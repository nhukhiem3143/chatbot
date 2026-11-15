import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout.jsx';
import { get, errMsg } from '../../api/client.js';

export const STATUS = {
    interviewing: ['Đang thu thập', ''], spec_ready: ['Chờ duyệt', 'warn'], generating: ['Đang tạo', 'warn'], done: ['Hoàn tất', 'ok'],
};
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '');

export default function AdminConversations() {
    const [sp, setSp] = useSearchParams();
    const uid = sp.get('user_id') || '';
    const [users, setUsers] = useState([]);
    const [rows, setRows] = useState([]);
    const [err, setErr] = useState('');
    useEffect(() => { get('/admin/users').then(setUsers).catch(() => { }); }, []);
    useEffect(() => {
        get('/admin/conversations', { params: uid ? { user_id: uid } : {} }).then(setRows).catch((e) => setErr(errMsg(e)));
    }, [uid]);

    return (
        <AdminLayout title="Hội thoại của người dùng" subtitle="Mỗi hội thoại thuộc về một người dùng cụ thể."
            actions={(
                <select aria-label="Lọc người dùng" className="sel-filter" value={uid} onChange={(e) => setSp(e.target.value ? { user_id: e.target.value } : {})}>
                    <option value="">Tất cả người dùng</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.conversations})</option>)}
                </select>
            )}>
            {err && <div className="error">{err}</div>}
            <table className="tbl">
                <thead><tr><th>Người dùng</th><th>Hội thoại</th><th>Trạng thái</th><th>Tin nhắn</th><th>Cập nhật</th><th></th></tr></thead>
                <tbody>
                    {rows.map((c) => (
                        <tr key={c.id}>
                            <td><b>{c.user_name}</b><div className="muted small">{c.user_email}</div></td>
                            <td>{c.title}</td>
                            <td><span className={`tag ${STATUS[c.status]?.[1] || ''}`}>{STATUS[c.status]?.[0] || c.status}</span></td>
                            <td>{c.message_count}</td><td className="muted">{fmt(c.updated_at)}</td>
                            <td><Link to={`/admin/conversations/${c.id}`}>Xem</Link></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!rows.length && <p className="muted">Chưa có hội thoại nào.</p>}
        </AdminLayout>
    );
}