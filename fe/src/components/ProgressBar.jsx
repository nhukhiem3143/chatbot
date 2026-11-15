import React from 'react';
import { Icon } from './Icon.jsx';

const STEPS = [
  { key: 'planning', label: 'Lên kế hoạch', agent: 'Planner' },
  { key: 'coding', label: 'Viết code', agent: 'Developer' },
  { key: 'testing', label: 'Build & kiểm thử', agent: 'Tester' },
  { key: 'running', label: 'Chạy web', agent: '' },
];
// 'ready' có trong DB (runModel) nên phải được tính là đã xong
const order = { queued: -1, planning: 0, coding: 1, testing: 2, starting: 2, running: 3, ready: 3, failed: -2, stopped: 3 };
const FINISHED = ['running', 'stopped', 'ready'];

export default function ProgressBar({ run }) {
  if (!run) return null;
  const cur = order[run.status] ?? -1;
  const failed = run.status === 'failed';
  return (
    <div className="progress">
      <div className="steps">
        {STEPS.map((s, i) => {
          const done = !failed && (cur > i || FINISHED.includes(run.status));
          const active = !failed && cur === i && !done;
          return (
            <div key={s.key} className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <span className="dot">{done ? <Icon name="check" size={14} /> : i + 1}</span>
              <span>{s.label}{active && s.agent ? ` (${s.agent})` : ''}</span>
            </div>
          );
        })}
      </div>
      {run.retry_count > 0 && run.status !== 'running' && <div className="muted small">Vòng sửa lỗi: {run.retry_count}</div>}
      {failed && <div className="error">Thất bại: {run.error}</div>}
    </div>
  );
}