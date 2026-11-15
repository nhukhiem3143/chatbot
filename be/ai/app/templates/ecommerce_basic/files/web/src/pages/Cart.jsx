import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { money } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Cart() {
  const { user } = useAuth();
  const { items, total, setQty, remove } = useCart();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="container">
      <h2>Giỏ hàng</h2>
      {!items.length ? (
        <p className="muted">Giỏ hàng trống. <Link to="/products">Mua sắm ngay</Link></p>
      ) : (
        <div className="panel">
          <table>
            <thead><tr><th>Sản phẩm</th><th>Giá</th><th>SL</th><th>Tạm tính</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.product_id}>
                  <td>{i.name}</td>
                  <td>{money(i.price)}</td>
                  <td><input type="number" min="1" value={i.quantity} style={{ width: 80 }} onChange={(e) => setQty(i.product_id, +e.target.value)} /></td>
                  <td>{money(i.price * i.quantity)}</td>
                  <td><button className="btn small danger" onClick={() => remove(i.product_id)}>Xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
            <strong>Tổng: <span className="price">{money(total)}</span></strong>
            <Link to="/checkout" className="btn">Thanh toán</Link>
          </div>
        </div>
      )}
    </div>
  );
}
