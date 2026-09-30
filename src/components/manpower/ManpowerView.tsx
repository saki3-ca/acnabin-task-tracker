import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building,
  Check,
  Download,
  Filter,
  Pencil,
  RotateCcw,
  Search,
  Users,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { DESIGNATIONS } from '../../lib/constants';
import { isAssistantDirectorOrAbove } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { ClientLabel, clientText } from '../ui/ClientLabel';
import { manpowerService } from '../../services/manpowerService';
import { ClientManpowerSummaryItem, ManpowerRecord } from '../../types';

function formatBDT(amount: number): string {
  return `৳ ${Math.round(amount).toLocaleString('en-IN')}`;
}

function renderAcademicYear(year?: string) {
  if (!year || year === '—' || !year.trim()) {
    return <span style={{ color: 'var(--ink-muted)' }}>—</span>;
  }
  const match = year.match(/^(\d+)(st|nd|rd|th)(\s*.*)?$/i);
  if (match) {
    const [, num, suffix, rest] = match;
    return (
      <span style={{ fontWeight: 600 }}>
        {num}
        <sup style={{ fontSize: '0.7em', textTransform: 'lowercase' }}>{suffix}</sup>
        {rest || ' Year'}
      </span>
    );
  }
  return <span>{year}</span>;
}

const ALL_CLIENTS = 'All Clients';

// Assistant Director and above with no client selected work across all clients
function withAllClients(r: ManpowerRecord): ManpowerRecord {
  const noClient =
    (!r.clientIds || r.clientIds.length === 0) &&
    (!r.assignedClient || ['unassigned', '—', '-', 'none'].includes(r.assignedClient.trim().toLowerCase()));
  if (isAssistantDirectorOrAbove(r.designation) && noClient) {
    return { ...r, assignedClient: ALL_CLIENTS, clientId: null };
  }
  return r;
}

type DetailSortField = 'empId' | 'name' | 'assignedClient' | 'designation' | 'academicYear' | 'salary' | 'conveyance' | 'total';
type SummarySortField = 'clientName' | 'manpowerCount' | 'totalSalary' | 'totalConveyance' | 'totalCost';

export const ManpowerView: React.FC = () => {
  const { currentUser, refreshContextData, allUsers, allClients } = useAuth();
  const [viewMode, setViewMode] = useState<'details' | 'summary'>('details');

  const [records, setRecords] = useState<ManpowerRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Checkbox: "Include all HR records" (defaults to false = only active users)
  const [includeAllHr, setIncludeAllHr] = useState<boolean>(false);

  // Remarks state
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [savingRemarkId, setSavingRemarkId] = useState<string | null>(null);

  // Details View Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedDesignation, setSelectedDesignation] = useState<string>('');

  // Details View Sorting
  const [detailSortField, setDetailSortField] = useState<DetailSortField>('empId');
  const [detailSortDirection, setDetailSortDirection] = useState<'asc' | 'desc'>('asc');

  // Summary View Sorting (default by Total Cost descending)
  const [summarySortField, setSummarySortField] = useState<SummarySortField>('totalCost');
  const [summarySortDirection, setSummarySortDirection] = useState<'asc' | 'desc'>('desc');

  // Admin Editing Modal State
  const [editingRecord, setEditingRecord] = useState<ManpowerRecord | null>(null);
  const [editSalary, setEditSalary] = useState<number>(0);
  const [editConveyance, setEditConveyance] = useState<number>(0);
  const [editDesignation, setEditDesignation] = useState<string>('');
  const [editAcademicYear, setEditAcademicYear] = useState<string>('');
  const [editClients, setEditClients] = useState<{ id: string; name: string }[]>([]);
  const [editClientInput, setEditClientInput] = useState<string>('');
  const [editClientSuggestions, setEditClientSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';
  // Only students (and trainees) have an academic year
  const showEditAcademicYear = ['student', 'trainee'].includes((editDesignation || '').toLowerCase().trim());
  const isADOrAbove = isAssistantDirectorOrAbove(currentUser?.designation);
  const canEditManpower = isAdmin || isADOrAbove;
  const canEditRemarks = isAdmin || isADOrAbove;

  // Only Admin can include all HR records; non-admins are strictly active students
  const effectiveIncludeAllHr = isAdmin ? includeAllHr : false;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    Promise.all([
      manpowerService.getManpower({ includeAll: effectiveIncludeAllHr }),
      manpowerService.getClientManpowerRemarks().catch(() => ({})),
      manpowerService.getSalaries().catch(() => [])
    ])
      .then(([mpData, remarksData, salaryRows]) => {
        if (isMounted) {
          // Fill salary/conveyance from the protected salary table when the STD/EMP ID matches
          const salaryById = new Map(salaryRows.map(x => [x.empId, x]));
          setRecords((mpData || []).map(r => {
            const row = withAllClients(r);
            const hit = salaryById.get((r.empId || '').trim().toUpperCase());
            if (!hit) return row;
            return { ...row, salary: hit.salary, conveyance: hit.conveyance, total: hit.salary + hit.conveyance };
          }));
          setRemarksMap(remarksData || {});
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          console.error('Failed to load manpower data:', err);
          setError(err?.message || 'Failed to load manpower records.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveIncludeAllHr]);

  // Unique clients and designations for Details dropdowns
  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.assignedClient && r.assignedClient !== '—' && r.assignedClient.toLowerCase() !== 'unassigned' && r.assignedClient !== ALL_CLIENTS) {
        r.assignedClient.split(',').forEach(c => {
          const trimmed = c.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueDesignations = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      let d = (r.designation || '').trim();
      if (/year/i.test(d)) d = 'Student';
      if (d && d !== 'TBA') {
        set.add(d);
      }
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered & sorted for Details
  const filteredDetails = useMemo(() => {
    return records.filter(r => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = r.name.toLowerCase().includes(term);
        const matchesId = r.empId.toLowerCase().includes(term);
        if (!matchesName && !matchesId) return false;
      }

      if (selectedClient) {
        if (!r.assignedClient.toLowerCase().includes(selectedClient.toLowerCase())) {
          return false;
        }
      }

      if (selectedDesignation) {
        if (r.designation.toLowerCase() !== selectedDesignation.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [records, searchTerm, selectedClient, selectedDesignation]);

  const sortedDetails = useMemo(() => {
    const list = [...filteredDetails];
    list.sort((a, b) => {
      let aVal = a[detailSortField];
      let bVal = b[detailSortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return detailSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      return detailSortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    return list;
  }, [filteredDetails, detailSortField, detailSortDirection]);

  // Grouped Summary Data by Client
  const summaryList = useMemo(() => {
    const groupMap = new Map<string, {
      clientId: string;
      clientName: string;
      jobClientId: string | null;
      manpowerCount: number;
      totalSalary: number;
      totalConveyance: number;
    }>();

    records.forEach(r => {
      let cName = (r.assignedClient || '').trim();
      if (!cName || cName === '—' || cName.toLowerCase() === 'unassigned' || cName.toLowerCase() === 'none' || cName === '-') {
        cName = 'Unassigned';
      }

      // A single-client row is grouped by client id, so two clients with the same
      // name but different job IDs stay separate.
      const singleId = r.clientIds && r.clientIds.length === 1 ? r.clientIds[0] : null;
      const key = singleId ? `${cName.toLowerCase()}|${singleId}` : cName.toLowerCase();
      const cId = r.clientId || (cName === 'Unassigned' ? 'UNASSIGNED' : cName);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          clientId: cId,
          clientName: cName,
          jobClientId: singleId,
          manpowerCount: 0,
          totalSalary: 0,
          totalConveyance: 0
        });
      }

      const item = groupMap.get(key)!;
      item.manpowerCount += 1;
      item.totalSalary += Number(r.salary) || 0;
      item.totalConveyance += Number(r.conveyance) || 0;
    });

    const items: ClientManpowerSummaryItem[] = [];
    groupMap.forEach(g => {
      items.push({
        clientId: g.clientId,
        clientName: g.clientName,
        jobClientId: g.jobClientId,
        manpowerCount: g.manpowerCount,
        totalSalary: g.totalSalary,
        totalConveyance: g.totalConveyance,
        totalCost: g.totalSalary + g.totalConveyance,
        remarks: remarksMap[g.clientId] || ''
      });
    });

    return items;
  }, [records, remarksMap]);

  // Sorted Summary List: sort by summarySortField, and "Unassigned" always last
  const sortedSummaryList = useMemo(() => {
    const regular = summaryList.filter(item => item.clientName !== 'Unassigned' && item.clientName !== ALL_CLIENTS);
    const allClientsRows = summaryList.filter(item => item.clientName === ALL_CLIENTS);
    const unassigned = summaryList.filter(item => item.clientName === 'Unassigned');

    regular.sort((a, b) => {
      let aVal = a[summarySortField];
      let bVal = b[summarySortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return summarySortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      return summarySortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return [...regular, ...allClientsRows, ...unassigned];
  }, [summaryList, summarySortField, summarySortDirection]);

  // Grand Totals for Summary
  const grandTotalManpower = useMemo(() => {
    return summaryList.reduce((sum, item) => sum + item.manpowerCount, 0);
  }, [summaryList]);

  const grandTotalSalary = useMemo(() => {
    return summaryList.reduce((sum, item) => sum + item.totalSalary, 0);
  }, [summaryList]);

  const grandTotalConveyance = useMemo(() => {
    return summaryList.reduce((sum, item) => sum + item.totalConveyance, 0);
  }, [summaryList]);

  const grandTotalCost = useMemo(() => {
    return grandTotalSalary + grandTotalConveyance;
  }, [grandTotalSalary, grandTotalConveyance]);

  // Sorting handlers
  const handleDetailSort = (field: DetailSortField) => {
    if (detailSortField === field) {
      setDetailSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDetailSortField(field);
      setDetailSortDirection('asc');
    }
  };

  const handleSummarySort = (field: SummarySortField) => {
    if (summarySortField === field) {
      setSummarySortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSummarySortField(field);
      setSummarySortDirection('desc');
    }
  };

  // Remark change and save
  const handleRemarkChange = (clientId: string, val: string) => {
    setRemarksMap(prev => ({
      ...prev,
      [clientId]: val
    }));
  };

  const handleRemarkBlur = async (clientId: string) => {
    if (clientId === 'UNASSIGNED') return;
    const remarks = remarksMap[clientId] ?? '';
    setSavingRemarkId(clientId);
    try {
      await manpowerService.saveClientManpowerRemark(
        clientId,
        remarks,
        currentUser?.name || currentUser?.empId
      );
    } catch (err) {
      console.error('Failed to save remark:', err);
    } finally {
      setSavingRemarkId(null);
    }
  };

  const handleClientRowClick = (clientName: string) => {
    if (clientName === 'Unassigned' || clientName === ALL_CLIENTS) {
      setSelectedClient('');
    } else {
      setSelectedClient(clientName);
    }
    setViewMode('details');
  };

  const jobOf = (id?: string | null) => (id ? allClients.find(c => c.id === id)?.jobNumber : undefined);
  const assignedClientText = (r: ManpowerRecord) =>
    r.clientIds && r.clientIds.length > 0
      ? r.clientIds
          .map(id => clientText(allClients.find(c => c.id === id)?.name || r.assignedClient, jobOf(id)))
          .join(', ')
      : r.assignedClient;

  const handleExportExcel = () => {
    const today = new Date().toISOString().split('T')[0];
    const fileName = `ACNABIN_Manpower_Summary_and_Details_${today}.xlsx`;

    // 1. Sheet 1: Client-wise Summary Data
    const summaryData = sortedSummaryList.map((item, idx) => ({
      'SL': idx + 1,
      'Client Name': clientText(item.clientName, jobOf(item.jobClientId)),
      'Manpower': item.manpowerCount,
      'Total Salary': item.totalSalary,
      'Total Conveyance': item.totalConveyance,
      'Total Cost': item.totalCost,
      'Remarks': remarksMap[item.clientId] || ''
    }));

    summaryData.push({
      'SL': '' as any,
      'Client Name': 'GRAND TOTAL',
      'Manpower': grandTotalManpower,
      'Total Salary': grandTotalSalary,
      'Total Conveyance': grandTotalConveyance,
      'Total Cost': grandTotalCost,
      'Remarks': 'Aggregated firm total'
    });

    // 2. Sheet 2: Staff Details Data
    const detailsData = sortedDetails.map((item, idx) => ({
      'SL': idx + 1,
      'EMP/STD ID': item.empId,
      'Name': item.name,
      'Assigned Client': assignedClientText(item),
      'Designation': /year/i.test(item.designation || '') ? 'Student' : (item.designation || ''),
      'Academic Year': item.academicYear && item.academicYear !== '—' ? item.academicYear : '',
      'Monthly Salary': item.salary,
      'Conveyance': item.conveyance,
      'Total Cost': item.total
    }));

    const workbook = XLSX.utils.book_new();

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    const detailsWorksheet = XLSX.utils.json_to_sheet(detailsData);

    summaryWorksheet['!cols'] = [
      { wch: 6 },
      { wch: 38 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 30 }
    ];

    detailsWorksheet['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 28 },
      { wch: 35 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 }
    ];

    // Append both sheets in one Excel file
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, 'Details');

    XLSX.writeFile(workbook, fileName);
  };

  const handleExportDetailsExcel = handleExportExcel;

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedClient('');
    setSelectedDesignation('');
  };

  // Admin Edit Actions
  const handleOpenEdit = (rec: ManpowerRecord) => {
    setEditingRecord(rec);
    setEditSalary(rec.salary);
    setEditConveyance(rec.conveyance);
    let desig = rec.designation;
    if (/year/i.test(desig || '')) desig = 'Student';
    setEditDesignation(desig);
    let acad = rec.academicYear || '';
    if ((!acad || acad === '—') && /year/i.test(rec.designation || '')) {
      acad = rec.designation;
    }
    setEditAcademicYear(acad);
    // Current clients: the user's saved assignments, else match the displayed client names
    const user = allUsers.find(u => (u.empId || '').toUpperCase() === rec.empId.toUpperCase());
    let current = (user?.assignedClientIds || [])
      .map(id => allClients.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map(c => ({ id: c.id, name: c.name }));
    if (current.length === 0 && rec.assignedClient && rec.assignedClient !== 'Unassigned') {
      const names = rec.assignedClient.split(',').map(n => n.trim().toLowerCase());
      current = allClients.filter(c => names.includes(c.name.trim().toLowerCase())).map(c => ({ id: c.id, name: c.name }));
    }
    setEditClients(current);
    setEditClientInput('');
    setEditClientSuggestions([]);
    setEditRemarks((rec as any).remarks || '');
  };

  const handleEditClientInput = (val: string) => {
    setEditClientInput(val);
    if (val.trim()) {
      setEditClientSuggestions(
        allClients
          .filter(c => (c.name.toLowerCase().includes(val.toLowerCase()) || (c.jobNumber || '').toLowerCase().includes(val.toLowerCase())) && !editClients.find(sc => sc.id === c.id))
          .slice(0, 8)
          .map(c => ({ id: c.id, name: c.name }))
      );
    } else {
      setEditClientSuggestions([]);
    }
  };

  const addEditClient = (c: { id: string; name: string }) => {
    setEditClients(prev => (prev.find(x => x.id === c.id) ? prev : [...prev, c]));
    setEditClientInput('');
    setEditClientSuggestions([]);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setIsSavingEdit(true);
    const calculatedTotal = Number(editSalary) + Number(editConveyance);
    // AD and above cannot change designation; only Admin can change designation
    const finalDesignation = isAdmin
      ? (editDesignation.trim() || 'Student')
      : (editingRecord.designation || 'Student');

    const clientNamesText = editClients.map(c => c.name).join(', ');
    const linkedUser = allUsers.find(u => (u.empId || '').toUpperCase() === editingRecord.empId.toUpperCase());

    try {
      // Salary and conveyance live in the protected salary table.
      await manpowerService.setSalary(editingRecord.empId, Number(editSalary) || 0, Number(editConveyance) || 0);

      // Client assignment lives on the user (same as signup); this also updates client access.
      if (linkedUser) {
        await adminService.updateUser(linkedUser.id, { assignedClientIds: editClients.map(c => c.id) });
      }

      await manpowerService.updateManpowerRecord({
        empId: editingRecord.empId,
        salary: Number(editSalary) || 0,
        conveyance: Number(editConveyance) || 0,
        total: calculatedTotal,
        designation: finalDesignation,
        academicYear: editAcademicYear.trim(),
        // With a linked user the assignment was saved above; only pass a name for HR-only rows.
        clientName: linkedUser ? '' : (editClients[0]?.name || ''),
        remarks: editRemarks.trim()
      });

      // Update local state instantly
      setRecords(prev =>
        prev.map(r => {
          if (r.empId === editingRecord.empId) {
            return withAllClients({
              ...r,
              salary: Number(editSalary) || 0,
              conveyance: Number(editConveyance) || 0,
              total: calculatedTotal,
              designation: finalDesignation === 'TBA' ? '' : finalDesignation,
              academicYear: editAcademicYear.trim() || '—',
              assignedClient: clientNamesText || 'Unassigned',
              clientId: editClients[0]?.id || null,
              clientIds: editClients.map(c => c.id)
            });
          }
          return r;
        })
      );

      // Refresh AuthContext data so full task tracker reflects this change immediately
      try {
        await refreshContextData();
      } catch (e) {
        console.warn('Could not refresh context data after manpower update:', e);
      }

      setSuccessToast(`Manpower record for ${editingRecord.name} updated successfully!`);
      setTimeout(() => setSuccessToast(null), 3000);
      setEditingRecord(null);
    } catch (err: any) {
      console.error('Failed to update record:', err);
      alert('Error updating manpower record: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const hasActiveFilters = Boolean(searchTerm || selectedClient || selectedDesignation);

  return (
    <div className="tab-pane">
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            background: '#065F46',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <Check size={16} />
          <span>{successToast}</span>
        </div>
      )}

      {/* 1. TOP ROW: 5-SLOT GRID MATCHING TEAM TASKS EXACT HEIGHT & PROPORTIONS */}
      <div className="stat-pills">
        {/* Pill 1: Total Manpower */}
        <div className="stat-pill">
          <span className="stat-pill-label">
            {effectiveIncludeAllHr ? 'TOTAL MANPOWER' : 'ACTIVE MANPOWER'}
          </span>
          <span className="stat-pill-value">
            {String(viewMode === 'summary' ? grandTotalManpower : records.length).padStart(2, '0')}
          </span>
        </div>

        {/* Pill 2: Total Monthly Salary */}
        <div className="stat-pill">
          <span className="stat-pill-label">TOTAL MONTHLY SALARY</span>
          <span className="stat-pill-value" style={{ color: 'var(--navy, #1B2A6B)' }}>
            {formatBDT(viewMode === 'summary' ? grandTotalSalary : records.reduce((s, r) => s + r.salary, 0))}
          </span>
        </div>

        {/* Pill 3: Total Conveyance */}
        <div className="stat-pill">
          <span className="stat-pill-label">TOTAL CONVEYANCE</span>
          <span className="stat-pill-value" style={{ color: '#03543F' }}>
            {formatBDT(viewMode === 'summary' ? grandTotalConveyance : records.reduce((s, r) => s + r.conveyance, 0))}
          </span>
        </div>

        {/* Pill 4: Grand Total Cost */}
        <div className="stat-pill">
          <span className="stat-pill-label">GRAND TOTAL COST</span>
          <span className="stat-pill-value" style={{ color: 'var(--maroon, #800000)' }}>
            {formatBDT(viewMode === 'summary' ? grandTotalCost : records.reduce((s, r) => s + r.total, 0))}
          </span>
        </div>

        {/* Slot 5: Liquid Glass View Switcher (Distributed Details & Summary) */}
        <div
          className="stat-pill"
          style={{
            padding: isAdmin ? '5px 8px' : '6px 8px',
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
            gap: isAdmin ? '4px' : '0',
            boxSizing: 'border-box'
          }}
        >
          {/* Liquid Glass Segmented View Toggle Buttons (Distributed 50/50) */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              flex: isAdmin ? '0 0 38px' : '1',
              height: isAdmin ? '38px' : '100%',
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
              onClick={() => setViewMode('details')}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: viewMode === 'details' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                cursor: 'pointer',
                background: viewMode === 'details'
                  ? 'linear-gradient(180deg, #8C1414 0%, #800000 60%, #680000 100%)'
                  : 'transparent',
                color: viewMode === 'details' ? '#ffffff' : 'var(--ink-soft)',
                boxShadow: viewMode === 'details'
                  ? '0 3px 10px rgba(128, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5), inset 0 -1px 2px rgba(0, 0, 0, 0.25)'
                  : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: viewMode === 'details' ? 'blur(6px)' : 'none',
                WebkitBackdropFilter: viewMode === 'details' ? 'blur(6px)' : 'none'
              }}
              title="View all manpower staff details"
            >
              <Users size={13} /> Details
            </button>

            <button
              type="button"
              onClick={() => setViewMode('summary')}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: viewMode === 'summary' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                cursor: 'pointer',
                background: viewMode === 'summary'
                  ? 'linear-gradient(180deg, #8C1414 0%, #800000 60%, #680000 100%)'
                  : 'transparent',
                color: viewMode === 'summary' ? '#ffffff' : 'var(--ink-soft)',
                boxShadow: viewMode === 'summary'
                  ? '0 3px 10px rgba(128, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5), inset 0 -1px 2px rgba(0, 0, 0, 0.25)'
                  : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: viewMode === 'summary' ? 'blur(6px)' : 'none',
                WebkitBackdropFilter: viewMode === 'summary' ? 'blur(6px)' : 'none'
              }}
              title="View client-wise cost summary"
            >
              <Building size={13} /> Summary
            </button>
          </div>

          {/* Admin Scope Switcher (Only visible to Admin) */}
          {isAdmin && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingTop: '1px',
                boxSizing: 'border-box'
              }}
            >
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: 'var(--ink-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                HR Data:
              </span>
              <button
                type="button"
                onClick={() => setIncludeAllHr(prev => !prev)}
                style={{
                  background: includeAllHr
                    ? 'linear-gradient(135deg, rgba(128, 0, 0, 0.95), rgba(155, 28, 28, 0.88))'
                    : 'rgba(241, 245, 249, 0.85)',
                  color: includeAllHr ? '#ffffff' : 'var(--ink)',
                  border: '1px solid ' + (includeAllHr ? 'rgba(128, 0, 0, 0.4)' : '#CBD5E1'),
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: includeAllHr ? '0 2px 6px rgba(128, 0, 0, 0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title={includeAllHr ? 'Switch to Active Students Only' : 'Include All 64 HR Records'}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: includeAllHr ? '#34D399' : '#94A3B8'
                  }}
                />
                {includeAllHr ? 'All Records' : 'Active Only'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="auth-alert-error" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {/* 2. VIEW 1: MANPOWER DIRECTORY DETAILS */}
      {viewMode === 'details' && (
        <>
          {/* Details Filter Bar */}
          <div
            className="filter-bar"
            style={{
              display: 'flex',
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
                  placeholder="Search by name or EMP/STD ID…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

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

              <div style={{ minWidth: '160px', flex: '1 1 160px' }}>
                <select
                  className="form-select"
                  style={{ height: '36px', fontSize: '12.5px', width: '100%' }}
                  value={selectedDesignation}
                  onChange={e => setSelectedDesignation(e.target.value)}
                >
                  <option value="">All Designations</option>
                  {uniqueDesignations.map(d => (
                    <option key={d} value={d}>
                      {d}
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
              {!effectiveIncludeAllHr && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
              )}
              Showing {sortedDetails.length} {effectiveIncludeAllHr ? `of ${records.length} staff records` : 'active students'}
            </div>
          </div>

          {/* Manpower Directory Table Card */}
          <div className="table-card">
            <div className="banner-strip banner-maroon" style={{ justifyContent: 'space-between', padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} />
                <span>MANPOWER DIRECTORY</span>
                {!effectiveIncludeAllHr ? (
                  <span
                    style={{
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
                    Active Student Accounts
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      letterSpacing: '0.04em'
                    }}
                  >
                    ALL HR RECORDS
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleExportDetailsExcel}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  color: 'var(--maroon, #800000)',
                  border: 'none',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                title="Export details to Excel"
              >
                <Download size={12} /> Export Excel
              </button>
            </div>

            <div className="table-responsive" style={{ minHeight: '440px' }}>
              <table className="data-table maroon-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', minWidth: '40px', textAlign: 'center' }}>SL.</th>
                    <th
                      onClick={() => handleDetailSort('empId')}
                      style={{ width: '110px', minWidth: '100px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by EMP/STD ID"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <span>EMP/STD</span>
                        {detailSortField === 'empId' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('name')}
                      style={{ width: '18%', minWidth: '150px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Name"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Name</span>
                        {detailSortField === 'name' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('assignedClient')}
                      style={{ width: '22%', minWidth: '170px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Assigned Client"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Assigned Client</span>
                        {detailSortField === 'assignedClient' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('designation')}
                      style={{ width: '14%', minWidth: '130px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Designation"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <span>Designation</span>
                        {detailSortField === 'designation' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('academicYear')}
                      style={{ width: '10%', minWidth: '95px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Academic Year"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <span>Academic Year</span>
                        {detailSortField === 'academicYear' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('salary')}
                      style={{ width: '9%', minWidth: '85px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', paddingRight: '14px' }}
                      title="Sort by Monthly Salary"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                        <span>Salary</span>
                        {detailSortField === 'salary' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('conveyance')}
                      style={{ width: '9%', minWidth: '85px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', paddingRight: '14px' }}
                      title="Sort by Monthly Conveyance"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                        <span>Conveyance</span>
                        {detailSortField === 'conveyance' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('total')}
                      style={{ width: '10%', minWidth: '90px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', paddingRight: '14px' }}
                      title="Sort by Total Cost"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                        <span>Total</span>
                        {detailSortField === 'total' ? (
                          detailSortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.5} />
                        )}
                      </div>
                    </th>
                    {canEditManpower && (
                      <th style={{ width: '70px', minWidth: '65px', textAlign: 'center' }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={canEditManpower ? 10 : 9} style={{ textAlign: 'center', padding: '48px 16px' }}>
                        <div className="loading-indicator">Loading manpower records…</div>
                      </td>
                    </tr>
                  ) : sortedDetails.length === 0 ? (
                    <tr>
                      <td colSpan={canEditManpower ? 10 : 9} className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
                        <Filter size={32} style={{ color: 'var(--ink-muted)', opacity: 0.5, marginBottom: '8px' }} />
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
                          No manpower records found
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                          Try clearing or modifying the current search and filter settings.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedDetails.map((item, idx) => (
                      <tr key={`${item.empId}-${idx}`}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                          {idx + 1}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' }}>
                          {item.empId}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--ink)' }}>
                          {item.name}
                        </td>
                        <td style={{ color: 'var(--ink)', fontSize: '12.5px' }}>
                          {item.clientIds && item.clientIds.length > 0
                            ? item.clientIds.map(id => (
                                <div key={id}>
                                  <ClientLabel id={id} name={allClients.find(c => c.id === id)?.name || item.assignedClient} />
                                </div>
                              ))
                            : item.assignedClient}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {item.designation && item.designation !== 'TBA' ? (
                            <span
                              className="role-badge user"
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                background: item.empId.startsWith('EMP') ? '#EFF6FF' : '#F1F5F9',
                                color: item.empId.startsWith('EMP') ? '#1E40AF' : 'var(--ink)'
                              }}
                            >
                              {/year/i.test(item.designation) ? 'Student' : item.designation}
                            </span>
                          ) : null}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--ink-soft)' }}>
                          {renderAcademicYear(item.academicYear)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', paddingRight: '14px' }}>
                          {formatBDT(item.salary)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', paddingRight: '14px' }}>
                          {formatBDT(item.conveyance)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: 'var(--maroon)',
                            paddingRight: '14px'
                          }}
                        >
                          {formatBDT(item.total)}
                        </td>
                        {canEditManpower && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Edit manpower record"
                            >
                              <Pencil size={11} /> Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 3. VIEW 2: CLIENT-WISE SUMMARY */}
      {viewMode === 'summary' && (
        <div className="table-card">
          <div className="banner-strip banner-maroon" style={{ justifyContent: 'space-between', padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} />
              <span>CLIENT-WISE MANPOWER & COST SUMMARY</span>
              {!effectiveIncludeAllHr ? (
                <span
                  style={{
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
                  Active Student Accounts
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    letterSpacing: '0.04em'
                  }}
                >
                  ALL HR RECORDS
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                color: 'var(--maroon, #800000)',
                border: 'none',
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              title="Download Excel spreadsheet"
            >
              <Download size={12} /> Export Excel
            </button>
          </div>

          <div className="table-responsive" style={{ minHeight: '440px' }}>
            <table className="data-table maroon-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>SL.</th>

                  <th
                    onClick={() => handleSummarySort('clientName')}
                    style={{ width: '28%', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort by Client Name"
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>Client Name</span>
                      {summarySortField === 'clientName' ? (
                        summarySortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} opacity={0.5} />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSummarySort('manpowerCount')}
                    style={{ width: '10%', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                    title={`Click to sort by ${effectiveIncludeAllHr ? 'Manpower' : 'Students'} count`}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                      <span>{effectiveIncludeAllHr ? 'Manpower' : 'Students'}</span>
                      {summarySortField === 'manpowerCount' ? (
                        summarySortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} opacity={0.5} />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSummarySort('totalSalary')}
                    style={{ width: '13%', textAlign: 'right', cursor: 'pointer', userSelect: 'none', paddingRight: '14px' }}
                    title="Click to sort by Total Salary"
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                      <span>Total Salary</span>
                      {summarySortField === 'totalSalary' ? (
                        summarySortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} opacity={0.5} />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSummarySort('totalConveyance')}
                    style={{ width: '13%', textAlign: 'right', cursor: 'pointer', userSelect: 'none', paddingRight: '14px' }}
                    title="Click to sort by Total Conveyance"
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                      <span>Total Conveyance</span>
                      {summarySortField === 'totalConveyance' ? (
                        summarySortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} opacity={0.5} />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSummarySort('totalCost')}
                    style={{ width: '14%', textAlign: 'right', cursor: 'pointer', userSelect: 'none', paddingRight: '14px' }}
                    title="Click to sort by Total Cost"
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                      <span>Total Cost</span>
                      {summarySortField === 'totalCost' ? (
                        summarySortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} opacity={0.5} />
                      )}
                    </div>
                  </th>

                  <th style={{ width: '18%', textAlign: 'left', paddingLeft: '12px' }}>
                    Remarks
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px' }}>
                      <div className="loading-indicator">Computing client manpower summary…</div>
                    </td>
                  </tr>
                ) : sortedSummaryList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
                      <Building size={32} style={{ color: 'var(--ink-muted)', opacity: 0.5, marginBottom: '8px' }} />
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
                        No client summary data available
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {sortedSummaryList.map((item, idx) => {
                      const isUnassigned = item.clientName === 'Unassigned';
                      return (
                        <tr
                          key={`${item.clientId}-${idx}`}
                          onClick={() => handleClientRowClick(item.clientName)}
                          style={{
                            cursor: 'pointer',
                            background: isUnassigned ? '#FFFBF0' : undefined
                          }}
                          title={`Click to view students for ${item.clientName}`}
                        >
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                            {idx + 1}
                          </td>

                          <td style={{ fontWeight: 700, color: isUnassigned ? '#B45309' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Building size={14} color={isUnassigned ? '#B45309' : 'var(--navy)'} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.jobClientId ? <ClientLabel id={item.jobClientId} name={item.clientName} /> : item.clientName}
                              </span>
                            </div>
                          </td>

                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: '#EFF6FF',
                                color: '#1E40AF'
                              }}
                            >
                              <Users size={11} /> {item.manpowerCount}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', paddingRight: '14px' }}>
                            {formatBDT(item.totalSalary)}
                          </td>

                          <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', paddingRight: '14px' }}>
                            {formatBDT(item.totalConveyance)}
                          </td>

                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: 'var(--maroon)',
                              paddingRight: '14px'
                            }}
                          >
                            {formatBDT(item.totalCost)}
                          </td>

                          {/* Editable Remarks Column */}
                          <td
                            onClick={e => e.stopPropagation()}
                            style={{ padding: '6px 12px' }}
                          >
                            {isUnassigned || item.clientName === ALL_CLIENTS ? (
                              <span style={{ color: 'var(--ink-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                                Not applicable
                              </span>
                            ) : canEditRemarks ? (
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={remarksMap[item.clientId] ?? item.remarks ?? ''}
                                  placeholder="Add client remarks…"
                                  onChange={e => handleRemarkChange(item.clientId, e.target.value)}
                                  onBlur={() => handleRemarkBlur(item.clientId)}
                                  style={{
                                    width: '100%',
                                    height: '30px',
                                    fontSize: '12px',
                                    paddingRight: savingRemarkId === item.clientId ? '24px' : '8px'
                                  }}
                                />
                                {savingRemarkId === item.clientId && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      right: '8px',
                                      fontSize: '10px',
                                      color: '#03543F'
                                    }}
                                  >
                                    <Check size={12} />
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '12.5px', color: 'var(--ink)' }}>
                                {remarksMap[item.clientId] || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Bold GRAND TOTAL Row at the bottom */}
                    <tr
                      style={{
                        fontWeight: 800,
                        background: '#F1F5F9',
                        borderTop: '2px solid var(--line-strong)',
                        fontSize: '13px'
                      }}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>—</td>

                      <td style={{ fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        GRAND TOTAL
                      </td>

                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--navy)' }}>
                        {grandTotalManpower}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', paddingRight: '14px', color: 'var(--ink)' }}>
                        {formatBDT(grandTotalSalary)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', paddingRight: '14px', color: 'var(--ink)' }}>
                        {formatBDT(grandTotalConveyance)}
                      </td>

                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          color: 'var(--maroon)',
                          paddingRight: '14px'
                        }}
                      >
                        {formatBDT(grandTotalCost)}
                      </td>

                      <td style={{ color: 'var(--ink-muted)', fontSize: '12px', fontStyle: 'italic', paddingLeft: '12px' }}>
                        All client costs aggregated
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ADMIN EDIT MANPOWER MODAL */}
      {editingRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeInTab 0.15s ease'
          }}
          onClick={() => !isSavingEdit && setEditingRecord(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="banner-strip banner-maroon"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
                <Pencil size={15} />
                <span>EDIT MANPOWER RECORD</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Readonly Staff Info Banner */}
            <div
              style={{
                background: '#F8FAFC',
                borderBottom: '1px solid var(--line)',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                  {editingRecord.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--navy)', fontFamily: 'monospace', fontWeight: 700 }}>
                  {editingRecord.empId}
                </div>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#E2E8F0',
                  color: 'var(--ink)',
                  padding: '3px 8px',
                  borderRadius: '12px'
                }}
              >
                {isAdmin ? 'ADMIN EDIT' : 'MANPOWER EDIT'}
              </span>
            </div>

            {/* Modal Body Form */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: showEditAcademicYear ? '1fr 1fr' : '1fr', gap: '12px' }}>
                <div className="form-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>Designation</label>
                    {!isAdmin && (
                      <span style={{ fontSize: '11px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                        Admin only
                      </span>
                    )}
                  </div>
                  <select
                    className="form-select"
                    value={editDesignation}
                    onChange={e => setEditDesignation(e.target.value)}
                    disabled={!isAdmin}
                    style={{
                      height: '36px',
                      fontSize: '13px',
                      background: !isAdmin ? '#F1F5F9' : '#ffffff',
                      cursor: !isAdmin ? 'not-allowed' : undefined,
                      color: !isAdmin ? 'var(--ink-muted)' : undefined,
                      borderColor: !isAdmin ? '#E2E8F0' : undefined
                    }}
                    title={!isAdmin ? 'Designation cannot be modified by Assistant Director or above (Admin only)' : undefined}
                  >
                    {DESIGNATIONS.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    {!DESIGNATIONS.includes(editDesignation as any) && editDesignation && (
                      <option value={editDesignation}>{editDesignation}</option>
                    )}
                  </select>
                </div>

                {showEditAcademicYear && (
                <div className="form-field">
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>Academic Year</label>
                  <select
                    className="form-select"
                    value={editAcademicYear}
                    onChange={e => setEditAcademicYear(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  >
                    <option value="">None / Not Applicable</option>
                    <option value="1st Year">1ˢᵗ Year</option>
                    <option value="2nd Year">2ⁿᵈ Year</option>
                    <option value="3rd Year">3ʳᵈ Year</option>
                    <option value="4th Year">4ᵗʰ Year</option>
                    {editAcademicYear && !['', '1st Year', '2nd Year', '3rd Year', '4th Year'].includes(editAcademicYear) && (
                      <option value={editAcademicYear}>{editAcademicYear}</option>
                    )}
                  </select>
                </div>
                )}
              </div>

              <div className="form-field" style={{ position: 'relative' }}>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Assigned Client</label>
                {editClients.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                    {editClients.map(c => (
                      <span
                        key={c.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'var(--navy-light, #EBF0FE)',
                          border: '1px solid var(--navy, #1B2A6B)',
                          borderRadius: '20px',
                          padding: '2px 10px',
                          fontSize: '12px',
                          color: 'var(--navy, #1B2A6B)',
                          fontWeight: 600
                        }}
                      >
                        <span><ClientLabel id={c.id} name={c.name} /></span>
                        <button
                          type="button"
                          onClick={() => setEditClients(prev => prev.filter(x => x.id !== c.id))}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--maroon)', fontWeight: 700, padding: 0, lineHeight: 1, fontSize: '14px' }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  className="form-input"
                  value={editClientInput}
                  onChange={e => handleEditClientInput(e.target.value)}
                  onBlur={() => setTimeout(() => setEditClientSuggestions([]), 150)}
                  placeholder="Type to search client name…"
                  autoComplete="off"
                  style={{ height: '36px', fontSize: '13px' }}
                />
                {editClientSuggestions.length > 0 && (
                  <ul
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      margin: 0,
                      padding: '4px 0',
                      listStyle: 'none',
                      maxHeight: '160px',
                      overflowY: 'auto'
                    }}
                  >
                    {editClientSuggestions.map(c => (
                      <li
                        key={c.id}
                        onMouseDown={() => addEditClient(c)}
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--ink)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt, #F5F3EF)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <ClientLabel id={c.id} name={c.name} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-field">
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>Monthly Salary (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    className="form-input"
                    value={editSalary}
                    onChange={e => setEditSalary(Number(e.target.value) || 0)}
                    style={{ height: '36px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600 }}
                  />
                </div>

                <div className="form-field">
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>Conveyance (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="form-input"
                    value={editConveyance}
                    onChange={e => setEditConveyance(Number(e.target.value) || 0)}
                    style={{ height: '36px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Live Calculated Total Display */}
              <div
                style={{
                  background: '#FDF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--maroon)' }}>
                  Total Monthly Cost:
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--maroon)' }}>
                  {formatBDT(Number(editSalary) + Number(editConveyance))}
                </span>
              </div>

              <div className="form-field">
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  placeholder="Optional staff remarks…"
                  style={{ height: '36px', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                background: '#F8FAFC'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingRecord(null)}
                disabled={isSavingEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                style={{ minWidth: '120px' }}
              >
                {isSavingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
