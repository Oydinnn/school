// SchoolEvents Backend Server
// Node.js + Express + PostgreSQL

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware - Token verification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token topilmadi' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token yaroqsiz' });
    req.user = user;
    next();
  });
};

// ============= AUTH ROUTES =============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, grade, role } = req.body;

    // Check if user exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone, grade, role) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, email, phone, grade, role`,
      [name, email, hashedPassword, phone, grade, role || 'student']
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    // Remove password from response
    delete user.password;

    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ============= EVENTS ROUTES =============

// Get all events
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, 
             COUNT(r.id) as current_participants,
             CASE WHEN e.max_participants > 0 
                  THEN e.max_participants - COUNT(r.id) 
                  ELSE 0 
             END as spots_left
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
      GROUP BY e.id
      ORDER BY e.date ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Get single event
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT e.*, 
             COUNT(r.id) as current_participants
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
      WHERE e.id = $1
      GROUP BY e.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tadbir topilmadi' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Create event (admin only)
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const {
      title, date, time, location, category, description,
      max_participants, requirements, image
    } = req.body;

    const result = await pool.query(
      `INSERT INTO events (
        title, date, time, location, category, description,
        max_participants, requirements, image, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [title, date, time, location, category, description,
       max_participants, requirements, image, 'upcoming', req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Update event
app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time, location, description, status } = req.body;

    const result = await pool.query(
      `UPDATE events 
       SET title = $1, date = $2, time = $3, location = $4, 
           description = $5, status = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, date, time, location, description, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tadbir topilmadi' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ============= REGISTRATION ROUTES =============

// Register for event
app.post('/api/registrations', authenticateToken, async (req, res) => {
  try {
    const { event_id, comment } = req.body;
    const user_id = req.user.id;

    // Check if already registered
    const existing = await pool.query(
      'SELECT * FROM registrations WHERE user_id = $1 AND event_id = $2',
      [user_id, event_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Siz allaqachon ro\'yxatdan o\'tgansiz' });
    }

    // Check event capacity
    const event = await pool.query(`
      SELECT e.max_participants, COUNT(r.id) as current_participants
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
      WHERE e.id = $1
      GROUP BY e.id, e.max_participants
    `, [event_id]);

    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'Tadbir topilmadi' });
    }

    const { max_participants, current_participants } = event.rows[0];
    if (current_participants >= max_participants) {
      return res.status(400).json({ error: 'Tadbirga joy qolmagan' });
    }

    // Create registration
    const result = await pool.query(
      `INSERT INTO registrations (user_id, event_id, comment, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, event_id, comment, 'confirmed']
    );

    // Get user and event details for email
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [event_id]);
    
    const user = userResult.rows[0];
    const eventData = eventResult.rows[0];

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Tasdiq: ${eventData.title}`,
      html: `
        <h2>Ro'yxatdan o'tish tasdiqlandi!</h2>
        <p>Hurmatli ${user.name},</p>
        <p>Siz <strong>${eventData.title}</strong> tadbiriga muvaffaqiyatli ro'yxatdan o'tdingiz.</p>
        <h3>Tadbir ma'lumotlari:</h3>
        <ul>
          <li><strong>Sana:</strong> ${eventData.date}</li>
          <li><strong>Vaqt:</strong> ${eventData.time}</li>
          <li><strong>Joy:</strong> ${eventData.location}</li>
        </ul>
        <p>Ko'rishguncha!</p>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Email send error:', error);
      }
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Get user's registrations
app.get('/api/registrations/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, e.title, e.date, e.time, e.location, e.category
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Cancel registration
app.delete('/api/registrations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM registrations WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ro\'yxat topilmadi' });
    }

    res.json({ message: 'Ro\'yxat bekor qilindi' });
  } catch (error) {
    console.error('Cancel registration error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ============= RESULTS ROUTES =============

// Add result (admin only)
app.post('/api/results', authenticateToken, async (req, res) => {
  try {
    const { event_id, user_id, position, score, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO results (event_id, user_id, position, score, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [event_id, user_id, position, score, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add result error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Get results for event
app.get('/api/results/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await pool.query(`
      SELECT r.*, u.name as user_name, u.grade
      FROM results r
      JOIN users u ON r.user_id = u.id
      WHERE r.event_id = $1
      ORDER BY r.position ASC, r.score DESC
    `, [eventId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server ishlamoqda' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda`);
});