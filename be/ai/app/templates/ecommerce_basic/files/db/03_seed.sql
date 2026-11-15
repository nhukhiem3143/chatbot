-- [EDITABLE] Dữ liệu mẫu (AI viết lại theo chủ đề). Tài khoản admin do api/server.js tự tạo.
SET NAMES utf8mb4;
INSERT INTO categories (name, slug) VALUES ('Danh mục 1', 'danh-muc-1'), ('Danh mục 2', 'danh-muc-2');
INSERT INTO products (category_id, name, description, price, image_url, stock) VALUES
(1, 'Sản phẩm mẫu 1', 'Mô tả sản phẩm mẫu.', 50000, 'https://picsum.photos/seed/p1/600/400', 100),
(1, 'Sản phẩm mẫu 2', 'Mô tả sản phẩm mẫu.', 75000, 'https://picsum.photos/seed/p2/600/400', 100),
(2, 'Sản phẩm mẫu 3', 'Mô tả sản phẩm mẫu.', 120000, 'https://picsum.photos/seed/p3/600/400', 100);
