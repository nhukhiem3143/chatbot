import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post, errMsg } from '../api/client.js';
import { Icon, Logo, BotAvatar, UserAvatar } from '../components/Icon.jsx';

export default function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const d = await post(mode === 'login' ? '/auth/login' : '/auth/register', f);
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      nav(d.user?.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };

  return (
    <div className="auth-split">
      <div className="auth-form">
        <form onSubmit={submit}>
          <Logo size={40} />
          <h1>{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h1>
          <p className="muted">Trò chuyện để AI tạo website bán hàng cho bạn.</p>
          {mode === 'register' && (
            <div className="field"><Icon name="user" /><input aria-label="Họ tên" placeholder="Họ tên" value={f.name} onChange={set('name')} /></div>
          )}
          <div className="field"><Icon name="mail" /><input aria-label="Email" type="email" placeholder="Email" required value={f.email} onChange={set('email')} /></div>
          <div className="field"><Icon name="lock" /><input aria-label="Mật khẩu" type="password" placeholder="Mật khẩu (từ 6 ký tự)" required minLength={6} value={f.password} onChange={set('password')} /></div>
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn lg" disabled={busy}>{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
          <button type="button" className="btn ghost lg" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </form>
      </div>
      <div className="auth-art" aria-hidden="true">
        <div className="art-card">
          <div className="msg user"><div className="bubble">Tôi muốn web bán cà phê rang xay</div><UserAvatar /></div>
          <div className="msg assistant"><BotAvatar /><div className="bubble">Tuyệt! Cửa hàng của bạn tên là gì?</div></div>
          <div className="art-run"><Icon name="bolt" size={20} /><span>AI đang viết code…</span></div>
        </div>
        <div className="art-steps"><span>Lên kế hoạch</span><span>Viết code</span><span>Chạy web</span></div>
      </div>
    </div>
  );
}