import React, { useEffect, useState } from 'react';
import { Briefcase, HeartPulse, Laptop, Phone, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  academicYearFromStart,
  employmentYearFromJoining,
  isEmployeeId,
  principalDisplay
} from '../../lib/academicYear';
import { notificationService } from '../../services/notificationService';
import { staffService } from '../../services/staffService';
import { MyInfo, MyStaff } from '../../types';

const DASH = '—';
const show = (v?: string | number | null) => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));

const fmtDate = (iso?: string) => {
  if (!iso) return DASH;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
// Inter has no taka sign, so the browser borrows a tiny one from another font: draw it in a font that has it
const TAKA_FONT = "'Noto Sans Bengali', 'Nirmala UI', 'Segoe UI', Arial, sans-serif";
const fmtMoney = (n?: number | null): React.ReactNode =>
  n === null || n === undefined ? (
    DASH
  ) : (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: TAKA_FONT, fontWeight: 600, marginRight: '4px' }}>৳</span>
      {Math.round(n).toLocaleString('en-IN')}
    </span>
  );

const HAIRLINE = '#EAE3D9';

/** One "label ..... value" line. Empty values show a soft dash. */
const Row: React.FC<{ label: string; children: React.ReactNode; last?: boolean }> = ({ label, children, last }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(110px, 38%) 1fr',
      gap: '12px',
      alignItems: 'baseline',
      padding: '9px 0',
      borderBottom: last ? 'none' : `1px solid ${HAIRLINE}`
    }}
  >
    <div style={{ fontSize: '11px', color: 'var(--ink-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '13.5px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div>
  </div>
);

const Panel: React.FC<{ title: string; icon: React.ReactNode; wide?: boolean; children: React.ReactNode; footer?: React.ReactNode }> = ({
  title,
  icon,
  wide,
  children,
  footer
}) => (
  <section
    style={{
      gridColumn: wide ? '1 / -1' : undefined,
      background: '#FFFFFF',
      border: '1px solid var(--line)',
      borderRadius: '10px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 16px',
        background: 'var(--cream-card)',
        borderBottom: `1px solid ${HAIRLINE}`
      }}
    >
      <span
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'var(--maroon-light)',
          color: 'var(--maroon)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '1px', color: 'var(--navy)' }}>{title}</span>
    </header>
    <div
      style={{
        padding: '4px 16px',
        flex: 1,
        ...(wide ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', columnGap: '28px' } : {})
      }}
    >
      {children}
    </div>
    {footer}
  </section>
);

/** A highlighted figure on top of the card. */
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ flex: '1 1 150px', minWidth: 0, padding: '12px 16px', borderLeft: '3px solid var(--maroon)', background: '#FFFFFF', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px', borderLeftColor: 'var(--maroon)' }}>
    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '0.7px', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--navy)', marginTop: '3px', wordBreak: 'break-word' }}>{value}</div>
  </div>
);

interface Props {
  /** Change this number to reload after the profile was edited */
  refreshKey?: number;
}

export const StaffDetailsCard: React.FC<Props> = ({ refreshKey = 0 }) => {
  const { currentUser } = useAuth();
  const [staff, setStaff] = useState<MyStaff | null>(null);
  const [info, setInfo] = useState<MyInfo | null>(null);

  useEffect(() => {
    let alive = true;
    staffService.getMyStaff().then(s => alive && setStaff(s)).catch(() => alive && setStaff(null));
    notificationService.getMyInfo().then(i => alive && setInfo(i)).catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [refreshKey, currentUser?.id]);

  if (!currentUser) return null;

  const isEmp = isEmployeeId(currentUser.empId);
  const isPartner = currentUser.designation === 'Partner'; // Partners have no pay or emergency panels

  const yearValue = isEmp
    ? employmentYearFromJoining(staff?.joiningDate)
    : academicYearFromStart(staff?.articleshipStart, staff?.articleshipEnd) || info?.academicYear || staff?.academicYear || '';
  const yearLabel = isEmp ? 'Employment Year' : 'Academic Year';

  const payLabel = isEmp ? 'Monthly Salary' : 'Monthly Allowance';
  const total = info && (info.salary !== null || info.conveyance !== null) ? (info.salary || 0) + (info.conveyance || 0) : null;

  const blood = info?.bloodGroup || staff?.bloodGroup;
  const emName = info?.emergencyName || staff?.emergencyName;
  const emPhone = info?.emergencyPhone || staff?.emergencyPhone;

  const icon = 15;
  const soft = (v?: React.ReactNode) => {
    const empty = v === null || v === undefined || v === '' || v === DASH;
    return empty ? <span style={{ color: 'var(--line-strong)', fontWeight: 500 }}>{DASH}</span> : v;
  };

  return (
    <div className="table-card">
      <div className="banner-strip banner-maroon" style={{ justifyContent: 'space-between', padding: '0 20px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.8px' }}>OFFICIAL EMPLOYEE PROFILE · FULL DETAILS</span>
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '4px' }}>
          {show(currentUser.empId)}
        </span>
      </div>

      <div style={{ padding: '18px 20px 14px', background: 'var(--cream)' }}>
        {/* Key figures */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          {!isPartner && <Stat label={yearLabel} value={show(yearValue)} />}
          <Stat label="Joining Date" value={fmtDate(staff?.joiningDate)} />
          <Stat label="Designation" value={show(currentUser.designation)} />
        </div>

        <div className="fd-grid">
          <Panel title="EMPLOYMENT" icon={<Briefcase size={icon} />}>
            <Row label="ID">{soft(currentUser.empId)}</Row>
            <Row label="Designation">{soft(currentUser.designation)}</Row>
            <Row label="Department" last={isEmp || isPartner}>{soft(staff?.department)}</Row>
            {!isEmp && !isPartner && <Row label="Articleship Period">{soft(staff?.articleshipPeriod)}</Row>}
            {!isEmp && !isPartner && <Row label="Principal" last>{soft(principalDisplay(staff?.principalName))}</Row>}
          </Panel>

          {!isPartner && (
          <Panel title={isEmp ? 'SALARY & CONVEYANCE' : 'ALLOWANCE & CONVEYANCE'} icon={<Wallet size={icon} />}
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--maroon-light)', borderTop: `1px solid ${HAIRLINE}` }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--maroon-dark)', letterSpacing: '0.6px' }}>TOTAL</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--maroon)' }}>{fmtMoney(total)}</span>
              </div>
            }
          >
            <Row label={payLabel}>{soft(info?.salary === null || info?.salary === undefined ? '' : fmtMoney(info.salary))}</Row>
            <Row label="Conveyance" last>{soft(info?.conveyance === null || info?.conveyance === undefined ? '' : fmtMoney(info.conveyance))}</Row>
          </Panel>

          )}

          <Panel title="CONTACT" icon={<Phone size={icon} />}>
            <Row label="Mobile">{soft(currentUser.mobile || staff?.mobile)}</Row>
            <Row label="Email">{soft(currentUser.email || staff?.email)}</Row>
            <Row label="Present Address">{soft(staff?.presentAddress)}</Row>
            <Row label="Blood Group" last>{soft(blood)}</Row>
          </Panel>

          {!isPartner && (
          <Panel title="EMERGENCY CONTACT" icon={<HeartPulse size={icon} />}>
            <Row label="Name">{soft(emName)}</Row>
            <Row label="Relationship">{soft(staff?.emergencyRelationship)}</Row>
            <Row label="Mobile" last>{soft(emPhone)}</Row>
          </Panel>
          )}

          <Panel title="LAPTOP" icon={<Laptop size={icon} />} wide>
            <div>
              <Row label="Availability">{soft(staff?.laptopAvailable)}</Row>
              <Row label="Ownership" last>{soft(staff?.laptopOwnership)}</Row>
            </div>
            <div>
              <Row label="Identification No.">{soft(staff?.laptopId)}</Row>
              <Row label="Remarks" last>{soft(staff?.remarks)}</Row>
            </div>
          </Panel>
        </div>

        <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', padding: '12px 2px 0' }}>
          Anything not on file shows as “—”. Use <strong>Edit Profile</strong> to change your details.
        </div>
      </div>
    </div>
  );
};
