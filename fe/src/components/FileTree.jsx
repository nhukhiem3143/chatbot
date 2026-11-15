import React from 'react';

const ICON = { generated: '🆕', edited: '✏️', template: '📄' };

// Danh sách file của project (nhóm theo thư mục cấp 1)
export default function FileTree({ files, selected, onSelect }) {
  const groups = {};
  (files || []).forEach((f) => {
    const top = f.path.includes('/') ? f.path.split('/')[0] : '(gốc)';
    (groups[top] = groups[top] || []).push(f);
  });
  return (
    <div className="filetree">
      {Object.keys(groups).sort().map((g) => (
        <div key={g}>
          <div className="ft-group">📁 {g}</div>
          {groups[g].map((f) => (
            <div key={f.path} className={`ft-file ${selected === f.path ? 'sel' : ''}`} onClick={() => onSelect(f.path)} title={f.kind}>
              {ICON[f.kind] || '📄'} {f.path}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
