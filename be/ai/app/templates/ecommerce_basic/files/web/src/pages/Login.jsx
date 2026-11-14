import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'login') await login(f.email, f.password);
      else await register(f.name, f.email, f.password);
      nav('/');
    } catch (ex) { setErr(ex.response?.data?.message || 'Có lỗi xảy ra'); }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <form className="panel" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h2>
        {mode === 'register' && (<><label>Họ tên</label><input value={f.name} onChange={set('name')} /></>)}
        <label>Email</label>
        <input type="email" required value={f.email} onChange={set('email')} />
        <label>Mật khẩu</label>
        <input type="password" required minLength={6} value={f.password} onChange={set('password')} />
        {err && <p className="error">{err}</p>}
        <br />
        <button className="btn">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>{' '}
        <button type="button" className="btn secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
        </button>
        <p className="muted" style={{ fontSize: 12 }}>Demo admin: admin@shop.local / admin123</p>
      </form>
    </div>
  );
}
