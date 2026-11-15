import React, { useEffect, useState } from 'react';
import api, { money } from '../../api/client.js';

const STATUS = ['pending', 'confirmed', 'shipping', 'done', 'cancelled'];

export default function OrderManage() {
  const [items, setItems] = useState([]);
  const load = () => api.get('/orders').then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => { await api.put(`/orders/${id}/status`, { status }); load(); };
  const confirmPay = async (id) => { await api.post(`/payments/order/${id}/confirm`); load(); };

  return (
    <div className="container">
      <h2>Quản lý đơn hàng</h2>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>#</th><th>Khách</th><th>Tổng</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.user_email}<div className="muted">{o.phone} — {o.address}</div></td>
                <td>{money(o.total)}</td>
                <td>
                  {o.payment_method.toUpperCase()} — {o.payment_status === 'paid' ? '✅ đã thanh toán' : 'chưa'}
                  {o.payment_status !== 'paid' && <> <button className="btn small secondary" onClick={() => confirmPay(o.id)}>Đã thu tiền</button></>}
                </td>
                <td>
                  <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                    {STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="muted">Chưa có đơn hàng.</p>}
      </div>
    </div>
  );
}
