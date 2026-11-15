import React from 'react';
import { previewUrl } from '../api/client.js';

// Iframe tới web do AI sinh ra (cùng IP Ubuntu, khác cổng)
export default function PreviewFrame({ port }) {
  if (!port) return null;
  const url = previewUrl(port);
  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="muted">{url}</span>
        <a className="btn small ghost" href={url} target="_blank" rel="noreferrer">Mở tab mới ↗</a>
      </div>
      <iframe title="preview" src={url} />
      <div className="muted small">Admin demo của web: admin@shop.local / admin123</div>
    </div>
  );
}
