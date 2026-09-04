import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isOverdue } from '../lib/dateUtils';
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
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addManagerComment: (taskId: string, comment: string) => Promise<void>;
  toast: string | null;
  showToast: (msg: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
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
      total: tasks.length,
      pending,
      inProgress,
      completed,
      overdue
    };
  };

  const myStats = useMemo(() => calculateStats(myTasks), [myTasks]);
  const teamStats = useMemo(() => calculateStats(teamTasks), [teamTasks]);

  const fetchTasks = async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    try {
      const [myResult, teamResult] = await Promise.allSettled([
        taskService.getMyTasks(currentUser.id),
        taskService.getTeamTasks(currentUser.id, teamFilters)
      ]);
      if (myResult.status === 'fulfilled') {
        setMyTasks(myResult.value);
      } else {
        console.error('Failed to fetch my tasks:', myResult.reason);
      }
      if (teamResult.status === 'fulfilled') {
        setTeamTasks(teamResult.value);
      } else {
        console.error('Failed to fetch team tasks:', teamResult.reason);
      }
    } catch (err: any) {
      showToast(err.message || 'Error fetching tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchTasks();
    }
  }, [currentUser?.id, teamFilters]);

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
