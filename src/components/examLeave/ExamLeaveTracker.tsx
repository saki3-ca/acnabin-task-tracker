import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  Download,
  Filter,
  GraduationCap,
  Info,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X
} from 'lucide-react';
import {
  EXAM_TIMELINE_DATES,
  ICAB_OFF_DAYS,
  OFFICIAL_ICAB_SCHEDULE,
  countsAsLeave,
  examLeaveService,
  sameName,
  weekdayLetter
} from '../../services/examLeaveService';
import { StaffExamLeaveRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { canViewAllClients, getUserAssignedClientIds } from '../../lib/permissions';
import { ApplyExamLeaveModal } from './ApplyExamLeaveModal';

const formatRoutineDate = (dateStr: string, dayName: string) => {
  const [y, m, d] = dateStr.split('-');
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[Number(m)] || m;
  return `${d} ${month} ${y}, ${dayName}`;
};

export const ExamLeaveTracker: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [allRecords, setRecords] = useState<StaffExamLeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'matrix' | 'roster' | 'routine'>('matrix');

  // Filters (Changed "Team" to "Client")
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  // Interactive Date Inspector
  const [inspectedDate, setInspectedDate] = useState<string>('2026-11-12');

  // Modals & Drawers
  const [editingRecord, setEditingRecord] = useState<StaffExamLeaveRecord | null>(null);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [routineModalTab, setRoutineModalTab] = useState<'PL_AL' | 'CL'>('PL_AL');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRecordForApplication, setSelectedRecordForApplication] = useState<StaffExamLeaveRecord | null>(null);
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<StaffExamLeaveRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  // My existing record if logged in as student or employee
  const myExistingRecord = useMemo(() => {
    if (!currentUser) return null;
    return allRecords.find(r => sameName(r.name, currentUser.name));
  }, [allRecords, currentUser]);

  // Assistant Directors and above (and Admin) see everyone. Everyone else sees only the people who share
  // one of their clients, plus themselves.
  const canSeeEveryone = canViewAllClients(currentUser);
  const teamUsers = useMemo(() => {
    if (!currentUser) return [];
    const mine = new Set(getUserAssignedClientIds(currentUser));
    return allUsers.filter(
      u => u.status !== 'INACTIVE' && u.role !== 'ADMIN' && (u.id === currentUser.id || getUserAssignedClientIds(u).some(id => mine.has(id)))
    );
  }, [allUsers, currentUser]);
  const records = useMemo(() => {
    if (canSeeEveryone) return allRecords;
    return allRecords.filter(r => sameName(r.name, currentUser?.name) || teamUsers.some(u => sameName(u.name, r.name)));
  }, [allRecords, canSeeEveryone, teamUsers, currentUser]);

  const handleApprove = async (id: string) => {
    await examLeaveService.approveLeave(id);
    await loadLeaves();
  };

  const handleDelete = async (record: StaffExamLeaveRecord) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete the exam leave of ${record.name}? This cannot be undone.`)) return;
    await examLeaveService.deleteLeave(record.id);
    setSelectedStudentForDrawer(null);
    await loadLeaves();
  };

  const handleReject = async (id: string) => {
    if (window.confirm('Are you sure you want to reject this leave application?')) {
      await examLeaveService.rejectLeave(id);
      await loadLeaves();
    }
  };

  // Form edit state
  const [editSubjects, setEditSubjects] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editTotalDays, setEditTotalDays] = useState('');
  const [editLeaveStart, setEditLeaveStart] = useState('');
  const [editLastExam, setEditLastExam] = useState('');
  const [editDates, setEditDates] = useState<string[]>([]);
  const [editClient, setEditClient] = useState('');

  const matrixScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await examLeaveService.getLeaves();
      setRecords(data);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await examLeaveService.exportToExcel(records, EXAM_TIMELINE_DATES, totalStaffCount);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export leave matrix to Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Reset all leave records to the official template data? Custom edits will be overwritten.')) {
      setLoading(true);
      const def = await examLeaveService.resetToDefaults();
      setRecords(def);
      setLoading(false);
    }
  };

  const handleOpenEdit = (record: StaffExamLeaveRecord) => {
    setEditingRecord(record);
    setEditSubjects(record.subjects);
    setEditLevel(record.level);
    setEditTotalDays(record.totalLeaveDays);
    setEditLeaveStart(record.leaveStartDay);
    setEditLastExam(record.appearInLastExamDate);
    setEditDates([...record.leaveDates]);
    setEditClient(record.category);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    const updated: StaffExamLeaveRecord = {
      ...editingRecord,
      category: editClient,
      subjects: editSubjects,
      level: editLevel,
      totalLeaveDays: editTotalDays || `${editDates.length} Days`,
      leaveStartDay: editLeaveStart,
      appearInLastExamDate: editLastExam,
      leaveDates: editDates
    };
    await examLeaveService.saveLeave(updated);
    setEditingRecord(null);
    await loadLeaves();
  };

  const toggleDateInEdit = (dateStr: string) => {
    if (editDates.includes(dateStr)) {
      setEditDates(editDates.filter(d => d !== dateStr));
    } else {
      setEditDates([...editDates, dateStr].sort());
    }
  };

  const scrollToCrunch = () => {
    setViewMode('matrix');
    setInspectedDate('2026-11-12');
    setTimeout(() => {
      const el = document.getElementById('matrix-col-2026-11-08');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 150);
  };

  // Distinct clients list for filter
  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.category && r.category.trim()) {
        set.add(r.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [records]);

  // Distinct levels list
  const uniqueLevels = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.level && r.level.trim() && r.level !== '—') {
        set.add(r.level.trim());
      }
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = r.name.toLowerCase().includes(term);
        const matchesClient = r.category.toLowerCase().includes(term);
        const matchesSubject = r.subjects.toLowerCase().includes(term);
        if (!matchesName && !matchesClient && !matchesSubject) return false;
      }

      if (selectedClient) {
        if (!r.category.toLowerCase().includes(selectedClient.toLowerCase())) {
          return false;
        }
      }

      if (selectedLevel) {
        if (r.level !== selectedLevel) {
          return false;
        }
      }

      return true;
    });
  }, [records, searchTerm, selectedClient, selectedLevel]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedClient('');
    setSelectedLevel('');
  };

  const hasActiveFilters = Boolean(searchTerm || selectedClient || selectedLevel);

  // Statistics
  // Rejected applications do not take anyone out of the office.
  const leaveRecords = useMemo(() => records.filter(countsAsLeave), [records]);
  // In-office headcount is all active staff, not just the people who applied for leave.
  const totalStaffCount = useMemo(() => {
    const staff = canSeeEveryone ? allUsers.filter(u => u.status !== 'INACTIVE' && u.role !== 'ADMIN').length : teamUsers.length;
    return Math.max(staff, leaveRecords.length);
  }, [allUsers, teamUsers, canSeeEveryone, leaveRecords]);
  const peakLeaveInfo = useMemo(() => {
    let maxOnLeave = 0;
    let peakDate = '2026-11-12';
    for (const d of EXAM_TIMELINE_DATES) {
      if (ICAB_OFF_DAYS.has(d)) continue;
      const count = leaveRecords.filter(r => r.leaveDates.includes(d)).length;
      if (count > maxOnLeave) {
        maxOnLeave = count;
        peakDate = d;
      }
    }
    const minAvailable = Math.max(0, totalStaffCount - maxOnLeave);
    return { maxOnLeave, peakDate, minAvailable };
  }, [leaveRecords, totalStaffCount]);

  // Day columns available manpower map
  const dailyAvailabilityMap = useMemo(() => {
    const map = new Map<string, { onLeave: number; available: number }>();
    for (const d of EXAM_TIMELINE_DATES) {
      const onLeaveCount = leaveRecords.filter(r => r.leaveDates.includes(d)).length;
      map.set(d, {
        onLeave: onLeaveCount,
        available: totalStaffCount - onLeaveCount
      });
    }
    return map;
  }, [leaveRecords, totalStaffCount]);

  return (
    <div className="tab-pane">
      {/* 1. TOP ROW: 5-SLOT GRID MATCHING MANPOWER & TEAM TASKS EXACT HEIGHT & PROPORTIONS */}
      <div className="stat-pills">
        {/* Pill 1: Total Candidates */}
        <div className="stat-pill">
          <span className="stat-pill-label">ACTIVE CANDIDATES</span>
          <span className="stat-pill-value">
            {String(records.length).padStart(2, '0')}
          </span>
        </div>

        {/* Pill 2: On Leave Peak */}
        <div className="stat-pill">
          <span className="stat-pill-label">PEAK ON LEAVE</span>
          <span className="stat-pill-value" style={{ color: 'var(--maroon, #800000)' }}>
            {String(peakLeaveInfo.maxOnLeave).padStart(2, '0')}
          </span>
        </div>

        {/* Pill 3: Available Capacity */}
        <div className="stat-pill">
          <span className="stat-pill-label">MIN IN-OFFICE</span>
          <span className="stat-pill-value" style={{ color: '#03543F' }}>
            {String(peakLeaveInfo.minAvailable).padStart(2, '0')} / {String(totalStaffCount).padStart(2, '0')}
          </span>
        </div>

        {/* Pill 4: Critical Window */}
        <div className="stat-pill">
          <span className="stat-pill-label">CRITICAL CRUNCH</span>
          <span className="stat-pill-value" style={{ color: 'var(--navy, #1B2A6B)', fontSize: '20px' }}>
            {records.length > 0 ? '08 – 14 Nov' : '—'}
          </span>
        </div>

        {/* Slot 5: Liquid Glass Segmented View Switcher (Matching Manpower Slot 5 Exactly) */}
        <div
          className="stat-pill"
          style={{
            padding: '6px 8px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(253, 248, 248, 0.92) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1.5px solid var(--maroon, #800000)',
            boxShadow: '0 2px 8px rgba(128, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'stretch',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              background: 'rgba(244, 240, 240, 0.75)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '8px',
              padding: '3px',
              gap: '4px',
              boxSizing: 'border-box',
              border: '1px solid rgba(128, 0, 0, 0.14)',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.06)'
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: viewMode === 'matrix' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                cursor: 'pointer',
                background: viewMode === 'matrix'
                  ? 'linear-gradient(180deg, #8C1414 0%, #800000 60%, #680000 100%)'
                  : 'transparent',
                color: viewMode === 'matrix' ? '#ffffff' : 'var(--ink-soft)',
                boxShadow: viewMode === 'matrix'
                  ? '0 3px 10px rgba(128, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5), inset 0 -1px 2px rgba(0, 0, 0, 0.25)'
                  : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Daily 36-day timeline matrix"
            >
              <Calendar size={13} /> Matrix
            </button>

            <button
              type="button"
              onClick={() => setViewMode('roster')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: viewMode === 'roster' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                cursor: 'pointer',
                background: viewMode === 'roster'
                  ? 'linear-gradient(180deg, #8C1414 0%, #800000 60%, #680000 100%)'
                  : 'transparent',
                color: viewMode === 'roster' ? '#ffffff' : 'var(--ink-soft)',
                boxShadow: viewMode === 'roster'
                  ? '0 3px 10px rgba(128, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5), inset 0 -1px 2px rgba(0, 0, 0, 0.25)'
                  : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Candidate roster and details"
            >
              <Users size={13} /> Roster
            </button>

            <button
              type="button"
              onClick={() => setViewMode('routine')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: viewMode === 'routine' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                cursor: 'pointer',
                background: viewMode === 'routine'
                  ? 'linear-gradient(180deg, #8C1414 0%, #800000 60%, #680000 100%)'
                  : 'transparent',
                color: viewMode === 'routine' ? '#ffffff' : 'var(--ink-soft)',
                boxShadow: viewMode === 'routine'
                  ? '0 3px 10px rgba(128, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5), inset 0 -1px 2px rgba(0, 0, 0, 0.25)'
                  : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Official ICAB routine schedule"
            >
              <BookOpen size={13} /> Routine
            </button>
          </div>
        </div>
      </div>

      {/* 2. FILTER BAR (Matching Manpower Filter Bar Exactly) */}
      <div
        className="filter-bar"
        style={{
          display: viewMode === 'routine' ? 'none' : 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '12px 18px',
          borderRadius: '8px',
          border: '1px solid var(--line)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-soft)'
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', height: '36px', fontSize: '12.5px', width: '100%' }}
              placeholder="Search by candidate name or subject…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Client Filter (Replaced Team with Client) */}
          <div style={{ minWidth: '180px', flex: '1 1 180px' }}>
            <select
              className="form-select"
              style={{ height: '36px', fontSize: '12.5px', width: '100%' }}
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
            >
              <option value="">All Assigned Clients</option>
              {uniqueClients.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Level Filter */}
          <div style={{ minWidth: '160px', flex: '1 1 160px' }}>
            <select
              className="form-select"
              style={{ height: '36px', fontSize: '12.5px', width: '100%' }}
              value={selectedLevel}
              onChange={e => setSelectedLevel(e.target.value)}
            >
              <option value="">All Exam Levels</option>
              {uniqueLevels.map(l => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn btn-secondary btn-sm"
              style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
              title="Reset all filters"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        <div style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
          Showing {filteredRecords.length} of {records.length} candidates
        </div>
      </div>

      {/* 3. MAIN TABLE CARD (Matching Manpower Directory Table Card Exactly) */}
      {viewMode === 'matrix' && (
        <div style={{ position: 'relative' }}>
          {/* the legend sits in the gap above the title bar, so the space between filter bar and table stays the same as Manpower */}
          <div style={{ position: 'absolute', right: '2px', bottom: '100%', marginBottom: '7px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '1px 9px', borderRadius: '10px', background: '#FEF9C3', border: '1px solid #CA8A04', color: '#854D0E', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EAB308', display: 'inline-block' }} />
                Study Leave
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '1px 9px', borderRadius: '10px', background: '#FEE2E2', border: '1px solid #DC2626', color: '#991B1B', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
                Holiday
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '1px 9px', borderRadius: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8', display: 'inline-block' }} />
                Working day
              </span>
            </div>
          </div>

          <div className="table-card" style={{ marginBottom: 0 }}>
            {/* Banner Strip matching Manpower Directory Banner */}
            <div className="banner-strip banner-maroon" style={{ justifyContent: 'center', padding: '0 16px' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  padding: '2px 9px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399' }} />
                ICAB Routine Active
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={16} />
                <span>CENTRAL EXAM LEAVE MANAGEMENT</span>
              </div>

              <div style={{ position: 'absolute', right: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecordForApplication(myExistingRecord || null);
                    setIsApplyModalOpen(true);
                  }}
                  style={{
                    background: '#F59E0B',
                    color: '#1F2937',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                  }}
                >
                  <Pencil size={12} />
                  {myExistingRecord ? 'Update My Leave' : 'Apply for Leave'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsRoutineModalOpen(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <BookOpen size={13} />
                  Exam Routine
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  style={{
                    background: '#ffffff',
                    color: 'var(--maroon, #800000)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                  }}
                >
                  <Download size={13} />
                  {exporting ? 'Exporting…' : 'Export Excel'}
                </button>
              </div>
            </div>

            {/* Matrix Scrollable Table */}
            <div
              ref={matrixScrollRef}
              style={{
                overflowX: 'auto',
                maxHeight: '660px',
                position: 'relative'
              }}
            >
            <table
              className="task-table"
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '12px',
                textAlign: 'left'
              }}
            >
              <thead>
                {/* Main Column Header Row (CLIENT replaces Team / Category) */}
                <tr style={{ background: '#FAF7F2', position: 'sticky', top: 0, zIndex: 12 }}>
                  <th style={{ position: 'sticky', left: 0, zIndex: 13, background: '#FAF7F2', width: '38px', textAlign: 'center', padding: '10px 4px', borderRight: '1px solid var(--line)', color: 'var(--maroon)' }}>
                    SL.
                  </th>
                  <th style={{ position: 'sticky', left: '38px', zIndex: 13, background: '#FAF7F2', minWidth: '190px', padding: '10px 12px', borderRight: '1px solid var(--line)', color: 'var(--maroon)' }}>
                    NAME
                  </th>
                  <th style={{ position: 'sticky', left: '228px', zIndex: 13, background: '#FAF7F2', minWidth: '140px', padding: '10px 10px', borderRight: '1px solid var(--line)', color: 'var(--maroon)' }}>
                    CLIENT
                  </th>
                  <th style={{ minWidth: '70px', textAlign: 'center', padding: '10px 6px', borderRight: '1px solid var(--line)', color: 'var(--maroon)' }}>
                    LEVEL
                  </th>
                  <th style={{ minWidth: '85px', textAlign: 'center', padding: '10px 6px', borderRight: '2px solid #CBD5E1', color: 'var(--maroon)' }}>
                    TOTAL LEAVE
                  </th>

                  {/* 36 Date Columns */}
                  {EXAM_TIMELINE_DATES.map(dateStr => {
                    const isFri = ICAB_OFF_DAYS.has(dateStr);
                    const isSelected = dateStr === inspectedDate;
                    const dayName = weekdayLetter(dateStr);
                    const dayNum = dateStr.slice(8);
                    const monthName = dateStr.slice(5, 7) === '10' ? 'Oct' : 'Nov';

                    return (
                      <th
                        id={`matrix-col-${dateStr}`}
                        key={`col-${dateStr}`}
                        onClick={() => setInspectedDate(dateStr)}
                        style={{
                          minWidth: '38px',
                          textAlign: 'center',
                          padding: '6px 2px',
                          borderRight: '1px solid var(--line)',
                          cursor: 'pointer',
                          background: isSelected
                            ? '#3B82F6'
                            : isFri
                            ? '#991B1B'
                            : '#FAF7F2',
                          color: isSelected || isFri ? '#ffffff' : 'var(--ink)',
                          transition: 'background 0.2s'
                        }}
                        title={`Click to inspect ${dateStr}`}
                      >
                        <div style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.8 }}>
                          {dayName}
                        </div>
                        <div style={{ fontSize: '11.5px', fontWeight: 700 }}>
                          {dayNum}
                        </div>
                        <div style={{ fontSize: '8px', opacity: 0.7 }}>
                          {monthName}
                        </div>
                      </th>
                    );
                  })}

                  <th style={{ minWidth: '140px', textAlign: 'center', padding: '10px 6px', background: '#FAF7F2', color: 'var(--maroon)' }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={EXAM_TIMELINE_DATES.length + 6}
                      style={{
                        padding: '60px 20px',
                        textAlign: 'center',
                        background: '#ffffff'
                      }}
                    >
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: '#F9E8EA',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 14px',
                          color: 'var(--maroon)'
                        }}
                      >
                        <GraduationCap size={28} />
                      </div>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy)', marginBottom: '6px' }}>
                        No Exam Leave Records Found
                      </h3>
                      <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', maxWidth: '420px', margin: '0 auto 16px' }}>
                        All previous data has been reset for a fresh start. Students and employees can now submit their ICAB exam leave applications.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecordForApplication(null);
                          setIsApplyModalOpen(true);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '8px 18px', fontSize: '12.5px', fontWeight: 700 }}
                      >
                        <Pencil size={13} style={{ marginRight: '6px' }} />
                        Apply for Exam Leave
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg = isEven ? '#ffffff' : '#FAF9F6';
                    return (
                      <tr
                        key={record.id}
                        style={{
                          background: rowBg,
                          transition: 'background 0.15s'
                        }}
                      >
                      {/* SL */}
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          background: rowBg,
                          textAlign: 'center',
                          padding: '9px 4px',
                          borderBottom: '1px solid #E2E8F0',
                          borderRight: '1px solid #E2E8F0',
                          fontWeight: 600,
                          color: 'var(--ink-muted)'
                        }}
                      >
                        {record.sl}
                      </td>

                      {/* Candidate Name */}
                      <td
                        style={{
                          position: 'sticky',
                          left: '38px',
                          zIndex: 10,
                          background: rowBg,
                          padding: '9px 12px',
                          borderBottom: '1px solid #E2E8F0',
                          borderRight: '1px solid #E2E8F0',
                          fontWeight: 600,
                          color: 'var(--navy)'
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => setSelectedStudentForDrawer(record)}
                        >
                          <span style={{ textDecoration: 'underline', textDecorationColor: '#CBD5E1' }}>
                            {record.name}
                          </span>
                          <Info size={13} color="var(--ink-muted)" />
                        </div>
                      </td>

                      {/* Client (Replaced Team / Category) */}
                      <td
                        style={{
                          position: 'sticky',
                          left: '228px',
                          zIndex: 10,
                          background: rowBg,
                          padding: '9px 10px',
                          borderBottom: '1px solid #E2E8F0',
                          borderRight: '1px solid #E2E8F0',
                          color: 'var(--ink-soft)',
                          fontSize: '11.5px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {record.category}
                      </td>

                      {/* Level */}
                      <td
                        style={{
                          textAlign: 'center',
                          padding: '9px 4px',
                          borderBottom: '1px solid #E2E8F0',
                          borderRight: '1px solid #E2E8F0'
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            background:
                              record.level === 'PL'
                                ? '#EBEFFE'
                                : record.level === 'CL'
                                ? '#E6F5F5'
                                : record.level === 'AL'
                                ? '#F9E8EA'
                                : '#FEF3C7',
                            color:
                              record.level === 'PL'
                                ? '#1B2A6B'
                                : record.level === 'CL'
                                ? '#1D8C8C'
                                : record.level === 'AL'
                                ? '#8B1420'
                                : '#92400E'
                          }}
                        >
                          {record.level}
                        </span>
                      </td>

                      {/* Total Leave */}
                      <td
                        style={{
                          textAlign: 'center',
                          padding: '9px 4px',
                          borderBottom: '1px solid #E2E8F0',
                          borderRight: '2px solid #CBD5E1',
                          fontWeight: 700,
                          color: record.leaveDates.length > 0 ? '#B45309' : 'var(--ink-muted)'
                        }}
                      >
                        {record.totalLeaveDays}
                      </td>

                      {/* 36 Date Cells */}
                      {EXAM_TIMELINE_DATES.map(dateStr => {
                        const isOnLeave = record.leaveDates.includes(dateStr);
                        const isOffDay = ICAB_OFF_DAYS.has(dateStr);
                        const isSelectedCol = dateStr === inspectedDate;

                        return (
                          <td
                            key={`cell-${record.id}-${dateStr}`}
                            onClick={() => setInspectedDate(dateStr)}
                            style={{
                              textAlign: 'center',
                              padding: '8px 2px',
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              cursor: 'pointer',
                              background: isOnLeave
                                ? '#FEF08A'
                                : isOffDay
                                ? '#FEE2E2'
                                : isSelectedCol
                                ? '#EFF6FF'
                                : 'transparent',
                              color: isOnLeave ? '#854D0E' : isOffDay ? '#DC2626' : 'var(--ink-muted)',
                              fontWeight: isOnLeave ? 800 : 400,
                              fontSize: isOnLeave ? '12px' : '10px'
                            }}
                            title={`${record.name} on ${dateStr}: ${isOnLeave ? 'Study Leave' : isOffDay ? 'Holiday' : 'Working day'}`}
                          >
                            {isOnLeave ? (
                              <span style={{ display: 'inline-block', width: '100%', height: '16px' }} />
                            ) : isOffDay ? (
                              <span style={{ opacity: 0.35 }}>—</span>
                            ) : (
                              <span style={{ opacity: 0.2 }}>•</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td
                        style={{
                          textAlign: 'center',
                          padding: '6px',
                          borderBottom: '1px solid #E2E8F0'
                        }}
                      >
                        {isAdmin && <div style={{ display: 'inline-flex', gap: '4px' }}><button
                          onClick={() => handleOpenEdit(record)}
                          title="Edit leave details"
                          style={{
                            padding: '3px 7px',
                            borderRadius: '4px',
                            border: '1px solid var(--line)',
                            background: '#ffffff',
                            color: 'var(--navy)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(record)}
                          title="Delete this leave"
                          aria-label={`Delete leave of ${record.name}`}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '4px',
                            border: '1px solid #FCA5A5',
                            background: '#ffffff',
                            color: '#B91C1C',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Trash2 size={11} />
                          Delete
                        </button></div>}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>

              {/* Matrix Table Footer Summary Rows */}
              <tfoot>
                {/* Row 1: TOTAL ON LEAVE PER DAY: */}
                <tr style={{ background: '#1E293B', color: '#ffffff', fontWeight: 700 }}>
                  <td
                    colSpan={5}
                    style={{
                      padding: '9px 12px',
                      borderTop: '2px solid #0F172A',
                      position: 'sticky',
                      left: 0,
                      zIndex: 11,
                      background: '#1E293B',
                      fontSize: '11.5px',
                      letterSpacing: '0.3px'
                    }}
                  >
                    TOTAL ON LEAVE PER DAY:
                  </td>
                  {EXAM_TIMELINE_DATES.map(dateStr => {
                    const count = leaveRecords.filter(r => r.leaveDates.includes(dateStr)).length;
                    const isFri = ICAB_OFF_DAYS.has(dateStr);
                    return (
                      <td
                        key={`total-${dateStr}`}
                        style={{
                          textAlign: 'center',
                          padding: '7px 2px',
                          borderTop: '2px solid #0F172A',
                          borderRight: '1px solid #334155',
                          background: isFri ? '#7F1D1D' : count >= 10 ? '#DC2626' : count >= 5 ? '#D97706' : '#1E293B',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '11.5px'
                        }}
                      >
                        {count}
                      </td>
                    );
                  })}
                  <td style={{ background: '#1E293B' }}></td>
                </tr>

                {/* Row 2: AVAILABLE IN-OFFICE MANPOWER: */}
                <tr style={{ background: '#0F172A', color: '#ffffff', fontWeight: 700 }}>
                  <td
                    colSpan={5}
                    style={{
                      padding: '9px 12px',
                      borderTop: '1px solid #334155',
                      position: 'sticky',
                      left: 0,
                      zIndex: 11,
                      background: '#0F172A',
                      fontSize: '11.5px',
                      letterSpacing: '0.3px'
                    }}
                  >
                    AVAILABLE IN-OFFICE MANPOWER:
                  </td>
                  {EXAM_TIMELINE_DATES.map(dateStr => {
                    const count = records.filter(r => r.leaveDates.includes(dateStr)).length;
                    const avail = Math.max(0, totalStaffCount - count);
                    const isFri = ICAB_OFF_DAYS.has(dateStr);
                    const isDeficit = avail <= 7;
                    return (
                      <td
                        key={`avail-ft-${dateStr}`}
                        style={{
                          textAlign: 'center',
                          padding: '7px 2px',
                          borderTop: '1px solid #334155',
                          borderRight: '1px solid #1E293B',
                          background: isFri ? '#450A0A' : isDeficit && totalStaffCount > 0 ? '#991B1B' : '#0F172A',
                          color: isFri ? '#FCA5A5' : '#ffffff',
                          fontWeight: 800,
                          fontSize: '11px'
                        }}
                      >
                        {isFri ? 'OFF' : avail}
                      </td>
                    );
                  })}
                  <td style={{ background: '#0F172A' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* 4. CANDIDATE ROSTER VIEW */}
      {viewMode === 'roster' && (
        <div className="table-card">
          <div className="banner-strip banner-maroon" style={{ justifyContent: 'center', padding: '0 16px' }}>
            <span
              style={{
                position: 'absolute',
                left: '16px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                padding: '2px 9px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Users size={12} />
              Client Directory
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={16} />
              <span>CANDIDATE DETAILS & SUBJECTS</span>
            </div>

            <div style={{ position: 'absolute', right: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecordForApplication(myExistingRecord || null);
                  setIsApplyModalOpen(true);
                }}
                style={{
                  background: '#F59E0B',
                  color: '#1F2937',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                }}
              >
                <Pencil size={12} />
                {myExistingRecord ? 'Update My Leave' : 'Apply for Leave'}
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                style={{
                  background: '#ffffff',
                  color: 'var(--maroon, #800000)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Download size={13} />
                Export Excel
              </button>
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            {filteredRecords.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#F9E8EA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                    color: 'var(--maroon)'
                  }}
                >
                  <GraduationCap size={28} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy)', marginBottom: '6px' }}>
                  No Candidate Applications Found
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', maxWidth: '420px', margin: '0 auto 16px' }}>
                  Start fresh by submitting your examination leave application.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecordForApplication(null);
                    setIsApplyModalOpen(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '8px 18px', fontSize: '12.5px', fontWeight: 700 }}
                >
                  <Pencil size={13} style={{ marginRight: '6px' }} />
                  Apply for Exam Leave
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '16px'
                }}
              >
                {filteredRecords.map(record => (
                <div
                  key={record.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    padding: '16px 18px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--navy)' }}>
                          {record.name}
                        </h3>
                        {/* Client replaces Team / Category */}
                        <span style={{ fontSize: '12px', color: 'var(--ink-muted)', fontWeight: 600 }}>
                          Client: {record.category}
                        </span>
                      </div>

                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background:
                            record.level === 'PL'
                              ? '#EBEFFE'
                              : record.level === 'CL'
                              ? '#E6F5F5'
                              : record.level === 'AL'
                              ? '#F9E8EA'
                              : '#FEF3C7',
                          color:
                            record.level === 'PL'
                              ? '#1B2A6B'
                              : record.level === 'CL'
                              ? '#1D8C8C'
                              : record.level === 'AL'
                              ? '#8B1420'
                              : '#92400E'
                        }}
                      >
                        {record.level}
                      </span>
                    </div>

                    <div
                      style={{
                        background: 'var(--cream-card)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: 'var(--ink)',
                        margin: '10px 0',
                        whiteSpace: 'pre-line',
                        lineHeight: '1.4'
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ink-muted)', marginBottom: '3px', textTransform: 'uppercase' }}>
                        Papers & Attempt
                      </div>
                      {record.subjects}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', marginBottom: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>Leave Start</span>
                        <strong>{record.leaveStartDay}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>Last Exam</span>
                        <strong>{record.appearInLastExamDate}</strong>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid #F1F5F9',
                      paddingTop: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#B45309' }}>
                        {record.leaveDates.length} Days Leave
                      </span>
                      {record.status && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            background:
                              record.status === 'Approved'
                                ? '#DCFCE7'
                                : record.status === 'Rejected'
                                ? '#FEE2E2'
                                : '#FEF3C7',
                            color:
                              record.status === 'Approved'
                                ? '#166534'
                                : record.status === 'Rejected'
                                ? '#991B1B'
                                : '#92400E'
                          }}
                        >
                          {record.status}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(record)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 8px', fontSize: '11px', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                      {isAdmin && record.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(record.id)}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '11px', background: '#16a34a', borderColor: '#16a34a' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(record.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '11px', color: '#dc2626' }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(isAdmin || record.id === myExistingRecord?.id) && (
                      <button
                        onClick={() => {
                          setSelectedRecordForApplication(record);
                          setIsApplyModalOpen(true);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Pencil size={12} />
                        Update Leave
                      </button>
                      )}
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. OFFICIAL ROUTINE VIEW */}
      {viewMode === 'routine' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 560px), 1fr))', gap: '16px', alignItems: 'start' }}>
          {/* Card 1: PL & AL */}
          <div className="table-card">
            <div className="banner-strip banner-maroon" style={{ justifyContent: 'center', padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} />
                <span>PROFESSIONAL & ADVANCED LEVEL (NOV 8 – 21)</span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table maroon-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                    <th style={{ width: '65px', textAlign: 'center', padding: '10px 6px' }}>Level</th>
                    <th style={{ minWidth: '180px', textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                    <th style={{ width: '160px', textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'PL' || s.level === 'AL').map(item => {
                    const isAL = item.level === 'AL';
                    const isOff = item.isOffDay;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: isOff
                            ? '#FAF8F5'
                            : isAL
                            ? 'rgba(20, 104, 96, 0.05)'
                            : '#ffffff',
                          borderLeft: isAL ? '4px solid #146860' : 'none'
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: isAL ? '#146860' : isOff ? '#94A3B8' : 'var(--ink)', whiteSpace: 'nowrap' }}>
                          {formatRoutineDate(item.date, item.dayName)}
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          {!isOff ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: isAL ? '#E6F5F2' : '#EBF0F7',
                                color: isAL ? '#146860' : '#1E344F',
                                border: isAL ? '1px solid #146860' : '1px solid #CBD5E1'
                              }}
                            >
                              {item.level}
                            </span>
                          ) : (
                            <span style={{ color: '#CBD5E1', fontSize: '11px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              fontWeight: isAL ? 700 : isOff ? 500 : 600,
                              color: isAL ? '#146860' : isOff ? '#64748B' : 'var(--ink)',
                              fontStyle: isOff ? 'italic' : 'normal'
                            }}
                          >
                            {item.subject}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: isAL ? 600 : 400,
                              color: isAL ? '#146860' : isOff ? '#94A3B8' : 'var(--ink-soft)',
                              fontStyle: isOff ? 'italic' : 'normal'
                            }}
                          >
                            {item.timeSlot || 'Off Day'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Certificate Level (CL) */}
          <div className="table-card">
            <div className="banner-strip banner-teal" style={{ justifyContent: 'center', padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} />
                <span>CERTIFICATE LEVEL EXAMINATION (NOV 23 – 30)</span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table teal-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                    <th style={{ width: '90px', textAlign: 'center', padding: '10px 6px' }}>Paper</th>
                    <th style={{ minWidth: '180px', textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                    <th style={{ width: '160px', textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'CL').map(item => (
                    <tr key={item.id} style={{ background: item.isOffDay ? '#FAF8F5' : '#ffffff' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: item.isOffDay ? '#94A3B8' : 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {formatRoutineDate(item.date, item.dayName)}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        {item.isOffDay ? (
                          <span style={{ color: '#CBD5E1', fontSize: '11px' }}>—</span>
                        ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#E6F5F2',
                            color: '#146860',
                            border: '1px solid #146860'
                          }}
                        >
                          Paper {item.paperCode}
                        </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: item.isOffDay ? 500 : 600, color: item.isOffDay ? '#64748B' : 'var(--ink)', fontStyle: item.isOffDay ? 'italic' : 'normal' }}>
                        {item.subject}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: item.isOffDay ? '#94A3B8' : 'var(--ink-soft)', fontStyle: item.isOffDay ? 'italic' : 'normal', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        {item.timeSlot || (item.isOffDay ? 'Off Day' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. QUICK DRAWER FOR CANDIDATE */}
      {selectedStudentForDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          onClick={() => setSelectedStudentForDrawer(null)}
        >
          <div
            style={{
              width: '420px',
              maxWidth: '90vw',
              background: '#ffffff',
              height: '100%',
              padding: '24px',
              overflowY: 'auto',
              boxShadow: '-8px 0 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
                    {selectedStudentForDrawer.name}
                  </h2>
                  <span style={{ fontSize: '13px', color: 'var(--ink-muted)', fontWeight: 600 }}>
                    Client: {selectedStudentForDrawer.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStudentForDrawer(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} color="var(--ink-muted)" />
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#EBEFFE',
                    color: '#1B2A6B'
                  }}
                >
                  Level: {selectedStudentForDrawer.level}
                </span>
                <span
                  style={{
                    marginLeft: '8px',
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#FEF3C7',
                    color: '#92400E'
                  }}
                >
                  {selectedStudentForDrawer.totalLeaveDays}
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Registered Exam Subjects
                </h4>
                <div style={{ background: 'var(--cream-card)', padding: '12px', borderRadius: '8px', fontSize: '12.5px', whiteSpace: 'pre-line', lineHeight: '1.45' }}>
                  {selectedStudentForDrawer.subjects}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Leave Schedule
                </h4>
                <div style={{ fontSize: '12.5px', lineHeight: '1.6' }}>
                  <div><strong>Leave Commences:</strong> {selectedStudentForDrawer.leaveStartDay}</div>
                  <div><strong>Last Exam Date:</strong> {selectedStudentForDrawer.appearInLastExamDate}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Calendar Days Away ({selectedStudentForDrawer.leaveDates.length})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {selectedStudentForDrawer.leaveDates.map(d => (
                    <span
                      key={d}
                      style={{
                        padding: '3px 7px',
                        borderRadius: '4px',
                        background: '#FEF08A',
                        color: '#713F12',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {isAdmin && <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  const rec = selectedStudentForDrawer;
                  setSelectedStudentForDrawer(null);
                  handleOpenEdit(rec);
                }}
                className="btn btn-primary"
                style={{ flex: 1, height: '38px', fontSize: '13px' }}
              >
                Edit Leave Details
              </button>
              <button
                onClick={() => handleDelete(selectedStudentForDrawer)}
                className="btn btn-secondary"
                style={{ height: '38px', fontSize: '13px', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>}
          </div>
        </div>
      )}

      {/* 7. EDIT LEAVE MODAL */}
      {editingRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setEditingRecord(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '22px 26px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                  Edit Candidate Leave
                </h3>
                <span style={{ fontSize: '12.5px', color: 'var(--ink-muted)' }}>
                  {editingRecord.name} (Client: {editingRecord.category})
                </span>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                  Client
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editClient}
                  onChange={e => setEditClient(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                  Exam Level
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editLevel}
                  onChange={e => setEditLevel(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                  Registered Subjects / Attempt Information
                </label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  value={editSubjects}
                  onChange={e => setEditSubjects(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                    Leave Start Date
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editLeaveStart}
                    onChange={e => setEditLeaveStart(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                    Total Leave Days Label
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editTotalDays}
                    onChange={e => setEditTotalDays(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '5px' }}>
                  Toggle Individual Leave Days (Selected: {editDates.length} days)
                </label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '5px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    padding: '8px',
                    background: 'var(--cream-card)',
                    borderRadius: '6px',
                    border: '1px solid var(--line)'
                  }}
                >
                  {EXAM_TIMELINE_DATES.map(d => {
                    const isSelected = editDates.includes(d);
                    const isFri = ICAB_OFF_DAYS.has(d);
                    return (
                      <button
                        key={`toggle-${d}`}
                        type="button"
                        onClick={() => toggleDateInEdit(d)}
                        style={{
                          padding: '3px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #CA8A04' : '1px solid #CBD5E1',
                          background: isSelected ? '#FEF08A' : isFri ? '#FEE2E2' : '#ffffff',
                          color: isSelected ? '#713F12' : isFri ? '#DC2626' : 'var(--ink)'
                        }}
                      >
                        {d.slice(5)} {isSelected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="btn btn-secondary"
                style={{ height: '36px', padding: '0 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="btn btn-primary"
                style={{ height: '36px', padding: '0 18px' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. OFFICIAL ICAB TIMETABLE POPUP MODAL */}
      {isRoutineModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setIsRoutineModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '860px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="banner-strip banner-maroon" style={{ justifyContent: 'space-between', padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} />
                <span>ICAB EXAMINATION ROUTINE • NOVEMBER 2026</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRoutineModalOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {/* Segmented Level Switcher */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  background: 'rgba(244, 240, 240, 0.75)',
                  padding: '4px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid var(--line)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setRoutineModalTab('PL_AL')}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: routineModalTab === 'PL_AL' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                    background: routineModalTab === 'PL_AL' ? 'linear-gradient(180deg, #8C1414 0%, #800000 100%)' : 'transparent',
                    color: routineModalTab === 'PL_AL' ? '#ffffff' : 'var(--ink-soft)',
                    boxShadow: routineModalTab === 'PL_AL' ? '0 2px 6px rgba(128, 0, 0, 0.3)' : 'none'
                  }}
                >
                  Professional & Advanced Level (Nov 8 – 21)
                </button>
                <button
                  type="button"
                  onClick={() => setRoutineModalTab('CL')}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: routineModalTab === 'CL' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                    background: routineModalTab === 'CL' ? 'linear-gradient(180deg, #146860 0%, #0d4b45 100%)' : 'transparent',
                    color: routineModalTab === 'CL' ? '#ffffff' : 'var(--ink-soft)',
                    boxShadow: routineModalTab === 'CL' ? '0 2px 6px rgba(20, 104, 96, 0.3)' : 'none'
                  }}
                >
                  Certificate Level (Nov 23 – 30)
                </button>
              </div>

              {routineModalTab === 'PL_AL' ? (
                <div className="table-responsive">
                  <table className="data-table maroon-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                        <th style={{ width: '65px', textAlign: 'center', padding: '10px 6px' }}>Level</th>
                        <th style={{ minWidth: '180px', textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                        <th style={{ width: '160px', textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'PL' || s.level === 'AL').map(item => {
                        const isAL = item.level === 'AL';
                        const isOff = item.isOffDay;
                        return (
                          <tr
                            key={item.id}
                            style={{
                              background: isOff ? '#FAF8F5' : isAL ? 'rgba(20, 104, 96, 0.05)' : '#ffffff',
                              borderLeft: isAL ? '4px solid #146860' : 'none'
                            }}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: isAL ? '#146860' : isOff ? '#94A3B8' : 'var(--ink)', whiteSpace: 'nowrap' }}>
                              {formatRoutineDate(item.date, item.dayName)}
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                              {!isOff ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    background: isAL ? '#E6F5F2' : '#EBF0F7',
                                    color: isAL ? '#146860' : '#1E344F',
                                    border: isAL ? '1px solid #146860' : '1px solid #CBD5E1'
                                  }}
                                >
                                  {item.level}
                                </span>
                              ) : (
                                <span style={{ color: '#CBD5E1', fontSize: '11px' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  fontWeight: isAL ? 700 : isOff ? 500 : 600,
                                  color: isAL ? '#146860' : isOff ? '#64748B' : 'var(--ink)',
                                  fontStyle: isOff ? 'italic' : 'normal'
                                }}
                              >
                                {item.subject}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: isAL ? 600 : 400,
                                  color: isAL ? '#146860' : isOff ? '#94A3B8' : 'var(--ink-soft)',
                                  fontStyle: isOff ? 'italic' : 'normal'
                                }}
                              >
                                {item.timeSlot || 'Off Day'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table teal-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                        <th style={{ width: '90px', textAlign: 'center', padding: '10px 6px' }}>Paper</th>
                        <th style={{ minWidth: '180px', textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                        <th style={{ width: '160px', textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'CL').map(item => (
                        <tr key={item.id} style={{ background: '#ffffff' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                            {formatRoutineDate(item.date, item.dayName)}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: '#E6F5F2',
                                color: '#146860',
                                border: '1px solid #146860'
                              }}
                            >
                              Paper {item.paperCode}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)' }}>
                            {item.subject}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--ink-soft)', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                            {item.timeSlot || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', textAlign: 'right', background: '#FAF7F2' }}>
              <button
                type="button"
                onClick={() => setIsRoutineModalOpen(false)}
                className="btn btn-secondary"
                style={{ height: '34px', padding: '0 16px', fontSize: '12.5px' }}
              >
                Close Routine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. APPLY / EDIT EXAM LEAVE APPLICATION MODAL */}
      <ApplyExamLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setSelectedRecordForApplication(null);
        }}
        onSubmitted={loadLeaves}
        existingRecord={selectedRecordForApplication}
      />
    </div>
  );
};
