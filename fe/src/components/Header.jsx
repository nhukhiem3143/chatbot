import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Icon, Logo } from './Icon.jsx';

export default function Header() {
  const nav = useNavigate();
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { /* ignore */ }
  const cls = ({ isActive }) => `navlink ${isActive ? 'on' : ''}`;
  return (
    <header className="topbar">
      <Link to="/" className="brand"><Logo /></Link>
      <nav>
        <NavLink to="/" end className={cls}><Icon name="chat" size={16} />Trò chuyện</NavLink>
        <NavLink to="/history" className={cls}><Icon name="clock" size={16} />Lịch sử</NavLink>
        <span className="vsep" />
        <span className="avatar-u" title={user?.name}>{(user?.name || user?.email || '?')[0].toUpperCase()}</span>
        <button className="btn small ghost" onClick={() => { localStorage.clear(); nav('/login'); }}>
          <Icon name="out" size={15} />Đăng xuất
        </button>
      </nav>
    </header>
  );
}