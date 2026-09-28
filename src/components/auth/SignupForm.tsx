import React, { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BRAND, DESIGNATIONS } from '../../lib/constants';
import { formatHrmId, isAssistantDirectorOrAbove, normalizeBDMobile } from '../../lib/permissions';
import { Designation } from '../../types';
import { manpowerService } from '../../services/manpowerService';

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

// Manager-level suggestions when typing "manager"
const MANAGER_SUGGESTIONS: Designation[] = ['Senior Assistant Manager', 'Deputy Manager', 'Manager'];
// Director-level suggestions when typing "director"
const DIRECTOR_SUGGESTIONS: Designation[] = ['Assistant Director', 'Deputy Director', 'Director'];

function getDesignationSuggestions(input: string): Designation[] {
  if (!input.trim()) return [];
  const lower = input.toLowerCase();
  if ('manager'.startsWith(lower) || lower.includes('manager') || lower === 'sam' || lower === 'dm') {
    return MANAGER_SUGGESTIONS;
  }
  if ('director'.startsWith(lower) || lower.includes('director') || lower === 'ad' || lower === 'dd') {
    return DIRECTOR_SUGGESTIONS;
  }
  return DESIGNATIONS.filter(d => d.toLowerCase().includes(lower));
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSwitchToLogin }) => {
  const { register, allClients } = useAuth();
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('');
  const [academicYear, setAcademicYear] = useState('1st Year');
  const [designationSuggestions, setDesignationSuggestions] = useState<Designation[]>([]);
  const [showDesignationDropdown, setShowDesignationDropdown] = useState(false);
  const [hrAutofillHint, setHrAutofillHint] = useState(false);

  // Multi-client free-text with autocomplete
  const [clientInput, setClientInput] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [selectedClients, setSelectedClients] = useState<{ id: string; name: string }[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const designationRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);

  // Is assistant director or above? Hide client box
  const hideClientBox = isAssistantDirectorOrAbove(designation);

  const handleEmpIdBlur = async () => {
    const trimmed = empId.trim();
    if (!trimmed) return;
    try {
      const staff = await manpowerService.lookupStaff(trimmed);
      if (staff && (staff.name || staff.email || staff.designation || staff.mobile)) {
        if (staff.name) setName(staff.name);
        if (staff.email) setEmail(staff.email);
        if (staff.mobile && !mobile) setMobile(staff.mobile);
        if (staff.designation) {
          setDesignation(staff.designation);
          if (isAssistantDirectorOrAbove(staff.designation)) {
            setSelectedClients([]);
            setClientInput('');
          }
        }
        if (staff.academicYear) {
          setAcademicYear(staff.academicYear);
        } else if (staff.designation === 'Trainee') {
          setAcademicYear('1st Year');
        }
        setHrAutofillHint(true);
      }
    } catch {
      // Do nothing on failure
    }
  };

  const handleDesignationInput = (val: string) => {
    setDesignation(val);
    if (val.toLowerCase() === 'trainee') {
      setAcademicYear('1st Year');
    }
    const suggestions = getDesignationSuggestions(val);
    setDesignationSuggestions(suggestions);
    setShowDesignationDropdown(suggestions.length > 0 && val.trim().length > 0);
  };

  const selectDesignation = (d: Designation) => {
    setDesignation(d);
    setShowDesignationDropdown(false);
    if (d === 'Trainee') {
      setAcademicYear('1st Year');
    }
    if (isAssistantDirectorOrAbove(d)) {
      setSelectedClients([]);
      setClientInput('');
    }
  };

  const handleClientInput = (val: string) => {
    setClientInput(val);
    if (val.trim().length > 0) {
      const matches = allClients.filter(
        c =>
          c.name.toLowerCase().includes(val.toLowerCase()) &&
          !selectedClients.find(sc => sc.id === c.id)
      );
      setClientSuggestions(matches.slice(0, 8));
    } else {
      setClientSuggestions([]);
    }
  };

  const addClient = (client: { id: string; name: string }) => {
    if (!selectedClients.find(sc => sc.id === client.id)) {
      setSelectedClients(prev => [...prev, client]);
    }
    setClientInput('');
    setClientSuggestions([]);
  };

  const removeClient = (id: string) => {
    setSelectedClients(prev => prev.filter(c => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !empId.trim() || !email.trim() || !mobile.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    const normalizedMobile = normalizeBDMobile(mobile);
    if (!normalizedMobile) {
      setError('Please enter a valid Bangladesh mobile number (11 digits starting with 01, e.g. 01XXXXXXXXX).');
      return;
    }

    const clientIds = selectedClients.map(c => c.id).join(', ');
    const clientNames = selectedClients.map(c => c.name).join(', ');

    const formattedEmpId = formatHrmId(empId, designation);
    const isStudent = designation.toLowerCase() === 'student';
    const isTrainee = designation.toLowerCase() === 'trainee';
    const finalAcademicYear = isStudent ? academicYear : (isTrainee ? '1st Year' : undefined);

    setError(null);
    setLoading(true);
    try {
      await register({
        name,
        empId: formattedEmpId,
        email,
        mobile: normalizedMobile,
        password,
        designation: designation as Designation,
        clientId: clientIds,
        clientName: clientNames || undefined,
        academicYear: finalAcademicYear
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: '440px' }}>
        <div className="auth-card-header">
          <div
            className="brand-logo-badge"
            style={{ width: 56, height: 56, fontSize: 20, margin: '0 auto 12px' }}
          >
            {BRAND.initials}
          </div>
          <h2 className="auth-card-title">Join {BRAND.name}</h2>
          <p className="auth-card-subtitle">Create your portal access account</p>
        </div>

        {error && <div className="auth-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 1. ID / Partner Initial (First to ask for instant HR auto-fill) */}
          <div className="form-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label style={{ margin: 0 }}>Employee / Student ID / Partner Initial</label>
              {hrAutofillHint && (
                <span style={{ fontSize: '11px', color: '#03543F', fontWeight: 600 }}>
                  ✓ Filled from HR records
                </span>
              )}
            </div>
            <input
              type="text"
              value={empId}
              onChange={e => {
                setEmpId(e.target.value);
                setHrAutofillHint(false);
              }}
              onBlur={handleEmpIdBlur}
              className="form-input"
              placeholder="e.g. STD-001643 or EMP-000230 or AB"
              required
              autoFocus
            />
          </div>

          {/* 2. Full Name */}
          <div className="form-field">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="form-input"
              placeholder="Full Name as per firm records"
              required
            />
          </div>

          {/* 3. Email */}
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              placeholder="email@gmail.com"
              required
            />
          </div>

          {/* 4. Mobile Number */}
          <div className="form-field">
            <label>Mobile Number</label>
            <input
              type="tel"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              className="form-input"
              placeholder="01XXXXXXXXX"
              required
            />
          </div>

          {/* Designation with autocomplete */}
          <div className="form-field" ref={designationRef} style={{ position: 'relative' }}>
            <label>Designation</label>
            <input
              type="text"
              value={designation}
              onChange={e => handleDesignationInput(e.target.value)}
              onFocus={() => {
                if (designation.trim()) {
                  const s = getDesignationSuggestions(designation);
                  setDesignationSuggestions(s);
                  setShowDesignationDropdown(s.length > 0);
                }
              }}
              onBlur={() => setTimeout(() => setShowDesignationDropdown(false), 150)}
              className="form-input"
              placeholder="Student, Manager, Director, Partner…"
              autoComplete="off"
            />
            {showDesignationDropdown && (
              <ul style={{
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
                maxHeight: '180px',
                overflowY: 'auto'
              }}>
                {designationSuggestions.map(d => (
                  <li
                    key={d}
                    onMouseDown={() => selectDesignation(d)}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--ink)'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt, #F5F3EF)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Academic Year (only for Student) */}
          {designation.toLowerCase() === 'student' && (
            <div className="form-field">
              <label>Academic Year</label>
              <select
                className="form-select"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                style={{ width: '100%', height: '38px', fontSize: '13px' }}
              >
                <option value="1st Year">1ˢᵗ Year</option>
                <option value="2nd Year">2ⁿᵈ Year</option>
                <option value="3rd Year">3ʳᵈ Year</option>
                <option value="4th Year">4ᵗʰ Year</option>
              </select>
            </div>
          )}

          {/* Current Client Engagement — hidden for Assistant Director and above */}
          {designation.trim() && !hideClientBox && (
            <div className="form-field" ref={clientRef} style={{ position: 'relative' }}>
              <label>Current Client Engagement</label>

              {/* Selected client tags */}
              {selectedClients.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {selectedClients.map(c => (
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
                      {c.name}
                      <button
                        type="button"
                        onClick={() => removeClient(c.id)}
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--maroon)',
                          fontWeight: 700,
                          padding: 0,
                          lineHeight: 1,
                          fontSize: '14px'
                        }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={clientInput}
                onChange={e => handleClientInput(e.target.value)}
                onBlur={() => setTimeout(() => setClientSuggestions([]), 150)}
                className="form-input"
                placeholder="Type to search client name…"
                autoComplete="off"
              />

              {clientSuggestions.length > 0 && (
                <ul style={{
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
                }}>
                  {clientSuggestions.map(c => (
                    <li
                      key={c.id}
                      onMouseDown={() => addClient(c)}
                      style={{
                        padding: '8px 14px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: 'var(--ink)'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt, #F5F3EF)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Password - placed at the very bottom of the form */}
          <div className="form-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              placeholder="Create a password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '6px' }}>
            <Check size={16} /> {loading ? 'Creating Account…' : 'Complete Registration'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--ink-soft)' }}>
          Already registered?{' '}
          <button type="button" onClick={onSwitchToLogin} className="btn-link" style={{ fontWeight: 600 }}>
            Back to Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
