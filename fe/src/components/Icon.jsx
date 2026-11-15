import React, { useState } from 'react';

// Bộ icon nét mảnh dùng chung (thay emoji). Dùng: <Icon name="chat" size={16} />
const PATHS = {
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  plus: 'M12 5v14M5 12h14',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  dl: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  check: 'M20 6L9 17l-5-5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  ext: 'M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9z',
  save: 'M5 3h11l4 4v14H5zM8 3v5h7V3',
  mail: 'M4 4h16v16H4zM4 6l8 7 8-7',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  play: 'M5 3l14 9-14 9z',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  bot: 'M12 8V4H8M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM2 14h2M20 14h2M15 13v2M9 13v2',
  power: 'M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0',
};

export function Icon({ name, size = 18 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---- Thay đổi component Logo sử dụng ảnh tự chèn ----
export function Logo({ size = 32, text = true }) {
  const [imgError, setImgError] = useState(false);

  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {!imgError ? (
        <img
          src="/bot_icon.jpg"
          alt="Logo"
          width={size}
          height={size}
          style={{ objectFit: 'contain', borderRadius: '6px' }}
          onError={() => setImgError(true)}
        />
      ) : (
        // Fallback về SVG cũ nếu không tìm thấy file ảnh
        <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="AI Web Studio">
          <rect width="32" height="32" rx="9" fill="#4f46e5" />
          <path d="M15 7l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff" />
          <circle cx="24" cy="8" r="2" fill="#c7d2fe" />
        </svg>
      )}
      {text && <span className="logo-text">AI Web <b>Studio</b></span>}
    </span>
  );
}

// ---- Ảnh avatar do bạn tự thêm ----
export const AVATAR_SRC = {
  bot: '/bot.png',
  user: '/user.png',
};

function Avatar({ kind, size, title }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`av av-${kind} ${broken ? '' : 'av-img'}`} style={{ width: size, height: size }} title={title}>
      {broken
        ? <Icon name={kind === 'bot' ? 'bot' : 'user'} size={Math.round(size * 0.55)} />
        : <img src={AVATAR_SRC[kind]} alt={title} onError={() => setBroken(true)} />}
    </span>
  );
}
export const BotAvatar = ({ size = 34 }) => <Avatar kind="bot" size={size} title="AI" />;
export const UserAvatar = ({ size = 34 }) => <Avatar kind="user" size={size} title="Bạn" />;