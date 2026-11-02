import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { InfoField } from '../../lib/infoRequestFields';
import {
  getUserAssignedClientIds,
  isAssistantDirectorOrAbove,
  isStudentLevelDesignation,
  normalizeBDMobile
} from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { notificationService } from '../../services/notificationService';
import { ClientLabel } from '../ui/ClientLabel';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const FULL_REQUEST: InfoField[] = ['academicYear', 'salary', 'conveyance', 'bloodGroup', 'emergency'];

interface Props {
  /** What this request asks for (the Admin chooses). Defaults to everything except clients. */
  fields?: InfoField[];
  onClose: () => void;
  onDone: () => void;
}

export const ProfileInfoModal: React.FC<Props> = ({ fields = FULL_REQUEST, onClose, onDone }) => {
  const { currentUser, allClients, refreshContextData } = useAuth();
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  const has = (f: InfoField) => fields.includes(f);

  // Only student-level roles (Student, Trainee, In Charge, Supervisor) have an academic year
  const showYear = has('academicYear') && isStudentLevelDesignation(currentUser?.designation);
  const showClient = has('client');
  const showSalary = has('salary');
  const showDaily = has('conveyance');
  const showBlood = has('bloodGroup');
  const showEmergency = has('emergency');
  // The original full request is saved in one go; anything narrower only changes the asked fields
  const isFullRequest = !showClient && FULL_REQUEST.every(has);

  // Assistant Director and above may submit without filling anything in
  const infoOptional = isAssistantDirectorOrAbove(currentUser?.designation);
  const [academicYear, setAcademicYear] = useState('');
  const [salary, setSalary] = useState('');
  const [daily, setDaily] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emName, setEmName] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const initialClients = useMemo(() => getUserAssignedClientIds(currentUser), [currentUser]);
  const [clientIds, setClientIds] = useState<string[]>(initialClients);
  const [clientSearch, setClientSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Walton clients work 24 days a month, everyone else 22 (the database applies the same rule).
  const days = useMemo(() => {
    const isWalton = allClients.some(c => clientIds.includes(c.id) && /walton/i.test(c.name));
    return isWalton ? 24 : 22;
  }, [clientIds, allClients]);

  // Prefill salary and daily conveyance with what is already on record
  const [current, setCurrent] = useState<{ salary: number | null; daily: number | null } | null>(null);
  useEffect(() => {
    if (!showSalary && !showDaily) return;
    let alive = true;
    notificationService
      .getMyInfo()
      .then(info => {
        if (!alive || !info) return;
        const d =
          info.dailyConveyance !== null
            ? info.dailyConveyance
            : info.conveyance !== null
              ? Math.round(info.conveyance / days)
              : null;
        setCurrent({ salary: info.salary, daily: d });
        if (info.salary !== null) setSalary(s => (s === '' ? String(info.salary) : s));
        if (d !== null) setDaily(v => (v === '' ? String(d) : v));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dailyNum = Number(daily) || 0;
  const monthlyConveyance = dailyNum * days;

  const visibleClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return allClients
      .filter(c => c.status !== 'INACTIVE' || clientIds.includes(c.id))
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.jobNumber || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allClients, clientSearch, clientIds]);

  const toggleClient = (id: string) => setClientIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  const makePrimary = (id: string) => setClientIds(ids => [id, ...ids.filter(x => x !== id)]);
  const clientsChanged = clientIds.join(',') !== initialClients.join(',');

  const handleSubmit = async () => {
    setError(null);
    const allBlank =
      !clientsChanged && !academicYear && (!showSalary || salary.trim() === '') && (!showDaily || daily.trim() === '') &&
      !bloodGroup && !emName.trim() && !emPhone.trim();
    if (infoOptional && allBlank) {
      onDone(); // nothing to update: just complete the request
      return;
    }

    if (showClient && clientIds.length === 0) return setError('Please choose at least one client.');
    if (showYear && !academicYear) return setError('Please select your academic year.');
    if (showSalary && (salary.trim() === '' || Number(salary) < 0)) return setError('Please enter your monthly salary/allowance (0 if none).');
    if (showDaily && (daily.trim() === '' || Number(daily) < 0)) return setError('Please enter your daily conveyance (0 if none).');
    if (showBlood && !bloodGroup) return setError('Please select your blood group.');
    if (showEmergency && !emName.trim()) return setError('Please enter your emergency contact name.');
    const phone = showEmergency ? normalizeBDMobile(emPhone) || '' : '';
    if (showEmergency && !phone) return setError('Please enter a valid emergency contact mobile number (01XXXXXXXXX).');

    setSaving(true);
    try {
      // Clients first, so the Walton 24-day rule sees the new clients when conveyance is saved
      if (showClient && clientsChanged && currentUser) {
        await adminService.updateUser(currentUser.id, { assignedClientIds: clientIds });
        await refreshContextData();
        // Monthly conveyance = daily x 22 or 24 days (Walton). If the new clients change the days, re-save the
        // daily amount already on record so the monthly figure follows (when conveyance is asked, it is saved below).
        if (!showDaily) {
          const info = await notificationService.getMyInfo().catch(() => null);
          if (info && info.dailyConveyance !== null && info.dailyConveyance !== undefined) {
            await notificationService.saveMyInfo({ dailyConveyance: info.dailyConveyance });
          }
        }
      }
      if (isFullRequest) {
        await notificationService.submitProfileInfo({
          academicYear: showYear ? academicYear : '',
          salary: Number(salary),
          dailyConveyance: Number(daily),
          bloodGroup,
          emergencyName: emName.trim(),
          emergencyPhone: phone
        });
      } else if (showYear || showSalary || showDaily || showBlood || showEmergency) {
        // Only the asked fields are sent; everything else on record stays as it is
        await notificationService.saveMyInfo({
          ...(showYear ? { academicYear } : {}),
          ...(showSalary ? { salary: Number(salary) } : {}),
          ...(showDaily ? { dailyConveyance: Number(daily) } : {}),
          ...(showBlood ? { bloodGroup } : {}),
          ...(showEmergency ? { emergencyName: emName.trim(), emergencyPhone: phone } : {})
        });
      }
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onlySalaryAndConveyance = fields.length === 2 && showSalary && showDaily;
  const title = isFullRequest
    ? 'UPDATE YOUR INFORMATION'
    : onlySalaryAndConveyance
      ? 'UPDATE YOUR SALARY & CONVEYANCE'
      : 'UPDATE YOUR INFORMATION';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="modal-dialog"
        style={{
          background: isGlass ? 'var(--ui-modal-bg)' : '#ffffff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: isGlass ? 'var(--ui-shadow)' : '0 20px 40px rgba(0, 0, 0, 0.25)',
          border: isGlass ? '1px solid var(--ui-border)' : undefined,
          backdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
          WebkitBackdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
          color: isGlass ? '#ffffff' : undefined
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="banner-strip banner-maroon"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}
        >
          <span style={{ fontSize: '14px', fontWeight: 700 }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {infoOptional && (
            <div style={{ fontSize: '12.5px', color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px 10px' }}>
              Optional for your role. You can submit without filling anything in. If you do fill something in, please complete every field.
            </div>
          )}

          {!showClient && !showYear && !showSalary && !showDaily && !showBlood && !showEmergency && (
            <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
              Nothing to fill in for your role. Press Submit to complete this request.
            </div>
          )}

          {showClient && (
            <div className="form-field">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Your Client(s)</label>
              <div style={{ fontSize: '12px', color: 'var(--ink-soft)', margin: '2px 0 6px' }}>
                Tick every client you work on. The first one is your Primary client; use "Make primary" to change it.
              </div>
              <input
                type="text"
                className="form-input"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Search clients…"
                style={{ height: '34px', fontSize: '13px', marginBottom: '6px' }}
              />
              <div style={{ maxHeight: '210px', overflowY: 'auto', border: isGlass ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--line)', borderRadius: '8px' }}>
                {visibleClients.map((c, i) => {
                  const selected = clientIds.includes(c.id);
                  const isPrimary = clientIds[0] === c.id;
                  return (
                    <label
                      key={c.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', cursor: 'pointer',
                        borderTop: i === 0 ? 'none' : isGlass ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid var(--line)',
                        background: selected
                          ? (isGlass ? 'rgba(246, 139, 139, 0.14)' : 'rgba(128, 0, 0, 0.05)')
                          : (isGlass ? 'rgba(255, 255, 255, 0.04)' : '#ffffff')
                      }}
                    >
                      <input type="checkbox" checked={selected} onChange={() => toggleClient(c.id)} />
                      <span style={{ flex: 1, fontSize: '13px' }}><ClientLabel id={c.id} name={c.name} /></span>
                      {isPrimary && <span style={{ fontSize: '11px', fontWeight: 700, color: isGlass ? '#77dfc0' : '#166534' }}>Primary</span>}
                      {selected && !isPrimary && (
                        <button
                          type="button"
                          onClick={e => { e.preventDefault(); makePrimary(c.id); }}
                          style={{ fontSize: '11px', border: 'none', background: 'transparent', color: isGlass ? '#fca5a5' : 'var(--maroon, #800000)', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Make primary
                        </button>
                      )}
                    </label>
                  );
                })}
                {visibleClients.length === 0 && (
                  <div style={{ padding: '12px', fontSize: '12.5px', color: 'var(--ink-muted)' }}>No client matches.</div>
                )}
              </div>
            </div>
          )}

          {showYear && (
            <div className="form-field">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Academic Year</label>
              <select
                className="form-select"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                style={{ height: '36px', fontSize: '13px' }}
              >
                <option value="">Select…</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {showSalary && (
            <div className="form-field">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Monthly Salary / Allowance (৳)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={salary}
                onChange={e => setSalary(e.target.value)}
                placeholder="e.g. 15000"
                style={{ height: '36px', fontSize: '13px' }}
              />
              {current && (
                <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                  Current on record: {current.salary === null ? 'not set' : `৳ ${current.salary.toLocaleString('en-IN')}`}
                </div>
              )}
            </div>
          )}

          {showDaily && (
            <div className="form-field">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Daily Conveyance (৳ per day, total for going and returning)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={daily}
                onChange={e => setDaily(e.target.value)}
                placeholder="e.g. 120"
                style={{ height: '36px', fontSize: '13px' }}
              />
              {current && (
                <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                  Current on record: {current.daily === null ? 'not set' : `৳ ${current.daily.toLocaleString('en-IN')} per day`}
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                Monthly conveyance = ৳ {dailyNum.toLocaleString('en-IN')} × {days} days ={' '}
                <strong>৳ {monthlyConveyance.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          )}

          {showBlood && (
            <div className="form-field">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Blood Group</label>
              <select
                className="form-select"
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value)}
                style={{ height: '36px', fontSize: '13px' }}
              >
                <option value="">Select…</option>
                {BLOOD_GROUPS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {showEmergency && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-field">
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Emergency Contact Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={emName}
                  onChange={e => setEmName(e.target.value)}
                  style={{ height: '36px', fontSize: '13px' }}
                />
              </div>
              <div className="form-field">
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Emergency Contact Mobile</label>
                <input
                  type="tel"
                  className="form-input"
                  value={emPhone}
                  onChange={e => setEmPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  style={{ height: '36px', fontSize: '13px' }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="auth-alert-error" style={{ margin: 0 }}>
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderTop: isGlass ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: isGlass ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
            style={{
              background: isGlass ? 'rgba(255, 255, 255, 0.10)' : undefined,
              color: isGlass ? '#ffffff' : undefined,
              border: isGlass ? '1px solid rgba(255, 255, 255, 0.20)' : undefined
            }}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ minWidth: '120px' }}>
            {saving ? 'Saving…' : (<><Check size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Submit</>)}
          </button>
        </div>
      </div>
    </div>
  );
};
