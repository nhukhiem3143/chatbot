import React, { useEffect, useRef, useState } from 'react';

// Khung hội thoại kiểu ChatGPT
export default function ChatBox({ messages, onSend, busy, disabled }) {
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onSend(t);
  };
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); };

  return (
    <div className="chat">
      <div className="msgs">
        {!messages.length && (
          <div className="empty">
            <h2>Bạn muốn tạo website bán gì?</h2>
            <p className="muted">Ví dụ: “Tôi muốn web bán cà phê rang xay, tông màu nâu, có đánh giá sản phẩm”</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === 'user' ? '🧑' : '🤖'}</div>
            <div className="bubble">{m.content}</div>
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="avatar">🤖</div><div className="bubble typing">Đang suy nghĩ…</div></div>}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} disabled={disabled}
          placeholder="Nhập yêu cầu… (Enter để gửi, Shift+Enter xuống dòng)" />
        <button className="btn" disabled={busy || disabled || !text.trim()}>Gửi</button>
      </form>
    </div>
  );
}
