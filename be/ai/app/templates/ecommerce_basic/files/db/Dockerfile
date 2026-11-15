FROM mysql:8.0
# Nhúng sẵn SQL vào image (không cần bind mount). MySQL chạy theo thứ tự tên file.
COPY *.sql /docker-entrypoint-initdb.d/
CMD ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]
