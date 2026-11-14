import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import FileTree from '../components/FileTree.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import PreviewFrame from '../components/PreviewFrame.jsx';
import { get, downloadZip, errMsg } from '../api/client.js';

export default function RunDetailPage() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [sel, setSel] = useState('');
  const [content, setContent] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { get(`/runs/${id}`).then(setRun).catch((e) => setErr(errMsg(e))); }, [id]);
  useEffect(() => {
    if (!sel) return;
    get(`/runs/${id}/file`, { params: { path: sel } }).then((d) => setContent(d.content)).catch((e) => setContent(`// ${errMsg(e)}`));
  }, [sel, id]);

  if (err) return <div className="app"><Header /><div className="page error">{err}</div></div>;
  if (!run) return <div className="app"><Header /><div className="page">Đang tải…</div></div>;

  return (
    <div className="app">
      <Header />
      <div className="page">
        <div className="row between">
          <h2>Run #{run.id} <span className="tag">{run.status}</span></h2>
          <div className="row">
            <Link className="btn small ghost" to={`/c/${run.conversation_id}`}>← Hội thoại</Link>
            <button className="btn small" onClick={() => downloadZip(run.id)}>⬇ Tải ZIP project</button>
          </div>
        </div>
        <ProgressBar run={run} />
        {run.status === 'running' && run.port && <PreviewFrame port={run.port} />}

        {run.plan && (
          <details className="box"><summary>Plan (hợp đồng giữa các agent)</summary><pre>{JSON.stringify(run.plan, null, 2)}</pre></details>
        )}
        {run.report && (
          <details className="box"><summary>Báo cáo Tester</summary><pre>{JSON.stringify(run.report, null, 2)}</pre></details>
        )}

        <h3>File của project</h3>
        <div className="files">
          <FileTree files={run.files} selected={sel} onSelect={setSel} />
          <pre className="code">{sel ? content : 'Chọn một file để xem nội dung.'}</pre>
        </div>
      </div>
    </div>
  );
}
