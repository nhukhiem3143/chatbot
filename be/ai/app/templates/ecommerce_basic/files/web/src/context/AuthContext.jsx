// [LOCKED] Đăng nhập / đăng ký / đăng xuất, lưu token ở localStorage
import React, { createContext, useContext, useState } from 'react';
import api from '../api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
  });

  const save = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };
  const login = async (email, password) => save((await api.post('/auth/login', { email, password })).data);
  const register = async (name, email, password) => save((await api.post('/auth/register', { name, email, password })).data);
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, register, logout, isAdmin: user?.role === 'admin' }}>{children}</Ctx.Provider>;
}
