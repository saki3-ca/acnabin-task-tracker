import { supabase } from '../lib/supabase';
import { formatHrmId } from '../lib/permissions';
import {
  AppNotification,
  Client,
  ManagerAccessItem,
  ManagerStudentItem,
  Task,
  TaskFilter,
  TaskRequest,
  User
} from '../types';
import {
  INITIAL_CLIENTS,
  INITIAL_MANAGER_CLIENTS,
  INITIAL_MANAGER_STUDENTS,
  INITIAL_TASKS,
  INITIAL_USERS
} from './mockData';

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
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
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

// Fallback Local Storage store in case database tables are unreachable
class LocalFallbackStore {
  users: User[];
  clients: Client[];
  tasks: Task[];
  managerClients: Record<string, string[]>;
  managerStudents: Record<string, string[]>;
  currentUser: User | null;

  constructor() {
    const storedUsers = localStorage.getItem('acnabin_users');
    const storedClients = localStorage.getItem('acnabin_clients');
    const storedTasks = localStorage.getItem('acnabin_tasks');
    const storedMgrClients = localStorage.getItem('acnabin_mgr_clients');
    const storedMgrStudents = localStorage.getItem('acnabin_mgr_students');
    const storedCurrent = localStorage.getItem('acnabin_current_user');

    this.users = storedUsers ? JSON.parse(storedUsers) : [...INITIAL_USERS];
    this.clients = storedClients ? JSON.parse(storedClients) : [...INITIAL_CLIENTS];
    this.tasks = storedTasks ? JSON.parse(storedTasks) : [...INITIAL_TASKS];
    this.managerClients = storedMgrClients ? JSON.parse(storedMgrClients) : { ...INITIAL_MANAGER_CLIENTS };
    this.managerStudents = storedMgrStudents ? JSON.parse(storedMgrStudents) : { ...INITIAL_MANAGER_STUDENTS };
    this.currentUser = storedCurrent ? JSON.parse(storedCurrent) : this.users[0];
  }

  save() {
    localStorage.setItem('acnabin_users', JSON.stringify(this.users));
    localStorage.setItem('acnabin_clients', JSON.stringify(this.clients));
    localStorage.setItem('acnabin_tasks', JSON.stringify(this.tasks));
    localStorage.setItem('acnabin_mgr_clients', JSON.stringify(this.managerClients));
    localStorage.setItem('acnabin_mgr_students', JSON.stringify(this.managerStudents));
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
      try { parsed = JSON.parse(stored); } catch {}
    }

    try {
      if (parsed && parsed.id) {
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
      }

      // If user in localStorage does not exist in DB (or no stored user), pick real user from DB
      localStorage.removeItem('acnabin_current_user');
      const { data: dbUsers } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (dbUsers && dbUsers.length > 0) {
        const sakib = dbUsers.find((u: any) => u.name?.toUpperCase().includes('SAKIB'));
        const chosen = mapUserFromDb(sakib || dbUsers[0]);
        localStorage.setItem('acnabin_current_user', JSON.stringify(chosen));
        fallbackStore.currentUser = chosen;
        return chosen;
      }

      return fallbackStore.currentUser;
    } catch {
      return fallbackStore.currentUser;
    }
  },

  async callBackend<T>(action: string, payload: any = {}): Promise<T> {
    try {
      return await this.dispatchSupabase<T>(action, payload);
    } catch (err: any) {
      console.warn(`[Supabase API] Failed action "${action}", falling back to local store:`, err?.message || err);
      return this.dispatchFallback<T>(action, payload);
    }
  },

  async dispatchSupabase<T>(action: string, payload: any): Promise<T> {
    switch (action) {
      // ----------------------------------------------------------------------
      // AUTH
      // ----------------------------------------------------------------------
      case 'login': {
        const { empId } = payload;
        const raw = String(empId).trim();
        const normalized = raw.toUpperCase();
        const digits = raw.replace(/\D/g, '');
        const paddedDigits = digits.length > 0 ? digits.padStart(6, '0') : '';

        // Flexible query matching: STD-001643, EMP-000230, raw numbers, exact input, or email
        const filters: string[] = [
          `emp_id.ilike.${normalized}`,
          `email.ilike.${normalized}`
        ];
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

        let target = users && users.length > 0 ? users[0] : null;

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

        const user = mapUserFromDb(target);
        localStorage.setItem('acnabin_current_user', JSON.stringify(user));
        fallbackStore.currentUser = user;
        return { user, token: `session-${user.id}-${Date.now()}` } as T;
      }

      case 'register': {
        const { name, empId, email, designation: reqDesignation, clientId } = payload;
        const hrmEmpId = formatHrmId(String(empId), reqDesignation);

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .ilike('emp_id', hrmEmpId)
          .maybeSingle();

        if (existing) {
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
          created_date: new Date().toISOString()
        };

        const { data: created, error } = await supabase
          .from('users')
          .insert(userRow)
          .select()
          .single();

        if (error) throw error;
        const newUser = mapUserFromDb(created);
        localStorage.setItem('acnabin_current_user', JSON.stringify(newUser));
        fallbackStore.currentUser = newUser;
        return { user: newUser, token: `session-${newUser.id}-${Date.now()}` } as T;
      }

      case 'getCurrentUser': {
        const user = await this.getCurrentUser();
        return user as T;
      }

      case 'logout': {
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
          .or(`assigned_to_id.eq.${targetUserId},created_by_id.eq.${targetUserId}`)
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
          if (SUPERVISOR_TO_MANAGER.includes(currentUserDesig)) {
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
                const isGeneral = !t.clientId || t.clientId === 'general' || t.clientName?.toLowerCase() === 'general' || t.clientId === 'CLI-017' || t.clientId === 'CLI-018';
                if (isGeneral) return true;
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
        let clientName = payload.clientName;
        if ((!clientName || clientName === 'General') && payload.clientId) {
          const { data: c } = await supabase.from('clients').select('name').eq('id', payload.clientId).maybeSingle();
          if (c?.name) clientName = c.name;
        }

        let assignedToName = payload.assignedToName;
        if (!assignedToName && payload.assignedToId) {
          const { data: u } = await supabase.from('users').select('name, role, designation').eq('id', payload.assignedToId).maybeSingle();
          if (u) {
            if (u.role === 'ADMIN' || u.designation === 'Admin') {
              if (user?.role !== 'ADMIN') {
                throw new Error('Tasks cannot be assigned to Administrator.');
              }
            }
            assignedToName = u.name;
          }
        }

        const newId = `TSK-${Math.floor(100 + Math.random() * 900)}`;
        const now = new Date().toISOString();

        const taskRow = {
          id: newId,
          client_id: payload.clientId,
          client_name: clientName || 'General',
          assigned_to_id: payload.assignedToId || user?.id || 'b2906eef-124a-4abc-a60f-c0834da25ee0',
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
          try {
            const assigner = user?.name || 'Management';
            await supabase.from('notifications').insert({
              user_id: payload.assignedToId,
              type: 'TASK_ASSIGNED',
              title: 'New Task Assigned',
              message: `${assigner} assigned you "${payload.particular}" for ${clientName || 'General'}`,
              data: { taskId: newId, assignerName: assigner }
            });
          } catch (e) {
            console.warn(e);
          }
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
            try {
              const commenter = user?.name || 'Management';
              const excerpt = updates.managerComment.length > 70
                ? updates.managerComment.slice(0, 70) + '…'
                : updates.managerComment;
              await supabase.from('notifications').insert({
                user_id: data.assigned_to_id,
                type: 'MANAGER_COMMENT',
                title: 'Management Comment Added',
                message: `${commenter} commented on "${data.particular}": "${excerpt}"`,
                data: { taskId: data.id, commenterName: commenter }
              });
            } catch (e) {
              console.warn(e);
            }
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
            try {
              const commenter = user?.name || 'Management';
              const excerpt = comment.length > 70 ? comment.slice(0, 70) + '…' : comment;
              await supabase.from('notifications').insert({
                user_id: data.assigned_to_id,
                type: 'MANAGER_COMMENT',
                title: 'Management Comment Added',
                message: `${commenter} commented on "${data.particular}": "${excerpt}"`,
                data: { taskId: data.id, commenterName: commenter }
              });
            } catch (e) {
              console.warn(e);
            }
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

        // Auto-check for approaching deadlines and overdue tasks
        try {
          const { data: userTasks } = await supabase
            .from('tasks')
            .select('id, particular, deadline, status, client_name')
            .eq('assigned_to_id', userId)
            .neq('status', 'Completed');

          if (userTasks && userTasks.length > 0) {
            const todayStr = new Date().toISOString().slice(0, 10);
            for (const t of userTasks) {
              if (t.deadline) {
                const dStr = t.deadline.slice(0, 10);
                const isOverdue = dStr < todayStr;
                const isToday = dStr === todayStr;

                if (isOverdue || isToday) {
                  const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('type', 'DEADLINE_ALERT')
                    .filter('data->>taskId', 'eq', t.id)
                    .maybeSingle();

                  if (!existing) {
                    await supabase.from('notifications').insert({
                      user_id: userId,
                      type: 'DEADLINE_ALERT',
                      title: isOverdue ? 'Task Overdue' : 'Task Due Today',
                      message: isOverdue
                        ? `Task "${t.particular}" for ${t.client_name} was due on ${dStr} and is overdue!`
                        : `Task "${t.particular}" for ${t.client_name} is due today!`,
                      data: { taskId: t.id }
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('Deadline check error', e);
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        return (data || []).map(mapNotificationFromDb) as T;
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
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId);
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
        try {
          await supabase.from('notifications').insert({
            user_id: superiorId,
            type: 'TASK_REQUEST',
            title: 'New Task Request Received',
            message: `${requesterName} submitted a task request: "${particular}" for ${clientName}`,
            data: { requestId: data.id, requesterId }
          });
        } catch (e) {
          console.warn(e);
        }

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

        const now = new Date().toISOString();
        const { error: updateErr } = await supabase
          .from('task_requests')
          .update({ status, updated_at: now })
          .eq('id', requestId);

        if (updateErr) throw updateErr;

        if (status === 'ACCEPTED') {
          const newTaskId = `TSK-${Math.floor(100 + Math.random() * 900)}`;
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
          try {
            await supabase.from('notifications').insert({
              user_id: req.requester_id,
              type: 'TASK_REQUEST',
              title: 'Task Request Accepted',
              message: `${req.superior_name} accepted your task request: "${req.particular}". Added to their task list.`,
              data: { requestId, taskId: newTaskId }
            });
          } catch (e) {
            console.warn(e);
          }
        } else {
          // Notify requester of decline
          try {
            await supabase.from('notifications').insert({
              user_id: req.requester_id,
              type: 'TASK_REQUEST',
              title: 'Task Request Declined',
              message: `${req.superior_name} declined your task request: "${req.particular}".`,
              data: { requestId }
            });
          } catch (e) {
            console.warn(e);
          }
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
        const { name, jobNumber } = payload;
        const newClientRow = {
          id: `c-${Date.now()}`,
          name,
          job_number: jobNumber || `C-${Math.floor(26000 + Math.random() * 900)}`,
          status: 'ACTIVE',
          created_date: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };

        const { data, error } = await supabase.from('clients').insert(newClientRow).select().single();
        if (error) throw error;
        return mapClientFromDb(data) as T;
      }

      case 'updateClient': {
        const { clientId, name, jobNumber, status } = payload;
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
        return mapClientFromDb(data) as T;
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
        const { name, empId, email, designation: reqDesignation, clientId, clientName } = payload;
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
          createdDate: new Date().toISOString()
        };
        fallbackStore.users.push(newUser);
        fallbackStore.currentUser = newUser;
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
        return fallbackStore.tasks.filter(t => t.assignedToId === targetId || t.createdById === targetId) as T;
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
        const newTask: Task = {
          id: `TSK-${Math.floor(100 + Math.random() * 900)}`,
          clientId: payload.clientId,
          clientName: payload.clientName || 'General',
          assignedToId: payload.assignedToId || user?.id || 'b2906eef-124a-4abc-a60f-c0834da25ee0',
          assignedToName: payload.assignedToName || user?.name || 'Unknown',
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

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
};
