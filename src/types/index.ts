export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export type Designation =
  | 'Student'
  | 'Trainee'
  | 'In Charge'
  | 'Supervisor'
  | 'Senior Assistant Manager'
  | 'Deputy Manager'
  | 'Manager'
  | 'Assistant Director'
  | 'Deputy Director'
  | 'Director'
  | 'Partner'
  | 'Admin';

export type Priority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';

export interface User {
  id: string;
  name: string;
  empId: string;
  email: string;
  role: Role;
  designation: Designation;
  signupClientId?: string;
  signupClientName?: string;
  assignedClientIds?: string[];
  status: 'ACTIVE' | 'INACTIVE';
  avatarUrl?: string;
  mobile?: string;
  lastLogin?: string;
  createdDate?: string;
}

export interface Client {
  id: string;
  name: string;
  jobNumber?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdDate?: string;
  lastUpdated?: string;
}

export interface Task {
  id: string;
  clientId: string;
  clientName?: string;
  assignedToId: string;
  assignedToName?: string;
  createdById: string;
  createdByName?: string;
  particular: string;
  priority: Priority;
  assignedDate?: string;
  deadline?: string;
  status: TaskStatus;
  remarks?: string; // Employee remarks
  managerComment?: string;
  createdDate?: string;
  lastUpdated?: string;
}

export interface ManagerAccessItem {
  clientId: string;
  clientName: string;
  hasAccess: boolean;
}

export interface ManagerStudentItem {
  studentId: string;
  studentName: string;
  empId: string;
  isAssigned: boolean;
}

export interface TaskFilter {
  clientId?: string;
  memberId?: string;
  status?: string;
  overdueOnly?: boolean;
  searchTerm?: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'DEADLINE_ALERT'
  | 'MANAGER_COMMENT'
  | 'TASK_REQUEST'
  | 'INFO_REQUEST'
  | 'ANNOUNCEMENT'
  | 'USER_QUERY'
  | 'QUERY_RESOLVED';

export interface MyInfo {
  academicYear: string;
  salary: number | null;
  conveyance: number | null;
  dailyConveyance: number | null;
  bloodGroup: string;
  emergencyName: string;
  emergencyPhone: string;
}

export interface UserQuery {
  id: number;
  userId: string;
  userName: string;
  empId: string;
  message: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export type TaskRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface TaskRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  superiorId: string;
  superiorName: string;
  clientId: string;
  clientName: string;
  particular: string;
  priority: Priority;
  deadline?: string;
  notes?: string;
  status: TaskRequestStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface ManpowerRecord {
  empId: string;
  name: string;
  clientId?: string | null;
  /** All assigned client ids, in the same order as the names in assignedClient */
  clientIds?: string[];
  assignedClient: string;
  designation: string;
  academicYear: string;
  salary: number;
  conveyance: number;
  total: number;
  contactNumber?: string;
  email?: string;
  remarks?: string;
}

export interface StaffLookupResult {
  name: string;
  email: string;
  designation: Designation;
  mobile?: string;
  academicYear?: string;
}

export interface ClientManpowerSummaryItem {
  clientId: string;
  clientName: string;
  manpowerCount: number;
  totalSalary: number;
  totalConveyance: number;
  totalCost: number;
  remarks: string;
  /** Set when the row is one single client, so its job ID can be shown */
  jobClientId?: string | null;
}

export interface ClientManpowerRemark {
  clientId: string;
  remarks: string;
  updatedBy?: string;
  updatedAt?: string;
}

