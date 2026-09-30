import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  academicYearFromStart,
  employmentYearFromJoining,
  isEmployeeId,
  principalDisplay
} from '../../lib/academicYear';
import { isStudentLevelDesignation } from '../../lib/permissions';
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
const fmtMoney = (n?: number | null) => (n === null || n === undefined ? DASH : `৳ ${Math.round(n).toLocaleString('en-IN')}`);

const Field: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div style={{ gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </div>
    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px', wordBreak: 'break-word' }}>{children}</div>
  </div>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '18px' }}>
    <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--maroon)', letterSpacing: '0.8px', borderBottom: '1px solid var(--line)', paddingBottom: '4px', marginBottom: '10px' }}>
      {title}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px 18px' }}>{children}</div>
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
  const studentLevel = isStudentLevelDesignation(currentUser.designation) && !isEmp;

  const yearValue = isEmp
    ? employmentYearFromJoining(staff?.joiningDate)
    : academicYearFromStart(staff?.articleshipStart, staff?.articleshipEnd) || info?.academicYear || staff?.academicYear || '';
  const yearLabel = isEmp ? 'Employment Year' : 'Academic Year';

  const payLabel = isEmp ? 'Monthly Salary' : 'Monthly Allowance';
  const total = info && (info.salary !== null || info.conveyance !== null) ? (info.salary || 0) + (info.conveyance || 0) : null;

  const blood = info?.bloodGroup || staff?.bloodGroup;
  const emName = info?.emergencyName || staff?.emergencyName;
  const emPhone = info?.emergencyPhone || staff?.emergencyPhone;

  return (
    <div className="table-card">
      <div className="banner-strip banner-maroon" style={{ justifyContent: 'space-between', padding: '0 20px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.8px' }}>OFFICIAL EMPLOYEE PROFILE · FULL DETAILS</span>
      </div>

      <div style={{ padding: '16px 20px 6px' }}>
        <Group title="EMPLOYMENT">
          <Field label="ID">{show(currentUser.empId)}</Field>
          <Field label="Designation">{show(currentUser.designation)}</Field>
          <Field label="Department">{show(staff?.department)}</Field>
          {(isEmp || studentLevel || yearValue) && <Field label={yearLabel}>{show(yearValue)}</Field>}
          <Field label="Joining Date">{fmtDate(staff?.joiningDate)}</Field>
          {!isEmp && <Field label="Articleship Period">{show(staff?.articleshipPeriod)}</Field>}
          {!isEmp && <Field label="Principal">{show(principalDisplay(staff?.principalName))}</Field>}
        </Group>

        <Group title={isEmp ? 'SALARY & CONVEYANCE' : 'ALLOWANCE & CONVEYANCE'}>
          <Field label={payLabel}>{fmtMoney(info?.salary)}</Field>
          <Field label="Conveyance">{fmtMoney(info?.conveyance)}</Field>
          <Field label="Total">
            <span style={{ color: 'var(--maroon)', fontWeight: 800 }}>{fmtMoney(total)}</span>
          </Field>
        </Group>

        <Group title="CONTACT">
          <Field label="Mobile">{show(currentUser.mobile || staff?.mobile)}</Field>
          <Field label="Email">{show(currentUser.email || staff?.email)}</Field>
          <Field label="Present Address">{show(staff?.presentAddress)}</Field>
          <Field label="Blood Group">{show(blood)}</Field>
        </Group>

        <Group title="EMERGENCY CONTACT">
          <Field label="Name">{show(emName)}</Field>
          <Field label="Relationship">{show(staff?.emergencyRelationship)}</Field>
          <Field label="Mobile">{show(emPhone)}</Field>
        </Group>

        <Group title="LAPTOP">
          <Field label="Availability">{show(staff?.laptopAvailable)}</Field>
          <Field label="Ownership">{show(staff?.laptopOwnership)}</Field>
          <Field label="Identification No.">{show(staff?.laptopId)}</Field>
          <Field label="Remarks">{show(staff?.remarks)}</Field>
        </Group>

        <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', padding: '0 0 12px' }}>
          Anything not on file shows as “—”. Use <strong>Edit Profile</strong> to change your details.
        </div>
      </div>
    </div>
  );
};
