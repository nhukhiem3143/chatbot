import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';

export default function ProductList() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => { api.get('/categories').then((r) => setCats(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    api.get('/products', { params: { category, q } }).then((r) => setItems(r.data)).catch(() => {});
  }, [category, q]);

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 16 }}>
        <input style={{ maxWidth: 280 }} placeholder="Tìm sản phẩm..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ maxWidth: 220 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      {!items.length && <p className="muted">Không có sản phẩm.</p>}
    </div>
  );
}
