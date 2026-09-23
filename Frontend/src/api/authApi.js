import { authHttp } from './axios';

export const loginRequest = (email, password) =>
  authHttp.post('/login', { email, password });

export const getMeRequest = () => authHttp.get('/me');

export const logoutRequest = () => authHttp.post('/logout');
