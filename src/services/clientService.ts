import { Client } from '../types';
import { api } from './api';

export const clientService = {
  async getAllClients(): Promise<Client[]> {
    return api.callBackend('getAllClients');
  },

  async addClient(name: string, jobNumber?: string): Promise<Client> {
    return api.callBackend('addClient', { name, jobNumber });
  },

  async updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
    return api.callBackend('updateClient', { clientId, ...updates });
  }
};
