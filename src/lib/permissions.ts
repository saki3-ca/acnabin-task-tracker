import { Designation, Task, User } from '../types';

export function isInChargeOrAbove(designation?: Designation | string): boolean {
  if (!designation) return false;
  return [
    'In Charge',
    'Supervisor',
    'Senior Assistant Manager',
    'Deputy Manager',
    'Manager',
    'Assistant Director',
    'Deputy Director',
    'Director',
    'Partner'
  ].includes(designation);
}

export function isManagementDesignation(designation?: Designation | string): boolean {
  return isInChargeOrAbove(designation);
}

export function isSAMOrAbove(designation?: Designation | string): boolean {
  if (!designation) return false;
  return [
    'Senior Assistant Manager',
    'Deputy Manager',
    'Manager',
    'Assistant Director',
    'Deputy Director',
    'Director',
    'Partner'
  ].includes(designation);
}

/**
 * Senior Assistant Manager and above have EMP.
 * Below Senior Assistant Manager (Student, In Charge, Supervisor) have STD.
 * Partners use Initial.
 */
export function getUserIdentifierLabel(user?: { designation?: string; role?: string } | null): string {
  if (!user) return 'ID';
  if (user.designation === 'Partner') return 'Initial';
  if (user.role === 'ADMIN') return 'Admin ID';
  if (isSAMOrAbove(user.designation)) return 'EMP ID';
  return 'STD ID';
}

/**
 * Formats user ID to the firm HRM standard:
 * - Below SAM: STD-001643
 * - SAM and above: EMP-000230
 * - Partner: Initials (e.g. AB)
 * - Admin: ADMIN
 */
export function formatHrmId(id: string, designation?: string): string {
  const raw = id.trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'ADMIN' || raw.startsWith('ADMIN')) return 'ADMIN';
  if (designation === 'Partner' || raw.length === 2) return raw;

  const digits = raw.replace(/\D/g, '');
  if (digits.length > 0) {
    const padded = digits.padStart(6, '0');
    if (raw.startsWith('EMP')) return `EMP-${padded}`;
    if (raw.startsWith('STD')) return `STD-${padded}`;
    if (isSAMOrAbove(designation)) return `EMP-${padded}`;
    return `STD-${padded}`;
  }
  return raw;
}

export function isAssistantDirectorOrAbove(designation?: Designation | string): boolean {
  if (!designation) return false;
  return [
    'Assistant Director',
    'Deputy Director',
    'Director',
    'Partner'
  ].includes(designation);
}

export function isAllAccessDesignation(designation?: Designation | string): boolean {
  return isAssistantDirectorOrAbove(designation);
}

export function canViewTeamTasks(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || isInChargeOrAbove(user.designation);
}

export function canViewAllClients(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || isAssistantDirectorOrAbove(user.designation);
}

export function canEditTask(user: User | null, task: Task, _isTeamView = false): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  // In own task (assigned to user), they can always edit
  if (task.assignedToId === user.id) return true;
  // If the task was directly assigned/created by them to others, they can edit
  if (task.createdById === user.id) return true;
  // For other's tasks not created by them, they cannot edit (they can only comment)
  return false;
}

export function canDeleteTask(user: User | null, task: Task): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  // Only the creator can delete their task
  if (task.createdById === user.id) return true;
  return false;
}

export function canAssignTasks(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || isInChargeOrAbove(user.designation);
}

export function canRequestTask(user: User | null): boolean {
  if (!user) return false;
  // Partners and Admin do not need to request tasks; they have direct assignment authority.
  if (user.role === 'ADMIN' || user.designation === 'Partner') return false;
  return true;
}

/**
 * Task commenting rule:
 * - Own task (assigned to user): NO comment option (they can edit directly).
 * - Other's task (assigned to someone else): they can comment.
 * - If they directly assigned a task to others, they can edit, comment, and delete.
 */
export function canCommentOnTask(user: User | null, task: Task): boolean {
  if (!user) return false;
  // Remove comment option for own task (they can edit directly)
  if (task.assignedToId === user.id) return false;

  // Admin can always comment on other's tasks
  if (user.role === 'ADMIN') return true;

  // If they directly assigned a task to others, they can comment
  if (task.createdById === user.id) return true;

  // Supervisory/management reviewing team tasks can comment
  if (isInChargeOrAbove(user.designation)) return true;

  return false;
}

export function canAddManagerComment(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || isInChargeOrAbove(user.designation);
}

// Numerical hierarchy ranking (higher number = higher authority)
export const DESIGNATION_RANKS: Record<string, number> = {
  'Admin': 100,
  'Partner': 90,
  'Director': 80,
  'Deputy Director': 70,
  'Assistant Director': 60,
  'Manager': 50,
  'Deputy Manager': 40,
  'Senior Assistant Manager': 30,
  'Supervisor': 20,
  'In Charge': 15,
  'Student': 10
};

export function getUserRank(user?: User | null): number {
  if (!user) return 0;
  if (user.role === 'ADMIN' || user.designation === 'Admin') return 100;
  return DESIGNATION_RANKS[user.designation] || 10;
}

export function getUserAssignedClientIds(user?: User | null): string[] {
  if (!user) return [];
  const list = new Set<string>();
  if (user.assignedClientIds && Array.isArray(user.assignedClientIds)) {
    user.assignedClientIds.forEach(id => {
      if (id) list.add(id.trim());
    });
  }
  if (user.signupClientId) {
    user.signupClientId.split(',').forEach(id => {
      const trimmed = id.trim();
      if (trimmed) list.add(trimmed);
    });
  }
  return Array.from(list);
}

/**
 * Returns the list of team members a user is permitted to assign tasks to:
 * 1. Must be strictly below the current user in the hierarchy (targetRank < currentRank).
 * 2. If current user is Assistant Director or above (or Admin), they can assign to any subordinate across the firm for the selected client.
 * 3. If current user is below Assistant Director (Manager, SAM, Supervisor, In Charge), they can ONLY assign to subordinates who are assigned to the selected client.
 */
export function getAssignableUsers(
  currentUser: User | null,
  allUsers: User[],
  selectedClientId: string
): User[] {
  if (!currentUser || !canAssignTasks(currentUser)) return [];

  const currentRank = getUserRank(currentUser);

  // Subordinates strictly below current user in hierarchy (excluding Admin)
  const subordinates = allUsers.filter(
    u => u.id !== currentUser.id &&
         u.role !== 'ADMIN' &&
         u.designation !== 'Admin' &&
         getUserRank(u) < currentRank
  );

  // If no client selected yet, show AD to above (since AD+ oversee all clients)
  if (!selectedClientId) {
    return subordinates.filter(u => isAssistantDirectorOrAbove(u.designation));
  }

  // Filter subordinates for selectedClientId:
  // 1. AD to above (Assistant Director, Deputy Director, Director, Partner): ALWAYS eligible for any client!
  // 2. Subordinates below AD (Manager, SAM, Supervisor, In Charge, Student): MUST be assigned to selectedClientId!
  return subordinates.filter(u => {
    if (isAssistantDirectorOrAbove(u.designation)) {
      return true;
    }
    const userClients = getUserAssignedClientIds(u);
    return userClients.includes(selectedClientId);
  });
}

/**
 * Returns eligible recipients for a task request:
 * - Student:
 *    1) Another student of the same client.
 *    2) In Charge through Manager (rank 15 to 50) on that client.
 *    3) CANNOT request to AD to above (Assistant Director, Deputy Director, Director, Partner) or Admin.
 * - In Charge to Director:
 *    1) Practice superiors ranked above them (including AD, DD, Director, Partner; excluding Admin).
 * - Partner / Admin:
 *    Do not need to request tasks (they directly assign).
 */
export function getEligibleTaskRequestRecipients(
  currentUser: User | null,
  allUsers: User[],
  selectedClientId: string
): { peers: User[]; superiors: User[] } {
  if (!currentUser || !canRequestTask(currentUser)) return { peers: [], superiors: [] };

  const currentRank = getUserRank(currentUser);
  const isStudent = currentUser.designation === 'Student';
  const isADPlus = isAssistantDirectorOrAbove(currentUser.designation);

  // 1. AD to Above (Assistant Director, Deputy Director, Director, Partner):
  // Can ONLY request tasks to AD to above (AD, DD, Director, Partner). Firm-wide, client is optional.
  if (isADPlus) {
    const superiors = allUsers.filter(u => {
      if (u.id === currentUser.id) return false;
      if (u.role === 'ADMIN' || u.designation === 'Admin') return false;
      return isAssistantDirectorOrAbove(u.designation);
    });
    return { peers: [], superiors };
  }

  // 2. Student:
  if (isStudent) {
    // Peer Students assigned to the same client
    const peers = allUsers.filter(u => {
      if (u.id === currentUser.id) return false;
      if (u.role === 'ADMIN' || u.designation === 'Admin') return false;
      if (u.designation !== 'Student') return false;
      if (!selectedClientId) return false;
      const clients = getUserAssignedClientIds(u);
      return clients.includes(selectedClientId);
    });

    // In-Charge through Manager (rank 15 to 50) on that client
    const superiors = allUsers.filter(u => {
      if (u.id === currentUser.id) return false;
      if (u.role === 'ADMIN' || u.designation === 'Admin') return false;
      const rank = getUserRank(u);
      if (rank < 15 || rank > 50) return false;
      if (!selectedClientId) return false;
      const clients = getUserAssignedClientIds(u);
      return clients.includes(selectedClientId);
    });

    return { peers, superiors };
  }

  // 3. In Charge to Manager (rank 15 to 50):
  // Can request to practice peers/superiors ranked same or above them (rank >= currentRank).
  const superiors = allUsers.filter(u => {
    if (u.id === currentUser.id) return false;
    if (u.role === 'ADMIN' || u.designation === 'Admin') return false;
    const rank = getUserRank(u);
    if (rank < currentRank) return false; // Must be same or higher rank (lower ranks assigned, not requested)

    // AD+ superiors work firm-wide
    if (isAssistantDirectorOrAbove(u.designation)) {
      return true;
    }

    // Peers/superiors below AD must be assigned to the selected client
    if (selectedClientId) {
      const clients = getUserAssignedClientIds(u);
      return clients.includes(selectedClientId);
    }

    return true;
  });

  return { peers: [], superiors };
}


