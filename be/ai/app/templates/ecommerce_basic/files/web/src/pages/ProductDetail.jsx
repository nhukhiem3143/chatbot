import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { money } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const { user } = useAuth();
  const { add } = useCart();
  const nav = useNavigate();

  useEffect(() => { api.get(`/products/${id}`).then((r) => setP(r.data)).catch(() => setP(false)); }, [id]);
  if (p === null) return <div className="container">Đang tải...</div>;
  if (p === false) return <div className="container">Không tìm thấy sản phẩm.</div>;

  const buy = async () => {
    if (!user) return nav('/login');
    await add(p.id, qty);
    nav('/cart');
  };

  return (
    <div className="container">
      <div className="panel row" style={{ alignItems: 'flex-start' }}>
        <img src={p.image_url} alt={p.name} style={{ width: 360, maxWidth: '100%', borderRadius: 'var(--radius)' }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2>{p.name}</h2>
          <p className="muted">{p.category_name}</p>
          <p className="price" style={{ fontSize: 24 }}>{money(p.price)}</p>
          <p>{p.description}</p>
          <div className="row">
            <input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} style={{ width: 90 }} />
            <button className="btn" onClick={buy}>Thêm vào giỏ</button>
          </div>
        </div>
      </div>
    </div>
  );
}
