import React, { createContext, useContext, useEffect, useState } from 'react';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshContextData = async () => {
    try {
      const [users, clients] = await Promise.all([
        adminService.getAllUsers().catch(() => []),
        clientService.getAllClients().catch(() => [])
      ]);
      setAllUsers(users);
      setAllClients(clients);

      // Resolve active user: pick real user from DB if current is null or mock
      setCurrentUser(prev => {
        if (prev && users.some(u => u.id === prev.id)) {
          const matched = users.find(u => u.id === prev.id) || prev;
          try { localStorage.setItem('acnabin_current_user', JSON.stringify(matched)); } catch {}
          return matched;
        }
        const stored = localStorage.getItem('acnabin_current_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) {
              const matched = users.find(u => u.id === parsed.id || u.empId === parsed.empId);
              if (matched) {
                localStorage.setItem('acnabin_current_user', JSON.stringify(matched));
                return matched;
              }
            }
          } catch {}
        }
        const sakib = users.find(u => u.name.toUpperCase().includes('SAKIB'));
        const chosen = sakib || users[0] || null;
        if (chosen) {
          try { localStorage.setItem('acnabin_current_user', JSON.stringify(chosen)); } catch {}
        }
        return chosen;
      });
    } catch (err) {
      console.error('Failed to load initial context data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshContextData();
  }, []);

  const login = async (empId: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await authService.login(empId, password);
      setCurrentUser(res.user);
      await refreshContextData();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: any) => {
    setIsLoading(true);
    try {
      const res = await authService.register(payload);
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
