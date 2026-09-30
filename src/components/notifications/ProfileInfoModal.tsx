import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAssistantDirectorOrAbove, normalizeBDMobile } from '../../lib/permissions';
import { notificationService } from '../../services/notificationService';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export const ProfileInfoModal: React.FC<Props> = ({ onClose, onDone }) => {
  const { currentUser, allClients } = useAuth();

  // Only students (and trainees, who are given a year at signup) have an academic year
  const hasAcademicYear = ['student', 'trainee'].includes((currentUser?.designation || '').toLowerCase().trim());
  // Assistant Director and above may submit without filling anything in
  const infoOptional = isAssistantDirectorOrAbove(currentUser?.designation);
  const [academicYear, setAcademicYear] = useState('');
  const [salary, setSalary] = useState('');
  const [daily, setDaily] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emName, setEmName] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Walton clients work 24 days a month, everyone else 22 (the database applies the same rule).
  const days = useMemo(() => {
    const ids = new Set<string>(currentUser?.assignedClientIds || []);
    (currentUser?.signupClientId || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(id => ids.add(id));
    const isWalton = allClients.some(c => ids.has(c.id) && /walton/i.test(c.name));
    return isWalton ? 24 : 22;
  }, [currentUser, allClients]);

  const dailyNum = Number(daily) || 0;
  const monthlyConveyance = dailyNum * days;

  const handleSubmit = async () => {
    setError(null);
    const allBlank =
      !academicYear && salary.trim() === '' && daily.trim() === '' && !bloodGroup && !emName.trim() && !emPhone.trim();
    if (infoOptional && allBlank) {
      onDone(); // nothing to update: just complete the request
      return;
    }
    if (hasAcademicYear && !academicYear) return setError('Please select your academic year.');
    if (salary.trim() === '' || Number(salary) < 0) return setError('Please enter your monthly salary/allowance (0 if none).');
    if (daily.trim() === '' || Number(daily) < 0) return setError('Please enter your daily conveyance (0 if none).');
    if (!bloodGroup) return setError('Please select your blood group.');
    if (!emName.trim()) return setError('Please enter your emergency contact name.');
    const phone = normalizeBDMobile(emPhone);
    if (!phone) return setError('Please enter a valid emergency contact mobile number (01XXXXXXXXX).');

    setSaving(true);
    try {
      await notificationService.submitProfileInfo({
        academicYear: hasAcademicYear ? academicYear : '',
        salary: Number(salary),
        dailyConveyance: Number(daily),
        bloodGroup,
        emergencyName: emName.trim(),
        emergencyPhone: phone
      });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="banner-strip banner-maroon"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}
        >
          <span style={{ fontSize: '14px', fontWeight: 700 }}>UPDATE YOUR INFORMATION</span>
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
          {hasAcademicYear && (
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
          </div>

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
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
              Monthly conveyance = ৳ {dailyNum.toLocaleString('en-IN')} × {days} days ={' '}
              <strong>৳ {monthlyConveyance.toLocaleString('en-IN')}</strong>
            </div>
          </div>

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

          {error && (
            <div className="auth-alert-error" style={{ margin: 0 }}>
              {error}
            </div>
          )}
        </div>

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
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
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
