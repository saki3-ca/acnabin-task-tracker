import React, { useEffect, useState } from 'react';
import { Briefcase, HeartPulse, Laptop, User as UserIcon, Wallet } from 'lucide-react';
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

const HAIRLINE = '#DDE3C8'; // soft green-grey, from the Linen Cloud palette

/** One "label ..... value" line. Empty values show a soft dash. */
const Row: React.FC<{ label: string; children: React.ReactNode; last?: boolean }> = ({ label, children, last }) => (
  <div
    className="fd-row"
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(110px, 38%) 1fr',
      gap: '12px',
      alignItems: 'baseline',
      padding: '10px 8px',
      margin: '0 -8px',
      borderRadius: '6px',
      borderBottom: last ? 'none' : `1px dotted ${HAIRLINE}`
    }}
  >
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--plum)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 'var(--text-base)', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div>
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
      border: '1px solid #E3E8D3',
      borderLeft: '4px solid var(--forest)',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(1, 62, 55, 0.06)',
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
        background: 'var(--linen)',
        borderBottom: `1px solid ${HAIRLINE}`
      }}
    >
      <span
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'var(--butter)',
          color: 'var(--forest)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--forest)' }}>{title}</span>
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
  <div
    style={{
      flex: '1 1 150px',
      minWidth: 0,
      padding: '12px 16px',
      background: 'var(--linen)',
      border: '1px solid #E3E8D3',
      borderLeft: '4px solid var(--forest)',
      borderRadius: '10px'
    }}
  >
    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--plum)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--forest)', marginTop: '3px', overflowWrap: 'anywhere' }}>{value}</div>
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

  // Partners: everything (ID, designation, email, mobile) is already in the identity bar above
  if (isPartner) return null;

  const personal = (
    <Panel title="PERSONAL DETAILS" icon={<UserIcon size={icon} />}>
      <Row label="Present Address">{soft(staff?.presentAddress)}</Row>
      <Row label="Blood Group" last>{soft(blood)}</Row>
    </Panel>
  );
  const emergency = (
    <Panel title="EMERGENCY CONTACT" icon={<HeartPulse size={icon} />}>
      <Row label="Name">{soft(emName)}</Row>
      <Row label="Relationship">{soft(staff?.emergencyRelationship)}</Row>
      <Row label="Mobile" last>{soft(emPhone)}</Row>
    </Panel>
  );
  const pay = (
    <Panel
      title={isEmp ? 'SALARY & CONVEYANCE' : 'ALLOWANCE & CONVEYANCE'}
      icon={<Wallet size={icon} />}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--butter)', borderTop: `1px solid ${HAIRLINE}` }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--forest)', letterSpacing: '0.08em' }}>TOTAL</span>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--forest)' }}>{fmtMoney(total)}</span>
        </div>
      }
    >
      <Row label={payLabel}>{soft(info?.salary === null || info?.salary === undefined ? '' : fmtMoney(info.salary))}</Row>
      <Row label="Conveyance" last>{soft(info?.conveyance === null || info?.conveyance === undefined ? '' : fmtMoney(info.conveyance))}</Row>
    </Panel>
  );

  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <div style={{ padding: '18px 20px 14px', background: '#FFFFFF' }}>
        {/* Key figures */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <Stat label={yearLabel} value={show(yearValue)} />
          <Stat label="Joining Date" value={fmtDate(staff?.joiningDate)} />
          <Stat label="Department" value={show(staff?.department)} />
        </div>

        {isEmp ? (
          <div className="fd-grid">
            {personal}
            {emergency}
            {pay}
            <Panel title="LAPTOP" icon={<Laptop size={icon} />}>
              <Row label="Availability">{soft(staff?.laptopAvailable)}</Row>
              <Row label="Ownership">{soft(staff?.laptopOwnership)}</Row>
              <Row label="Identification No.">{soft(staff?.laptopId)}</Row>
              <Row label="Remarks" last>{soft(staff?.remarks)}</Row>
            </Panel>
          </div>
        ) : (
          <div className="fd-grid">
            <Panel title="EMPLOYMENT" icon={<Briefcase size={icon} />}>
              <Row label="Articleship Period">{soft(staff?.articleshipPeriod)}</Row>
              <Row label="Principal" last>{soft(principalDisplay(staff?.principalName))}</Row>
            </Panel>
            {personal}
            {emergency}
            {pay}
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
        )}

        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', padding: '12px 2px 0' }}>
          Anything not on file shows as “—”. Use <strong>Edit Profile</strong> to change your details.
        </div>
      </div>
    </div>
  );
};
