// [LOCKED] axios, baseURL = /api (nginx proxy sang container api)
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const money = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';
export default api;
