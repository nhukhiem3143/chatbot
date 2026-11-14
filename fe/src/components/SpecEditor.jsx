import React, { useEffect, useState } from 'react';

const lines = (a) => (a || []).join('\n');
const toArr = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

// Duyệt + sửa trực tiếp yêu cầu (Spec) trước khi AI làm. Nút "Xác nhận" mới kích hoạt pha generate.
export default function SpecEditor({ spec, ready, busy, onSave, onConfirm }) {
  const [s, setS] = useState(spec?.content || null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setS(spec?.content || null); setDirty(false); }, [spec?.id]);

  if (!s) return <div className="muted pad">Chưa có yêu cầu. Hãy trò chuyện với AI để bắt đầu.</div>;

  const upd = (patch) => { setS({ ...s, ...patch }); setDirty(true); };
  const updDesign = (k, v) => upd({ design: { ...(s.design || {}), [k]: v } });
  const updProd = (i, k, v) => upd({ sample_products: s.sample_products.map((p, j) => (j === i ? { ...p, [k]: k === 'price' ? Number(v) || 0 : v } : p)) });
  const addProd = () => upd({ sample_products: [...(s.sample_products || []), { name: '', price: 0, category: '', description: '' }] });
  const delProd = (i) => upd({ sample_products: s.sample_products.filter((_, j) => j !== i) });
  const d = s.design || {};
  const confirmed = spec?.status === 'confirmed' && !dirty;

  return (
    <div className="spec">
      <div className="spec-head">
        <strong>Yêu cầu website</strong>
        <span className={`tag ${confirmed ? 'ok' : ready ? 'warn' : ''}`}>
          {confirmed ? 'Đã xác nhận' : ready ? 'Chờ bạn duyệt' : 'Đang thu thập'} · v{spec.version}
        </span>
      </div>

      <label>Tên cửa hàng</label>
      <input value={s.site_name || ''} onChange={(e) => upd({ site_name: e.target.value })} />
      <label>Loại hình kinh doanh</label>
      <input value={s.business_type || ''} onChange={(e) => upd({ business_type: e.target.value })} />
      <label>Slogan</label>
      <input value={s.tagline || ''} onChange={(e) => upd({ tagline: e.target.value })} />
      <label>Mô tả</label>
      <textarea rows={2} value={s.description || ''} onChange={(e) => upd({ description: e.target.value })} />
      <label>Danh mục (mỗi dòng 1 mục)</label>
      <textarea rows={3} value={lines(s.categories)} onChange={(e) => upd({ categories: toArr(e.target.value) })} />
      <label>Tính năng thêm (mỗi dòng 1 mục)</label>
      <textarea rows={3} value={lines(s.features)} onChange={(e) => upd({ features: toArr(e.target.value) })} />
      <label>Trang thêm (mỗi dòng 1 mục)</label>
      <textarea rows={2} value={lines(s.pages)} onChange={(e) => upd({ pages: toArr(e.target.value) })} />

      <label>Thiết kế (để trống = dùng skill mặc định)</label>
      <div className="grid2">
        <select value={d.style || ''} onChange={(e) => updDesign('style', e.target.value)}>
          <option value="">Tự chọn theo loại hình</option>
          <option value="coffee_warm">coffee_warm (nâu, kem)</option>
          <option value="minimal">minimal (tối giản)</option>
          <option value="tech_neon">tech_neon (công nghệ)</option>
          <option value="vibrant">vibrant (trẻ trung)</option>
        </select>
        <input placeholder="Font (vd Poppins)" value={d.font || ''} onChange={(e) => updDesign('font', e.target.value)} />
        {[['primary_color', 'Màu chính'], ['secondary_color', 'Màu phụ'], ['background_color', 'Màu nền']].map(([k, label]) => (
          <div key={k} className="colorrow">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(d[k] || '') ? d[k] : '#888888'} onChange={(e) => updDesign(k, e.target.value)} />
            <input placeholder={`${label} (#hex)`} value={d[k] || ''} onChange={(e) => updDesign(k, e.target.value)} />
          </div>
        ))}
      </div>
      <input placeholder="Ghi chú thiết kế riêng (ưu tiên cao nhất)" value={d.notes || ''} onChange={(e) => updDesign('notes', e.target.value)} />

      <label>Sản phẩm mẫu</label>
      {(s.sample_products || []).map((p, i) => (
        <div key={i} className="prod">
          <input placeholder="Tên" value={p.name} onChange={(e) => updProd(i, 'name', e.target.value)} />
          <input placeholder="Giá" type="number" value={p.price} onChange={(e) => updProd(i, 'price', e.target.value)} />
          <input placeholder="Danh mục" value={p.category} onChange={(e) => updProd(i, 'category', e.target.value)} />
          <button className="btn small ghost" onClick={() => delProd(i)} type="button">✕</button>
        </div>
      ))}
      <button className="btn small ghost" onClick={addProd} type="button">+ Thêm sản phẩm</button>

      <div className="spec-actions">
        <button className="btn ghost" disabled={!dirty || busy} onClick={() => onSave(s)}>Lưu chỉnh sửa</button>
        <button className="btn" disabled={busy} onClick={() => onConfirm(dirty ? s : null)}>
          {confirmed ? 'Tạo lại web' : 'Xác nhận & tạo web'}
        </button>
      </div>
    </div>
  );
}
