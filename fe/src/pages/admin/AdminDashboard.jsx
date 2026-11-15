import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { Icon } from '../../components/Icon.jsx';
import { get, errMsg } from '../../api/client.js';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TAG = { running: 'ok', failed: 'bad' };

export default function AdminDashboard() {
    const [s, setS] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => { get('/admin/stats').then(setS).catch((e) => setErr(errMsg(e))); }, []);

    const days = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const key = ymd(d);
        return { label: `${d.getDate()}/${d.getMonth() + 1}`, c: Number((s?.per_day || []).find((x) => x.d === key)?.c || 0) };
    });
    const max = Math.max(1, ...days.map((d) => d.c));
    const cards = s && [
        ['users', 'Người dùng', s.users], ['chat', 'Hội thoại', s.conversations],
        ['globe', 'Web đang chạy', s.running], ['bolt', 'Lượt tạo web', s.runs],
    ];

    return (
        <AdminLayout title="Tổng quan hệ thống" subtitle="Theo dõi người dùng và các lượt tạo web.">
            {err && <div className="error">{err}</div>}
            {s && (
                <>
                    <div className="stats">
                        {cards.map(([i, l, v]) => (
                            <div key={l} className="stat"><span className="stat-ic"><Icon name={i} size={20} /></span><div className="muted small">{l}</div><div className="stat-v">{v}</div></div>
                        ))}
                    </div>
                    <div className="adm-cols">
                        <div className="adm-card">
                            <strong>Lượt tạo web 7 ngày qua</strong>
                            <div className="bars">
                                {days.map((d, i) => (
                                    <div key={d.label} className="bar-col"><span className="small">{d.c}</span>
                                        <div className={`bar ${i === 6 ? 'cur' : ''}`} style={{ height: `${(d.c / max) * 140 + 4}px` }} /><span className="small muted">{d.label}</span></div>
                                ))}
                            </div>
                        </div>
                        <div className="adm-card">
                            <strong>Run gần đây</strong>
                            {s.recent.map((r) => (
                                <div key={r.id} className="adm-row"><b>#{r.id}</b><span className="muted grow">{r.user_name} · {r.template}</span><span className={`tag ${TAG[r.status] || ''}`}>{r.status}</span></div>
                            ))}
                            {!s.recent.length && <p className="muted">Chưa có lượt tạo web nào.</p>}
                            <p className="muted small">Run thất bại: {s.failed}</p>
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
}