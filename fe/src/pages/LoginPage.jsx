import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post, errMsg } from '../api/client.js';

export default function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const d = await post(mode === 'login' ? '/auth/login' : '/auth/register', f);
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      nav('/');
    } catch (ex) { setErr(errMsg(ex)); }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>🤖 AI Web Studio</h1>
        <p className="muted">Trò chuyện để AI tạo website bán hàng cho bạn</p>
        {mode === 'register' && <input placeholder="Họ tên" value={f.name} onChange={set('name')} />}
        <input type="email" placeholder="Email" required value={f.email} onChange={set('email')} />
        <input type="password" placeholder="Mật khẩu (>= 6 ký tự)" required minLength={6} value={f.password} onChange={set('password')} />
        {err && <div className="error">{err}</div>}
        <button className="btn">{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
