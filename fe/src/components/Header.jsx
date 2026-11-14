import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const nav = useNavigate();
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { /* ignore */ }
  return (
    <header className="topbar">
      <Link to="/" className="brand">🤖 AI Web Studio</Link>
      <nav>
        <Link to="/">Trò chuyện</Link>
        <Link to="/history">Lịch sử</Link>
        <span className="muted">{user?.name}{user?.role === 'admin' ? ' (admin)' : ''}</span>
        <button className="btn small ghost" onClick={() => { localStorage.clear(); nav('/login'); }}>Đăng xuất</button>
      </nav>
    </header>
  );
}
