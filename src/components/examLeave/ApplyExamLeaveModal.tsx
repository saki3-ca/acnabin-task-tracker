import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  GraduationCap,
  Info,
  UserCheck,
  X
} from 'lucide-react';
import {
  EXAM_TIMELINE_DATES,
  ICAB_PAPERS_CATALOG,
  examLeaveService,
  isCentralHoliday,
  formatDayMonth,
  sameName,
  weekdayLetter
} from '../../services/examLeaveService';
import { ExamLevel, StaffExamLeaveRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface ApplyExamLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  existingRecord?: StaffExamLeaveRecord | null;
}

export const ApplyExamLeaveModal: React.FC<ApplyExamLeaveModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
  existingRecord
}) => {
  const { currentUser, allUsers, allClients } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  // Candidate identity
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
  const [candidateName, setCandidateName] = useState<string>(currentUser?.name || '');
  const [candidateClient, setCandidateClient] = useState<string>('');

  // Candidate Category: Articled Student vs Employee
  const [candidateType, setCandidateType] = useState<'Student' | 'Employee'>('Student');

  // Exam Level: Only PL, CL, AL (No CL & PL Combined)
  const [examLevel, setExamLevel] = useState<ExamLevel>('PL');

  // Selected registered papers
  const [selectedPapers, setSelectedPapers] = useState<
    { code: string; name: string; date: string; attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest' }[]
  >([]);

  // Dates
  const [startDate, setStartDate] = useState<string>('2026-11-01');
  const [lastExamDate, setLastExamDate] = useState<string>('2026-11-19');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [remarks, setRemarks] = useState<string>('');

  // Auto-calculate leave dates for given papers and candidate type
  // Rule:
  // - Employee: all subjects get 2 days (exam day + 1 day before: e.g. exam on 10 -> 9, 10)
  // - Student:
  //   1st attempt = 5 days (exam day + 4 days before: e.g. exam on 10 -> 6, 7, 8, 9, 10)
  //   2nd attempt = 4 days (exam day + 3 days before: e.g. exam on 10 -> 7, 8, 9, 10)
  //   3rd attempt & rest = 3 days (exam day + 2 days before: e.g. exam on 10 -> 8, 9, 10)
  const calculateLeaveDates = (
    papers: { code: string; name: string; date: string; attempt: string }[],
    type: 'Student' | 'Employee'
  ): string[] => {
    if (papers.length === 0) return [];
    const dateSet = new Set<string>();

    papers.forEach(p => {
      let daysCount = 2;
      if (type === 'Employee') {
        daysCount = 2;
      } else {
        if (p.attempt === '1st Attempt') daysCount = 5;
        else if (p.attempt === '2nd Attempt') daysCount = 4;
        else daysCount = 3;
      }

      const [y, m, d] = p.date.split('-').map(Number);
      // Exam day and (daysCount - 1) days before
      for (let offset = daysCount - 1; offset >= 0; offset--) {
        const dt = new Date(y, m - 1, d - offset);
        const yStr = dt.getFullYear();
        const mStr = String(dt.getMonth() + 1).padStart(2, '0');
        const dStr = String(dt.getDate()).padStart(2, '0');
        dateSet.add(`${yStr}-${mStr}-${dStr}`);
      }
    });

    return Array.from(dateSet).sort();
  };

  // Records already saved: a person can have one per level (PL, CL, AL)
  const [savedRecords, setSavedRecords] = useState<StaffExamLeaveRecord[]>([]);
  useEffect(() => {
    if (isOpen) examLeaveService.getLeaves().then(setSavedRecords).catch(() => setSavedRecords([]));
  }, [isOpen]);
  const sameLevelRecord = existingRecord
    ? null
    : savedRecords.find(r => sameName(r.name, candidateName) && r.level === examLevel) || null;
  const otherLevels = savedRecords
    .filter(r => sameName(r.name, candidateName) && r.level !== examLevel && r.id !== existingRecord?.id)
    .map(r => r.level);

  // Initialize or pre-fill every time the modal opens, so a previous application never carries over
  useEffect(() => {
    if (!isOpen) return;
    setSelectedPapers([]);
    setSelectedDates([]);
    setRemarks('');
    setExamLevel('PL');
    setCandidateType('Student');
    setStartDate('2026-11-01');
    setLastExamDate('2026-11-19');
    if (existingRecord) {
      setCandidateName(existingRecord.name);
      setCandidateClient(existingRecord.category);
      if (existingRecord.candidateType) {
        setCandidateType(existingRecord.candidateType);
      } else if (existingRecord.category?.toLowerCase().includes('employee')) {
        setCandidateType('Employee');
      } else {
        setCandidateType('Student');
      }

      if (['PL', 'CL', 'AL'].includes(existingRecord.level)) {
        setExamLevel(existingRecord.level as ExamLevel);
      }
      setStartDate(existingRecord.leaveStartDay !== '—' ? existingRecord.leaveStartDay : '2026-11-01');
      setLastExamDate(existingRecord.appearInLastExamDate !== '—' ? existingRecord.appearInLastExamDate : '2026-11-19');
      setSelectedDates([...existingRecord.leaveDates]);
      setRemarks(existingRecord.notes || '');

      // Bring back the papers and their attempt so they can be changed here. Records saved before papers were
      // stored are read back from their text ("1. FM (1st Attempt - 5 days)").
      if (existingRecord.papers && existingRecord.papers.length > 0) {
        setSelectedPapers(existingRecord.papers.map(p => ({ ...p })));
      } else if (['PL', 'CL', 'AL'].includes(existingRecord.level)) {
        const catalog = ICAB_PAPERS_CATALOG[existingRecord.level as ExamLevel];
        const parsed: { code: string; name: string; date: string; attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest' }[] = [];
        (existingRecord.subjects || '').split('\n').forEach(line => {
          const m = /^\s*\d+\.\s*(.+?)\s*\((.*)\)\s*$/.exec(line);
          if (!m) return;
          const paper = catalog.find(c => c.code.toLowerCase() === m[1].trim().toLowerCase());
          if (!paper || parsed.some(x => x.code === paper.code)) return;
          const attempt = /1st/i.test(m[2]) ? '1st Attempt' : /2nd/i.test(m[2]) ? '2nd Attempt' : '3rd Attempt & rest';
          parsed.push({ ...paper, attempt });
        });
        setSelectedPapers(parsed);
      }
    } else if (currentUser) {
      setCandidateName(currentUser.name);
      setSelectedUserId(currentUser.id);

      // Determine client name
      const userClients = (currentUser.assignedClientIds || [])
        .map(cid => allClients.find(c => c.id === cid)?.name)
        .filter(Boolean);
      setCandidateClient(userClients.join(', '));
    }
  }, [isOpen, existingRecord, currentUser, allClients]);

  // When selected user changes (Admin applying for someone else)
  const handleUserChange = (uId: string) => {
    setSelectedUserId(uId);
    const u = allUsers.find(x => x.id === uId);
    if (u) {
      setCandidateName(u.name);
      const userClients = (u.assignedClientIds || [])
        .map(cid => allClients.find(c => c.id === cid)?.name)
        .filter(Boolean);
      setCandidateClient(userClients.join(', '));
    }
  };

  // Available catalog papers based on exam level
  const availableCatalog = useMemo(() => {
    return (ICAB_PAPERS_CATALOG[examLevel] || []).map(p => ({ ...p, level: examLevel }));
  }, [examLevel]);

  // Handle Candidate Type change
  const handleCandidateTypeChange = (newType: 'Student' | 'Employee') => {
    setCandidateType(newType);
    if (selectedPapers.length > 0) {
      const dates = calculateLeaveDates(selectedPapers, newType);
      applyCalculatedDates(dates, selectedPapers);
    }
  };

  // Toggle paper selection
  const togglePaper = (paper: { code: string; name: string; date: string }) => {
    const exists = selectedPapers.find(x => x.code === paper.code);
    let nextPapers: { code: string; name: string; date: string; attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest' }[];

    if (exists) {
      nextPapers = selectedPapers.filter(x => x.code !== paper.code);
    } else {
      nextPapers = [...selectedPapers, { ...paper, attempt: '1st Attempt' }];
    }

    setSelectedPapers(nextPapers);
    const nextDates = calculateLeaveDates(nextPapers, candidateType);
    applyCalculatedDates(nextDates, nextPapers);
  };

  // Change paper attempt (for students)
  const handleAttemptChange = (code: string, attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest') => {
    const nextPapers = selectedPapers.map(p => (p.code === code ? { ...p, attempt } : p));
    setSelectedPapers(nextPapers);
    const nextDates = calculateLeaveDates(nextPapers, candidateType);
    applyCalculatedDates(nextDates, nextPapers);
  };

  // Apply auto-calculated dates
  const applyCalculatedDates = (
    dates: string[],
    papers: { code: string; name: string; date: string }[]
  ) => {
    if (dates.length > 0) {
      setSelectedDates(dates);
      setStartDate(dates[0]);
      const sortedExamDates = papers.map(p => p.date).sort();
      setLastExamDate(sortedExamDates[sortedExamDates.length - 1]);
    } else {
      setSelectedDates([]);
    }
  };

  // Manual toggle of individual leave day
  const toggleLeaveDay = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      const next = selectedDates.filter(d => d !== dateStr);
      setSelectedDates(next);
      if (next.length > 0) {
        setStartDate(next[0]);
      }
    } else {
      const next = [...selectedDates, dateStr].sort();
      setSelectedDates(next);
      setStartDate(next[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      alert('Candidate name is required.');
      return;
    }

    if (selectedDates.length === 0) {
      alert('Please select at least one paper or leave day.');
      return;
    }

    // Format subjects string
    let formattedSubjects = '';
    if (selectedPapers.length > 0) {
      formattedSubjects = selectedPapers
        .map((p, idx) => {
          if (candidateType === 'Employee') {
            return `${idx + 1}. ${p.code} (2 days)`;
          }
          const days = p.attempt === '1st Attempt' ? '5 days' : p.attempt === '2nd Attempt' ? '4 days' : '3 days';
          return `${idx + 1}. ${p.code} (${p.attempt} - ${days})`;
        })
        .join('\n');
    } else if (existingRecord?.subjects) {
      formattedSubjects = existingRecord.subjects;
    } else {
      formattedSubjects = 'General ICAB Revision';
    }

    const totalDaysLabel = `${selectedDates.length} Days`;
    const all = await examLeaveService.getLeaves();
    // One record per person per level (a PL, a CL and an AL leave sit side by side). A submitted leave is
    // never overwritten from this form, which would risk wrong data: changes go through Edit.
    const existing = existingRecord || null;
    if (!existing && all.some(r => sameName(r.name, candidateName) && r.level === examLevel)) {
      alert(`A ${examLevel} leave is already submitted for ${candidateName.trim()}. To change it, use Edit in the Action column.`);
      return;
    }
    const recordId = existing?.id || `leave-${Date.now()}`;
    const sl = existing?.sl || Math.max(0, ...all.map(r => r.sl)) + 1;

    const recordToSave: StaffExamLeaveRecord = {
      id: recordId,
      sl,
      name: candidateName.trim(),
      candidateType,
      category: candidateClient.trim() || 'General Client Assignment',
      subjects: formattedSubjects,
      papers: selectedPapers.length > 0 ? selectedPapers : existing?.papers,
      level: examLevel,
      totalLeaveDays: totalDaysLabel,
      leaveStartDay: selectedDates.length > 0 ? selectedDates[0] : startDate,
      appearInLastExamDate: lastExamDate,
      leaveDates: selectedDates,
      status: isAdmin ? 'Approved' : (existing?.status || 'Pending'),
      empId: existing?.empId || allUsers.find(u => u.id === selectedUserId)?.empId,
      notes: remarks.trim()
    };

    await examLeaveService.saveLeave(recordToSave);
    onSubmitted();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Banner Strip Header */}
        <div className="banner-strip banner-maroon" style={{ justifyContent: 'space-between', padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GraduationCap size={18} />
            <span>{existingRecord ? 'EDIT EXAM LEAVE APPLICATION' : 'APPLY FOR ICAB EXAM LEAVE'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* 1. Candidate Category: Articled Student vs Employee */}
          <div className="form-field" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--ink)' }}>
              Candidate Category
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleCandidateTypeChange('Student')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: candidateType === 'Student' ? '2px solid var(--maroon)' : '1px solid var(--line)',
                  background: candidateType === 'Student' ? '#F9E8EA' : '#FAF7F2',
                  color: candidateType === 'Student' ? 'var(--maroon)' : 'var(--ink)'
                }}
              >
                <GraduationCap size={16} />
                <span>Articled Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleCandidateTypeChange('Employee')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: candidateType === 'Employee' ? '2px solid var(--maroon)' : '1px solid var(--line)',
                  background: candidateType === 'Employee' ? '#F9E8EA' : '#FAF7F2',
                  color: candidateType === 'Employee' ? 'var(--maroon)' : 'var(--ink)'
                }}
              >
                <UserCheck size={16} />
                <span>Employee / Audit Staff</span>
              </button>
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: '6px', background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              {candidateType === 'Student' ? (
                <span>
                  <strong>Student Rule:</strong> 1st attempt = <strong>5 days</strong>, 2nd attempt = <strong>4 days</strong>, 3rd+ attempt = <strong>3 days</strong> (exam day & days before).
                </span>
              ) : (
                <span>
                  <strong>Employee Rule:</strong> All subjects leave = <strong>2 days</strong> per paper (exam day & 1 day before).
                </span>
              )}
            </div>
          </div>

          {/* 2. Candidate Profile Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            {isAdmin && !existingRecord ? (
              <div className="form-field">
                <label>Select Candidate</label>
                <select
                  value={selectedUserId}
                  onChange={e => handleUserChange(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">Select candidate…</option>
                  {allUsers.filter(u => u.status !== 'INACTIVE').map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.designation})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-field">
                <label>Candidate Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={candidateName}
                  onChange={e => setCandidateName(e.target.value)}
                  readOnly={!isAdmin}
                  style={{ background: !isAdmin ? 'var(--cream-card)' : '#fff' }}
                  required
                />
              </div>
            )}

            {/* Client (replaces Team) */}
            <div className="form-field">
              <label>Assigned Client</label>
              <input
                type="text"
                className="form-input"
                value={candidateClient}
                onChange={e => setCandidateClient(e.target.value)}
                placeholder="Client Name or Team..."
                required
              />
            </div>
          </div>

          {/* 3. Exam Level Radios (Only PL, CL, AL - No CL & PL Combined) */}
          <div className="form-field" style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
              ICAB Examination Level
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { id: 'PL', label: 'Professional Level (PL)' },
                { id: 'CL', label: 'Certificate Level (CL)' },
                { id: 'AL', label: 'Advanced Level (AL)' }
              ].map(lvl => (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={Boolean(existingRecord) && examLevel !== lvl.id}
                  onClick={() => {
                    setExamLevel(lvl.id as ExamLevel);
                    setSelectedPapers([]);
                    setSelectedDates([]);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: examLevel === lvl.id ? '1.5px solid var(--maroon)' : '1px solid var(--line)',
                    background: examLevel === lvl.id ? '#F9E8EA' : '#FAF7F2',
                    color: examLevel === lvl.id ? 'var(--maroon)' : 'var(--ink)'
                  }}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {(sameLevelRecord || otherLevels.length > 0) && (
            <div style={{ fontSize: '11.5px', marginTop: '-8px', marginBottom: '14px', padding: '6px 10px', borderRadius: '6px', background: sameLevelRecord ? '#FEE2E2' : '#EFF6FF', border: `1px solid ${sameLevelRecord ? '#F87171' : '#BFDBFE'}`, color: sameLevelRecord ? '#991B1B' : '#1E40AF' }}>
              {sameLevelRecord
                ? `A ${examLevel} leave is already submitted for ${candidateName}. To change it, use Edit in the Action column.`
                : `Already saved: ${otherLevels.join(', ')}. This will be added as a separate ${examLevel} leave.`}
            </div>
          )}

          {/* 4. Papers / Subjects Selector with Attempt Dropdown */}
          <div className="form-field" style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700 }}>
                Select Registered Papers ({selectedPapers.length} selected)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                Leave dates calculated automatically
              </span>
            </div>

            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '10px 14px',
                maxHeight: '210px',
                overflowY: 'auto',
                background: '#FAF7F2',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {availableCatalog.map(paper => {
                const isChecked = selectedPapers.some(p => p.code === paper.code);
                const paperItem = selectedPapers.find(p => p.code === paper.code);
                const currentAttempt = paperItem?.attempt || '1st Attempt';

                // Display days info
                let daysLabel = '';
                if (candidateType === 'Employee') {
                  daysLabel = '2 days leave';
                } else {
                  daysLabel = currentAttempt === '1st Attempt' ? '5 days leave' : currentAttempt === '2nd Attempt' ? '4 days leave' : '3 days leave';
                }

                return (
                  <div
                    key={paper.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isChecked ? '#ffffff' : 'transparent',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: isChecked ? '1px solid #CBD5E1' : '1px solid transparent'
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        fontWeight: isChecked ? 600 : 400,
                        flex: 1
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePaper(paper)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--maroon)' }}
                      />
                      <span>
                        <strong>{paper.code}</strong> — {paper.name}{' '}
                        <span style={{ color: 'var(--ink-muted)', fontSize: '11px' }}>
                          (Exam: {paper.date})
                        </span>
                      </span>
                    </label>

                    {isChecked && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {candidateType === 'Student' ? (
                          <select
                            value={currentAttempt}
                            onChange={e => handleAttemptChange(paper.code, e.target.value as any)}
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--line)',
                              background: '#fff',
                              color: 'var(--ink)'
                            }}
                          >
                            <option value="1st Attempt">1st Attempt (5 Days)</option>
                            <option value="2nd Attempt">2nd Attempt (4 Days)</option>
                            <option value="3rd Attempt & rest">3rd+ Attempt (3 Days)</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#E0F2FE',
                              color: '#0369A1',
                              border: '1px solid #BAE6FD'
                            }}
                          >
                            2 Days Leave
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Leave Summary & Interactive Day Toggles */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--maroon)' }}>
                  Total Leave Days: {selectedDates.length} Days
                </span>
                {selectedDates.length > 0 && (
                  <span style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginLeft: '10px' }}>
                    ({formatDayMonth(selectedDates[0])} to {formatDayMonth(lastExamDate)})
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                Click date to toggle manually if needed
              </span>
            </div>

            {/* Interactive Working Days Toggle */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                maxHeight: '130px',
                overflowY: 'auto',
                padding: '8px',
                background: '#ffffff',
                borderRadius: '6px',
                border: '1px solid var(--line)'
              }}
            >
              {EXAM_TIMELINE_DATES.map(d => {
                const isHoliday = isCentralHoliday(d);
                const isSelected = selectedDates.includes(d);
                const dayName = weekdayLetter(d);

                return (
                  <button
                    key={`sel-day-${d}`}
                    type="button"
                    onClick={() => toggleLeaveDay(d)}
                    style={{
                      padding: '4px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid #CA8A04'
                        : isHoliday
                        ? '1px solid #FCA5A5'
                        : '1px solid #CBD5E1',
                      background: isSelected ? '#FEF08A' : isHoliday ? '#FEE2E2' : '#ffffff',
                      color: isSelected ? '#713F12' : isHoliday ? '#DC2626' : 'var(--ink)'
                    }}
                    title={isSelected ? `${d} (${dayName}): Study Leave Day` : isHoliday ? `${d} (${dayName}): Holiday` : `${d} (${dayName}): Working Day`}
                  >
                    {formatDayMonth(d)} ({dayName}) {isSelected ? '✓' : isHoliday ? 'OFF' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Remarks */}
          <div className="form-field" style={{ marginBottom: '20px' }}>
            <label>Additional Notes / Remarks</label>
            <input
              type="text"
              className="form-input"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Special revision days, supervisor discussed..."
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ height: '38px', padding: '0 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(sameLevelRecord)}
              className="btn btn-primary"
              style={{
                height: '38px',
                padding: '0 20px',
                background: 'var(--maroon)',
                borderColor: 'var(--maroon)'
              }}
            >
              {existingRecord ? 'Update' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
