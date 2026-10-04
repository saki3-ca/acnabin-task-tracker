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

/** The signed-in person's own staff record (department, articleship, address, emergency contact, laptop...) */
export interface MyStaff {
  empId: string;
  name: string;
  department: string;
  designation: string;
  academicYear: string;
  clientNames: string;
  articleshipPeriod: string;
  articleshipStart: string;
  articleshipEnd: string;
  principalName: string;
  mobile: string;
  email: string;
  joiningDate: string;
  bloodGroup: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  presentAddress: string;
  laptopAvailable: string;
  laptopOwnership: string;
  laptopId: string;
  remarks: string;
}

export interface StaffDates {
  empId: string;
  articleshipStart: string;
  articleshipEnd: string;
  joiningDate: string;
  academicYear: string;
}

export interface StaffImportRowResult {
  emp_id: string;
  name?: string;
  status: 'NEW' | 'UPDATED' | 'UNCHANGED' | 'ERROR';
  account?: string | null;
  linked?: boolean;
  nameMismatch?: boolean;
  changed?: string[];
  error?: string;
}

export interface StaffImportResult {
  status: 'OK' | 'INVALID_SESSION' | 'FORBIDDEN' | 'INVALID_INPUT';
  dryRun?: boolean;
  mode?: 'FILL' | 'OVERWRITE';
  total?: number;
  new?: number;
  updated?: number;
  unchanged?: number;
  linked?: number;
  errors?: number;
  rows?: StaffImportRowResult[];
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
  /** Remarks written by the person who accepted / declined */
  responseRemarks?: string;
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


export type ProposalStatus =
  | 'Draft' | 'In Progress' | 'Submitted' | 'Under Review' | 'On Hold'
  | 'Approved' | 'Rejected' | 'Not Started' | 'Assigned To Other Team';

export interface Proposal {
  id: string;
  name: string;
  client: string;
  type: string;
  assignedTo: string;
  /** Accounts the proposal is assigned to (they get an email); old proposals only have the text in assignedTo */
  assignedIds?: string[];
  receiveDate: string;
  deadline: string;
  status: string;
  remarks: string;
  createdAt?: string;
}

export interface ProposalPerson {
  id: string;
  name: string;
  designation: string;
}

export interface ProposalImportRow {
  name: string;
  client: string;
  type: string;
  assignedTo: string;
  receiveDate: string;
  deadline: string;
  status: string;
  remarks: string;
}

export interface ProposalImportResult {
  status: string;
  dryRun?: boolean;
  total?: number;
  added?: number;
  skipped?: number;
  errors?: number;
  rows?: { name: string; client: string; result: 'NEW' | 'DUPLICATE' | 'ERROR'; error?: string }[];
}

export interface ProposalAttachment {
  id: string;
  proposalId: string;
  fileName: string;
  mimeType: string;
  size: number;
  driveFileId: string;
  uploadedBy: string;
  uploadedAt: string;
}

/** One invoice. Money and dates arrive as text ('' = empty); dates are YYYY-MM-DD. */
export interface Invoice {
  id: string;
  forMonth: string;
  year: string;
  invoiceDate: string;
  client: string;
  jicName: string;
  jobNumber: string;
  purpose: string;
  invoiceNo: string;
  submissionNo: string;
  amount: string;
  tds: string;
  vds: string;
  /** Submitted to the client? (no money without this) */
  clientSubmitted: string;
  clientSubmitDate: string;
  signedSubmitted: string;
  mailDate: string;
  collected: string;
  collectionDate: string;
  collectionMethod: string;
  paymentRef: string;
  vdsCollected: string;
  vdsDate: string;
  vdsChallanLink: string;
  vdsChallanNo: string;
  tdsCollected: string;
  tdsDate: string;
  tdsChallanLink: string;
  tdsChallanNo: string;
  remarks: string;
  erpNote: string;
  createdAt?: string;
}

/** One row of the invoice CSV import: same fields as an invoice, without id. */
export type InvoiceImportRow = Omit<Invoice, 'id' | 'createdAt'>;

export interface InvoiceImportResult {
  status: string;
  dryRun?: boolean;
  total?: number;
  added?: number;
  skipped?: number;
  errors?: number;
  rows?: { invoiceNo: string; client: string; result: 'NEW' | 'DUPLICATE' | 'ERROR'; error?: string }[];
}

export interface InvoiceAttachment {
  id: string;
  invoiceId: string;
  kind: 'VDS' | 'TDS';
  fileName: string;
  mimeType: string;
  size: number;
  driveFileId: string;
  uploadedBy: string;
  uploadedAt: string;
}
