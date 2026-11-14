import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import tokens from '../theme/tokens.json';

export default function Home() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get('/products').then((r) => setItems(r.data.slice(0, 8))).catch(() => {}); }, []);
  return (
    <>
      <section className="hero">
        <h1>{tokens.heroTitle}</h1>
        <p>{tokens.heroSubtitle}</p>
        <Link to="/products" className="btn secondary" style={{ background: '#fff' }}>Xem sản phẩm</Link>
      </section>
      <div className="container">
        <h2>Nổi bật</h2>
        <div className="grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </div>
    </>
  );
}
