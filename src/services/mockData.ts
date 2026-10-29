import { Client, ManpowerRecord, Task, User } from '../types';

// Starting data for the offline fallback store in api.ts. Kept empty on purpose:
// real staff, client and task data lives only in Supabase, never in the repo.
export const INITIAL_USERS: User[] = [];

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_MANAGER_CLIENTS: Record<string, string[]> = {};

export const INITIAL_MANAGER_STUDENTS: Record<string, string[]> = {};

export const INITIAL_MANPOWER: ManpowerRecord[] = [];
