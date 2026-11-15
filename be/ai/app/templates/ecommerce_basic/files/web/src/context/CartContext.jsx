// [LOCKED] Giỏ hàng (đồng bộ với API /cart khi đã đăng nhập)
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) return setItems([]);
    try { setItems((await api.get('/cart')).data); } catch (e) { setItems([]); }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (product_id, quantity = 1) => { await api.post('/cart', { product_id, quantity }); await refresh(); };
  const setQty = async (product_id, quantity) => { await api.put(`/cart/${product_id}`, { quantity }); await refresh(); };
  const remove = async (product_id) => { await api.delete(`/cart/${product_id}`); await refresh(); };

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

  return <Ctx.Provider value={{ items, count, total, add, setQty, remove, refresh }}>{children}</Ctx.Provider>;
}
