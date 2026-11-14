import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { money } from '../../api/client.js';

export default function Dashboard() {
  const [s, setS] = useState({ products: 0, orders: 0, revenue: 0 });
  useEffect(() => {
    Promise.all([api.get('/products'), api.get('/orders')]).then(([p, o]) => {
      setS({
        products: p.data.length,
        orders: o.data.length,
        revenue: o.data.filter((x) => x.payment_status === 'paid').reduce((a, x) => a + Number(x.total), 0),
      });
    }).catch(() => {});
  }, []);
  return (
    <div className="container">
      <h2>Quản trị</h2>
      <div className="grid">
        <div className="panel"><div className="muted">Sản phẩm</div><h2>{s.products}</h2></div>
        <div className="panel"><div className="muted">Đơn hàng</div><h2>{s.orders}</h2></div>
        <div className="panel"><div className="muted">Doanh thu (đã thanh toán)</div><h2>{money(s.revenue)}</h2></div>
      </div>
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn" to="/admin/products">Quản lý sản phẩm</Link>
        <Link className="btn secondary" to="/admin/orders">Quản lý đơn hàng</Link>
      </div>
    </div>
  );
}
