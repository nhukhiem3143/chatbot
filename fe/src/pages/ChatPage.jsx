import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import ChatBox from '../components/ChatBox.jsx';
import SpecEditor from '../components/SpecEditor.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import PreviewFrame from '../components/PreviewFrame.jsx';
import { get, post, put, del, errMsg, downloadZip } from '../api/client.js';

const FINISHED = ['failed', 'stopped'];

export default function ChatPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [convs, setConvs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [spec, setSpec] = useState(null);
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState(null);
  const [tab, setTab] = useState('spec');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadList = useCallback(() => get('/conversations').then(setConvs).catch(() => { }), []);
  useEffect(() => { loadList(); }, [loadList]);

  // Nạp hội thoại + spec + run gần nhất của hội thoại này
  useEffect(() => {
    setErr(''); setRun(null); setTab('spec');
    if (!id) { setMessages([]); setSpec(null); setReady(false); return; }
    get(`/conversations/${id}`).then((d) => {
      setMessages(d.messages);
      setSpec(d.spec);
      setReady(['spec_ready', 'generating', 'done'].includes(d.conversation.status));
    }).catch((e) => setErr(errMsg(e)));
    get('/runs').then((rs) => {
      const r = rs.find((x) => String(x.conversation_id) === String(id));
      if (r) { get(`/runs/${r.id}`).then(setRun); setTab('run'); }
    }).catch(() => { });
  }, [id]);

  // Theo dõi tiến trình tạo web
  useEffect(() => {
    if (!run || FINISHED.includes(run.status)) return undefined;
    if (run.status === 'running' && !run.current_agent) return undefined;
    const t = setInterval(() => get(`/runs/${run.id}`).then(setRun).catch(() => { }), 3000);
    return () => clearInterval(t);
  }, [run]);

  const send = async (text) => {
    setErr(''); setBusy(true);
    try {
      let cid = id;
      if (!cid) {
        const c = await post('/conversations', {});
        cid = c.id;
        nav(`/c/${cid}`, { replace: true });
      }
      setMessages((m) => [...m, { role: 'user', content: text }]);
      const r = await post(`/conversations/${cid}/messages`, { content: text });
      setMessages((m) => [...m, { role: 'assistant', content: r.reply }]);
      if (r.spec) setSpec(r.spec);
      setReady(r.ready);
      if (r.ready) setTab('spec');
      loadList();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const saveSpec = async (content) => {
    setBusy(true);
    try { setSpec(await put(`/specs/${spec.id}`, { content })); setReady(true); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const confirmAndGenerate = async (edited) => {
    setErr(''); setBusy(true);
    try {
      let s = spec;
      if (edited) s = await put(`/specs/${spec.id}`, { content: edited });
      await post(`/specs/${s.id}/confirm`);
      setSpec({ ...s, status: 'confirmed' });
      const r = await post('/generate', { conversation_id: Number(id) });
      setRun({ id: r.run_id, status: 'queued', current_agent: 'planner' });
      setTab('run');
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const stop = async () => { await post(`/generate/${run.id}/stop`); setRun(await get(`/runs/${run.id}`)); };
  const restart = async () => {
    setErr(''); setBusy(true);
    try { await post(`/generate/${run.id}/start`); setRun(await get(`/runs/${run.id}`)); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const removeConv = async (cid) => {
    if (!confirm('Xóa cuộc trò chuyện này?')) return;
    await del(`/conversations/${cid}`);
    if (String(cid) === String(id)) nav('/');
    loadList();
  };

  const showPreview = run && run.status === 'running' && run.port;

  return (
    <div className="app">
      <Header />
      <div className="layout">
        <aside className="side">
          <button className="btn" onClick={() => nav('/')}>+ Cuộc trò chuyện mới</button>
          <div className="conv-list">
            {convs.map((c) => (
              <div key={c.id} className={`conv ${String(c.id) === String(id) ? 'sel' : ''}`}>
                <Link to={`/c/${c.id}`}>{c.title}</Link>
                <button className="x" onClick={() => removeConv(c.id)} title="Xóa">✕</button>
              </div>
            ))}
          </div>
        </aside>

        <main className="center">
          <ChatBox messages={messages} onSend={send} busy={busy} />
          {err && <div className="error pad">{err}</div>}
        </main>

        <section className="right">
          <div className="tabs">
            <button className={tab === 'spec' ? 'on' : ''} onClick={() => setTab('spec')}>Yêu cầu</button>
            <button className={tab === 'run' ? 'on' : ''} onClick={() => setTab('run')} disabled={!run}>Tiến trình & Preview</button>
          </div>
          {tab === 'spec' && <SpecEditor spec={spec} ready={ready} busy={busy} onSave={saveSpec} onConfirm={confirmAndGenerate} />}
          {tab === 'run' && run && (
            <div className="pad">
              <ProgressBar run={run} />
              {showPreview && <PreviewFrame port={run.port} />}
              <div className="row">
                {run.status === 'running' && <button className="btn small ghost" onClick={stop}>Tắt web</button>}
                {run.status === 'stopped' && <button className="btn small" onClick={restart} disabled={busy}>▶ Bật lại web</button>}
                <button className="btn small ghost" onClick={() => downloadZip(run.id)} disabled={!['running', 'stopped', 'failed'].includes(run.status)}>⬇ Tải ZIP</button>
                <Link className="btn small ghost" to={`/runs/${run.id}`}>Xem file</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}