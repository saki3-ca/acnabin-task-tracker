import { Designation, Priority, Role, TaskStatus } from '../types';

export const DESIGNATIONS: Designation[] = [
  'Student',
  'In Charge',
  'Supervisor',
  'Senior Assistant Manager',
  'Deputy Manager',
  'Manager',
  'Assistant Director',
  'Deputy Director',
  'Director',
  'Partner'
];

export const ROLES: Role[] = ['USER', 'MANAGER', 'ADMIN'];

export const VALID_PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];

export const VALID_STATUSES: TaskStatus[] = ['Pending', 'In Progress', 'Completed'];

export const BRAND = {
  name: 'ACNABIN',
  sub: 'Chartered Accountants',
  initials: 'AC'
};
