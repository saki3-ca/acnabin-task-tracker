import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isOverdue } from '../lib/dateUtils';
import { useLivePolling } from '../lib/useLivePolling';
import { taskService } from '../services/taskService';
import { DashboardStats, Task, TaskFilter } from '../types';
import { useAuth } from './AuthContext';

interface TaskContextType {
  myTasks: Task[];
  teamTasks: Task[];
  isLoading: boolean;
  teamFilters: TaskFilter;
  setTeamFilters: React.Dispatch<React.SetStateAction<TaskFilter>>;
  myStats: DashboardStats;
  teamStats: DashboardStats;
  fetchTasks: () => Promise<void>;
  createTask: (taskData: Partial<Task>) => Promise<void>;
  createTasksBulk: (tasksData: Partial<Task>[]) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addManagerComment: (taskId: string, comment: string) => Promise<void>;
  toast: string | null;
  showToast: (msg: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, allUsers } = useAuth();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [teamFilters, setTeamFilters] = useState<TaskFilter>({ status: 'All' });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const calculateStats = (tasks: Task[]): DashboardStats => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;

    tasks.forEach(t => {
      if (t.status === 'Pending') pending++;
      else if (t.status === 'In Progress') inProgress++;
      else if (t.status === 'Completed') completed++;

      if (isOverdue(t.deadline, t.status)) overdue++;
    });

    return {
      total: pending + inProgress, // active only: completed tasks are not counted
      pending,
      inProgress,
      completed,
      overdue
    };
  };

  const myStats = useMemo(() => calculateStats(myTasks), [myTasks]);
  const teamStats = useMemo(() => calculateStats(teamTasks), [teamTasks]);

  const fetchTasks = async (silent = false) => {
    if (!currentUser?.id) return;
    if (!silent) setIsLoading(true); // background refreshes don't flash the loading state
    try {
      const [myResult, teamResult] = await Promise.allSettled([
        taskService.getMyTasks(currentUser.id),
        taskService.getTeamTasks(currentUser.id, {
          clientId: teamFilters.clientId,
          memberId: teamFilters.memberId
        })
      ]);
      // A task keeps the name the person had when it was created. If the account was renamed since,
      // show the current name so the same person is not listed under two names.
      const currentName = new Map(allUsers.map(u => [u.id, u.name]));
      const withCurrentNames = (list: Task[]) =>
        list.map(t => {
          const assignee = currentName.get(t.assignedToId);
          const creator = currentName.get(t.createdById);
          return assignee !== t.assignedToName || (creator && creator !== t.createdByName)
            ? { ...t, assignedToName: assignee || t.assignedToName, createdByName: creator || t.createdByName }
            : t;
        });

      if (myResult.status === 'fulfilled') {
        setMyTasks(withCurrentNames(myResult.value));
      } else {
        console.error('Failed to fetch my tasks:', myResult.reason);
      }
      if (teamResult.status === 'fulfilled') {
        setTeamTasks(withCurrentNames(teamResult.value));
      } else {
        console.error('Failed to fetch team tasks:', teamResult.reason);
      }
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Error fetching tasks');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Keep tasks up to date without a manual refresh
  useLivePolling(() => fetchTasks(true), 10000, Boolean(currentUser?.id));

  useEffect(() => {
    if (currentUser?.id) {
      fetchTasks();
    }
  }, [currentUser?.id, teamFilters.clientId, teamFilters.memberId]);

  const createTask = async (taskData: Partial<Task>) => {
    try {
      await taskService.createTask(taskData);
      showToast('Task created successfully');
      await fetchTasks();
    } catch (err: any) {
      showToast(err.message || 'Failed to create task');
      throw err;
    }
  };

  const createTasksBulk = async (tasksData: Partial<Task>[]) => {
    // allSettled so one failed insert doesn't hide the ones that succeeded
    // (throwing would keep the modal open and a retry would duplicate them).
    // skipEmail: the emails for the whole batch are sent together below, one per person
    const results = await Promise.allSettled(tasksData.map(t => taskService.createTask({ ...t, skipEmail: true } as Partial<Task>)));
    const failed = tasksData.filter((_, i) => results[i].status === 'rejected');
    const succeededCount = tasksData.length - failed.length;

    if (succeededCount > 0) {
      const createdIds = results
        .filter((r): r is PromiseFulfilledResult<Task> => r.status === 'fulfilled')
        .map(r => r.value.id);
      void taskService.emailAssigned(createdIds);
      await fetchTasks();
    }

    if (failed.length === 0) {
      showToast(`Successfully assigned tasks to ${tasksData.length} team members!`);
      return;
    }

    const firstError = (results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason;
    console.error('Bulk assignment failures:', results.filter(r => r.status === 'rejected'));
    if (succeededCount === 0) {
      showToast(firstError?.message || 'Failed to assign tasks');
      throw firstError;
    }
    showToast(
      `Assigned to ${succeededCount} of ${tasksData.length} members. Failed for: ${failed.map(t => t.assignedToName || t.assignedToId).join(', ')}`
    );
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await taskService.updateTask(taskId, updates);
      showToast('Task updated');
      await fetchTasks();
    } catch (err: any) {
      showToast(err.message || 'Failed to update task');
      throw err;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      showToast('Task deleted');
      await fetchTasks();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete task');
      throw err;
    }
  };

  const addManagerComment = async (taskId: string, comment: string) => {
    try {
      await taskService.addManagerComment(taskId, comment);
      showToast('Comment saved');
      await fetchTasks();
    } catch (err: any) {
      showToast(err.message || 'Failed to add comment');
      throw err;
    }
  };

  return (
    <TaskContext.Provider
      value={{
        myTasks,
        teamTasks,
        isLoading,
        teamFilters,
        setTeamFilters,
        myStats,
        teamStats,
        fetchTasks,
        createTask,
        createTasksBulk,
        updateTask,
        deleteTask,
        addManagerComment,
        toast,
        showToast
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within a TaskProvider');
  return context;
};
