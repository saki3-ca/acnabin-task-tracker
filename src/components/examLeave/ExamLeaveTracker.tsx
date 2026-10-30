import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  countOnLeave,
  countPeople,
  countsAsLeave,
  examCodesOn,
  examPapersOn,
  examLeaveService,
  formatShortDate,
  routineSubject,
  sameName,
  weekdayLetter
} from '../../services/examLeaveService';
import { StaffExamLeaveRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { canViewAllClients, getUserAssignedClientIds, isSAMOrAbove } from '../../lib/permissions';
import { ApplyExamLeaveModal } from './ApplyExamLeaveModal';
import { InstantTooltip } from '../ui/InstantTooltip';

const formatRoutineDate = (dateStr: string, dayName: string) => `${formatShortDate(dateStr)}, ${dayName}`;

/** Today's date as the selected (blue) column; before the timeline starts it is the first day, after it ends the last day. */
const todayInTimeline = (): string => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const first = EXAM_TIMELINE_DATES[0];
  const last = EXAM_TIMELINE_DATES[EXAM_TIMELINE_DATES.length - 1];
  return today < first ? first : today > last ? last : today;
};

export const ExamLeaveTracker: React.FC = () => {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  const { currentUser, allUsers, allClients } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [allRecords, setRecords] = useState<StaffExamLeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'matrix' | 'roster' | 'routine'>('matrix');

  // Filters (Changed "Team" to "Client")
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  // Interactive Date Inspector
  const [inspectedDate, setInspectedDate] = useState<string>(todayInTimeline);

  // Modals & Drawers
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [routineModalTab, setRoutineModalTab] = useState<'PL_AL' | 'CL'>('PL_AL');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRecordForApplication, setSelectedRecordForApplication] = useState<StaffExamLeaveRecord | null>(null);
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<StaffExamLeaveRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  // My leave: one per person, covering every level (PL, AL, CL) in the same record
  const myRecordIds = useMemo(
    () => new Set(allRecords.filter(r => sameName(r.name, currentUser?.name)).map(r => r.id)),
    [allRecords, currentUser]
  );
  const hasMyRecord = myRecordIds.size > 0;
  // Apply once, then Edit: a submitted leave is never re-submitted from the Apply form
  const openMyLeave = () => {
    const mine = allRecords.find(r => myRecordIds.has(r.id));
    setSelectedRecordForApplication(mine || null);
    setIsApplyModalOpen(true);
  };

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

  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState<{ id: string; name: string; reason: string }[]>([]);
  const attempt = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (err: any) {
      alert(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const handleApprove = async (id: string) => {
    await attempt(() => examLeaveService.approveLeave(id));
    await loadLeaves();
  };

  const handleDelete = async (record: StaffExamLeaveRecord) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete the exam leave of ${record.name}? This cannot be undone.`)) return;
    await attempt(() => examLeaveService.deleteLeave(record.id));
    setSelectedStudentForDrawer(null);
    await loadLeaves();
  };

  const handleReject = async (id: string) => {
    if (window.confirm('Are you sure you want to reject this leave application?')) {
      await attempt(() => examLeaveService.rejectLeave(id));
      await loadLeaves();
    }
  };

  const matrixScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await examLeaveService.getLeaves();
      setRecords(data);
      setLoadError(null);
      setPendingLocal(examLeaveService.getPendingLocalLeaves());
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load exam leave.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await examLeaveService.exportToExcel(records, EXAM_TIMELINE_DATES, totalStaffCount, r => {
        const clients = getRecordClients(r);
        return {
          primaryClient: clients[0] || '—',
          allClients: clients.join(', ') || r.category || '—'
        };
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export leave matrix to Excel.');
    } finally {
      setExporting(false);
    }
  };

  // Edit uses the same form as Apply: pick papers and attempt, days follow the rule, and days can still be toggled.
  const handleOpenEdit = (record: StaffExamLeaveRecord) => {
    if (!canEditRecord(record)) return;
    setSelectedRecordForApplication(record);
    setIsApplyModalOpen(true);
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

  // Who may change a leave (add or remove days): Admin, the person themself, and Senior Assistant
  // Manager and above for the people on their own clients (AD and above: everyone).
  const canEditRecord = (r: StaffExamLeaveRecord): boolean => {
    if (isAdmin || myRecordIds.has(r.id)) return true;
    if (!currentUser || !isSAMOrAbove(currentUser.designation)) return false;
    return canSeeEveryone || teamUsers.some(u => sameName(u.name, r.name));
  };

  // Map user names to their assigned client names (live from allUsers and allClients)
  const userClientMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allUsers.forEach(u => {
      const cids = getUserAssignedClientIds(u);
      const names = cids.map(cid => allClients.find(c => c.id === cid)?.name).filter(Boolean) as string[];
      if (names.length > 0) {
        map.set(u.name.toLowerCase().trim(), names);
      }
    });
    return map;
  }, [allUsers, allClients]);

  // Resolves all individual clients a candidate belongs to:
  // If the user has assigned clients in the system, their live assignments take priority.
  // Falls back to r.category for historical or unlinked records.
  const getRecordClients = useCallback((r: StaffExamLeaveRecord): string[] => {
    const liveClients = userClientMap.get(r.name.toLowerCase().trim());
    if (liveClients && liveClients.length > 0) {
      return liveClients;
    }

    const clientSet = new Set<string>();
    if (r.category && r.category.trim()) {
      r.category.split(',').forEach(c => {
        const trimmed = c.trim();
        if (trimmed && trimmed !== '—' && trimmed.toLowerCase() !== 'general client assignment') {
          const live = allClients.find(ac => ac.name.toLowerCase() === trimmed.toLowerCase() || ac.id === trimmed);
          clientSet.add(live ? live.name : trimmed);
        }
      });
    }
    if (clientSet.size === 0) {
      const fallback = (r.category || '').trim();
      if (fallback) clientSet.add(fallback);
    }
    return Array.from(clientSet);
  }, [userClientMap, allClients]);

  // Distinct clients list for filter (client-wise, each client listed individually)
  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      const clients = getRecordClients(r);
      clients.forEach(c => {
        const trimmed = c.trim();
        if (trimmed && trimmed !== '—' && trimmed.toLowerCase() !== 'general client assignment') {
          set.add(trimmed);
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records, getRecordClients]);

  // Distinct levels list
  const uniqueLevels = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      (r.level || '').split(/\s*&\s*/).forEach(l => {
        if (l.trim() && l.trim() !== '—') set.add(l.trim());
      });
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered Records (client-wise matching for multi-client users)
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const recordClients = getRecordClients(r);

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = r.name.toLowerCase().includes(term);
        const matchesClient =
          recordClients.some(c => c.toLowerCase().includes(term)) ||
          (r.category || '').toLowerCase().includes(term);
        const matchesSubject = (r.subjects || '').toLowerCase().includes(term);
        if (!matchesName && !matchesClient && !matchesSubject) return false;
      }

      if (selectedClient) {
        const target = selectedClient.toLowerCase().trim();
        // Exact match so "Walton Hi-Tech Industries PLC" does not unintentionally match "(Merger)" or other variants
        const matches = recordClients.some(
          c => c.toLowerCase().trim() === target
        );
        if (!matches) {
          return false;
        }
      }

      if (selectedLevel) {
        // a leave can cover several levels ('PL & AL')
        if (!(r.level || '').split(/\s*&\s*/).map(l => l.trim()).includes(selectedLevel)) return false;
      }

      return true;
    });
  }, [records, searchTerm, selectedClient, selectedLevel, getRecordClients]);

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
    return Math.max(staff, countPeople(leaveRecords));
  }, [allUsers, teamUsers, canSeeEveryone, leaveRecords]);
  const peakLeaveInfo = useMemo(() => {
    let maxOnLeave = 0;
    let peakDate = '2026-11-12';
    for (const d of EXAM_TIMELINE_DATES) {
      if (ICAB_OFF_DAYS.has(d)) continue;
      const count = countOnLeave(leaveRecords, d);
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
      const onLeaveCount = countOnLeave(leaveRecords, d);
      map.set(d, {
        onLeave: onLeaveCount,
        available: totalStaffCount - onLeaveCount
      });
    }
    return map;
  }, [leaveRecords, totalStaffCount]);

  return (
    <div className="tab-pane">
      {loadError && (
        <div className="auth-alert-error" style={{ margin: 0 }}>
          {loadError}
        </div>
      )}
      {pendingLocal.length > 0 && (
        <div style={{ margin: 0, padding: '10px 14px', borderRadius: '8px', background: '#FBEBC4', border: '1px solid #D9A441', color: '#7A4B00', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <span>
            <strong>{pendingLocal.length} leave{pendingLocal.length === 1 ? ' is' : 's are'} saved only on this computer</strong> and nobody else can see {pendingLocal.length === 1 ? 'it' : 'them'} yet:{' '}
            {pendingLocal.map(p => (p.reason ? `${p.name} (${p.reason})` : p.name)).join('; ')}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadLeaves()}>
            Upload now
          </button>
        </div>
      )}
      {/* 1. TOP ROW: 5-SLOT GRID MATCHING MANPOWER & TEAM TASKS EXACT HEIGHT & PROPORTIONS */}
      <div className="stat-pills">
        {/* Pill 1: Total Candidates */}
        <div className="stat-pill">
          <span className="stat-pill-label">ACTIVE CANDIDATES</span>
          <span className="stat-pill-value">
            {String(countPeople(records)).padStart(2, '0')}
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
            className="segmented-control"
            style={{
              width: '100%',
              height: '100%'
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`segmented-btn ${viewMode === 'matrix' ? 'active' : ''}`}
              title="Daily 36-day timeline matrix"
            >
              <Calendar size={13} /> Matrix
            </button>

            <button
              type="button"
              onClick={() => setViewMode('roster')}
              className={`segmented-btn ${viewMode === 'roster' ? 'active' : ''}`}
              title="Candidate roster and details"
            >
              <Users size={13} /> Roster
            </button>

            <button
              type="button"
              onClick={() => setViewMode('routine')}
              className={`segmented-btn ${viewMode === 'routine' ? 'active' : ''}`}
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
              placeholder="Search by candidate name, client, or subject…"
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
              <span className="legend-pill study-leave">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D99A1F', display: 'inline-block' }} />
                Study Leave
              </span>
              <span className="legend-pill holiday">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A94442', display: 'inline-block' }} />
                Holiday
              </span>
              <span className="legend-pill working-day">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A79F92', display: 'inline-block' }} />
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
                  onClick={openMyLeave}
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
                  {hasMyRecord ? 'Edit My Leave' : 'Apply for Leave'}
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
              className="data-table exam-matrix-table"
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
                <tr className="exam-header-row" style={{ position: 'sticky', top: 0, zIndex: 12 }}>
                  <th className="exam-th-sticky" style={{ position: 'sticky', left: 0, zIndex: 13, width: '38px', minWidth: '38px', maxWidth: '38px', boxSizing: 'border-box', textAlign: 'center', padding: '10px 4px' }}>
                    SL.
                  </th>
                  <th className="exam-th-sticky" style={{ position: 'sticky', left: '38px', zIndex: 13, boxSizing: 'border-box', width: '190px', minWidth: '190px', maxWidth: '190px', padding: '10px 12px' }}>
                    NAME
                  </th>
                  <th className="exam-th-sticky" style={{ position: 'sticky', left: '228px', zIndex: 13, boxSizing: 'border-box', width: '230px', minWidth: '230px', maxWidth: '230px', padding: '10px 10px' }}>
                    CLIENT
                  </th>
                  <th className="exam-th" style={{ minWidth: '70px', textAlign: 'center', padding: '10px 6px' }}>
                    LEVEL
                  </th>
                  <th className="exam-th" style={{ minWidth: '85px', textAlign: 'center', padding: '10px 6px' }}>
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
                        className={`exam-th-date ${isSelected ? 'selected' : ''} ${isFri ? 'friday' : ''}`}
                        style={{
                          minWidth: '38px',
                          textAlign: 'center',
                          padding: '6px 2px',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        title={`Click to inspect ${formatShortDate(dateStr)}`}
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

                  <th className="exam-th" style={{ minWidth: '140px', textAlign: 'center', padding: '10px 6px' }}>
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
                        onClick={openMyLeave}
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
                    return (
                      <tr
                        key={record.id}
                        className={`exam-row ${isEven ? 'table-row-even' : 'table-row-odd'}`}
                        style={{
                          transition: 'background 0.15s'
                        }}
                      >
                      {/* SL */}
                      <td
                        className="exam-td-sticky"
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          width: '38px',
                          minWidth: '38px',
                          maxWidth: '38px',
                          boxSizing: 'border-box',
                          textAlign: 'center',
                          padding: '9px 4px',
                          fontWeight: 600
                        }}
                      >
                        {idx + 1}
                      </td>

                      {/* Candidate Name */}
                      <td
                        className="exam-td-sticky"
                        style={{
                          position: 'sticky',
                          left: '38px',
                          zIndex: 10,
                          boxSizing: 'border-box',
                          padding: '9px 12px',
                          fontWeight: 600,
                          width: '190px',
                          minWidth: '190px',
                          maxWidth: '190px'
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => setSelectedStudentForDrawer(record)}
                        >
                          <span className="exam-candidate-name">
                            {record.name}
                          </span>
                          <Info size={13} style={{ color: 'var(--ink-muted)' }} />
                        </div>
                      </td>

                      {/* Client (Replaced Team / Category) */}
                      <td
                        className="exam-td-sticky"
                        style={{
                          position: 'sticky',
                          left: '228px',
                          zIndex: 10,
                          padding: '9px 10px',
                          fontSize: '11.5px',
                          width: '230px',
                          minWidth: '230px',
                          maxWidth: '230px'
                        }}
                      >
                        {/* a long client list wraps to two lines; hover shows every client, one per line */}
                        <InstantTooltip content={getRecordClients(record).join(String.fromCharCode(10)) || record.category || '—'} style={{ width: '210px' }}>
                          <div className="exam-client-name" style={{ lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                            {getRecordClients(record).join(', ') || record.category || '—'}
                          </div>
                        </InstantTooltip>
                      </td>

                      {/* Level */}
                      <td
                        className="exam-td"
                        style={{
                          textAlign: 'center',
                          padding: '9px 4px'
                        }}
                      >
                        <span className={`level-badge level-${record.level.toLowerCase()}`}>
                          {record.level}
                        </span>
                      </td>

                      {/* Total Leave */}
                      <td
                        className="exam-td"
                        style={{
                          textAlign: 'center',
                          padding: '9px 4px',
                          fontWeight: 700
                        }}
                      >
                        <span className={record.leaveDates.length > 0 ? 'total-leave-has-leave' : 'total-leave-zero'}>
                          {record.totalLeaveDays}
                        </span>
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
                            className={`matrix-day-cell ${isOnLeave ? 'on-leave' : ''} ${isOffDay ? 'off-day' : ''} ${isSelectedCol ? 'selected-col' : ''}`}
                            style={{
                              textAlign: 'center',
                              padding: '8px 2px',
                              cursor: 'pointer'
                            }}
                            title={`${record.name} on ${formatShortDate(dateStr)}: ${isOnLeave ? (examCodesOn(record, dateStr).length > 0 ? `Exam - ${examPapersOn(record, dateStr).map(p => `${p.code} (${p.level})`).join(' / ')}` : 'Study Leave') : isOffDay ? 'Holiday' : 'Working day'}`}
                          >
                            {isOnLeave ? (
                              (() => {
                                const codes = examCodesOn(record, dateStr);
                                return codes.length > 0 ? (
                                  <span className="exam-code-chip" style={{ display: 'inline-block', width: '100%', minHeight: '16px', fontSize: '9px', fontWeight: 800, lineHeight: '16px', letterSpacing: '-0.2px' }}>
                                    {codes.join('/')}
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-block', width: '100%', height: '16px' }} />
                                );
                              })()
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
                        {canEditRecord(record) && <div style={{ display: 'inline-flex', gap: '4px' }}><button
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
                        {isAdmin && <button
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
                        </button>}</div>}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>

              {/* Matrix Table Footer Summary Rows */}
              <tfoot>
                {/* Row 1: TOTAL ON LEAVE PER DAY: */}
                <tr className="exam-footer-row total" style={{ background: '#1B2A6B', color: '#ffffff', fontWeight: 700 }}>
                  <td
                    colSpan={5}
                    className="exam-footer-sticky"
                    style={{
                      padding: '9px 12px',
                      borderTop: '2px solid #141F52',
                      position: 'sticky',
                      left: 0,
                      zIndex: 11,
                      background: '#1B2A6B',
                      fontSize: '11.5px',
                      letterSpacing: '0.3px'
                    }}
                  >
                    TOTAL ON LEAVE PER DAY:
                  </td>
                  {EXAM_TIMELINE_DATES.map(dateStr => {
                    const count = countOnLeave(leaveRecords, dateStr);
                    const isFri = ICAB_OFF_DAYS.has(dateStr);
                    return (
                      <td
                        key={`total-${dateStr}`}
                        style={{
                          textAlign: 'center',
                          padding: '7px 2px',
                          borderTop: '2px solid #141F52',
                          borderRight: '1px solid #33438A',
                          background: isFri ? '#5B2230' : count >= 10 ? '#9B2C2C' : count >= 5 ? '#A66A12' : '#1B2A6B',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '11.5px'
                        }}
                      >
                        {count}
                      </td>
                    );
                  })}
                  <td style={{ background: '#1B2A6B' }}></td>
                </tr>

                {/* Row 2: AVAILABLE IN-OFFICE MANPOWER: */}
                <tr className="exam-footer-row avail" style={{ background: '#141F52', color: '#ffffff', fontWeight: 700 }}>
                  <td
                    colSpan={5}
                    className="exam-footer-sticky"
                    style={{
                      padding: '9px 12px',
                      borderTop: '1px solid #33438A',
                      position: 'sticky',
                      left: 0,
                      zIndex: 11,
                      background: '#141F52',
                      fontSize: '11.5px',
                      letterSpacing: '0.3px'
                    }}
                  >
                    AVAILABLE IN-OFFICE MANPOWER (OUT OF {totalStaffCount}):
                  </td>
                  {EXAM_TIMELINE_DATES.map(dateStr => {
                    const count = countOnLeave(leaveRecords, dateStr);
                    const avail = Math.max(0, totalStaffCount - count);
                    const isFri = ICAB_OFF_DAYS.has(dateStr);
                    const isDeficit = avail <= 7;
                    return (
                      <td
                        key={`avail-ft-${dateStr}`}
                        style={{
                          textAlign: 'center',
                          padding: '7px 2px',
                          borderTop: '1px solid #33438A',
                          borderRight: '1px solid #1B2A6B',
                          background: isFri ? '#3F1D2B' : isDeficit && totalStaffCount > 0 ? '#9B2C2C' : '#141F52',
                          color: isFri ? '#E3B3B3' : '#ffffff',
                          fontWeight: 800,
                          fontSize: '11px'
                        }}
                      >
                        {isFri ? 'OFF' : avail}
                      </td>
                    );
                  })}
                  <td style={{ background: '#141F52' }}></td>
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
                onClick={openMyLeave}
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
                {hasMyRecord ? 'Edit My Leave' : 'Apply for Leave'}
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
                  onClick={openMyLeave}
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
                  className="roster-card"
                  style={{
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
                          Client: {getRecordClients(record).join(', ') || record.category || '—'}
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
                        <strong>{formatShortDate(record.leaveStartDay)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>Last Exam</span>
                        <strong>{formatShortDate(record.appearInLastExamDate)}</strong>
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
                      {canEditRecord(record) && (
                      <button
                        onClick={() => handleOpenEdit(record)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Pencil size={12} />
                        Edit
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
              <table className="data-table maroon-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                    <th style={{ width: '65px', textAlign: 'center', padding: '10px 6px' }}>Level</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                    <th style={{ width: 'calc(120px + 1.5cm)', textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'PL' || s.level === 'AL').map((item, idx) => {
                    const isAL = item.level === 'AL';
                    const isOff = item.isOffDay;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: isGlass
                            ? (isOff ? 'rgba(255, 255, 255, 0.02)' : isAL ? 'rgba(246, 139, 139, 0.14)' : (idx % 2 === 0 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)'))
                            : (isOff ? '#FAF8F5' : isAL ? 'rgba(139, 20, 32, 0.05)' : '#ffffff'),
                          borderLeft: isAL ? (isGlass ? '4px solid #f68b8b' : '4px solid #8B1420') : 'none',
                          borderBottom: isGlass ? '1px solid rgba(255, 255, 255, 0.08)' : undefined
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: isGlass ? (isOff ? 'rgba(255, 255, 255, 0.60)' : '#FFFFFF') : (isAL ? '#8B1420' : isOff ? '#94A3B8' : 'var(--ink)'), whiteSpace: 'nowrap' }}>
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
                                background: isGlass ? (isAL ? 'rgba(246, 139, 139, 0.22)' : 'rgba(201, 164, 235, 0.20)') : (isAL ? '#F9E8EA' : '#EBF0F7'),
                                color: isGlass ? (isAL ? '#f68b8b' : '#c9a4eb') : (isAL ? '#8B1420' : '#1E344F'),
                                border: isGlass ? (isAL ? '1px solid rgba(246, 139, 139, 0.45)' : '1px solid rgba(201, 164, 235, 0.40)') : (isAL ? '1px solid #8B1420' : '1px solid #CBD5E1')
                              }}
                            >
                              {item.level}
                            </span>
                          ) : (
                            <span style={{ color: isGlass ? 'rgba(255, 255, 255, 0.35)' : '#CBD5E1', fontSize: '11px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              fontWeight: isAL ? 700 : isOff ? 500 : 600,
                              color: isGlass ? (isOff ? 'rgba(255, 255, 255, 0.65)' : '#FFFFFF') : (isAL ? '#8B1420' : isOff ? '#64748B' : 'var(--ink)'),
                              fontStyle: isOff ? 'italic' : 'normal'
                            }}
                          >
                            {routineSubject(item)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: isAL ? 600 : 400,
                              color: isGlass ? (isOff ? 'rgba(255, 255, 255, 0.60)' : 'rgba(255, 255, 255, 0.85)') : (isAL ? '#8B1420' : isOff ? '#94A3B8' : 'var(--ink-soft)'),
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
              <table className="data-table teal-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                    <th style={{ width: '80px', textAlign: 'center', padding: '10px 6px' }}>Paper</th>
                    <th style={{ width: 'calc(200px - 2cm)', textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'CL').map((item, idx) => (
                    <tr
                      key={item.id}
                      style={{
                        background: isGlass
                          ? (item.isOffDay ? 'rgba(255, 255, 255, 0.02)' : (idx % 2 === 0 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)'))
                          : (item.isOffDay ? '#FAF8F5' : '#ffffff'),
                        borderBottom: isGlass ? '1px solid rgba(255, 255, 255, 0.08)' : undefined
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: isGlass ? (item.isOffDay ? 'rgba(255, 255, 255, 0.45)' : '#FFFFFF') : (item.isOffDay ? '#94A3B8' : 'var(--ink)'), whiteSpace: 'nowrap' }}>
                        {formatRoutineDate(item.date, item.dayName)}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        {item.isOffDay ? (
                          <span style={{ color: isGlass ? 'rgba(255, 255, 255, 0.35)' : '#CBD5E1', fontSize: '11px' }}>—</span>
                        ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: isGlass ? 'rgba(119, 223, 192, 0.20)' : '#E6F5F2',
                            color: isGlass ? '#77dfc0' : '#146860',
                            border: isGlass ? '1px solid rgba(119, 223, 192, 0.40)' : '1px solid #146860'
                          }}
                        >
                          {item.paperCode}
                        </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: item.isOffDay ? 500 : 600, color: isGlass ? (item.isOffDay ? 'rgba(255, 255, 255, 0.50)' : '#FFFFFF') : (item.isOffDay ? '#64748B' : 'var(--ink)'), fontStyle: item.isOffDay ? 'italic' : 'normal' }}>
                        {routineSubject(item)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: isGlass ? (item.isOffDay ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.75)') : (item.isOffDay ? '#94A3B8' : 'var(--ink-soft)'), fontStyle: item.isOffDay ? 'italic' : 'normal', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
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
          className="modal-backdrop"
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
            className="modal-dialog drawer-panel"
            style={{
              width: '420px',
              maxWidth: '90vw',
              background: isGlass ? 'var(--ui-modal-bg)' : '#ffffff',
              height: '100%',
              padding: '24px',
              overflowY: 'auto',
              boxShadow: isGlass ? 'var(--ui-shadow)' : '-8px 0 25px rgba(0,0,0,0.15)',
              borderLeft: isGlass ? '1px solid var(--ui-border)' : undefined,
              backdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
              WebkitBackdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
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
                    Client: {getRecordClients(selectedStudentForDrawer).join(', ') || selectedStudentForDrawer.category || '—'}
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
                  <div><strong>Leave Commences:</strong> {formatShortDate(selectedStudentForDrawer.leaveStartDay)}</div>
                  <div><strong>Last Exam Date:</strong> {formatShortDate(selectedStudentForDrawer.appearInLastExamDate)}</div>
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
                        background: '#F7DC93',
                        color: '#7A4B00',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      {formatShortDate(d)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {canEditRecord(selectedStudentForDrawer) && <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', display: 'flex', gap: '10px' }}>
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
              {isAdmin && <button
                onClick={() => handleDelete(selectedStudentForDrawer)}
                className="btn btn-secondary"
                style={{ height: '38px', fontSize: '13px', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} />
                Delete
              </button>}
            </div>}
          </div>
        </div>
      )}

      {/* 8. OFFICIAL ICAB TIMETABLE POPUP MODAL */}
      {isRoutineModalOpen && (
        <div
          className="modal-backdrop"
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
            className="modal-dialog"
            style={{
              background: isGlass ? 'var(--ui-modal-bg)' : '#ffffff',
              borderRadius: '12px',
              maxWidth: '860px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: isGlass ? 'var(--ui-shadow)' : '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: isGlass ? '1px solid var(--ui-border)' : '1px solid var(--line)',
              backdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
              WebkitBackdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
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
                  background: isGlass ? 'rgba(255, 255, 255, 0.06)' : 'rgba(244, 240, 240, 0.75)',
                  padding: '4px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: isGlass ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--line)'
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
                    background: routineModalTab === 'PL_AL' ? (isGlass ? 'rgba(255, 255, 255, 0.22)' : 'linear-gradient(180deg, #8C1414 0%, #800000 100%)') : 'transparent',
                    color: routineModalTab === 'PL_AL' ? '#ffffff' : (isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)'),
                    boxShadow: routineModalTab === 'PL_AL' && !isGlass ? '0 2px 6px rgba(128, 0, 0, 0.3)' : 'none'
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
                    background: routineModalTab === 'CL' ? (isGlass ? 'rgba(255, 255, 255, 0.22)' : 'linear-gradient(180deg, #146860 0%, #0d4b45 100%)') : 'transparent',
                    color: routineModalTab === 'CL' ? '#ffffff' : (isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)'),
                    boxShadow: routineModalTab === 'CL' && !isGlass ? '0 2px 6px rgba(20, 104, 96, 0.3)' : 'none'
                  }}
                >
                  Certificate Level (Nov 23 – 30)
                </button>
              </div>

              {routineModalTab === 'PL_AL' ? (
                <div className="table-responsive">
                  <table className="data-table maroon-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                        <th style={{ width: '65px', textAlign: 'center', padding: '10px 6px' }}>Level</th>
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                        <th style={{ width: 'calc(120px + 1.5cm)', textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'PL' || s.level === 'AL').map((item, idx) => {
                        const isAL = item.level === 'AL';
                        const isOff = item.isOffDay;
                        return (
                          <tr
                            key={item.id}
                            style={{
                              background: isGlass
                                ? (isOff ? 'rgba(255, 255, 255, 0.02)' : isAL ? 'rgba(246, 139, 139, 0.14)' : (idx % 2 === 0 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)'))
                                : (isOff ? '#FAF8F5' : isAL ? 'rgba(139, 20, 32, 0.05)' : '#ffffff'),
                              borderLeft: isAL ? (isGlass ? '4px solid #f68b8b' : '4px solid #8B1420') : 'none',
                              borderBottom: isGlass ? '1px solid rgba(255, 255, 255, 0.08)' : undefined
                            }}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: isGlass ? (isOff ? 'rgba(255, 255, 255, 0.60)' : '#FFFFFF') : (isAL ? '#8B1420' : isOff ? '#94A3B8' : 'var(--ink)'), whiteSpace: 'nowrap' }}>
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
                                    background: isGlass ? (isAL ? 'rgba(246, 139, 139, 0.22)' : 'rgba(201, 164, 235, 0.20)') : (isAL ? '#F9E8EA' : '#EBF0F7'),
                                    color: isGlass ? (isAL ? '#f68b8b' : '#c9a4eb') : (isAL ? '#8B1420' : '#1E344F'),
                                    border: isGlass ? (isAL ? '1px solid rgba(246, 139, 139, 0.45)' : '1px solid rgba(201, 164, 235, 0.40)') : (isAL ? '1px solid #8B1420' : '1px solid #CBD5E1')
                                  }}
                                >
                                  {item.level}
                                </span>
                              ) : (
                                <span style={{ color: isGlass ? 'rgba(255, 255, 255, 0.35)' : '#CBD5E1', fontSize: '11px' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  fontWeight: isAL ? 700 : isOff ? 500 : 600,
                                  color: isGlass ? (isOff ? 'rgba(255, 255, 255, 0.65)' : '#FFFFFF') : (isAL ? '#8B1420' : isOff ? '#64748B' : 'var(--ink)'),
                                  fontStyle: isOff ? 'italic' : 'normal'
                                }}
                              >
                                {routineSubject(item)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: isAL ? 600 : 400,
                                  color: isGlass ? (isOff ? 'rgba(255, 255, 255, 0.60)' : 'rgba(255, 255, 255, 0.85)') : (isAL ? '#8B1420' : isOff ? '#94A3B8' : 'var(--ink-soft)'),
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
                  <table className="data-table teal-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '170px', minWidth: '160px', textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' }}>Date & Day</th>
                        <th style={{ width: '80px', textAlign: 'center', padding: '10px 6px' }}>Paper</th>
                        <th style={{ width: 'calc(200px - 2cm)', textAlign: 'left', padding: '10px 14px' }}>Subject</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px', whiteSpace: 'nowrap' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OFFICIAL_ICAB_SCHEDULE.filter(s => s.level === 'CL').map((item, idx) => (
                        <tr
                          key={item.id}
                          style={{
                            background: isGlass
                              ? (item.isOffDay ? 'rgba(255, 255, 255, 0.02)' : (idx % 2 === 0 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)'))
                              : (item.isOffDay ? '#FAF8F5' : '#ffffff'),
                            borderBottom: isGlass ? '1px solid rgba(255, 255, 255, 0.08)' : undefined
                          }}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: isGlass ? (item.isOffDay ? 'rgba(255, 255, 255, 0.45)' : '#FFFFFF') : (item.isOffDay ? '#94A3B8' : 'var(--ink)'), whiteSpace: 'nowrap' }}>
                            {formatRoutineDate(item.date, item.dayName)}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                            {item.isOffDay ? (
                              <span style={{ color: isGlass ? 'rgba(255, 255, 255, 0.35)' : '#CBD5E1', fontSize: '11px' }}>—</span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  background: isGlass ? 'rgba(119, 223, 192, 0.20)' : '#E6F5F2',
                                  color: isGlass ? '#77dfc0' : '#146860',
                                  border: isGlass ? '1px solid rgba(119, 223, 192, 0.40)' : '1px solid #146860'
                                }}
                              >
                                {item.paperCode}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: item.isOffDay ? 500 : 600, color: isGlass ? (item.isOffDay ? 'rgba(255, 255, 255, 0.50)' : '#FFFFFF') : (item.isOffDay ? '#64748B' : 'var(--ink)'), fontStyle: item.isOffDay ? 'italic' : 'normal' }}>
                            {routineSubject(item)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: isGlass ? (item.isOffDay ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.75)') : (item.isOffDay ? '#94A3B8' : 'var(--ink-soft)'), fontStyle: item.isOffDay ? 'italic' : 'normal', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                            {item.timeSlot || (item.isOffDay ? 'Off Day' : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{
              padding: '14px 20px',
              borderTop: isGlass ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid var(--line)',
              textAlign: 'right',
              background: isGlass ? 'rgba(255, 255, 255, 0.03)' : '#FAF7F2'
            }}>
              <button
                type="button"
                onClick={() => setIsRoutineModalOpen(false)}
                className="btn btn-secondary"
                style={{
                  height: '34px',
                  padding: '0 16px',
                  fontSize: '12.5px',
                  background: isGlass ? 'rgba(255, 255, 255, 0.10)' : undefined,
                  color: isGlass ? '#ffffff' : undefined,
                  border: isGlass ? '1px solid rgba(255, 255, 255, 0.20)' : undefined
                }}
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
