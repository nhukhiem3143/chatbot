import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import RunDetailPage from './pages/RunDetailPage.jsx';

const authed = () => !!localStorage.getItem('token');
const Guard = ({ children }) => (authed() ? children : <Navigate to="/login" replace />);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Guard><ChatPage /></Guard>} />
      <Route path="/c/:id" element={<Guard><ChatPage /></Guard>} />
      <Route path="/history" element={<Guard><HistoryPage /></Guard>} />
      <Route path="/runs/:id" element={<Guard><RunDetailPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
