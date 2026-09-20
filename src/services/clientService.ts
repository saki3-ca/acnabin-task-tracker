import { Client } from '../types';
import { api } from './api';

const CLIENTS_CACHE_KEY = 'acnabin_all_clients_cache';
let inMemoryClientsCache: Client[] | null = null;

export const clientService = {
  getCachedAllClients(): Client[] | null {
    if (inMemoryClientsCache && inMemoryClientsCache.length > 0) {
      return inMemoryClientsCache;
    }
    try {
      const stored = localStorage.getItem(CLIENTS_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryClientsCache = parsed;
          return parsed;
        }
      }
    } catch {}
    return null;
  },

  async getAllClients(): Promise<Client[]> {
    try {
      const clients: Client[] = await api.callBackend('getAllClients');
      if (Array.isArray(clients)) {
        inMemoryClientsCache = clients;
        try {
          localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(clients));
        } catch {}
      }
      return clients;
    } catch (err) {
      const cached = this.getCachedAllClients();
      if (cached) return cached;
      throw err;
    }
  },

  async addClient(name: string, jobNumber?: string): Promise<Client> {
    const res = await api.callBackend<Client>('addClient', { name, jobNumber });
    // Invalidate/refresh cache
    this.getAllClients().catch(() => {});
    return res;
  },

  async updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
    const res = await api.callBackend<Client>('updateClient', { clientId, ...updates });
    // Invalidate/refresh cache
    this.getAllClients().catch(() => {});
    return res;
  }
};

