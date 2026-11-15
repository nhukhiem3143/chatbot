import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout.jsx';
import { get, errMsg } from '../../api/client.js';
import { BotAvatar, UserAvatar } from '../../components/Icon.jsx';
import { STATUS } from './AdminConversations.jsx';

export default function AdminConversationDetail() {
    const { id } = useParams();
    const [d, setD] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => { get(`/admin/conversations/${id}`).then(setD).catch((e) => setErr(errMsg(e))); }, [id]);
    if (err) return <AdminLayout title="Hội thoại"><div className="error">{err}</div></AdminLayout>;
    if (!d) return <AdminLayout title="Hội thoại"><p className="muted">Đang tải…</p></AdminLayout>;
    const sc = d.spec?.content || {};

    return (
        <AdminLayout title={d.conversation.title} subtitle={`Của ${d.owner.name} (${d.owner.email}) · ${STATUS[d.conversation.status]?.[0] || d.conversation.status}`}
            actions={<Link className="btn small ghost" to={`/admin/conversations?user_id=${d.owner.id}`}>← Hội thoại của {d.owner.name}</Link>}>
            <div className="adm-cols">
                <div className="adm-card msgs-ro">
                    {d.messages.map((m) => (
                        <div key={m.id} className={`msg ${m.role}`}>
                            {m.role === 'assistant' && <BotAvatar size={30} />}
                            <div className="bubble">{m.content}</div>
                            {m.role === 'user' && <UserAvatar size={30} />}
                        </div>
                    ))}
                    {!d.messages.length && <p className="muted">Chưa có tin nhắn.</p>}
                </div>
                <div className="adm-stack">
                    <div className="adm-card">
                        <strong>Yêu cầu (Spec{d.spec ? ` v${d.spec.version}` : ''})</strong>
                        {d.spec ? (
                            <dl className="kv">
                                <dt>Cửa hàng</dt><dd>{sc.site_name || '-'}</dd>
                                <dt>Loại hình</dt><dd>{sc.business_type || '-'}</dd>
                                <dt>Danh mục</dt><dd>{(sc.categories || []).join(', ') || '-'}</dd>
                                <dt>Trạng thái</dt><dd>{d.spec.status === 'confirmed' ? 'Đã xác nhận' : 'Bản nháp'}</dd>
                            </dl>
                        ) : <p className="muted">Chưa có spec.</p>}
                    </div>
                    <div className="adm-card">
                        <strong>Các lần tạo web</strong>
                        {d.runs.map((r) => (
                            <div key={r.id} className="adm-row"><b>#{r.id}</b><span className="muted grow">{r.template}{r.port ? ` · cổng ${r.port}` : ''}</span><span className={`tag ${r.status === 'running' ? 'ok' : r.status === 'failed' ? 'bad' : ''}`}>{r.status}</span></div>
                        ))}
                        {!d.runs.length && <p className="muted">Chưa tạo web.</p>}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}