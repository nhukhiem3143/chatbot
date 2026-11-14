-- Schema của Studio. Tự chạy lần đầu khi volume mysql_data còn trống.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Mỗi cuộc chat = 1 dự án web
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL DEFAULT 'Cuộc trò chuyện mới',
  status ENUM('interviewing','spec_ready','generating','done') NOT NULL DEFAULT 'interviewing',
  summary TEXT NULL,              -- tóm tắt hội thoại (cache ngữ cảnh)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  role ENUM('user','assistant','system') NOT NULL,
  content MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_conv_msg (conversation_id, id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Yêu cầu đã thu thập (có phiên bản). Spec mới nhất = version lớn nhất
CREATE TABLE IF NOT EXISTS specs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  version INT NOT NULL,
  content JSON NOT NULL,
  status ENUM('draft','confirmed') NOT NULL DEFAULT 'draft',
  edited_by_user TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conv_ver (conversation_id, version),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Mỗi lần generate = 1 run; cổng/tên project preview gộp luôn vào đây
CREATE TABLE IF NOT EXISTS runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  spec_id INT NULL,
  template VARCHAR(60) NOT NULL DEFAULT 'ecommerce_basic',
  status ENUM('queued','planning','coding','testing','starting','running','failed','stopped') NOT NULL DEFAULT 'queued',
  current_agent VARCHAR(30) NULL,
  plan JSON NULL,
  report JSON NULL,
  retry_count INT NOT NULL DEFAULT 0,
  port INT NULL,
  project_name VARCHAR(60) NULL,
  error TEXT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (spec_id) REFERENCES specs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Danh sách file của run (nội dung đọc từ outputs/run_<id>/)
CREATE TABLE IF NOT EXISTS run_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_id INT NOT NULL,
  path VARCHAR(300) NOT NULL,
  kind ENUM('template','generated','edited') NOT NULL DEFAULT 'template',
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
