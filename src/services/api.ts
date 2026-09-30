import { supabase } from '../lib/supabase';
import { formatHrmId } from '../lib/permissions';
import {
  AppNotification,
  Client,
  Designation,
  ManagerAccessItem,
  ManagerStudentItem,
  ManpowerRecord,
  StaffLookupResult,
  Task,
  TaskFilter,
  TaskRequest,
  User
} from '../types';
import {
  INITIAL_CLIENTS,
  INITIAL_MANAGER_CLIENTS,
  INITIAL_MANAGER_STUDENTS,
  INITIAL_MANPOWER,
  INITIAL_TASKS,
  INITIAL_USERS
} from './mockData';

// Actions that must never fall back to the local store: credential checks (it has
// no passwords) and every write. A silent local save would look like success while
// nothing reached the database.
const NO_FALLBACK_ACTIONS = new Set(['login', 'register', 'changePassword', 'addClient', 'updateClient', 'deleteClient', 'sendInfoRequest', 'submitProfileInfo', 'submitQuery', 'listQueries', 'resolveQuery', 'sendAnnouncement', 'setManpowerSalary',
  'createTask', 'updateTask', 'deleteTask', 'addManagerComment', 'createTaskRequest', 'respondTaskRequest',
  'updateUser', 'saveManagerClients', 'saveManagerStudents', 'updateManpowerRecord', 'saveClientManpowerRemark', 'saveMyInfo']);
const MIN_PASSWORD_LENGTH = 4;

// Login session key issued by app_login_session (see supabase_password_change.sql).
// It lets a logged-in user change their password without re-entering the old one.
const SESSION_STORAGE_KEY = 'acnabin_session';

interface StoredSession {
  userId: string;
  token: string;
}

function readSession(): StoredSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    return parsed?.userId && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { }
}

const isMissingFunction = (err: any) =>
  err?.code === 'PGRST202' || /could not find the function/i.test(err?.message || '');

/** Verify a password; on success also open a session. Status: OK | INVALID | NO_PASSWORD. */
async function verifyPassword(userId: string, password: string): Promise<{ status: string; token: string | null }> {
  const { data, error } = await supabase.rpc('app_login_session', { p_user_id: userId, p_password: password });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return { status: row?.status || 'INVALID', token: row?.session_token || null };
  }
  if (!isMissingFunction(error)) throw error;

  // supabase_password_change.sql not applied yet: verify without opening a session.
  const { data: legacy, error: legacyErr } = await supabase.rpc('app_login', { p_user_id: userId, p_password: password });
  if (legacyErr) throw legacyErr;
  // 'SET' only comes from the older first-login app_login; the password is
  // already saved by then, so treat it as a successful login.
  return { status: legacy === 'SET' ? 'OK' : String(legacy), token: null };
}

// Collision-resistant task ID (tasks.id is the primary key).
const generateTaskId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `TSK-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

function mapToSystemDesignation(raw?: string): Designation {
  if (!raw) return 'Student';
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  if (/year/i.test(lower)) return 'Student';
  if (lower.includes('partner')) return 'Partner';
  if (lower.includes('admin')) return 'Admin';
  if (lower.includes('assitant director') || lower.includes('assistant director')) return 'Assistant Director';
  if (lower.includes('deputy director')) return 'Deputy Director';
  if (lower === 'director') return 'Director';
  if (lower.includes('senior assistant manager')) return 'Senior Assistant Manager';
  if (lower.includes('deputy manager')) return 'Deputy Manager';
  if (lower.includes('manager')) return 'Manager';
  if (lower.includes('supervisor')) return 'Supervisor';
  if (lower.includes('in charge') || lower.includes('incharge')) return 'In Charge';
  return 'Student';
}

// Map database snake_case columns to frontend types
function mapUserFromDb(row: any): User {
  const signupClientId = row.signup_client_id || '';
  const assignedClientIds = signupClientId
    ? signupClientId.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];
  return {
    id: row.id,
    name: row.name,
    empId: row.emp_id,
    email: row.email,
    role: row.role || 'USER',
    designation: row.designation || 'Student',
    signupClientId: signupClientId,
    assignedClientIds: assignedClientIds,
    status: row.status || 'ACTIVE',
    avatarUrl: row.avatar_url || '',
    mobile: row.mobile || '',
    createdDate: row.created_date
  };
}

function mapClientFromDb(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    jobNumber: row.job_number || '',
    status: row.status || 'ACTIVE',
    createdDate: row.created_date,
    lastUpdated: row.last_updated
  };
}

function mapTaskFromDb(row: any): Task {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name || 'General',
    assignedToId: row.assigned_to_id,
    assignedToName: row.assigned_to_name || 'Unknown',
    createdById: row.created_by_id,
    createdByName: row.created_by_name || 'Admin',
    particular: row.particular,
    priority: row.priority || 'Medium',
    assignedDate: row.assigned_date,
    deadline: row.deadline || '',
    status: row.status || 'Pending',
    remarks: row.remarks || '',
    managerComment: row.manager_comment || '',
    createdDate: row.created_date,
    lastUpdated: row.last_updated
  };
}

function mapNotificationFromDb(row: any): AppNotification {
  let title = row.title || '';
  let message = row.message || '';

  // Clean up legacy internal scheduling tags for deadline alerts
  title = title
    .replace(/\s*\(Midnight Alert\)/gi, '')
    .replace(/\s*\(Noon Reminder\)/gi, '')
    .trim();

  message = message
    .replace(/\s*\(Scheduled 12:00 AM Alert\)/gi, '')
    .replace(/\s*\(Scheduled 12:00 PM Alert\)/gi, '')
    .trim();

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title,
    message,
    data: row.data || {},
    isRead: Boolean(row.is_read),
    createdAt: row.created_at
  };
}

function mapTaskRequestFromDb(row: any): TaskRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    superiorId: row.superior_id,
    superiorName: row.superior_name,
    clientId: row.client_id,
    clientName: row.client_name,
    particular: row.particular,
    priority: row.priority || 'Medium',
    deadline: row.deadline || '',
    notes: row.notes || '',
    status: row.status || 'PENDING',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Helper to safely check deduplication before inserting a notification into Supabase
async function safeInsertNotification(row: {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
}): Promise<boolean> {
  try {
    const { data: existingRows } = await supabase
      .from('notifications')
      .select('id, data, created_at')
      .eq('user_id', row.user_id)
      .eq('type', row.type)
      .order('created_at', { ascending: false })
      .limit(50);

    if (existingRows && existingRows.length > 0) {
      const isDuplicate = existingRows.some(ex => {
        const d = ex.data || {};
        // 1. Deadline alerts check matching taskId & slot
        if (row.data?.taskId && row.data?.slot) {
          return d.taskId === row.data.taskId && d.slot === row.data.slot;
        }
        // 2. Task assignment check matching taskId
        if (row.type === 'TASK_ASSIGNED' && row.data?.taskId) {
          return d.taskId === row.data.taskId;
        }
        // 3. Manager comments check matching taskId
        if (row.type === 'MANAGER_COMMENT' && row.data?.taskId) {
          if (d.taskId === row.data.taskId) {
            const timeDiffMs = Math.abs(new Date(ex.created_at).getTime() - Date.now());
            if (timeDiffMs < 5 * 60 * 1000) return true; // Created within 5 mins
          }
        }
        // 4. Task requests check matching requestId
        if (row.data?.requestId) {
          return d.requestId === row.data.requestId && (d.status === row.data.status || d.action === row.data.action);
        }
        return false;
      });

      if (isDuplicate) {
        return false;
      }
    }

    const { error } = await supabase.from('notifications').insert(row);
    if (error) {
      console.warn('[Notification] Insert error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Notification] safeInsertNotification exception:', e);
    return false;
  }
}

// Fallback Local Storage store in case database tables are unreachable
class LocalFallbackStore {
  users: User[];
  clients: Client[];
  tasks: Task[];
  managerClients: Record<string, string[]>;
  managerStudents: Record<string, string[]>;
  manpower: ManpowerRecord[];
  currentUser: User | null;

  constructor() {
    // One-time purge of legacy cached manpower records from localStorage to remove personal data
    try {
      if (!localStorage.getItem('acnabin_manpower_purged')) {
        localStorage.removeItem('acnabin_manpower_records');
        localStorage.setItem('acnabin_manpower_purged', 'true');
      }
    } catch {}

    const storedUsers = localStorage.getItem('acnabin_users');
    const storedClients = localStorage.getItem('acnabin_clients');
    const storedTasks = localStorage.getItem('acnabin_tasks');
    const storedMgrClients = localStorage.getItem('acnabin_mgr_clients');
    const storedMgrStudents = localStorage.getItem('acnabin_mgr_students');
    const storedManpower = localStorage.getItem('acnabin_manpower_records');
    const storedCurrent = localStorage.getItem('acnabin_current_user');

    this.users = storedUsers ? JSON.parse(storedUsers) : [...INITIAL_USERS];
    this.clients = storedClients ? JSON.parse(storedClients) : [...INITIAL_CLIENTS];
    this.tasks = storedTasks ? JSON.parse(storedTasks) : [...INITIAL_TASKS];
    this.managerClients = storedMgrClients ? JSON.parse(storedMgrClients) : { ...INITIAL_MANAGER_CLIENTS };
    this.managerStudents = storedMgrStudents ? JSON.parse(storedMgrStudents) : { ...INITIAL_MANAGER_STUDENTS };
    this.manpower = storedManpower ? JSON.parse(storedManpower) : [];
    this.currentUser = storedCurrent ? JSON.parse(storedCurrent) : null;

    let hadBadUsers = false;
    this.users = this.users.map(u => {
      if (/year/i.test(u.designation || '')) {
        hadBadUsers = true;
        return {
          ...u,
          designation: 'Student'
        };
      }
      return u;
    });
    if (hadBadUsers) {
      localStorage.setItem('acnabin_users', JSON.stringify(this.users));
    }
  }

  save() {
    localStorage.setItem('acnabin_users', JSON.stringify(this.users));
    localStorage.setItem('acnabin_clients', JSON.stringify(this.clients));
    localStorage.setItem('acnabin_tasks', JSON.stringify(this.tasks));
    localStorage.setItem('acnabin_mgr_clients', JSON.stringify(this.managerClients));
    localStorage.setItem('acnabin_mgr_students', JSON.stringify(this.managerStudents));
    localStorage.setItem('acnabin_manpower_records', JSON.stringify(this.manpower));
    if (this.currentUser) {
      localStorage.setItem('acnabin_current_user', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('acnabin_current_user');
    }
  }
}

const fallbackStore = new LocalFallbackStore();

export const api = {
  isLiveMode: (): boolean => true,

  async getCurrentUser(): Promise<User | null> {
    const stored = localStorage.getItem('acnabin_current_user');
    let parsed: any = null;
    if (stored) {
      try { parsed = JSON.parse(stored); } catch { }
    }

    if (!parsed || !parsed.id) {
      fallbackStore.currentUser = null;
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', parsed.id)
        .maybeSingle();
      if (!error && data) {
        const fresh = mapUserFromDb(data);
        localStorage.setItem('acnabin_current_user', JSON.stringify(fresh));
        fallbackStore.currentUser = fresh;
        return fresh;
      }

      localStorage.removeItem('acnabin_current_user');
      fallbackStore.currentUser = null;
      return null;
    } catch {
      return parsed ? (parsed as User) : fallbackStore.currentUser;
    }
  },

  /** After Admin "Switch User" the saved session still belongs to the Admin: don't save data under the wrong account. */
  async assertSessionIsCurrentUser(session: { userId: string }) {
    const current = await this.getCurrentUser();
    if (current && current.id !== session.userId) {
      throw new Error('You are viewing as another user (Switch User). Log in as that user directly to do this.');
    }
  },

  async callBackend<T>(action: string, payload: any = {}): Promise<T> {
    try {
      return await (this.dispatchSupabase(action, payload) as Promise<T>);
    } catch (err: any) {
      if (NO_FALLBACK_ACTIONS.has(action)) throw err;
      console.warn(`[Supabase API] Failed action "${action}", falling back to local store:`, err?.message || err);
      return (this.dispatchFallback(action, payload) as T);
    }
  },

  async dispatchSupabase<T>(action: string, payload: any): Promise<T> {
    switch (action) {
      // ----------------------------------------------------------------------
      // AUTH
      // ----------------------------------------------------------------------
      case 'login': {
        const { empId, password } = payload;
        if (!password) {
          throw new Error('Please enter your password.');
        }
        const raw = String(empId).trim();
        const normalized = raw.toUpperCase();
        const digits = raw.replace(/\D/g, '');
        const paddedDigits = digits.length > 0 ? digits.padStart(6, '0') : '';

        // Flexible query matching: STD-001643, EMP-000230, raw numbers, exact input, or email
        // Escape LIKE wildcards so "%" or "_" typed in the ID box can't match other accounts
        const escapedInput = normalized.replace(/[\\%_]/g, m => `\\${m}`);
        const filters: string[] = [
          `emp_id.ilike.${escapedInput}`,
          `email.ilike.${escapedInput}`
        ];
        // Let the administrator log in with the ID "admin" whatever their emp_id is.
        if (normalized === 'ADMIN') {
          filters.push('role.eq.ADMIN');
        }
        if (paddedDigits) {
          filters.push(`emp_id.ilike.STD-${paddedDigits}`);
          filters.push(`emp_id.ilike.EMP-${paddedDigits}`);
          filters.push(`emp_id.ilike.%${paddedDigits}%`);
        }

        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .or(filters.join(','));

        if (error) throw error;

        // Prefer an exact ID/email match over the loose "%digits%" match, so the
        // password is checked against the account the user actually meant.
        const exactIds = [normalized, paddedDigits && `STD-${paddedDigits}`, paddedDigits && `EMP-${paddedDigits}`].filter(Boolean);
        let target = (users || []).find((u: any) =>
          exactIds.includes((u.emp_id || '').toUpperCase()) || (u.email || '').toUpperCase() === normalized
        ) || (users && users.length === 1 ? users[0] : null);
        if (!target && users && users.length > 1) {
          throw new Error('More than one account matches. Please enter your full ID (e.g. STD-001643 or EMP-000230).');
        }

        // 2. Check 2-letter partner initials if partner/admin
        if (!target && normalized.length === 2) {
          const { data: allUsers } = await supabase.from('users').select('*');
          if (allUsers) {
            target = allUsers.find((u: any) => {
              if (u.designation === 'Partner' || u.role === 'ADMIN') {
                const initials = (u.name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase();
                return initials.includes(normalized) || (u.emp_id || '').toUpperCase().includes(normalized);
              }
              return false;
            }) || null;
          }
        }

        if (!target) {
          throw new Error('User not found. Check your Employee / Student ID (e.g. STD-001643 or EMP-000230) or Partner Initial (e.g. AB).');
        }
        if (target.status !== 'ACTIVE') {
          throw new Error('Your account is inactive. Contact an administrator.');
        }

        let loginResult: { status: string; token: string | null };
        try {
          loginResult = await verifyPassword(target.id, String(password));
        } catch (loginErr) {
          console.error('Password verification failed:', loginErr);
          throw new Error('Password verification is unavailable. Please contact an administrator.');
        }
        if (loginResult.status === 'NO_PASSWORD') {
          throw new Error('This account has no password yet. Use "Forgot password?" to set one.');
        }
        if (loginResult.status !== 'OK') {
          throw new Error('Incorrect password.');
        }
        saveSession(loginResult.token ? { userId: target.id, token: loginResult.token } : null);

        const user = mapUserFromDb(target);
        localStorage.setItem('acnabin_current_user', JSON.stringify(user));
        fallbackStore.currentUser = user;
        return { user, token: `session-${user.id}-${Date.now()}` } as T;
      }

      case 'register': {
        const { name, empId, email, designation: reqDesignation, clientId, clientName, mobile, academicYear, password } = payload;
        if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
          throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        const hrmEmpId = formatHrmId(String(empId), reqDesignation);

        // "Admin" is a system designation and can't be picked at signup.
        if (String(reqDesignation || '').trim().toLowerCase() === 'admin') {
          throw new Error('That designation cannot be chosen at signup.');
        }

        // Any existing account with this ID (case-insensitive) blocks signup.
        // limit(1) instead of maybeSingle(): maybeSingle() errors out, and would let
        // signup through, if duplicates already exist.
        const { data: existingRows, error: existingErr } = await supabase
          .from('users')
          .select('id')
          .ilike('emp_id', hrmEmpId.replace(/[\\%_]/g, m => `\\${m}`))
          .limit(1);
        if (existingErr) throw existingErr;

        if (existingRows && existingRows.length > 0) {
          throw new Error('A user with this Employee/Student ID already exists.');
        }

        const newId = `u-${Date.now()}`;
        const userRow = {
          id: newId,
          name,
          emp_id: hrmEmpId,
          email,
          role: 'USER',
          designation: reqDesignation || 'Student',
          signup_client_id: clientId || '',
          status: 'ACTIVE',
          created_date: new Date().toISOString(),
          mobile: mobile || ''
        };

        const { data: created, error } = await supabase
          .from('users')
          .insert(userRow)
          .select()
          .single();

        if (error) {
          // 23505 = unique violation: someone signed up with this ID at the same moment
          if ((error as any).code === '23505') {
            throw new Error('A user with this Employee/Student ID already exists.');
          }
          throw error;
        }

        const { data: pwSet, error: pwErr } = await supabase.rpc('app_set_initial_password', {
          p_user_id: newId,
          p_password: String(password)
        });
        if (pwErr || !pwSet) {
          console.error('app_set_initial_password failed:', pwErr);
          // Don't leave behind an account with no password (anyone could claim it).
          await supabase.from('users').delete().eq('id', newId);
          throw new Error('Could not save your password. Please try again or contact an administrator.');
        }
        try {
          const { token } = await verifyPassword(newId, String(password));
          saveSession(token ? { userId: newId, token } : null);
        } catch (sessionErr) {
          console.warn('Could not open a session after registration:', sessionErr);
          saveSession(null);
        }

        // Keep the year the user entered on their own user row (works even with no HR manpower row)
        const signupAcademicYear = academicYear || (reqDesignation === 'Trainee' ? '1st Year' : '');
        if (signupAcademicYear) {
          try {
            await supabase.from('users').update({ academic_year: signupAcademicYear }).eq('id', newId);
          } catch (acadErr) {
            console.warn('Could not save academic year on user (run the users.academic_year migration):', acadErr);
          }
        }

        // If matching HR manpower row exists, sync academic year and client name
        try {
          const mpUpdates: any = {};
          if (academicYear) mpUpdates.academic_year = academicYear;
          else if (reqDesignation === 'Trainee') mpUpdates.academic_year = '1st Year';
          if (clientName) mpUpdates.client_name = clientName;

          if (Object.keys(mpUpdates).length > 0) {
            await supabase
              .from('manpower')
              .update(mpUpdates)
              .or(`emp_id.ilike.${hrmEmpId},emp_id.ilike.${empId}`);
          }
        } catch (mpUpdateErr) {
          console.warn('Could not sync manpower on register:', mpUpdateErr);
        }

        const newUser = mapUserFromDb(created);
        localStorage.setItem('acnabin_current_user', JSON.stringify(newUser));
        fallbackStore.currentUser = newUser;
        return { user: newUser, token: `session-${newUser.id}-${Date.now()}` } as T;
      }

      case 'getCurrentUser': {
        const user = await this.getCurrentUser();
        return user as T;
      }

      case 'changePassword': {
        const { userId, newPassword } = payload;
        if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
          throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        const session = readSession();
        if (!session) {
          throw new Error('For security, please log out and log in again, then change your password.');
        }
        // After the admin "Switch User", the stored session still belongs to the
        // admin; don't let that silently change the admin's password.
        if (userId && session.userId !== userId) {
          throw new Error('You can only change the password of the account you logged in with.');
        }
        const { data: result, error } = await supabase.rpc('app_set_password_with_session', {
          p_session: session.token,
          p_new: String(newPassword)
        });
        if (error) {
          console.error('app_set_password_with_session failed:', error);
          throw new Error('Password change is unavailable. Please contact an administrator.');
        }
        if (result === 'INVALID_SESSION') {
          saveSession(null);
          throw new Error('Your login session has expired. Please log out and log in again, then change your password.');
        }
        if (result !== 'OK') {
          throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        return { success: true } as T;
      }

      case 'logout': {
        const session = readSession();
        saveSession(null);
        if (session) {
          const { error: logoutErr } = await supabase.rpc('app_logout', { p_session: session.token });
          if (logoutErr && !isMissingFunction(logoutErr)) console.warn('app_logout failed:', logoutErr);
        }
        localStorage.removeItem('acnabin_current_user');
        fallbackStore.currentUser = null;
        return { success: true } as T;
      }

      case 'switchUserForDemo': {
        const { userId } = payload;
        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (userRow) {
          const user = mapUserFromDb(userRow);
          localStorage.setItem('acnabin_current_user', JSON.stringify(user));
          fallbackStore.currentUser = user;
          return user as T;
        }
        return fallbackStore.currentUser as T;
      }

      // ----------------------------------------------------------------------
      // TASKS
      // ----------------------------------------------------------------------
      case 'getMyTasks': {
        const targetUserId = payload?.userId || (await this.getCurrentUser())?.id;
        if (!targetUserId) return [] as T;

        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to_id', targetUserId) // only tasks assigned to me; ones I assign to others live in Team Tasks
          .order('created_date', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapTaskFromDb) as T;
      }

      case 'getTeamTasks': {
        const user = await this.getCurrentUser();
        const targetUserId = payload?.userId || user?.id;
        if (!targetUserId) return [] as T;

        const { data: callerUser } = await supabase.from('users').select('*').eq('id', targetUserId).maybeSingle();
        const currentUserRole = callerUser?.role || user?.role || 'USER';
        const currentUserDesig = callerUser?.designation || user?.designation || 'Student';

        const filters: TaskFilter = payload.filters || {};
        const AD_AND_ABOVE = ['Assistant Director', 'Deputy Director', 'Director', 'Partner'];
        const SUPERVISOR_TO_MANAGER = ['In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager'];

        let query = supabase.from('tasks').select('*');

        if (filters.clientId) {
          query = query.eq('client_id', filters.clientId);
        }
        if (filters.memberId) {
          query = query.eq('assigned_to_id', filters.memberId);
        }
        if (filters.status && filters.status !== 'All') {
          query = query.eq('status', filters.status);
        }

        const { data: rawTasks, error } = await query.order('created_date', { ascending: false });
        if (error) throw error;
        let tasks = (rawTasks || []).map(mapTaskFromDb);

        // Exclude system Admin tasks (assigned to ADMIN role / designation) for practice team members
        if (currentUserRole !== 'ADMIN') {
          const { data: adminUsers } = await supabase
            .from('users')
            .select('id')
            .or('role.eq.ADMIN,designation.eq.Admin');
          const adminIds = (adminUsers || []).map((u: any) => u.id);

          tasks = tasks.filter(t => {
            if (t.assignedToId && (adminIds.includes(t.assignedToId) || t.assignedToId === 'ADMIN')) return false;
            if (t.assignedToName?.toLowerCase() === 'admin') return false;
            return true;
          });
        }

        if (currentUserRole !== 'ADMIN' && !AD_AND_ABOVE.includes(currentUserDesig)) {
          if (SUPERVISOR_TO_MANAGER.includes(currentUserDesig) || currentUserRole === 'MANAGER') {
            const { data: accessRows } = await supabase
              .from('manager_client_access')
              .select('client_id')
              .eq('manager_user_id', targetUserId)
              .eq('status', 'ACTIVE');

            const allowedClientIds = (accessRows || []).map((r: any) => r.client_id);
            if (callerUser?.signup_client_id) {
              callerUser.signup_client_id
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
                .forEach((cid: string) => {
                  if (!allowedClientIds.includes(cid)) allowedClientIds.push(cid);
                });
            }

            // Only filter to specific clients if specific client restrictions have been assigned.
            // If no restrictions are set, show all team engagement tasks.
            if (allowedClientIds.length > 0) {
              tasks = tasks.filter(t => {
                if (allowedClientIds.includes(t.clientId)) return true;
                if (t.assignedToId === targetUserId || t.createdById === targetUserId) return true;
                return false;
              });
            }
          }
        }

        return tasks as T;
      }

      case 'createTask': {
        const user = await this.getCurrentUser();
        let clientId = payload.clientId;
        let clientName = payload.clientName;
        let assignedToName = payload.assignedToName;

        const targetAssigneeId = payload.assignedToId || user?.id;
        if (targetAssigneeId) {
          const { data: u } = await supabase
            .from('users')
            .select('name, role, designation, signup_client_id')
            .eq('id', targetAssigneeId)
            .maybeSingle();

          if (u) {
            if (u.role === 'ADMIN' || u.designation === 'Admin') {
              if (user?.role !== 'ADMIN') {
                throw new Error('Tasks cannot be assigned to Administrator.');
              }
            }
            if (!assignedToName) assignedToName = u.name;

            // If clientId is empty, general, or ALL_CLIENTS, auto-resolve from the assignee's assigned client:
            // An explicit 'general' is respected.
            if (!clientId || clientId === 'ALL_CLIENTS' || clientId === 'all') {
              if (u.signup_client_id) {
                const primaryCid = u.signup_client_id.split(',')[0].trim();
                if (primaryCid && primaryCid !== 'ALL_CLIENTS' && primaryCid !== 'general') {
                  clientId = primaryCid;
                  const { data: c } = await supabase.from('clients').select('name').eq('id', primaryCid).maybeSingle();
                  if (c?.name) clientName = c.name;
                }
              }
            }
          }
        }

        if ((!clientName || clientName === 'General') && clientId && clientId !== 'general' && clientId !== 'ALL_CLIENTS') {
          const { data: c } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
          if (c?.name) clientName = c.name;
        }

        const newId = generateTaskId();
        const now = new Date().toISOString();

        const taskRow = {
          id: newId,
          client_id: clientId || 'general',
          client_name: clientName || 'General',
          assigned_to_id: targetAssigneeId || 'b2906eef-124a-4abc-a60f-c0834da25ee0',
          assigned_to_name: assignedToName || user?.name || 'Unknown',
          created_by_id: user?.id || 'e53b4ed5-46d2-4566-a3dc-bb7e4ac39201',
          created_by_name: user?.name || 'Admin',
          particular: payload.particular,
          priority: payload.priority || 'Medium',
          assigned_date: payload.assignedDate || now.slice(0, 10),
          deadline: payload.deadline || '',
          status: payload.status || 'Pending',
          remarks: payload.remarks || '',
          manager_comment: payload.managerComment || '',
          created_date: now,
          last_updated: now
        };

        const { data, error } = await supabase
          .from('tasks')
          .insert(taskRow)
          .select()
          .single();

        if (error) throw error;

        // Auto-generate notification for assigned user if someone else assigned it
        if (payload.assignedToId && payload.assignedToId !== user?.id) {
          const assigner = user?.name || 'Management';
          await safeInsertNotification({
            user_id: payload.assignedToId,
            type: 'TASK_ASSIGNED',
            title: 'New Task Assigned',
            message: `${assigner} assigned you "${payload.particular}" for ${clientName || 'General'}`,
            data: { taskId: newId, assignerName: assigner }
          });
        }

        return mapTaskFromDb(data) as T;
      }

      case 'updateTask': {
        const { taskId, updates } = payload;
        const user = await this.getCurrentUser();

        // Enforce task edit rule: only creator (or ADMIN) can edit core fields. Otherwise can only comment.
        if (user && user.role !== 'ADMIN') {
          const { data: existingTask } = await supabase
            .from('tasks')
            .select('created_by_id, assigned_to_id')
            .eq('id', taskId)
            .single();

          if (existingTask) {
            const isCreator = existingTask.created_by_id === user.id;
            const isEditingCore =
              updates.particular !== undefined ||
              updates.priority !== undefined ||
              updates.deadline !== undefined ||
              updates.clientId !== undefined ||
              updates.assignedToId !== undefined;

            if (!isCreator && isEditingCore) {
              throw new Error('Only the task creator can edit task details. Others can only add comments.');
            }
          }
        }

        const dbUpdates: any = { last_updated: new Date().toISOString() };
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.remarks !== undefined) dbUpdates.remarks = updates.remarks;
        if (updates.managerComment !== undefined) dbUpdates.manager_comment = updates.managerComment;
        if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
        if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;
        if (updates.particular !== undefined) dbUpdates.particular = updates.particular;
        if (updates.clientId !== undefined) {
          dbUpdates.client_id = updates.clientId;
          if (updates.clientName === undefined || updates.clientName === 'General') {
            const { data: c } = await supabase.from('clients').select('name').eq('id', updates.clientId).maybeSingle();
            if (c?.name) dbUpdates.client_name = c.name;
          }
        }
        if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
        if (updates.assignedToId !== undefined) dbUpdates.assigned_to_id = updates.assignedToId;
        if (updates.assignedToName !== undefined) dbUpdates.assigned_to_name = updates.assignedToName;

        const { data, error } = await supabase
          .from('tasks')
          .update(dbUpdates)
          .eq('id', taskId)
          .select()
          .single();

        if (error) throw error;

        // If manager comment was updated, notify assigned user
        if (updates.managerComment && data) {
          const user = await this.getCurrentUser();
          if (data.assigned_to_id && data.assigned_to_id !== user?.id) {
            const commenter = user?.name || 'Management';
            const excerpt = updates.managerComment.length > 70
              ? updates.managerComment.slice(0, 70) + '…'
              : updates.managerComment;
            await safeInsertNotification({
              user_id: data.assigned_to_id,
              type: 'MANAGER_COMMENT',
              title: 'Management Comment Added',
              message: `${commenter} commented on "${data.particular}": "${excerpt}"`,
              data: { taskId: data.id, commenterName: commenter }
            });
          }
        }

        return mapTaskFromDb(data) as T;
      }

      case 'deleteTask': {
        const { taskId } = payload;
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
        return { success: true } as T;
      }

      case 'addManagerComment': {
        const { taskId, comment } = payload;
        const { data, error } = await supabase
          .from('tasks')
          .update({
            manager_comment: comment,
            last_updated: new Date().toISOString()
          })
          .eq('id', taskId)
          .select()
          .single();

        if (error) throw error;

        if (data && data.assigned_to_id) {
          const user = await this.getCurrentUser();
          if (data.assigned_to_id !== user?.id) {
            const commenter = user?.name || 'Management';
            const excerpt = comment.length > 70 ? comment.slice(0, 70) + '…' : comment;
            await safeInsertNotification({
              user_id: data.assigned_to_id,
              type: 'MANAGER_COMMENT',
              title: 'Management Comment Added',
              message: `${commenter} commented on "${data.particular}": "${excerpt}"`,
              data: { taskId: data.id, commenterName: commenter }
            });
          }
        }

        return mapTaskFromDb(data) as T;
      }

      // ----------------------------------------------------------------------
      // NOTIFICATIONS
      // ----------------------------------------------------------------------
      case 'getNotifications': {
        const { userId } = payload;
        if (!userId) return [] as T;

        // Auto-check for scheduled deadline alerts (12:00 AM & 12:00 PM) & overdue alerts
        try {
          const { data: userTasks } = await supabase
            .from('tasks')
            .select('id, particular, deadline, status, client_name')
            .eq('assigned_to_id', userId)
            .neq('status', 'Completed');

          if (userTasks && userTasks.length > 0) {
            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);
            const currentHour = now.getHours(); // Local hour (0..23)

            for (const t of userTasks) {
              if (t.deadline) {
                const dStr = t.deadline.slice(0, 10);
                const isToday = dStr === todayStr;
                const isOverdue = dStr < todayStr;

                if (isToday) {
                  // Slot 1: 12:00 AM (Midnight) Alert -> Active starting at 00:00 (currentHour >= 0)
                  if (currentHour >= 0) {
                    await safeInsertNotification({
                      user_id: userId,
                      type: 'DEADLINE_ALERT',
                      title: 'Task Due Today',
                      message: `Task "${t.particular}" for ${t.client_name || 'General'} is due today!`,
                      data: { taskId: t.id, slot: `${todayStr}_12AM`, date: todayStr }
                    });
                  }

                  // Slot 2: 12:00 PM (Noon) Alert -> Active ONLY starting at 12:00 PM (currentHour >= 12)
                  if (currentHour >= 12) {
                    await safeInsertNotification({
                      user_id: userId,
                      type: 'DEADLINE_ALERT',
                      title: 'Task Due Today',
                      message: `Reminder: Task "${t.particular}" for ${t.client_name || 'General'} is due today!`,
                      data: { taskId: t.id, slot: `${todayStr}_12PM`, date: todayStr }
                    });
                  }
                } else if (isOverdue) {
                  // Overdue alert -> 1 notification per overdue day
                  await safeInsertNotification({
                    user_id: userId,
                    type: 'DEADLINE_ALERT',
                    title: 'Task Overdue',
                    message: `Task "${t.particular}" for ${t.client_name || 'General'} was due on ${dStr} and is overdue!`,
                    data: { taskId: t.id, slot: `OVERDUE_${todayStr}`, date: todayStr }
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn('Deadline check error', e);
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        // Last 7 days, plus any info request that hasn't been filled in yet (stays until completed)
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .or(`created_at.gte.${sevenDaysAgo},and(type.in.(INFO_REQUEST,USER_QUERY),is_read.eq.false)`)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;

        // In-memory deduplication to ensure exact distinct notification count
        const rawList = (data || []).map(mapNotificationFromDb);
        const seenKeys = new Set<string>();
        const uniqueList: AppNotification[] = [];

        for (const notif of rawList) {
          const tId = notif.data?.taskId || '';
          const slot = notif.data?.slot || '';
          const reqId = notif.data?.requestId || '';
          const key = `${notif.type}_${tId}_${slot}_${reqId}_${notif.data?.queryId || ''}_${notif.data?.sentAt || ''}_${notif.title}_${notif.message.slice(0, 30)}`;

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueList.push(notif);
          }
        }

        return uniqueList as T;
      }

      case 'markNotificationRead': {
        const { notificationId } = payload;
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
        return { success: true } as T;
      }

      case 'markAllNotificationsRead': {
        const { userId } = payload;
        // Info requests can only be cleared by filling in the form
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .neq('type', 'INFO_REQUEST');
        return { success: true } as T;
      }

      case 'sendInfoRequest': {
        const { data: targets, error: tErr } = await supabase
          .from('users')
          .select('id, role, designation')
          .eq('status', 'ACTIVE');
        if (tErr) throw tErr;
        const requestId = `INFO-${Date.now()}`;
        const rows = (targets || [])
          .filter((u: any) =>
            payload?.userId
              ? u.id === payload.userId
              : (u.role || '').toUpperCase() !== 'ADMIN' &&
                (u.designation || '').toLowerCase().trim() !== 'partner')
          .map((u: any) => ({
            user_id: u.id,
            type: 'INFO_REQUEST',
            title: 'Please update your information',
            message: 'Tap "Update info" to fill in your academic year, salary/allowance, daily conveyance, blood group and emergency contact.',
            data: { requestId, kind: 'PROFILE_INFO' }
          }));
        if (rows.length === 0) return { count: 0 } as T;
        const { error: insErr } = await supabase.from('notifications').insert(rows);
        if (insErr) throw insErr;
        return { count: rows.length } as T;
      }

      case 'setManpowerSalary': {
        const session = readSession();
        if (!session) throw new Error('Please log out and log in again, then try again.');
        const { data, error } = await supabase.rpc('app_set_manpower_salary', {
          p_session: session.token,
          p_emp_id: payload.empId,
          p_salary: payload.salary,
          p_conveyance: payload.conveyance
        });
        if (error) {
          console.error('app_set_manpower_salary failed:', error);
          throw new Error('Could not save salary. Has supabase_manpower_salary_edit.sql been run?');
        }
        if (data === 'INVALID_SESSION') throw new Error('Your login has expired. Please log out and log in again.');
        if (data === 'FORBIDDEN') throw new Error('You are not allowed to change salary.');
        if (data !== 'OK') throw new Error('Invalid salary or conveyance value.');
        return { success: true } as T;
      }

      case 'sendAnnouncement': {
        const message = String(payload?.message || '').trim();
        if (!message) throw new Error('Please type your message.');
        const { data: targets, error: tErr } = await supabase
          .from('users')
          .select('id, role, designation')
          .eq('status', 'ACTIVE');
        if (tErr) throw tErr;
        const rows = (targets || [])
          .filter((u: any) =>
            payload?.userId
              ? u.id === payload.userId
              : (u.role || '').toUpperCase() !== 'ADMIN' &&
                (u.designation || '').toLowerCase().trim() !== 'partner')
          .map((u: any) => ({
            user_id: u.id,
            type: 'ANNOUNCEMENT',
            title: 'Message from Admin',
            message,
            data: { kind: 'ANNOUNCEMENT', sentAt: Date.now() }
          }));
        if (rows.length === 0) return { count: 0 } as T;
        const { error: insErr } = await supabase.from('notifications').insert(rows);
        if (insErr) throw insErr;
        return { count: rows.length } as T;
      }

      case 'submitQuery': {
        const session = readSession();
        if (!session) throw new Error('Please log out and log in again, then try again.');
        await this.assertSessionIsCurrentUser(session);
        const { data, error } = await supabase.rpc('app_submit_query', {
          p_session: session.token,
          p_message: payload.message
        });
        if (error) {
          console.error('app_submit_query failed:', error);
          throw new Error('Could not send your query. Has supabase_user_queries.sql been run?');
        }
        if (data === 'INVALID_SESSION') throw new Error('Your login has expired. Please log out and log in again.');
        if (data !== 'OK') throw new Error('Please type your query first.');
        return { success: true } as T;
      }

      case 'listQueries': {
        const session = readSession();
        if (!session) return [] as T;
        const { data, error } = await supabase.rpc('app_list_queries', { p_session: session.token });
        if (error) {
          console.warn('[listQueries] failed (run supabase_user_queries.sql?):', error.message);
          return [] as T;
        }
        return (data || []).map((r: any) => ({
          id: Number(r.id),
          userId: r.user_id,
          userName: r.user_name,
          empId: r.emp_id,
          message: r.message,
          createdAt: r.created_at
        })) as T;
      }

      case 'resolveQuery': {
        const session = readSession();
        if (!session) throw new Error('Please log out and log in again, then try again.');
        const { data, error } = await supabase.rpc('app_resolve_query', {
          p_session: session.token,
          p_query_id: payload.queryId,
          p_note: payload.note || ''
        });
        if (error) {
          console.error('app_resolve_query failed:', error);
          throw new Error('Could not resolve. Has supabase_user_queries.sql been run?');
        }
        if (data === 'INVALID_SESSION') throw new Error('Your login has expired. Please log out and log in again.');
        if (data === 'FORBIDDEN') throw new Error('Only Admin can resolve queries.');
        if (data === 'NOT_FOUND') throw new Error('This query was already resolved.');
        if (data !== 'OK') throw new Error('Could not resolve.');
        return { success: true } as T;
      }

      case 'getMyInfo': {
        const session = readSession();
        if (!session) return null as T;
        // After Switch User the session belongs to the Admin: don't show the Admin's data
        const current = await this.getCurrentUser();
        if (current && current.id !== session.userId) return null as T;
        const { data, error } = await supabase.rpc('app_get_my_info', { p_session: session.token });
        if (error) {
          console.warn('[getMyInfo] failed (run supabase_my_info.sql?):', error.message);
          return null as T;
        }
        const r = Array.isArray(data) ? data[0] : data;
        if (!r) return null as T;
        return {
          academicYear: r.academic_year || '',
          salary: r.salary === null || r.salary === undefined ? null : Number(r.salary),
          conveyance: r.conveyance === null || r.conveyance === undefined ? null : Number(r.conveyance),
          dailyConveyance: r.daily_conveyance === null || r.daily_conveyance === undefined ? null : Number(r.daily_conveyance),
          bloodGroup: r.blood_group || '',
          emergencyName: r.emergency_contact_name || '',
          emergencyPhone: r.emergency_contact_phone || ''
        } as T;
      }

      case 'saveMyInfo': {
        const session = readSession();
        if (!session) throw new Error('Please log out and log in again, then try again.');
        await this.assertSessionIsCurrentUser(session);
        const orNull = (v: any) => (v === undefined || v === '' ? null : v);
        const { data, error } = await supabase.rpc('app_save_my_info', {
          p_session: session.token,
          p_academic_year: orNull(payload.academicYear),
          p_salary: orNull(payload.salary),
          p_daily_conveyance: orNull(payload.dailyConveyance),
          p_blood_group: orNull(payload.bloodGroup),
          p_emergency_name: orNull(payload.emergencyName),
          p_emergency_phone: orNull(payload.emergencyPhone)
        });
        if (error) {
          console.error('app_save_my_info failed:', error);
          throw new Error('Could not save your information. Has supabase_my_info.sql been run?');
        }
        if (data === 'INVALID_SESSION') throw new Error('Your login has expired. Please log out and log in again.');
        if (data !== 'OK') throw new Error('Some information is invalid. Please check and try again.');
        return { success: true } as T;
      }

      case 'submitProfileInfo': {
        const session = readSession();
        if (!session) throw new Error('Please log out and log in again, then try again.');
        await this.assertSessionIsCurrentUser(session);
        const { data, error } = await supabase.rpc('app_submit_profile_info', {
          p_session: session.token,
          p_academic_year: payload.academicYear,
          p_salary: payload.salary,
          p_daily_conveyance: payload.dailyConveyance,
          p_blood_group: payload.bloodGroup,
          p_emergency_name: payload.emergencyName,
          p_emergency_phone: payload.emergencyPhone
        });
        if (error) {
          console.error('app_submit_profile_info failed:', error);
          throw new Error('Could not save your information. Please tell the administrator.');
        }
        if (data === 'INVALID_SESSION') throw new Error('Your login has expired. Please log out and log in again.');
        if (data !== 'OK') throw new Error('Some fields are missing or invalid. Please check and try again.');
        return { success: true } as T;
      }

      // ----------------------------------------------------------------------
      // TASK REQUESTS
      // ----------------------------------------------------------------------
      case 'createTaskRequest': {
        const {
          requesterId,
          requesterName,
          superiorId,
          superiorName,
          clientId,
          clientName,
          particular,
          priority,
          deadline,
          notes
        } = payload;

        // Block requests to System Administrator
        const { data: targetSuperior } = await supabase
          .from('users')
          .select('role, designation')
          .eq('id', superiorId)
          .maybeSingle();

        if (targetSuperior && (targetSuperior.role === 'ADMIN' || targetSuperior.designation === 'Admin')) {
          throw new Error('Task requests cannot be sent to System Administrator.');
        }

        // Student restrictions: students cannot request tasks to AD or above
        const user = await this.getCurrentUser();
        if (user && user.designation === 'Student') {
          const adAndAbove = ['Assistant Director', 'Deputy Director', 'Director', 'Partner'];
          if (targetSuperior && adAndAbove.includes(targetSuperior.designation)) {
            throw new Error('Students can only request tasks to fellow students or In-Charge to Manager.');
          }
        }

        const row = {
          requester_id: requesterId,
          requester_name: requesterName,
          superior_id: superiorId,
          superior_name: superiorName,
          client_id: clientId,
          client_name: clientName,
          particular,
          priority: priority || 'Medium',
          deadline: deadline || '',
          notes: notes || '',
          status: 'PENDING'
        };

        const { data, error } = await supabase
          .from('task_requests')
          .insert(row)
          .select()
          .single();

        if (error) throw error;

        // Notify superior
        await safeInsertNotification({
          user_id: superiorId,
          type: 'TASK_REQUEST',
          title: 'New Task Request Received',
          message: `${requesterName} submitted a task request: "${particular}" for ${clientName}`,
          data: { requestId: data.id, requesterId, action: 'SUBMITTED' }
        });

        return mapTaskRequestFromDb(data) as T;
      }

      case 'getTaskRequests': {
        const { userId } = payload;
        const { data, error } = await supabase
          .from('task_requests')
          .select('*')
          .or(`superior_id.eq.${userId},requester_id.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapTaskRequestFromDb) as T;
      }

      case 'respondTaskRequest': {
        const { requestId, status } = payload; // 'ACCEPTED' | 'DECLINED'
        const { data: req, error: fetchErr } = await supabase
          .from('task_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (fetchErr || !req) throw fetchErr || new Error('Request not found');

        const responder = await this.getCurrentUser();
        if (responder && responder.id !== req.superior_id && responder.role !== 'ADMIN') {
          throw new Error('Only the person this request was sent to can respond to it.');
        }
        if (req.status && req.status !== 'PENDING') {
          throw new Error('This request was already answered.');
        }

        const now = new Date().toISOString();
        // .eq('status','PENDING') makes a double click / second tab a no-op instead of a duplicate task
        const { data: updatedRows, error: updateErr } = await supabase
          .from('task_requests')
          .update({ status, updated_at: now })
          .eq('id', requestId)
          .eq('status', 'PENDING')
          .select('id');

        if (updateErr) throw updateErr;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error('This request was already answered.');
        }

        if (status === 'ACCEPTED') {
          const newTaskId = generateTaskId();
          await supabase.from('tasks').insert({
            id: newTaskId,
            client_id: req.client_id,
            client_name: req.client_name,
            assigned_to_id: req.superior_id,
            assigned_to_name: req.superior_name,
            created_by_id: req.requester_id,
            created_by_name: req.requester_name,
            particular: req.particular,
            priority: req.priority || 'Medium',
            assigned_date: now.slice(0, 10),
            deadline: req.deadline || '',
            status: 'Pending',
            remarks: req.notes ? `[Requested by ${req.requester_name}]: ${req.notes}` : `Requested by ${req.requester_name}`,
            created_date: now,
            last_updated: now
          });

          // Notify requester
          await safeInsertNotification({
            user_id: req.requester_id,
            type: 'TASK_REQUEST',
            title: 'Task Request Accepted',
            message: `${req.superior_name} accepted your task request: "${req.particular}". Added to their task list.`,
            data: { requestId, taskId: newTaskId, status: 'ACCEPTED' }
          });
        } else {
          // Notify requester of decline
          await safeInsertNotification({
            user_id: req.requester_id,
            type: 'TASK_REQUEST',
            title: 'Task Request Declined',
            message: `${req.superior_name} declined your task request: "${req.particular}".`,
            data: { requestId, status: 'DECLINED' }
          });
        }

        return { success: true } as T;
      }

      // ----------------------------------------------------------------------
      // CLIENTS
      // ----------------------------------------------------------------------
      case 'getAllClients': {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapClientFromDb) as T;
      }

      case 'addClient': {
        const name = String(payload.name || '').trim();
        const jobNumber = String(payload.jobNumber || '').trim();
        if (!name) throw new Error('Please enter the client name.');

        const { data: existing, error: existingErr } = await supabase.from('clients').select('name, job_number');
        if (existingErr) throw existingErr;
        // The same name is allowed when the job number is different; job numbers stay unique.
        if (!jobNumber && (existing || []).some((c: any) => (c.name || '').trim().toLowerCase() === name.toLowerCase())) {
          throw new Error(`A client named "${name}" already exists. To add another client with the same name, enter a different job number.`);
        }
        if (jobNumber && (existing || []).some((c: any) => (c.job_number || '').trim().toLowerCase() === jobNumber.toLowerCase())) {
          throw new Error(`Job number ${jobNumber} is already used by another client.`);
        }

        let autoJobNumber = '';
        if (!jobNumber) {
          const used = new Set((existing || []).map((c: any) => (c.job_number || '').trim().toLowerCase()));
          do {
            autoJobNumber = `C-${Math.floor(26000 + Math.random() * 900)}`;
          } while (used.has(autoJobNumber.toLowerCase()));
        }

        const newClientRow = {
          id: `c-${Date.now()}`,
          name,
          job_number: jobNumber || autoJobNumber,
          status: 'ACTIVE',
          created_date: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };

        const { data, error } = await supabase.from('clients').insert(newClientRow).select().single();
        if (error) throw error;
        return mapClientFromDb(data) as T;
      }

      case 'updateClient': {
        const { clientId, status } = payload;
        const name = payload.name !== undefined ? String(payload.name).trim() : undefined;
        const jobNumber = payload.jobNumber !== undefined ? String(payload.jobNumber).trim() : undefined;
        if (name !== undefined && !name) throw new Error('Client name cannot be empty.');

        if (name !== undefined || jobNumber) {
          const { data: others, error: othersErr } = await supabase
            .from('clients')
            .select('name, job_number')
            .neq('id', clientId);
          if (othersErr) throw othersErr;
          // The same name is allowed when the job number is different.
          if (name !== undefined) {
            const { data: current } = await supabase.from('clients').select('job_number').eq('id', clientId).maybeSingle();
            const effectiveJob = (jobNumber !== undefined ? jobNumber : (current?.job_number || '')).trim().toLowerCase();
            const clash = (others || []).some(
              (c: any) =>
                (c.name || '').trim().toLowerCase() === name.toLowerCase() &&
                (!effectiveJob || (c.job_number || '').trim().toLowerCase() === effectiveJob)
            );
            if (clash) {
              throw new Error(`A client named "${name}" already exists. To use the same name, give this client a different job number.`);
            }
          }
          if (jobNumber && (others || []).some((c: any) => (c.job_number || '').trim().toLowerCase() === jobNumber.toLowerCase())) {
            throw new Error(`Job number ${jobNumber} is already used by another client.`);
          }
        }

        const dbUpdates: any = { last_updated: new Date().toISOString() };
        if (name !== undefined) dbUpdates.name = name;
        if (jobNumber !== undefined) dbUpdates.job_number = jobNumber;
        if (status !== undefined) dbUpdates.status = status;

        const { data, error } = await supabase
          .from('clients')
          .update(dbUpdates)
          .eq('id', clientId)
          .select()
          .single();

        if (error) throw error;

        // Tasks store the client name; keep existing tasks in step with a rename.
        if (name !== undefined) {
          const { error: taskErr } = await supabase.from('tasks').update({ client_name: name }).eq('client_id', clientId);
          if (taskErr) console.warn('Could not update client name on tasks:', taskErr);
        }
        return mapClientFromDb(data) as T;
      }

      case 'deleteClient': {
        const { clientId } = payload;
        if (!clientId) throw new Error('No client selected.');

        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        if (error) throw error;

        // Drop the client from manager access lists and from users' assigned clients.
        // Existing tasks keep their stored client name, so history still reads correctly.
        await supabase.from('manager_client_access').delete().eq('client_id', clientId);
        const { data: assignedUsers } = await supabase
          .from('users')
          .select('id, signup_client_id')
          .ilike('signup_client_id', `%${clientId}%`);
        for (const u of assignedUsers || []) {
          const ids = String(u.signup_client_id || '').split(',').map((x: string) => x.trim()).filter(Boolean);
          if (!ids.includes(clientId)) continue;
          await supabase
            .from('users')
            .update({ signup_client_id: ids.filter((x: string) => x !== clientId).join(', ') })
            .eq('id', u.id);
        }
        return { success: true } as T;
      }

      // ----------------------------------------------------------------------
      // ADMIN & USERS
      // ----------------------------------------------------------------------
      case 'getAllUsers': {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapUserFromDb) as T;
      }

      case 'updateUser': {
        const { userId, updates } = payload;
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.empId !== undefined) {
          dbUpdates.emp_id = formatHrmId(String(updates.empId), updates.designation);
        }
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.role !== undefined) dbUpdates.role = updates.role;
        if (updates.designation !== undefined) dbUpdates.designation = updates.designation;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
        if (updates.mobile !== undefined) dbUpdates.mobile = updates.mobile;

        let clientIdsToSync: string[] | null = null;
        if (updates.assignedClientIds && Array.isArray(updates.assignedClientIds)) {
          const ids: string[] = updates.assignedClientIds;
          clientIdsToSync = ids;
          dbUpdates.signup_client_id = ids.join(', ');
        } else if (updates.signupClientId !== undefined) {
          dbUpdates.signup_client_id = updates.signupClientId;
          clientIdsToSync = updates.signupClientId.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        const { data, error } = await supabase
          .from('users')
          .update(dbUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        const updated = mapUserFromDb(data);

        // Also sync to manager_client_access table so access matrices remain consistent
        if (clientIdsToSync !== null) {
          await supabase.from('manager_client_access').delete().eq('manager_user_id', userId);
          if (clientIdsToSync.length > 0) {
            const rows = clientIdsToSync.map((cid: string) => ({
              manager_user_id: userId,
              client_id: cid,
              status: 'ACTIVE'
            }));
            await supabase.from('manager_client_access').insert(rows);
          }
        }

        const current = await this.getCurrentUser();
        if (current?.id === userId) {
          localStorage.setItem('acnabin_current_user', JSON.stringify(updated));
        }
        return updated as T;
      }

      case 'getManagerClients': {
        const { managerUserId } = payload;
        const [clientsRes, accessRes, userRes] = await Promise.all([
          supabase.from('clients').select('*').order('name', { ascending: true }),
          supabase.from('manager_client_access').select('client_id').eq('manager_user_id', managerUserId).eq('status', 'ACTIVE'),
          supabase.from('users').select('signup_client_id').eq('id', managerUserId).maybeSingle()
        ]);

        if (clientsRes.error) throw clientsRes.error;
        const assignedIds = new Set<string>((accessRes.data || []).map((r: any) => r.client_id));
        if (userRes.data?.signup_client_id) {
          userRes.data.signup_client_id.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((id: string) => assignedIds.add(id));
        }

        const result: ManagerAccessItem[] = (clientsRes.data || []).map((c: any) => ({
          clientId: c.id,
          clientName: c.name,
          hasAccess: assignedIds.has(c.id)
        }));
        return result as T;
      }

      case 'saveManagerClients': {
        const { managerUserId, clientIds } = payload;
        await supabase.from('manager_client_access').delete().eq('manager_user_id', managerUserId);

        const cleanIds = Array.isArray(clientIds) ? clientIds : [];
        if (cleanIds.length > 0) {
          const rows = cleanIds.map((cid: string) => ({
            manager_user_id: managerUserId,
            client_id: cid,
            status: 'ACTIVE'
          }));
          const { error } = await supabase.from('manager_client_access').insert(rows);
          if (error) throw error;
        }

        // Also update signup_client_id on user record
        await supabase.from('users').update({ signup_client_id: cleanIds.join(', ') }).eq('id', managerUserId);
        return { success: true } as T;
      }

      case 'getManagerStudents': {
        const { managerUserId } = payload;
        const [usersRes, accessRes] = await Promise.all([
          supabase.from('users').select('*').eq('designation', 'Student').order('name', { ascending: true }),
          supabase.from('manager_student_access').select('student_user_id').eq('manager_user_id', managerUserId).eq('status', 'ACTIVE')
        ]);

        if (usersRes.error) throw usersRes.error;
        const assignedIds = (accessRes.data || []).map((r: any) => r.student_user_id);

        const result: ManagerStudentItem[] = (usersRes.data || []).map((s: any) => ({
          studentId: s.id,
          studentName: s.name,
          empId: s.emp_id,
          isAssigned: assignedIds.includes(s.id)
        }));
        return result as T;
      }

      case 'saveManagerStudents': {
        const { managerUserId, studentIds } = payload;
        await supabase.from('manager_student_access').delete().eq('manager_user_id', managerUserId);

        if (Array.isArray(studentIds) && studentIds.length > 0) {
          const rows = studentIds.map((sid: string) => ({
            manager_user_id: managerUserId,
            student_user_id: sid,
            status: 'ACTIVE'
          }));
          const { error } = await supabase.from('manager_student_access').insert(rows);
          if (error) throw error;
        }
        return { success: true } as T;
      }

      case 'getManagerClientIds': {
        const { managerUserId } = payload;
        const [accessRes, userRes] = await Promise.all([
          supabase.from('manager_client_access').select('client_id').eq('manager_user_id', managerUserId).eq('status', 'ACTIVE'),
          supabase.from('users').select('signup_client_id').eq('id', managerUserId).maybeSingle()
        ]);

        const ids = new Set<string>((accessRes.data || []).map((r: any) => r.client_id));
        if (userRes.data?.signup_client_id) {
          userRes.data.signup_client_id.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((id: string) => ids.add(id));
        }
        return Array.from(ids) as T;
      }

      case 'getManpowerSalaries': {
        // Protected: the function checks the login session and role server-side.
        const session = readSession();
        if (!session) return [] as T;
        const { data, error } = await supabase.rpc('app_get_manpower_salaries', { p_session: session.token });
        if (error) {
          console.warn('[getManpowerSalaries] failed (run supabase_manpower_salary.sql?):', error.message);
          return [] as T;
        }
        return (data || []).map((r: any) => ({
          empId: String(r.emp_id || '').toUpperCase(),
          salary: Number(r.salary) || 0,
          conveyance: Number(r.conveyance) || 0
        })) as T;
      }

      case 'getManpower': {
        const includeAll = Boolean(payload?.includeAll);
        let { data: manpowerRows, error: mpErr } = await supabase
          .from('manpower')
          .select('*')
          .order('name', { ascending: true });

        if (mpErr || !manpowerRows || manpowerRows.length === 0) {
          console.warn('[getManpower] manpower table returned no rows, using local fallback:', mpErr?.message || 'empty result');
          // If Supabase table is empty or unreachable, use fallbackStore records
          manpowerRows = fallbackStore.manpower.map(m => ({
            emp_id: m.empId,
            name: m.name,
            client_id: m.clientId || null,
            client_name: m.assignedClient,
            designation: m.designation,
            academic_year: m.academicYear,
            salary: m.salary,
            conveyance: m.conveyance,
            total: m.total,
            contact_number: (m as any).contactNumber || '',
            email: (m as any).email || '',
            remarks: (m as any).remarks || ''
          }));
        }

        const [usersRes, clientsRes, mcaRes] = await Promise.all([
          supabase.from('users').select('*').eq('status', 'ACTIVE'),
          supabase.from('clients').select('id, name'),
          supabase.from('manager_client_access').select('manager_user_id, client_id').eq('status', 'ACTIVE')
        ]);

        const activeUsers = usersRes.data || fallbackStore.users.filter(u => u.status === 'ACTIVE');
        const clientList = clientsRes.data || fallbackStore.clients;
        const clientMap = new Map<string, string>();
        clientList.forEach((c: any) => clientMap.set(c.id, c.name));

        const mcaMap = new Map<string, string[]>();
        (mcaRes.data || []).forEach((row: any) => {
          const list = mcaMap.get(row.manager_user_id) || [];
          list.push(row.client_id);
          mcaMap.set(row.manager_user_id, list);
        });

        const result: ManpowerRecord[] = [];

        if (!includeAll) {
          // DEFAULT: Only show active registered students from the app!
          // Active STD- accounts / Students / Trainees only.
          const activeStudents = activeUsers.filter((u: any) => {
            const desig = (u.designation || '').toLowerCase().trim();
            const role = (u.role || '').toUpperCase().trim();
            // Everyone is listed except Partners and the system Admin account
            return desig !== 'partner' && desig !== 'admin' && role !== 'ADMIN';
          });

          for (const u of activeStudents) {
            const uEmpId = (u.emp_id || '').trim();
            const uDigits = uEmpId.replace(/\D/g, '');

            const mp = manpowerRows.find((m: any) => {
              const mEmpId = (m.emp_id || '').trim();
              if (mEmpId.toUpperCase() === uEmpId.toUpperCase()) return true;
              if (formatHrmId(uEmpId, u.designation).toUpperCase() === mEmpId.toUpperCase()) return true;
              const mDigits = mEmpId.replace(/\D/g, '');
              if (mDigits && uDigits && mDigits === uDigits) return true;
              return false;
            });

            const userClientIds = new Set<string>();
            if (u.signup_client_id) {
              u.signup_client_id.split(',').forEach((cid: string) => {
                const t = cid.trim();
                if (t) userClientIds.add(t);
              });
            }
            const mcaIds = mcaMap.get(u.id) || [];
            mcaIds.forEach((cid: string) => userClientIds.add(cid));

            const appClientNames: string[] = [];
            userClientIds.forEach((cid: string) => {
              const cName = clientMap.get(cid);
              if (cName) appClientNames.push(cName);
            });

            let assignedClient = 'Unassigned';
            let resolvedClientId: string | null = null;
            let rowClientIds: string[] = [];
            if (appClientNames.length > 0) {
              assignedClient = appClientNames.join(', ');
              resolvedClientId = Array.from(userClientIds)[0] || null;
              rowClientIds = Array.from(userClientIds).filter((cid: string) => clientMap.has(cid));
            } else if (mp && mp.client_name && mp.client_name !== '-' && mp.client_name.toLowerCase() !== 'none') {
              assignedClient = mp.client_name;
              resolvedClientId = mp.client_id || null;
            }

            if (!resolvedClientId && assignedClient && assignedClient !== 'Unassigned') {
              const cMatch = clientList.find((c: any) => c.name.toLowerCase().trim() === assignedClient.toLowerCase().trim());
              if (cMatch) resolvedClientId = cMatch.id;
            }

            const sal = mp ? (Number(mp.salary) || 0) : 0;
            const conv = mp ? (Number(mp.conveyance) || 0) : 0;
            let tot = mp ? (Number(mp.total) || 0) : 0;
            if (tot === 0 && (sal > 0 || conv > 0)) tot = sal + conv;

            let acad = u.academic_year || (mp ? (mp.academic_year || '') : '');
            if (!acad && (u.designation === 'Trainee' || (mp && mp.designation === 'Trainee'))) {
              acad = '1st Year';
            }

            const rawDesig = u.designation as string;
            let desig = (rawDesig === 'TBA' || !rawDesig) ? (mp ? mp.designation : '') : rawDesig;
            if (/year/i.test(desig)) {
              if (!acad || acad === '—') acad = desig;
              desig = 'Student';
            }

            result.push({
              empId: u.emp_id,
              name: u.name,
              clientId: resolvedClientId,
              clientIds: rowClientIds,
              assignedClient,
              designation: (desig as string) === 'TBA' ? '' : (desig || ''),
              academicYear: acad || '—',
              salary: sal,
              conveyance: conv,
              total: tot
            });
          }
        } else {
          // INCLUDE ALL HR RECORDS MODE:
          for (const mp of manpowerRows) {
            const mpEmpId = (mp.emp_id || '').trim();
            const mpDigits = mpEmpId.replace(/\D/g, '');

            const matchedUser = activeUsers.find((u: any) => {
              const uEmpId = (u.emp_id || '').trim();
              if (uEmpId.toUpperCase() === mpEmpId.toUpperCase()) return true;
              if (formatHrmId(uEmpId, u.designation).toUpperCase() === mpEmpId.toUpperCase()) return true;
              const uDigits = uEmpId.replace(/\D/g, '');
              if (uDigits && mpDigits && uDigits === mpDigits) return true;
              return false;
            });

            let resolvedClientId: string | null = mp.client_id || null;
            let assignedClient = mp.client_name || 'Unassigned';
            let designation = mp.designation || '';
            let name = mp.name || '';
            let rowClientIds: string[] = mp.client_id ? [mp.client_id] : [];

            if (matchedUser) {
              name = matchedUser.name;
              designation = matchedUser.designation || designation;

              const userClientIds = new Set<string>();
              if (matchedUser.signup_client_id) {
                matchedUser.signup_client_id.split(',').forEach((cid: string) => {
                  const t = cid.trim();
                  if (t) userClientIds.add(t);
                });
              }
              const mcaIds = mcaMap.get(matchedUser.id) || [];
              mcaIds.forEach((cid: string) => userClientIds.add(cid));

              const appClientNames: string[] = [];
              userClientIds.forEach((cid: string) => {
                const cName = clientMap.get(cid);
                if (cName) appClientNames.push(cName);
              });

              if (appClientNames.length > 0) {
                assignedClient = appClientNames.join(', ');
                resolvedClientId = Array.from(userClientIds)[0] || mp.client_id || null;
                rowClientIds = Array.from(userClientIds).filter((cid: string) => clientMap.has(cid));
              }
            } else {
              if (!mp.client_name || mp.client_name === '-' || mp.client_name.toLowerCase() === 'none') {
                assignedClient = 'Unassigned';
              } else {
                assignedClient = mp.client_name;
              }
            }

            if (!resolvedClientId && assignedClient && assignedClient !== 'Unassigned') {
              const cMatch = clientList.find((c: any) => c.name.toLowerCase().trim() === assignedClient.toLowerCase().trim());
              if (cMatch) resolvedClientId = cMatch.id;
            }

            const sal = Number(mp.salary) || 0;
            const conv = Number(mp.conveyance) || 0;
            let tot = Number(mp.total) || 0;
            if (tot === 0 && (sal > 0 || conv > 0)) tot = sal + conv;

            let acad = (matchedUser && matchedUser.academic_year) || mp.academic_year || '';
            if (!acad && (designation === 'Trainee' || mp.designation === 'Trainee')) {
              acad = '1st Year';
            }

            let finalDesig = designation === 'TBA' ? '' : designation;
            if (/year/i.test(finalDesig)) {
              if (!acad || acad === '—') acad = finalDesig;
              finalDesig = 'Student';
            }

            if (
              finalDesig.toLowerCase().trim() === 'partner' ||
              (matchedUser && ((matchedUser.role || '').toUpperCase() === 'ADMIN' || (matchedUser.designation || '').toLowerCase() === 'admin'))
            ) {
              continue;
            }

            result.push({
              empId: mpEmpId,
              name: name || (matchedUser ? matchedUser.name : ''),
              clientId: resolvedClientId,
              clientIds: rowClientIds,
              assignedClient,
              designation: finalDesig,
              academicYear: acad || '—',
              salary: sal,
              conveyance: conv,
              total: tot
            });
          }
        }

        return result as T;
      }

      case 'updateManpowerRecord': {
        const { empId, salary, conveyance, total, designation, academicYear, clientName, remarks } = payload;
        const trimmedClientName = (clientName || '').trim();
        const updates: any = {
          salary: Number(salary) || 0,
          conveyance: Number(conveyance) || 0,
          total: Number(total) || ((Number(salary) || 0) + (Number(conveyance) || 0)),
          designation: designation || 'Student',
          academic_year: academicYear || '',
          updated_at: new Date().toISOString()
        };
        if (clientName !== undefined) updates.client_name = trimmedClientName;
        if (remarks !== undefined) updates.remarks = remarks;

        let resolvedClientId: string | null = null;
        if (trimmedClientName && trimmedClientName !== 'Unassigned' && trimmedClientName !== '—' && trimmedClientName !== '-') {
          try {
            const { data: clientMatch } = await supabase
              .from('clients')
              .select('id, name')
              .ilike('name', trimmedClientName)
              .limit(1)
              .maybeSingle();

            if (clientMatch?.id) {
              resolvedClientId = clientMatch.id;
            } else {
              const newJobNumber = `C-${Math.floor(26000 + Math.random() * 900)}`;
              const { data: createdClient } = await supabase
                .from('clients')
                .insert({
                  name: trimmedClientName,
                  job_number: newJobNumber,
                  status: 'ACTIVE'
                })
                .select('id')
                .maybeSingle();
              if (createdClient?.id) {
                resolvedClientId = createdClient.id;
              }
            }
          } catch (cErr: any) {
            console.warn('Client lookup error in updateManpowerRecord:', cErr?.message || cErr);
          }
        }

        if (resolvedClientId) {
          updates.client_id = resolvedClientId;
        }

        try {
          const { error } = await supabase
            .from('manpower')
            .update(updates)
            .eq('emp_id', empId);
          if (error) {
            console.warn('Supabase manpower update note:', error.message);
          }
        } catch (e: any) {
          console.warn('Supabase manpower update exception:', e?.message || e);
        }

        // Sync with users table in Supabase so change affects full task tracker
        const empDigits = empId.replace(/\D/g, '');
        try {
          const targetIds = Array.from(new Set([
            empId,
            empId.toUpperCase(),
            empDigits ? `STD-${empDigits.padStart(6, '0')}` : '',
            empDigits ? `EMP-${empDigits.padStart(6, '0')}` : ''
          ].filter(Boolean)));

          const userUpdates: any = {
            updated_at: new Date().toISOString()
          };
          if (trimmedClientName) {
            userUpdates.signup_client_name = trimmedClientName === 'Unassigned' ? '' : trimmedClientName;
            userUpdates.signup_client_id = resolvedClientId || '';
          }
          if (academicYear !== undefined) {
            userUpdates.academic_year = academicYear;
          }
          if (designation !== undefined && designation !== 'TBA') {
            userUpdates.designation = designation;
          }

          await supabase
            .from('users')
            .update(userUpdates)
            .in('emp_id', targetIds);
        } catch (uErr: any) {
          console.warn('Supabase user sync error in updateManpowerRecord:', uErr?.message || uErr);
        }

        // Always keep local fallback store updated so changes persist immediately across full task tracker
        if (trimmedClientName && trimmedClientName !== 'Unassigned' && trimmedClientName !== '—' && trimmedClientName !== '-') {
          let fbClient = fallbackStore.clients.find(c => c.name.toLowerCase().trim() === trimmedClientName.toLowerCase());
          if (!fbClient) {
            fbClient = {
              id: resolvedClientId || `CLI-${Date.now()}`,
              name: trimmedClientName,
              jobNumber: `C-${Math.floor(26000 + Math.random() * 900)}`,
              status: 'ACTIVE',
              createdDate: new Date().toISOString()
            };
            fallbackStore.clients.push(fbClient);
          }
          if (!resolvedClientId) resolvedClientId = fbClient.id;
        }

        const matchedUser = fallbackStore.users.find(u => {
          const uEmp = (u.empId || '').toUpperCase().trim();
          const target = empId.toUpperCase().trim();
          if (uEmp === target) return true;
          const uDigits = uEmp.replace(/\D/g, '');
          return Boolean(uDigits && empDigits && uDigits === empDigits);
        });

        if (matchedUser) {
          if (trimmedClientName) {
            matchedUser.signupClientName = trimmedClientName === 'Unassigned' ? '' : trimmedClientName;
            matchedUser.signupClientId = resolvedClientId || '';
            matchedUser.assignedClientIds = resolvedClientId ? [resolvedClientId] : [];
          }
          if (academicYear !== undefined) {
            (matchedUser as any).academicYear = academicYear;
          }
          if (designation !== undefined && designation !== 'TBA') {
            matchedUser.designation = designation as any;
          }

          if (fallbackStore.currentUser?.id === matchedUser.id || fallbackStore.currentUser?.empId === matchedUser.empId) {
            fallbackStore.currentUser = { ...matchedUser };
            try {
              localStorage.setItem('acnabin_current_user', JSON.stringify(fallbackStore.currentUser));
            } catch {}
          }
        }

        const idx = fallbackStore.manpower.findIndex(m => {
          const mEmp = (m.empId || '').toUpperCase().trim();
          const target = empId.toUpperCase().trim();
          return mEmp === target || Boolean(empDigits && m.empId.replace(/\D/g, '') === empDigits);
        });
        if (idx !== -1) {
          fallbackStore.manpower[idx] = {
            ...fallbackStore.manpower[idx],
            salary: updates.salary,
            conveyance: updates.conveyance,
            total: updates.total,
            designation: updates.designation,
            academicYear: updates.academic_year,
            assignedClient: trimmedClientName || fallbackStore.manpower[idx].assignedClient,
            clientId: resolvedClientId || fallbackStore.manpower[idx].clientId
          };
        }
        fallbackStore.save();

        return { success: true } as T;
      }

      case 'getClientManpowerRemarks': {
        const { data, error } = await supabase
          .from('client_manpower_remarks')
          .select('*');

        if (error) {
          console.warn('Could not fetch client manpower remarks:', error.message);
          return {} as T;
        }

        const map: Record<string, string> = {};
        (data || []).forEach((row: any) => {
          if (row.client_id) {
            map[row.client_id] = row.remarks || '';
          }
        });
        return map as T;
      }

      case 'saveClientManpowerRemark': {
        const { clientId, remarks, updatedBy } = payload;
        if (!clientId) return { success: false } as T;

        const { error } = await supabase
          .from('client_manpower_remarks')
          .upsert({
            client_id: clientId,
            remarks: remarks || '',
            updated_by: updatedBy || '',
            updated_at: new Date().toISOString()
          }, { onConflict: 'client_id' });

        if (error) {
          console.error('Failed to save client manpower remark:', error.message);
          throw error;
        }
        return { success: true } as T;
      }

      case 'lookupStaff': {
        const { empId } = payload;
        if (!empId) return null as T;
        const raw = String(empId).trim();
        const digits = raw.replace(/\D/g, '');
        const formatted = formatHrmId(raw);
        const paddedDigits = digits.length > 0 ? digits.padStart(6, '0') : '';
        const possibleIds = Array.from(new Set([
          raw,
          raw.toUpperCase(),
          formatted,
          paddedDigits ? `STD-${paddedDigits}` : '',
          paddedDigits ? `EMP-${paddedDigits}` : ''
        ].filter(Boolean)));

        const { data, error } = await supabase
          .from('manpower')
          .select('name, email, designation, contact_number, academic_year')
          .in('emp_id', possibleIds)
          .limit(1)
          .maybeSingle();

        let staffRecord: any = data;
        if (!staffRecord || error) {
          const match = fallbackStore.manpower.find(m => {
            const mId = m.empId.toUpperCase();
            return possibleIds.some(p => p.toUpperCase() === mId) || (digits && m.empId.replace(/\D/g, '') === digits);
          });
          if (match) {
            staffRecord = {
              name: match.name,
              email: (match as any).email || '',
              designation: match.designation,
              contact_number: (match as any).contactNumber || '',
              academic_year: match.academicYear || ''
            };
          }
        }

        if (!staffRecord) {
          return null as T;
        }

        const rawDesig = staffRecord.designation === 'TBA' ? '' : staffRecord.designation;
        let acadYear = staffRecord.academic_year || '';
        if (/year/i.test(rawDesig)) {
          if (!acadYear) acadYear = rawDesig;
        }
        if (!acadYear && rawDesig === 'Trainee') {
          acadYear = '1st Year';
        }

        const res: StaffLookupResult = {
          name: staffRecord.name || '',
          email: staffRecord.email || '',
          designation: mapToSystemDesignation(rawDesig),
          mobile: staffRecord.contact_number || '',
          academicYear: acadYear
        };
        return res as T;
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  },

  // --------------------------------------------------------------------------
  // LOCAL FALLBACK (IN CASE SUPABASE IS OFFLINE OR INITIALIZING)
  // --------------------------------------------------------------------------
  dispatchFallback<T>(action: string, payload: any): T {
    switch (action) {
      case 'login': {
        const { empId } = payload;
        const raw = String(empId).trim();
        const normalized = raw.toUpperCase();
        const digits = raw.replace(/\D/g, '');
        const paddedDigits = digits.length > 0 ? digits.padStart(6, '0') : '';

        const user = fallbackStore.users.find(u => {
          const emp = u.empId.toUpperCase();
          const email = u.email.toLowerCase();
          if (emp === normalized || email === normalized.toLowerCase()) return true;
          if (paddedDigits && (emp === `STD-${paddedDigits}` || emp === `EMP-${paddedDigits}` || emp.includes(paddedDigits))) {
            return true;
          }
          if (normalized.length === 2 && (u.designation === 'Partner' || u.role === 'ADMIN')) {
            const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase();
            return initials.includes(normalized) || emp.includes(normalized);
          }
          return false;
        });
        if (!user) throw new Error('User not found. Check your Employee / Student ID (e.g. STD-001643 or EMP-000230) or Partner Initial (e.g. AB).');
        if (user.status !== 'ACTIVE') throw new Error('Your account is inactive.');
        fallbackStore.currentUser = user;
        fallbackStore.save();
        return { user, token: `session-${user.id}-${Date.now()}` } as T;
      }

      case 'register': {
        const { name, empId, email, designation: reqDesignation, clientId, clientName, academicYear } = payload;
        const finalEmpId = formatHrmId(String(empId), reqDesignation);
        const newUser: User = {
          id: `u-${Date.now()}`,
          name,
          empId: finalEmpId,
          email,
          role: 'USER',
          designation: reqDesignation || 'Student',
          signupClientId: clientId,
          signupClientName: clientName,
          status: 'ACTIVE',
          mobile: payload.mobile || '',
          createdDate: new Date().toISOString()
        };
        (newUser as any).academicYear = academicYear || (reqDesignation === 'Trainee' ? '1st Year' : '');
        fallbackStore.users.push(newUser);
        fallbackStore.currentUser = newUser;

        // Sync matching manpower record in fallback store
        const mpMatch = fallbackStore.manpower.find(m => {
          const mId = m.empId.toUpperCase();
          const target = finalEmpId.toUpperCase();
          return mId === target || (target.replace(/\D/g, '') && m.empId.replace(/\D/g, '') === target.replace(/\D/g, ''));
        });
        if (mpMatch) {
          if (clientName) mpMatch.assignedClient = clientName;
          if (academicYear) mpMatch.academicYear = academicYear;
          else if (reqDesignation === 'Trainee') mpMatch.academicYear = '1st Year';
        }

        fallbackStore.save();
        return { user: newUser, token: `session-${newUser.id}-${Date.now()}` } as T;
      }

      case 'getCurrentUser':
        return fallbackStore.currentUser as T;

      case 'logout':
        fallbackStore.currentUser = null;
        fallbackStore.save();
        return { success: true } as T;

      case 'getMyTasks': {
        const targetId = payload?.userId || fallbackStore.currentUser?.id;
        if (!targetId) return [] as T;
        return fallbackStore.tasks.filter(t => t.assignedToId === targetId) as T;
      }

      case 'getTeamTasks': {
        const caller = fallbackStore.currentUser;
        let tasks = [...fallbackStore.tasks];

        if (caller?.role !== 'ADMIN') {
          const adminUserIds = fallbackStore.users
            .filter(u => u.role === 'ADMIN' || u.designation === 'Admin')
            .map(u => u.id);

          tasks = tasks.filter(t => {
            if (t.assignedToId && (adminUserIds.includes(t.assignedToId) || t.assignedToId === 'ADMIN')) return false;
            if (t.assignedToName?.toLowerCase() === 'admin') return false;
            return true;
          });
        }

        const AD_AND_ABOVE = ['Assistant Director', 'Deputy Director', 'Director', 'Partner'];
        const SUPERVISOR_TO_MANAGER = ['In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager'];
        const callerDesig = caller?.designation || 'Student';
        const callerRole = caller?.role || 'USER';

        if (callerRole !== 'ADMIN' && !AD_AND_ABOVE.includes(callerDesig)) {
          if (SUPERVISOR_TO_MANAGER.includes(callerDesig) || callerRole === 'MANAGER') {
            const assignedClientIds = fallbackStore.managerClients[caller?.id || ''] || [];
            const allowedClientIds = [...assignedClientIds];
            if (caller?.signupClientId) {
              caller.signupClientId
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
                .forEach((cid: string) => {
                  if (!allowedClientIds.includes(cid)) allowedClientIds.push(cid);
                });
            }
            if (allowedClientIds.length > 0) {
              tasks = tasks.filter(t => {
                if (allowedClientIds.includes(t.clientId)) return true;
                if (t.assignedToId === caller?.id || t.createdById === caller?.id) return true;
                return false;
              });
            }
          }
        }

        const filters: TaskFilter = payload?.filters || {};
        if (filters?.clientId) {
          tasks = tasks.filter(t => t.clientId === filters.clientId);
        }
        if (filters?.memberId) {
          tasks = tasks.filter(t => t.assignedToId === filters.memberId);
        }
        if (filters?.status && filters.status !== 'All') {
          tasks = tasks.filter(t => t.status === filters.status);
        }
        return tasks as T;
      }

      case 'createTask': {
        const user = fallbackStore.currentUser;
        let clientId = payload.clientId;
        let clientName = payload.clientName;
        let assignedToName = payload.assignedToName;

        const targetAssigneeId = payload.assignedToId || user?.id;
        const targetUser = fallbackStore.users.find(u => u.id === targetAssigneeId);
        if (targetUser) {
          if (!assignedToName) assignedToName = targetUser.name;
          // An explicit 'general' is respected.
          if (!clientId || clientId === 'ALL_CLIENTS' || clientId === 'all') {
            const userCids = targetUser.assignedClientIds || (targetUser.signupClientId ? targetUser.signupClientId.split(',').map(s => s.trim()).filter(Boolean) : []);
            if (userCids.length > 0 && userCids[0] !== 'ALL_CLIENTS' && userCids[0] !== 'general') {
              clientId = userCids[0];
              const c = fallbackStore.clients.find(client => client.id === clientId);
              if (c?.name) clientName = c.name;
            }
          }
        }
        if ((!clientName || clientName === 'General') && clientId && clientId !== 'general' && clientId !== 'ALL_CLIENTS') {
          const c = fallbackStore.clients.find(client => client.id === clientId);
          if (c?.name) clientName = c.name;
        }

        const newTask: Task = {
          id: generateTaskId(),
          clientId: clientId || 'general',
          clientName: clientName || 'General',
          assignedToId: targetAssigneeId || 'b2906eef-124a-4abc-a60f-c0834da25ee0',
          assignedToName: assignedToName || user?.name || 'Unknown',
          createdById: user?.id || 'e53b4ed5-46d2-4566-a3dc-bb7e4ac39201',
          createdByName: user?.name || 'Admin',
          particular: payload.particular,
          priority: payload.priority || 'Medium',
          assignedDate: payload.assignedDate || new Date().toISOString().slice(0, 10),
          deadline: payload.deadline,
          status: payload.status || 'Pending',
          remarks: payload.remarks || '',
          managerComment: payload.managerComment || '',
          createdDate: new Date().toISOString()
        };
        fallbackStore.tasks.unshift(newTask);
        fallbackStore.save();
        return newTask as T;
      }

      case 'updateTask': {
        const { taskId, updates } = payload;
        const index = fallbackStore.tasks.findIndex(t => t.id === taskId);
        if (index === -1) throw new Error('Task not found');
        fallbackStore.tasks[index] = { ...fallbackStore.tasks[index], ...updates };
        fallbackStore.save();
        return fallbackStore.tasks[index] as T;
      }

      case 'deleteTask': {
        fallbackStore.tasks = fallbackStore.tasks.filter(t => t.id !== payload.taskId);
        fallbackStore.save();
        return { success: true } as T;
      }

      case 'addManagerComment': {
        const { taskId, comment } = payload;
        const index = fallbackStore.tasks.findIndex(t => t.id === taskId);
        if (index === -1) throw new Error('Task not found');
        fallbackStore.tasks[index].managerComment = comment;
        fallbackStore.save();
        return fallbackStore.tasks[index] as T;
      }

      case 'getAllClients':
        return fallbackStore.clients as T;

      case 'addClient': {
        const newClient: Client = {
          id: `c-${Date.now()}`,
          name: payload.name,
          jobNumber: payload.jobNumber || `C-${Math.floor(26000 + Math.random() * 900)}`,
          status: 'ACTIVE',
          createdDate: new Date().toISOString()
        };
        fallbackStore.clients.push(newClient);
        fallbackStore.save();
        return newClient as T;
      }

      case 'updateClient': {
        const { clientId, ...updates } = payload;
        const index = fallbackStore.clients.findIndex(c => c.id === clientId);
        if (index === -1) throw new Error('Client not found');
        fallbackStore.clients[index] = { ...fallbackStore.clients[index], ...updates };
        fallbackStore.save();
        return fallbackStore.clients[index] as T;
      }

      case 'getAllUsers':
        return fallbackStore.users as T;

      case 'updateUser': {
        const { userId, updates } = payload;
        const index = fallbackStore.users.findIndex(u => u.id === userId);
        if (index === -1) throw new Error('User not found');
        const finalUpdates = { ...updates };
        if (finalUpdates.empId !== undefined) {
          finalUpdates.empId = formatHrmId(String(finalUpdates.empId), finalUpdates.designation || fallbackStore.users[index].designation);
        }
        fallbackStore.users[index] = { ...fallbackStore.users[index], ...finalUpdates };
        fallbackStore.save();
        return fallbackStore.users[index] as T;
      }

      case 'switchUserForDemo': {
        const target = fallbackStore.users.find(u => u.id === payload.userId);
        if (target) {
          fallbackStore.currentUser = target;
          fallbackStore.save();
        }
        return fallbackStore.currentUser as T;
      }

      case 'getManagerClients': {
        const assignedIds = fallbackStore.managerClients[payload.managerUserId] || [];
        return fallbackStore.clients.map(c => ({
          clientId: c.id,
          clientName: c.name,
          hasAccess: assignedIds.includes(c.id)
        })) as T;
      }

      case 'saveManagerClients': {
        fallbackStore.managerClients[payload.managerUserId] = payload.clientIds;
        fallbackStore.save();
        return { success: true } as T;
      }

      case 'getManagerStudents': {
        const assignedIds = fallbackStore.managerStudents[payload.managerUserId] || [];
        const students = fallbackStore.users.filter(u => u.designation === 'Student');
        return students.map(s => ({
          studentId: s.id,
          studentName: s.name,
          empId: s.empId,
          isAssigned: assignedIds.includes(s.id)
        })) as T;
      }

      case 'saveManagerStudents': {
        fallbackStore.managerStudents[payload.managerUserId] = payload.studentIds;
        fallbackStore.save();
        return { success: true } as T;
      }

      case 'getManagerClientIds': {
        return (fallbackStore.managerClients[payload.managerUserId] || []) as T;
      }

      case 'getManpowerSalaries':
        return [] as T;

      case 'getManpower': {
        const includeAll = Boolean(payload?.includeAll);
        const activeUsers = fallbackStore.users.filter(u => u.status === 'ACTIVE');
        const clientMap = new Map<string, string>();
        fallbackStore.clients.forEach(c => clientMap.set(c.id, c.name));

        if (!includeAll) {
          // DEFAULT: only show active registered students from the app!
          // Active STD- accounts / Students / Trainees only.
          const activeStudents = activeUsers.filter(u => {
            const desig = (u.designation || '').toLowerCase().trim();
            const role = (u.role || '').toUpperCase().trim();
            return desig !== 'partner' && desig !== 'admin' && role !== 'ADMIN';
          });

          const result: ManpowerRecord[] = [];
          for (const u of activeStudents) {
            const uEmpId = (u.empId || '').trim();
            const uDigits = uEmpId.replace(/\D/g, '');

            const mp = fallbackStore.manpower.find(m => {
              const mEmpId = (m.empId || '').trim();
              if (mEmpId.toUpperCase() === uEmpId.toUpperCase()) return true;
              if (formatHrmId(uEmpId, u.designation).toUpperCase() === mEmpId.toUpperCase()) return true;
              const mDigits = mEmpId.replace(/\D/g, '');
              if (mDigits && uDigits && mDigits === uDigits) return true;
              return false;
            });

            // Determine active client
            const userClientIds = new Set<string>();
            if (u.signupClientId) {
              u.signupClientId.split(',').forEach(cid => {
                const t = cid.trim();
                if (t) userClientIds.add(t);
              });
            }
            const mcaIds = fallbackStore.managerClients[u.id] || [];
            mcaIds.forEach(cid => userClientIds.add(cid));

            const appClientNames: string[] = [];
            userClientIds.forEach(cid => {
              const cName = clientMap.get(cid);
              if (cName) appClientNames.push(cName);
            });

            let assignedClient = 'Unassigned';
            let resolvedClientId: string | null = null;
            if (appClientNames.length > 0) {
              assignedClient = appClientNames.join(', ');
              resolvedClientId = Array.from(userClientIds)[0] || null;
            } else if (u.signupClientName) {
              assignedClient = u.signupClientName;
            } else if (mp && mp.assignedClient && mp.assignedClient !== '-' && mp.assignedClient.toLowerCase() !== 'none') {
              assignedClient = mp.assignedClient;
              resolvedClientId = mp.clientId || null;
            }

            if (!resolvedClientId && assignedClient && assignedClient !== 'Unassigned') {
              const cMatch = fallbackStore.clients.find(c => c.name.toLowerCase().trim() === assignedClient.toLowerCase().trim());
              if (cMatch) resolvedClientId = cMatch.id;
            }

            const sal = mp ? (Number(mp.salary) || 0) : 0;
            const conv = mp ? (Number(mp.conveyance) || 0) : 0;
            let tot = mp ? (Number(mp.total) || 0) : 0;
            if (tot === 0 && (sal > 0 || conv > 0)) tot = sal + conv;

            let acad = (u as any).academicYear || (mp ? (mp.academicYear || '') : '');
            if (!acad && (u.designation === 'Trainee' || (mp && mp.designation === 'Trainee'))) {
              acad = '1st Year';
            }

            const rawDesig = u.designation as string;
            let desig = (rawDesig === 'TBA' || !rawDesig) ? (mp && (mp.designation as string) !== 'TBA' ? mp.designation : '') : rawDesig;
            if (/year/i.test(desig)) {
              if (!acad || acad === '—') acad = desig;
              desig = 'Student';
            }

            result.push({
              empId: u.empId,
              name: u.name,
              clientId: resolvedClientId,
              assignedClient,
              designation: (desig as string) === 'TBA' ? '' : (desig || ''),
              academicYear: acad || '—',
              salary: sal,
              conveyance: conv,
              total: tot
            });
          }
          return result as T;
        }

        // INCLUDE ALL HR RECORDS MODE:
        return fallbackStore.manpower.map(m => {
          const mpEmpId = (m.empId || '').trim();
          const mpDigits = mpEmpId.replace(/\D/g, '');

          const matchedUser = activeUsers.find(u => {
            const uEmpId = (u.empId || '').trim();
            if (uEmpId.toUpperCase() === mpEmpId.toUpperCase()) return true;
            if (formatHrmId(uEmpId, u.designation).toUpperCase() === mpEmpId.toUpperCase()) return true;
            const uDigits = uEmpId.replace(/\D/g, '');
            if (uDigits && mpDigits && uDigits === mpDigits) return true;
            return false;
          });

          let assignedClient = m.assignedClient || 'Unassigned';
          let resolvedClientId = m.clientId || null;
          let designation = (m.designation as string) === 'TBA' ? '' : (m.designation || '');
          let name = m.name || '';

          if (matchedUser) {
            name = matchedUser.name;
            if (matchedUser.designation && (matchedUser.designation as string) !== 'TBA') {
              designation = matchedUser.designation;
            }

            const userClientIds = new Set<string>();
            if (matchedUser.signupClientId) {
              matchedUser.signupClientId.split(',').forEach(cid => {
                const t = cid.trim();
                if (t) userClientIds.add(t);
              });
            }
            const mcaIds = fallbackStore.managerClients[matchedUser.id] || [];
            mcaIds.forEach(cid => userClientIds.add(cid));

            const appClientNames: string[] = [];
            userClientIds.forEach(cid => {
              const cName = clientMap.get(cid);
              if (cName) appClientNames.push(cName);
            });

            if (appClientNames.length > 0) {
              assignedClient = appClientNames.join(', ');
              resolvedClientId = Array.from(userClientIds)[0] || m.clientId || null;
            } else if (matchedUser.signupClientName) {
              assignedClient = matchedUser.signupClientName;
            }
          }

          if (assignedClient === '-' || assignedClient.toLowerCase() === 'none') {
            assignedClient = 'Unassigned';
          }

          let acad = (matchedUser && (matchedUser as any).academicYear) || m.academicYear || '';
          if (!acad && (designation === 'Trainee' || m.designation === 'Trainee')) {
            acad = '1st Year';
          }

          let finalDesig = designation === 'TBA' ? '' : designation;
          if (/year/i.test(finalDesig)) {
            if (!acad || acad === '—') acad = finalDesig;
            finalDesig = 'Student';
          }

          return {
            ...m,
            name: name || m.name,
            clientId: resolvedClientId,
            assignedClient,
            designation: finalDesig,
            academicYear: acad || '—'
          };
        }) as T;
      }

      case 'updateManpowerRecord': {
        const { empId, salary, conveyance, total, designation, academicYear, clientName, remarks } = payload;
        const trimmedClientName = (clientName || '').trim();
        const empDigits = empId.replace(/\D/g, '');

        let resolvedClientId: string | null = null;
        if (trimmedClientName && trimmedClientName !== 'Unassigned' && trimmedClientName !== '—' && trimmedClientName !== '-') {
          let fbClient = fallbackStore.clients.find(c => c.name.toLowerCase().trim() === trimmedClientName.toLowerCase());
          if (!fbClient) {
            fbClient = {
              id: `CLI-${Math.floor(100 + Math.random() * 900)}`,
              name: trimmedClientName,
              jobNumber: `C-${Math.floor(26000 + Math.random() * 900)}`,
              status: 'ACTIVE',
              createdDate: new Date().toISOString()
            };
            fallbackStore.clients.push(fbClient);
          }
          resolvedClientId = fbClient.id;
        }

        // Sync matching user in fallbackStore.users so changes propagate to full task tracker
        const matchedUser = fallbackStore.users.find(u => {
          const uEmp = (u.empId || '').toUpperCase().trim();
          const target = empId.toUpperCase().trim();
          if (uEmp === target) return true;
          const uDigits = uEmp.replace(/\D/g, '');
          return Boolean(uDigits && empDigits && uDigits === empDigits);
        });

        if (matchedUser) {
          if (trimmedClientName) {
            matchedUser.signupClientName = trimmedClientName === 'Unassigned' ? '' : trimmedClientName;
            matchedUser.signupClientId = resolvedClientId || '';
            matchedUser.assignedClientIds = resolvedClientId ? [resolvedClientId] : [];
          }
          if (academicYear !== undefined) {
            (matchedUser as any).academicYear = academicYear;
          }
          if (designation !== undefined && designation !== 'TBA') {
            matchedUser.designation = designation as any;
          }

          if (fallbackStore.currentUser?.id === matchedUser.id || fallbackStore.currentUser?.empId === matchedUser.empId) {
            fallbackStore.currentUser = { ...matchedUser };
            try {
              localStorage.setItem('acnabin_current_user', JSON.stringify(fallbackStore.currentUser));
            } catch {}
          }
        }

        const idx = fallbackStore.manpower.findIndex(m => {
          const mEmp = (m.empId || '').toUpperCase().trim();
          const target = empId.toUpperCase().trim();
          return mEmp === target || Boolean(empDigits && m.empId.replace(/\D/g, '') === empDigits);
        });
        if (idx !== -1) {
          fallbackStore.manpower[idx] = {
            ...fallbackStore.manpower[idx],
            salary: Number(salary) || 0,
            conveyance: Number(conveyance) || 0,
            total: Number(total) || ((Number(salary) || 0) + (Number(conveyance) || 0)),
            designation: (designation === 'TBA' ? '' : designation) || fallbackStore.manpower[idx].designation,
            academicYear: academicYear !== undefined ? academicYear : fallbackStore.manpower[idx].academicYear,
            assignedClient: trimmedClientName !== undefined ? (trimmedClientName || 'Unassigned') : fallbackStore.manpower[idx].assignedClient,
            clientId: resolvedClientId || fallbackStore.manpower[idx].clientId
          };
        }
        fallbackStore.save();
        return { success: true } as T;
      }

      case 'getClientManpowerRemarks': {
        try {
          const stored = localStorage.getItem('acnabin_client_manpower_remarks');
          return (stored ? JSON.parse(stored) : {}) as T;
        } catch {
          return {} as T;
        }
      }

      case 'saveClientManpowerRemark': {
        try {
          const stored = localStorage.getItem('acnabin_client_manpower_remarks');
          const map = stored ? JSON.parse(stored) : {};
          map[payload.clientId] = payload.remarks || '';
          localStorage.setItem('acnabin_client_manpower_remarks', JSON.stringify(map));
        } catch {}
        return { success: true } as T;
      }

      case 'lookupStaff': {
        const raw = String(payload?.empId || '').trim();
        const digits = raw.replace(/\D/g, '');
        const match = fallbackStore.manpower.find(m => {
          const mId = m.empId.toUpperCase();
          return mId === raw.toUpperCase() || (digits && m.empId.replace(/\D/g, '') === digits);
        });
        if (!match) return null as T;
        const desig = match.designation === 'TBA' ? '' : match.designation;
        let acadYear = match.academicYear || '';
        if (/year/i.test(desig)) {
          if (!acadYear) acadYear = desig;
        }
        if (!acadYear && desig === 'Trainee') {
          acadYear = '1st Year';
        }
        return {
          name: match.name,
          email: (match as any).email || '',
          designation: mapToSystemDesignation(desig),
          mobile: (match as any).contactNumber || '',
          academicYear: acadYear
        } as T;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
};
