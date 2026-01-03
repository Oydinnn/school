-- Active: 1767349636833@@127.0.0.1@5432@school
-- SchoolEvents Database Schema
-- PostgreSQL
 CREATE DATABASE school;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  grade INTEGER,
  role VARCHAR(50) DEFAULT 'student', -- student, teacher, admin
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM users;

-- Events table
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- sport, academic, cultural
  description TEXT,
  max_participants INTEGER DEFAULT 50,
  requirements TEXT,
  image VARCHAR(10) DEFAULT '📅',
  status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, ongoing, completed, cancelled
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registrations table
CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  comment TEXT,
  status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, cancelled, waitlist
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_id)
);

-- Results table
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER, -- 1, 2, 3, etc.
  score DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- Notifications table (bonus feature)
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info', -- info, success, warning, error
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_results_event ON results(event_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Sample data for testing
INSERT INTO users (name, email, password, phone, grade, role) VALUES
('Admin User', 'admin@school.uz', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+998901234567', NULL, 'admin'),
('Jasur Aliyev', 'jasur@school.uz', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+998901234568', 9, 'student'),
('Dilnoza Rahimova', 'dilnoza@school.uz', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+998901234569', 10, 'student');

INSERT INTO events (title, date, time, location, category, description, max_participants, requirements, image, status, created_by) VALUES
('Sport musobaqasi - Futbol', '2026-01-15', '14:00', 'Stadion', 'sport', 'Sinflar o''rtasida futbol musobaqasi', 60, 'Sport kiyimi, futbol poyabzali', '🏆', 'upcoming', 1),
('Matematika olimpiadasi', '2026-01-20', '10:00', 'Informatika xonasi', 'academic', '7-9 sinflar uchun matematika olimpiadasi', 50, 'Kalkulyator, ruchka', '📐', 'upcoming', 1),
('Yangi yil konserti', '2026-01-25', '18:00', 'Akt zali', 'cultural', 'O''quvchilar va ustozlar konsert dasturi', 150, 'Bayramona kiyim', '🎭', 'upcoming', 1),
('Ingliz tili tanlov', '2026-01-10', '11:00', '5-xona', 'academic', 'Speaking va writing ko''nikmalari tanlovi', 40, 'Pasport, ruchka', '📚', 'completed', 1);

-- Sample registrations
INSERT INTO registrations (user_id, event_id, comment, status) VALUES
(2, 1, 'Futbolga qiziqaman', 'confirmed'),
(3, 2, 'Matematika olimpiadasiga tayyorman', 'confirmed'),
(2, 4, 'Ingliz tilini yaxshi bilaman', 'confirmed');

-- Sample results
INSERT INTO results (event_id, user_id, position, score, notes) VALUES
(4, 3, 1, 95.5, 'Juda yaxshi natija ko''rsatdi'),
(4, 2, 2, 89.0, 'Yaxshi chiqish');