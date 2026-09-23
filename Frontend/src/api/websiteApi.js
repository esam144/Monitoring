import { api } from './axios';

export const getWebsites = (params = {}) =>
  api.get('/websites', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      status: params.status ?? 'all',
    },
  });

export const getWebsiteById = (id) => api.get(`/websites/${id}`);

export const createWebsite = (payload) => api.post('/websites', payload);

export const updateWebsite = (id, payload) => api.put(`/websites/${id}`, payload);

export const deleteWebsite = (id) => api.delete(`/websites/${id}`);
