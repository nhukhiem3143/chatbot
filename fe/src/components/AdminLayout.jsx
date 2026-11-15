import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon, Logo } from './Icon.jsx';

export default function AdminLayout({ title, subtitle, actions, children }) {
    const nav = useNavigate();
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { /* ignore */ }
    const cls = ({ isActive }) => `adm-link ${isActive ? 'on' : ''}`;
    return (
        <div className="adm">
            <aside className="adm-side">
                <Logo size={30} />
                <span className="tag adm-tag">Admin</span>
                <NavLink to="/admin" end className={cls}><Icon name="grid" />Tổng quan</NavLink>
                <NavLink to="/admin/users" className={cls}><Icon name="users" />Người dùng</NavLink>
                <NavLink to="/admin/conversations" className={cls}><Icon name="chat" />Hội thoại</NavLink>
                <div className="adm-foot">
                    <div className="muted small">{user?.name} · {user?.email}</div>
                    <button className="adm-link" onClick={() => { localStorage.clear(); nav('/login'); }}><Icon name="out" />Đăng xuất</button>
                </div>
            </aside>
            <main className="adm-main">
                <div className="adm-head">
                    <div><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div>
                    {actions}
                </div>
                {children}
            </main>
        </div>
    );
}