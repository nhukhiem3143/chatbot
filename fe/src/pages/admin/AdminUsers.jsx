import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout.jsx';
import { Icon } from '../../components/Icon.jsx';
import { get, put, errMsg } from '../../api/client.js';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [q, setQ] = useState('');
    const [err, setErr] = useState('');
    const me = JSON.parse(localStorage.getItem('user') || '{}');
    const load = () => get('/admin/users').then(setUsers).catch((e) => setErr(errMsg(e)));
    useEffect(() => { load(); }, []);

    const setRole = async (u, role) => {
        setErr('');
        try { await put(`/admin/users/${u.id}/role`, { role }); load(); } catch (e) { setErr(errMsg(e)); }
    };
    const list = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

    return (
        <AdminLayout title="Quản lý người dùng" subtitle="Xem ai đã tạo bao nhiêu hội thoại và web.">
            {err && <div className="error">{err}</div>}
            <div className="field"><Icon name="search" /><input aria-label="Tìm kiếm" placeholder="Tìm theo tên hoặc email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <table className="tbl">
                <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Hội thoại</th><th>Run</th><th></th></tr></thead>
                <tbody>
                    {list.map((u) => (
                        <tr key={u.id}>
                            <td><div className="who"><span className="avatar-u">{u.name?.[0]?.toUpperCase()}</span><div><b>{u.name}</b><div className="muted small">{u.email}</div></div></div></td>
                            <td>
                                <select aria-label="Vai trò" value={u.role} disabled={u.id === me.id} onChange={(e) => setRole(u, e.target.value)} className="sel-role">
                                    <option value="user">user</option><option value="admin">admin</option>
                                </select>
                            </td>
                            <td>{u.conversations}</td><td>{u.runs}</td>
                            <td><Link to={`/admin/conversations?user_id=${u.id}`}>Xem hội thoại</Link></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </AdminLayout>
    );
}