import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { money } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Checkout() {
  const { user } = useAuth();
  const { items, total, refresh } = useCart();
  const [form, setForm] = useState({ address: '', phone: '', payment_method: 'cod' });
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  if (!user) return <Navigate to="/login" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api.post('/orders', form);
      setOrder(r.data);
      await refresh();
    } catch (ex) { setErr(ex.response?.data?.message || 'Lỗi đặt hàng'); }
  };

  const payNow = async () => {
    await api.post(`/payments/order/${order.id}/pay`);
    setOrder({ ...order, paid: true });
  };

  if (order) {
    return (
      <div className="container">
        <div className="panel">
          <h2>Đặt hàng thành công 🎉</h2>
          <p>Mã đơn: <strong>#{order.id}</strong> — Tổng: <span className="price">{money(order.total)}</span></p>
          {order.payment_method === 'transfer' && !order.paid && (
            <>
              <p>Chuyển khoản (mô phỏng) đến STK 0000 000 000 — nội dung: <code>DH{order.id}</code></p>
              <button className="btn" onClick={payNow}>Tôi đã chuyển khoản</button>
            </>
          )}
          {order.paid && <p>✅ Đã ghi nhận thanh toán.</p>}
          {order.payment_method === 'cod' && <p>Thanh toán khi nhận hàng (COD).</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Thanh toán</h2>
      <form className="panel" onSubmit={submit}>
        <p>{items.length} sản phẩm — Tổng: <span className="price">{money(total)}</span></p>
        <label>Địa chỉ giao hàng</label>
        <input required value={form.address} onChange={set('address')} />
        <label>Số điện thoại</label>
        <input required value={form.phone} onChange={set('phone')} />
        <label>Phương thức thanh toán</label>
        <select value={form.payment_method} onChange={set('payment_method')}>
          <option value="cod">Thanh toán khi nhận hàng (COD)</option>
          <option value="transfer">Chuyển khoản (mô phỏng)</option>
        </select>
        {err && <p className="error">{err}</p>}
        <br />
        <button className="btn" disabled={!items.length}>Đặt hàng</button>
      </form>
    </div>
  );
}
