import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLivePolling } from '../lib/useLivePolling';
import { adminService } from '../services/adminService';
import { authService } from '../services/authService';
import { clientService } from '../services/clientService';
import { Client, User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  allUsers: User[];
  allClients: Client[];
  login: (empId: string, password?: string) => Promise<void>;
  register: (payload: any) => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  refreshContextData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const sameData = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('acnabin_current_user');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allClients, setAllClients] = useState<Client[]>(() => clientService.getCachedAllClients() || []);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshContextData = async () => {
    try {
      const [users, clients] = await Promise.all([
        adminService.getAllUsers().catch(() => []),
        clientService.getAllClients().catch(() => clientService.getCachedAllClients() || [])
      ]);
      // Keep the same objects when nothing changed, so screens don't reload on every background refresh
      setAllUsers(prev => (sameData(prev, users) ? prev : users));
      setAllClients(prev => (sameData(prev, clients) ? prev : clients));

      // Resolve active user from localStorage session
      setCurrentUser(prev => {
        let activeUser: User | null = null;
        if (prev && users.some(u => u.id === prev.id)) {
          activeUser = users.find(u => u.id === prev.id) || prev;
        } else {
          const stored = localStorage.getItem('acnabin_current_user');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed && parsed.id) {
                activeUser = users.find(u => u.id === parsed.id || u.empId === parsed.empId) || null;
              }
            } catch {}
          }
        }

        if (activeUser) {
          if (prev && sameData(prev, activeUser)) return prev;
          try { localStorage.setItem('acnabin_current_user', JSON.stringify(activeUser)); } catch {}
          // Pre-warm client cache for active user
          adminService.prefetchManagerClientIds(activeUser.id).catch(() => {});
          return activeUser;
        }
        return null;
      });
    } catch (err) {
      console.error('Failed to load initial context data', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep the user and client lists (dropdowns, names) fresh while the app stays open
  useLivePolling(() => refreshContextData(), 60000, Boolean(currentUser));

  useEffect(() => {
    // If current user is already cached in localStorage, start prefetching client IDs immediately
    if (currentUser?.id) {
      adminService.prefetchManagerClientIds(currentUser.id).catch(() => {});
    }
    refreshContextData();
  }, []);

  // Only show the global loading screen after the credentials are accepted:
  // showing it earlier unmounts the login/signup form and drops its error message.
  const login = async (empId: string, password?: string) => {
    const res = await authService.login(empId, password);
    setIsLoading(true);
    try {
      setCurrentUser(res.user);
      if (res.user?.id) {
        adminService.prefetchManagerClientIds(res.user.id).catch(() => {});
      }
      await refreshContextData();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: any) => {
    const res = await authService.register(payload);
    setIsLoading(true);
    try {
      setCurrentUser(res.user);
      await refreshContextData();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
  };

  const switchUser = async (userId: string) => {
    try {
      const switched = await authService.switchUserForDemo(userId);
      const target = allUsers.find(u => u.id === userId) || switched;
      if (target) {
        try { localStorage.setItem('acnabin_current_user', JSON.stringify(target)); } catch {}
        setCurrentUser(target);
      }
    } catch {
      const target = allUsers.find(u => u.id === userId);
      if (target) {
        try { localStorage.setItem('acnabin_current_user', JSON.stringify(target)); } catch {}
        setCurrentUser(target);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        allUsers,
        allClients,
        login,
        register,
        logout,
        switchUser,
        refreshContextData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
