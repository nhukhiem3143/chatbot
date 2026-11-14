import React, { useEffect, useState } from 'react';
import api, { money } from '../../api/client.js';

const empty = { id: null, name: '', description: '', price: 0, image_url: '', stock: 100, category_id: '' };

export default function ProductManage() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');

  const load = () => {
    api.get('/products').then((r) => setItems(r.data));
    api.get('/categories').then((r) => setCats(r.data));
  };
  useEffect(load, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (f.id) await api.put(`/products/${f.id}`, f);
      else await api.post('/products', f);
      setF(empty);
      load();
    } catch (ex) { setErr(ex.response?.data?.message || 'Lỗi lưu'); }
  };
  const del = async (id) => { if (confirm('Xóa sản phẩm này?')) { await api.delete(`/products/${id}`); load(); } };

  return (
    <div className="container">
      <h2>Quản lý sản phẩm</h2>
      <form className="panel" onSubmit={save}>
        <div className="row">
          <div style={{ flex: 2, minWidth: 200 }}><label>Tên</label><input required value={f.name} onChange={set('name')} /></div>
          <div style={{ flex: 1, minWidth: 120 }}><label>Giá</label><input type="number" value={f.price} onChange={set('price')} /></div>
          <div style={{ flex: 1, minWidth: 100 }}><label>Tồn kho</label><input type="number" value={f.stock} onChange={set('stock')} /></div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Danh mục</label>
            <select value={f.category_id || ''} onChange={set('category_id')}>
              <option value="">--</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <label>Ảnh (URL)</label><input value={f.image_url || ''} onChange={set('image_url')} />
        <label>Mô tả</label><textarea rows={2} value={f.description || ''} onChange={set('description')} />
        {err && <p className="error">{err}</p>}
        <br />
        <button className="btn">{f.id ? 'Cập nhật' : 'Thêm mới'}</button>{' '}
        {f.id && <button type="button" className="btn secondary" onClick={() => setF(empty)}>Hủy</button>}
      </form>
      <div className="panel" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>ID</th><th>Tên</th><th>Giá</th><th>Kho</th><th>Danh mục</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.name}</td><td>{money(p.price)}</td><td>{p.stock}</td><td>{p.category_name}</td>
                <td>
                  <button className="btn small secondary" onClick={() => setF({ ...p })}>Sửa</button>{' '}
                  <button className="btn small danger" onClick={() => del(p.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
