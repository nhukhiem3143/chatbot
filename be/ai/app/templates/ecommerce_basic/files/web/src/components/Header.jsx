import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import tokens from '../theme/tokens.json';

export default function Header() {
  const { user, logout, isAdmin } = useAuth();
  const { count } = useCart();
  const nav = useNavigate();
  return (
    <header className="header">
      <div className="bar">
        <Link to="/" className="logo">{tokens.siteName}</Link>
        <nav className="nav">
          <Link to="/products">Sản phẩm</Link>
          <Link to="/cart">Giỏ hàng {count > 0 && <span className="badge">{count}</span>}</Link>
          {isAdmin && <Link to="/admin">Quản trị</Link>}
          {user ? (
            <>
              <span className="muted">{user.name}</span>
              <button className="btn small secondary" onClick={() => { logout(); nav('/'); }}>Đăng xuất</button>
            </>
          ) : (
            <Link to="/login" className="btn small">Đăng nhập</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
