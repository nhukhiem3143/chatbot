import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { money } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function ProductCard({ p }) {
  const { user } = useAuth();
  const { add } = useCart();
  const nav = useNavigate();
  const buy = async () => {
    if (!user) return nav('/login');
    await add(p.id, 1);
  };
  return (
    <div className="card">
      <Link to={`/products/${p.id}`}><img src={p.image_url || ''} alt={p.name} /></Link>
      <div className="body">
        <Link to={`/products/${p.id}`}><strong>{p.name}</strong></Link>
        <span className="muted">{p.category_name}</span>
        <span className="price">{money(p.price)}</span>
        <button className="btn small" onClick={buy}>Thêm vào giỏ</button>
      </div>
    </div>
  );
}
