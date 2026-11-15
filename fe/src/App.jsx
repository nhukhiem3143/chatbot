import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import RunDetailPage from './pages/RunDetailPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminConversations from './pages/admin/AdminConversations.jsx';
import AdminConversationDetail from './pages/admin/AdminConversationDetail.jsx';

const me = () => {
  if (!localStorage.getItem('token')) return null;
  try { return JSON.parse(localStorage.getItem('user')) || null; } catch (e) { return null; }
};
// Khu người dùng: admin đăng nhập sẽ được chuyển sang /admin
const UserGuard = ({ children }) => {
  const u = me();
  if (!u) return <Navigate to="/login" replace />;
  if (u.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
};
// Khu quản trị: chỉ role=admin (FE chỉ để điều hướng; quyền thật do BE kiểm tra ở /api/admin)
const AdminGuard = ({ children }) => {
  const u = me();
  if (!u) return <Navigate to="/login" replace />;
  if (u.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<UserGuard><ChatPage /></UserGuard>} />
      <Route path="/c/:id" element={<UserGuard><ChatPage /></UserGuard>} />
      <Route path="/history" element={<UserGuard><HistoryPage /></UserGuard>} />
      <Route path="/runs/:id" element={<UserGuard><RunDetailPage /></UserGuard>} />
      <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
      <Route path="/admin/conversations" element={<AdminGuard><AdminConversations /></AdminGuard>} />
      <Route path="/admin/conversations/:id" element={<AdminGuard><AdminConversationDetail /></AdminGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}