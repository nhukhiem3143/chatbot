// Chuẩn hóa format trả về: { success, data, message }
exports.ok = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message });

exports.fail = (res, message = 'Lỗi', status = 400, data = null) =>
  res.status(status).json({ success: false, data, message });

// Bọc handler async để lỗi tự chuyển vào errorHandler
exports.wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
