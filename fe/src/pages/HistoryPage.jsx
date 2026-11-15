import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { Logo } from '../components/Icon.jsx';
import { get } from '../api/client.js';

const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '');

export default function HistoryPage() {
  const [runs, setRuns] = useState([]);
  useEffect(() => { get('/runs').then(setRuns).catch(() => { }); }, []);
  return (
    <div className="app">
      <Header />
      <div className="page">
        <h2>Lịch sử tạo web</h2>
        <table className="tbl">
          <thead><tr><th>Run</th><th>Template</th><th>Trạng thái</th><th>Cổng</th><th>Bắt đầu</th><th></th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td><td>{r.template}</td>
                <td><span className={`tag ${r.status === 'running' ? 'ok' : r.status === 'failed' ? 'bad' : ''}`}>{r.status}</span></td>
                <td>{r.port || '-'}</td><td>{fmt(r.started_at)}</td>
                <td><Link to={`/runs/${r.id}`}>Chi tiết</Link> · <Link to={`/c/${r.conversation_id}`}>Hội thoại</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!runs.length && (
          <div className="empty-state">
            <Logo size={44} text={false} />
            <h3>Chưa có website nào</h3>
            <p className="muted">Hãy trò chuyện với AI để tạo website đầu tiên.</p>
            <Link className="btn" to="/">Bắt đầu trò chuyện</Link>
          </div>
        )}
      </div>
    </div>
  );
}