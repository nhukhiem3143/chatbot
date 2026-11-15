// [EDITABLE] Khai báo route. AI thêm trang mới ở khu CUSTOM (import + <Route>).
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import ProductList from './pages/ProductList.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import ProductManage from './pages/admin/ProductManage.jsx';
import OrderManage from './pages/admin/OrderManage.jsx';
import { useAuth } from './context/AuthContext.jsx';
// CUSTOM_IMPORTS (AI thêm import trang mới ở đây)

function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminOnly><Dashboard /></AdminOnly>} />
        <Route path="/admin/products" element={<AdminOnly><ProductManage /></AdminOnly>} />
        <Route path="/admin/orders" element={<AdminOnly><OrderManage /></AdminOnly>} />
        {/* CUSTOM_ROUTES (AI thêm <Route> trang mới ở đây) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
