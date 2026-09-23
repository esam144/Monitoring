import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const authBaseURL = `${String(API_URL).replace(/\/api\/?$/, '')}/auth`.replace(
  /([^:]\/)\/+/g,
  '$1'
);

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const authHttp = axios.create({
  baseURL: authBaseURL,
  headers: { 'Content-Type': 'application/json' },
});

const attachToken = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(attachToken);
authHttp.interceptors.request.use(attachToken);

const handleUnauthorized = (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
  }
  return Promise.reject(error);
};

api.interceptors.response.use((res) => res, handleUnauthorized);
authHttp.interceptors.response.use((res) => res, handleUnauthorized);

export const getErrorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || fallback;

export default api;
