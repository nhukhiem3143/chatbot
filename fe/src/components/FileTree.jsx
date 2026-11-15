import React from 'react';
import { Icon } from './Icon.jsx';

// Danh sách file của project (nhóm theo thư mục cấp 1). kind: generated | edited | template
const KIND = { generated: 'Mới tạo', edited: 'Đã sửa', template: 'Từ template' };

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
          <div className="ft-group"><Icon name="folder" size={15} />{g}</div>
          {groups[g].map((f) => (
            <button key={f.path} type="button" className={`ft-file ${selected === f.path ? 'sel' : ''}`}
              onClick={() => onSelect(f.path)} title={KIND[f.kind] || f.kind}>
              <Icon name="file" size={14} />
              <span>{f.path}</span>
              {f.kind === 'generated' && <i className="dot-new" aria-label="Mới tạo" />}
              {f.kind === 'edited' && <i className="dot-edit" aria-label="Đã sửa" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}