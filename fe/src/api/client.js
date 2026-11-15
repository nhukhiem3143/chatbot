// axios gọi data-service qua /api (Nginx/Vite proxy). Tự gắn JWT; hết hạn thì về trang đăng nhập.
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.clear();
      location.href = '/login';
    }
    return Promise.reject(e);
  }
);

export const errMsg = (e) => e.response?.data?.message || e.message || 'Có lỗi xảy ra';

// Lấy `data` trong format { success, data, message }
export const get = async (url, cfg) => (await api.get(url, cfg)).data.data;
export const post = async (url, body, cfg) => (await api.post(url, body, cfg)).data.data;
export const put = async (url, body) => (await api.put(url, body)).data.data;
export const del = async (url) => (await api.delete(url)).data.data;

// Tải file ZIP (cần header Authorization nên dùng blob)
export async function downloadZip(runId) {
  const r = await api.get(`/runs/${runId}/zip`, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data);
  a.download = `run_${runId}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// URL xem web do AI sinh ra: cùng IP với Studio, khác cổng
export const previewUrl = (port) => `${location.protocol}//${location.hostname}:${port}`;

export default api;
