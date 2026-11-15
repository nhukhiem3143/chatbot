import React, { useEffect, useRef, useState } from 'react';
import { Icon, Logo, BotAvatar, UserAvatar } from './Icon.jsx';

const IDEAS = [
  'Web bán cà phê rang xay, tông tối giản',
  'Cửa hàng điện thoại có so sánh sản phẩm',
  'Shop quần áo trẻ trung, có đánh giá',
];

// Khung hội thoại
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
            <Logo size={44} text={false} />
            <h2>Bạn muốn tạo website bán gì?</h2>
            <p className="muted">Mô tả cửa hàng của bạn, AI sẽ hỏi thêm rồi lập bản yêu cầu để bạn duyệt.</p>
            <div className="chips">
              {IDEAS.map((i) => <button key={i} type="button" className="chip" onClick={() => setText(i)}>{i}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`msg ${m.role}`}>
            {m.role !== 'user' && <BotAvatar />}
            <div className="bubble">{m.content}</div>
            {m.role === 'user' && <UserAvatar />}
          </div>
        ))}
        {busy && (
          <div className="msg assistant">
            <BotAvatar />
            <div className="bubble typing"><span className="dots"><i /><i /><i /></span> Đang suy nghĩ</div>
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} disabled={disabled}
          aria-label="Tin nhắn" placeholder="Nhập yêu cầu… (Enter để gửi, Shift+Enter xuống dòng)" />
        <button className="btn send" aria-label="Gửi" disabled={busy || disabled || !text.trim()}><Icon name="send" /></button>
      </form>
    </div>
  );
}