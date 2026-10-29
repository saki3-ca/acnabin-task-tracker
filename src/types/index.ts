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
  theme?: 'classic' | 'glass';
  loginCount?: number;
  /** Students/trainees assigned to this person in Manager Student Supervisory Assignments (Admin panel). */
  teamMemberIds?: string[];
}

export interface Client {
  id: string;
  name: string;
  jobNumber?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdDate?: string;
  lastUpdated?: string;
  /** User ids of the client's key person and secondary key person; contact info comes from the user record. */
  keyPersonId?: string;
  secondaryKeyPersonId?: string;
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
  /** The student's clients, for showing next to the name */
  clientIds: string[];
  /** Assigned earlier but no longer on any of the manager's clients */
  outsideClients?: boolean;
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

/** One person in the Manpower tab of a below-AD user: staff-sheet details, no money. */
export interface ScopedManpowerRow extends Omit<MyStaff, 'clientNames'> {
  /** only the clients shared with the viewer */
  clientIds: string[];
}

export interface ScopedManpower {
  clients: { id: string; name: string; jobNumber: string; remarks: string }[];
  rows: ScopedManpowerRow[];
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
  /** id of the account that uploaded it (that person can delete it too) */
  uploadedById?: string;
  uploadedAt: string;
}

/** Tabs whose access Admin sets (My Tasks, Task Requests, Notifications, My Profile and Team Tasks are basic) */
export type TabAccessKey = 'manpower' | 'firm_costing' | 'exam_leave' | 'invoices' | 'proposals' | 'tenders';
/** ALL = everyone, ADMIN = only Admin, INDIVIDUAL = Admin plus the people on the list, EXCEPT = everyone but the people on the other list, NONE = nobody (switched off) */
export type TabAccessMode = 'ALL' | 'ADMIN' | 'INDIVIDUAL' | 'EXCEPT' | 'NONE';
/** What the signed-in person gets for a tab: mode null = Admin has not chosen yet (the old rule applies) */
export type MyTabAccess = Record<TabAccessKey, { mode: TabAccessMode | null; listed: boolean; excluded: boolean }>;
/** Admin view of one tab */
export interface TabAccessEntry { mode: TabAccessMode | null; userIds: string[]; exceptIds: string[] }

/** One client's figures for one month in the Firm Costing dashboard. Invoice value includes VAT and tax. */
export interface FirmCostingRow {
  /** YYYY-MM */
  month: string;
  clientId: string;
  clientName: string;
  /** invoice number or note that tells several lines of one client apart */
  note?: string;
  engagement: 'RECURRING' | 'ONE_TIME';
  invoiceValue: number;
  vat: number;
  tax: number;
  budget: number;
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
  /** id of the account that uploaded it (that person can delete it too) */
  uploadedById?: string;
  uploadedAt: string;
}

export type ExamLevel = 'CL' | 'PL' | 'AL';

export interface IcabExamScheduleItem {
  id: string;
  level: 'CL' | 'PL' | 'AL';
  subject: string;
  paperCode?: string;
  date: string; // YYYY-MM-DD
  dayName: string;
  timeSlot?: string;
  isOffDay?: boolean;
}

export interface StaffExamLeaveRecord {
  id: string;
  sl: number;
  name: string;
  empId?: string;
  /** The account this leave belongs to (set by the database) */
  userId?: string;
  candidateType?: 'Student' | 'Employee';
  category: string;
  subjects: string;
  /** The papers picked in the form (with attempt), so Edit can show and change them. Older records only have the text. */
  papers?: { code: string; name: string; date: string; level?: 'PL' | 'AL' | 'CL'; attempt: '1st Attempt' | '2nd Attempt' | '3rd Attempt & rest' }[];
  level: string;
  totalLeaveDays: string;
  leaveStartDay: string;
  appearInLastExamDate: string;
  leaveDates: string[];
  status?: 'Approved' | 'Pending' | 'Rejected';
  notes?: string;
}
