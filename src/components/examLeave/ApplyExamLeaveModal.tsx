import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  GraduationCap,
  Info,
  X
} from 'lucide-react';
import {
  EXAM_TIMELINE_DATES,
  ICAB_PAPERS_CATALOG,
  examLeaveService,
  isCentralHoliday,
  LEVEL_ORDER,
  formatShortDate,
  getRecordPapers,
  levelsOfRecord,
  sameName,
  weekdayLetter
} from '../../services/examLeaveService';
import { ExamLevel, StaffExamLeaveRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isEmployeeProfile } from '../../lib/academicYear';
import { User } from '../../types';

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

  // Articled Student (STD) or Employee (EMP): taken from the person's account, not chosen here
  const [candidateType, setCandidateType] = useState<'Student' | 'Employee'>('Student');
  const typeOf = (u?: User | null): 'Student' | 'Employee' => (u && isEmployeeProfile(u.empId, u.designation) ? 'Employee' : 'Student');

  // Selected registered papers
  const [selectedPapers, setSelectedPapers] = useState<
    { code: string; name: string; date: string; level: ExamLevel; attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest' }[]
  >([]);

  // Dates
  const [startDate, setStartDate] = useState<string>('2026-11-01');
  const [lastExamDate, setLastExamDate] = useState<string>('2026-11-19');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [remarks, setRemarks] = useState<string>('');

  // Leave days per paper (1st / 2nd / 3rd+ attempt). Student: AL = 10 / 8 / 6, PL = 5 / 4 / 3, CL = 4 / 3 / 2. Employee: 2.
  const STUDENT_DAYS: Record<ExamLevel, [number, number, number]> = { AL: [10, 8, 6], PL: [5, 4, 3], CL: [4, 3, 2] };
  const daysFor = (level: ExamLevel, attempt: string, type: 'Student' | 'Employee'): number => {
    if (type === 'Employee') return 2;
    const [first, second, rest] = STUDENT_DAYS[level] ?? STUDENT_DAYS.PL;
    return attempt === '1st Attempt' ? first : attempt === '2nd Attempt' ? second : rest;
  };

  // Auto-calculate leave dates for the chosen papers.
  // Days per paper: see daysFor above.
  // Each paper's leave ENDS on its exam day and runs backwards. Working from the last exam to the first,
  // a day that is already taken by a later paper is skipped (the window slides earlier), so the total is
  // always the sum of the papers' days and nothing falls after the last exam. Papers far apart keep their
  // own separate blocks (the days in between stay working days).
  const calculateLeaveDates = (
    papers: { code: string; name: string; date: string; level: ExamLevel; attempt: string }[],
    type: 'Student' | 'Employee'
  ): string[] => {
    if (papers.length === 0) return [];
    const iso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const taken = new Set<string>();

    [...papers].sort((a, b) => b.date.localeCompare(a.date)).forEach(p => {
      const need = daysFor(p.level, p.attempt, type);
      const [y, m, d] = p.date.split('-').map(Number);
      let offset = 0;
      let got = 0;
      while (got < need) {
        const day = iso(new Date(y, m - 1, d - offset));
        offset++;
        if (taken.has(day)) continue;
        taken.add(day);
        got++;
      }
    });

    return Array.from(taken).sort();
  };

  // Records already saved: a person has ONE leave that can cover PL, AL and CL together
  const [savedRecords, setSavedRecords] = useState<StaffExamLeaveRecord[]>([]);
  useEffect(() => {
    if (isOpen) examLeaveService.getLeaves().then(setSavedRecords).catch(() => setSavedRecords([]));
  }, [isOpen]);
  const personRecord = savedRecords.find(r => sameName(r.name, candidateName) && r.id !== existingRecord?.id) || null;

  // The last exam is the end of the leave: nothing is added after it
  const lastExamIso = selectedPapers.length > 0 ? selectedPapers.map(p => p.date).sort().slice(-1)[0] : '';

  // Initialize or pre-fill every time the modal opens, so a previous application never carries over
  useEffect(() => {
    if (!isOpen) return;
    setSelectedPapers([]);
    setSelectedDates([]);
    setRemarks('');
    setCandidateType('Student');
    setStartDate('2026-11-01');
    setLastExamDate('2026-11-19');
    if (existingRecord) {
      setCandidateName(existingRecord.name);
      setCandidateClient(existingRecord.category);
      const person = allUsers.find(u => sameName(u.name, existingRecord.name));
      setCandidateType(person ? typeOf(person) : existingRecord.candidateType || 'Student');

      setStartDate(existingRecord.leaveStartDay !== '—' ? existingRecord.leaveStartDay : '2026-11-01');
      setLastExamDate(existingRecord.appearInLastExamDate !== '—' ? existingRecord.appearInLastExamDate : '2026-11-19');
      setSelectedDates([...existingRecord.leaveDates]);
      setRemarks(existingRecord.notes || '');

      // Bring back the papers and their attempt so they can be changed here
      setSelectedPapers(getRecordPapers(existingRecord));
    } else if (currentUser && isAdmin) {
      // Admin applies on behalf of someone: nobody is pre-selected (Admin is not a candidate)
      setCandidateName('');
      setSelectedUserId('');
      setCandidateClient('');
    } else if (currentUser) {
      setCandidateName(currentUser.name);
      setSelectedUserId(currentUser.id);
      setCandidateType(typeOf(currentUser));

      // Determine client name
      const userClients = (currentUser.assignedClientIds || [])
        .map(cid => allClients.find(c => c.id === cid)?.name)
        .filter(Boolean);
      setCandidateClient(userClients.join(', '));
    }
  }, [isOpen, existingRecord, currentUser, allClients, allUsers]);

  // When selected user changes (Admin applying for someone else)
  const handleUserChange = (uId: string) => {
    setSelectedUserId(uId);
    const u = allUsers.find(x => x.id === uId);
    if (u) {
      const type = typeOf(u);
      setCandidateType(type);
      if (selectedPapers.length > 0) applyCalculatedDates(calculateLeaveDates(selectedPapers, type), selectedPapers);
      setCandidateName(u.name);
      const userClients = (u.assignedClientIds || [])
        .map(cid => allClients.find(c => c.id === cid)?.name)
        .filter(Boolean);
      setCandidateClient(userClients.join(', '));
    }
  };

  // Every paper of every level: a person can sit PL, AL and CL papers in the same session
  const levelNames: Record<ExamLevel, string> = { PL: 'Professional Level (PL)', AL: 'Advanced Level (AL)', CL: 'Certificate Level (CL)' };
  const catalogByLevel = useMemo(
    () => LEVEL_ORDER.map(level => ({ level, papers: ICAB_PAPERS_CATALOG[level].map(p => ({ ...p, level })) })),
    []
  );

  // Toggle paper selection
  const togglePaper = (paper: { code: string; name: string; date: string; level: ExamLevel }) => {
    const exists = selectedPapers.find(x => x.code === paper.code && x.level === paper.level);
    let nextPapers: { code: string; name: string; date: string; level: ExamLevel; attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest' }[];

    if (exists) {
      nextPapers = selectedPapers.filter(x => !(x.code === paper.code && x.level === paper.level));
    } else {
      nextPapers = [...selectedPapers, { ...paper, attempt: '1st Attempt' }];
    }

    setSelectedPapers(nextPapers);
    const nextDates = calculateLeaveDates(nextPapers, candidateType);
    applyCalculatedDates(nextDates, nextPapers);
  };

  // Change paper attempt (for students)
  const handleAttemptChange = (level: ExamLevel, code: string, attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest') => {
    const nextPapers = selectedPapers.map(p => (p.code === code && p.level === level ? { ...p, attempt } : p));
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
    if (lastExamIso && dateStr > lastExamIso && !selectedDates.includes(dateStr)) return; // no leave after the last exam
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

    // Format subjects string: one block per level when the leave covers more than one
    const dayLabel = (p: { level: ExamLevel; attempt: string }) => `${daysFor(p.level, p.attempt, candidateType)} days`;
    const levelsPicked = LEVEL_ORDER.filter(l => selectedPapers.some(p => p.level === l));
    let formattedSubjects = '';
    if (selectedPapers.length > 0) {
      formattedSubjects = levelsPicked
        .map(l => {
          const lines = selectedPapers
            .filter(p => p.level === l)
            .map((p, idx) => (candidateType === 'Employee' ? `${idx + 1}. ${p.code} (2 days)` : `${idx + 1}. ${p.code} (${p.attempt} - ${dayLabel(p)})`));
          return levelsPicked.length > 1 ? [l, ...lines].join('\n') : lines.join('\n');
        })
        .join('\n');
    } else if (existingRecord?.subjects) {
      formattedSubjects = existingRecord.subjects;
    } else {
      formattedSubjects = 'General ICAB Revision';
    }

    const totalDaysLabel = `${selectedDates.length} Days`;
    const all = await examLeaveService.getLeaves();
    // One leave per person; to change it use Edit. A submitted leave is never overwritten from a new application.
    const existing = existingRecord || null;
    if (all.some(r => sameName(r.name, candidateName) && r.id !== existing?.id)) {
      alert(`A leave is already submitted for ${candidateName.trim()}. To change it, use Edit.`);
      return;
    }
    const recordId = existing?.id || `leave-${Date.now()}`;
    const sl = existing?.sl || Math.max(0, ...all.map(r => r.sl)) + 1;
    const recordLevel = levelsPicked.length > 0 ? levelsPicked.join(' & ') : (existing ? levelsOfRecord(existing).join(' & ') || existing.level : 'PL');

    const recordToSave: StaffExamLeaveRecord = {
      id: recordId,
      sl,
      name: candidateName.trim(),
      candidateType,
      category: candidateClient.trim() || 'General Client Assignment',
      subjects: formattedSubjects,
      papers: selectedPapers.length > 0 ? selectedPapers : existing?.papers,
      level: recordLevel,
      totalLeaveDays: totalDaysLabel,
      leaveStartDay: selectedDates.length > 0 ? selectedDates[0] : startDate,
      appearInLastExamDate: lastExamIso || lastExamDate,
      leaveDates: selectedDates,
      status: isAdmin ? 'Approved' : (existing?.status || 'Pending'),
      empId: existing?.empId || allUsers.find(u => u.id === selectedUserId)?.empId,
      userId: existing?.userId || selectedUserId || undefined,
      notes: remarks.trim()
    };

    try {
      await examLeaveService.saveLeave(recordToSave);
    } catch (err: any) {
      alert(err?.message || 'Could not save the leave. Please try again.');
      return;
    }
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
          {/* 1. Category comes from the account (STD = Articled Student, EMP = Employee); only the rule is shown */}
          <div style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginBottom: '16px', background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
            {candidateType === 'Student' ? (
              <span>
                <strong>Articled Student rule:</strong> AL: 1st attempt <strong>10 days</strong>, 2nd <strong>8</strong>, 3rd+ <strong>6</strong>. PL: 1st attempt <strong>5 days</strong>, 2nd <strong>4</strong>, 3rd+ <strong>3</strong>. CL: 1st attempt <strong>4 days</strong>, 2nd <strong>3</strong>, 3rd+ <strong>2</strong>. Each paper's days end on its exam day; the total is the sum of all papers (3 PL papers on the 1st attempt = 15 days). You can still adjust days by hand.
              </span>
            ) : (
              <span>
                <strong>Employee rule:</strong> every paper = <strong>2 days</strong>, ending on its exam day. The total is the sum of all papers.
              </span>
            )}
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
                  {allUsers.filter(u => u.status !== 'INACTIVE' && u.role !== 'ADMIN' && u.designation !== 'Partner').map(u => (
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

          {personRecord && (
            <div style={{ fontSize: '11.5px', marginBottom: '14px', padding: '6px 10px', borderRadius: '6px', background: '#FEE2E2', border: '1px solid #F87171', color: '#991B1B' }}>
              A leave is already submitted for {candidateName}. To add or change papers (any level), use Edit on that leave.
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
                maxHeight: '300px',
                overflowY: 'auto',
                background: '#FAF7F2',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {catalogByLevel.map(group => (
                <React.Fragment key={group.level}>
                  <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: group.level === 'PL' ? '#1B2A6B' : group.level === 'AL' ? '#8B1420' : '#1D8C8C', borderBottom: '1px solid #E5DED3', paddingBottom: '3px', marginTop: group.level === 'PL' ? 0 : '6px' }}>
                    {levelNames[group.level]}
                  </div>
                  {group.papers.map(paper => {
                    const paperItem = selectedPapers.find(p => p.code === paper.code && p.level === paper.level);
                    const isChecked = Boolean(paperItem);
                    const currentAttempt = paperItem?.attempt || '1st Attempt';
                return (
                  <div
                    key={`${paper.level}-${paper.code}`}
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
                          (Exam: {formatShortDate(paper.date)})
                        </span>
                      </span>
                    </label>

                    {isChecked && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {candidateType === 'Student' ? (
                          <select
                            value={currentAttempt}
                            onChange={e => handleAttemptChange(paper.level, paper.code, e.target.value as any)}
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
                            <option value="1st Attempt">1st Attempt ({daysFor(paper.level, '1st Attempt', 'Student')} Days)</option>
                            <option value="2nd Attempt">2nd Attempt ({daysFor(paper.level, '2nd Attempt', 'Student')} Days)</option>
                            <option value="3rd Attempt & rest">3rd+ Attempt ({daysFor(paper.level, '3rd Attempt & rest', 'Student')} Days)</option>
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
                </React.Fragment>
              ))}
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
                    ({formatShortDate(selectedDates[0])} to {formatShortDate(lastExamIso || lastExamDate)})
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                Click a date to add or remove it (no leave after the last exam)
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
                const afterLastExam = Boolean(lastExamIso) && d > lastExamIso && !isSelected;

                return (
                  <button
                    key={`sel-day-${d}`}
                    type="button"
                    onClick={() => toggleLeaveDay(d)}
                    disabled={afterLastExam}
                    style={{
                      padding: '4px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: afterLastExam ? 'not-allowed' : 'pointer',
                      opacity: afterLastExam ? 0.4 : 1,
                      border: isSelected
                        ? '1px solid #D9A441'
                        : isHoliday
                        ? '1px solid #D9AEAE'
                        : '1px solid #CBD5E1',
                      background: isSelected ? '#F7DC93' : isHoliday ? '#F6E3E3' : '#ffffff',
                      color: isSelected ? '#7A4B00' : isHoliday ? '#A94442' : 'var(--ink)'
                    }}
                    title={afterLastExam ? `${formatShortDate(d)}: after the last exam, no leave` : isSelected ? `${formatShortDate(d)} (${dayName}): Study Leave Day` : isHoliday ? `${formatShortDate(d)} (${dayName}): Holiday` : `${formatShortDate(d)} (${dayName}): Working Day`}
                  >
                    {formatShortDate(d)} ({dayName}) {isSelected ? '✓' : isHoliday ? 'OFF' : ''}
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
              disabled={Boolean(personRecord)}
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
