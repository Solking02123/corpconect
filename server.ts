import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: InstanceType<typeof Database>;
try {
  db = new Database('corp.db');
  db.prepare('PRAGMA integrity_check').get();
} catch (err) {
  console.error('Database corrupted or failed to open, recovering new database:', err);
  try {
    if (fs.existsSync('corp.db')) {
      fs.unlinkSync('corp.db');
    }
  } catch (e) {}
  db = new Database('corp.db');
}
const JWT_SECRET = 'corp-secret-key-123'; // In production, move to env

// Initialize Database Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    registration_number TEXT UNIQUE,
    full_name TEXT,
    photo TEXT,
    rank TEXT,
    dob TEXT,
    pob TEXT,
    salary REAL,
    penalties TEXT,
    status TEXT DEFAULT 'online',
    vacation_start TEXT,
    vacation_end TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    job_title TEXT,
    department TEXT,
    hiring_date TEXT,
    contract_type TEXT,
    contract_end_date TEXT,
    next_promotion_date TEXT,
    phone TEXT,
    email TEXT,
    address TEXT
  );
`);

try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN address TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE messages ADD COLUMN is_urgent INTEGER DEFAULT 0'); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    files TEXT,
    status TEXT DEFAULT 'pending',
    manager_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER, -- NULL for public chat
    content TEXT,
    file_url TEXT,
    is_urgent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    issuer TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    clock_in DATETIME DEFAULT CURRENT_TIMESTAMP,
    clock_out DATETIME,
    overtime_minutes INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    doc_name TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS financial_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'bonus' or 'deduction'
    amount REAL NOT NULL,
    reason TEXT,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM
    base_salary REAL NOT NULL,
    overtime_pay REAL DEFAULT 0,
    bonuses REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_salary REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_date TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
    progress INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS performance_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    manager_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    rating INTEGER, -- 1 to 5
    notes TEXT,
    kpis TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(manager_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    type TEXT,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migrations for existing databases
const checkUsersColumns = db.prepare("PRAGMA table_info(users)").all();
const userColumnNames = (checkUsersColumns as any[]).map(c => c.name);

if (!userColumnNames.includes('vacation_start')) {
  db.exec("ALTER TABLE users ADD COLUMN vacation_start TEXT");
}
if (!userColumnNames.includes('vacation_end')) {
  db.exec("ALTER TABLE users ADD COLUMN vacation_end TEXT");
}
if (!userColumnNames.includes('last_seen')) {
  db.exec("ALTER TABLE users ADD COLUMN last_seen DATETIME DEFAULT CURRENT_TIMESTAMP");
}
if (!userColumnNames.includes('is_online')) {
  db.exec("ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0");
  // Normalize status for existing users
  db.prepare("UPDATE users SET status = 'active' WHERE status IN ('online', 'offline')").run();
}
if (!userColumnNames.includes('job_title')) {
  db.exec("ALTER TABLE users ADD COLUMN job_title TEXT");
}
if (!userColumnNames.includes('department')) {
  db.exec("ALTER TABLE users ADD COLUMN department TEXT");
}
if (!userColumnNames.includes('hiring_date')) {
  db.exec("ALTER TABLE users ADD COLUMN hiring_date TEXT");
}
if (!userColumnNames.includes('contract_type')) {
  db.exec("ALTER TABLE users ADD COLUMN contract_type TEXT");
}
if (!userColumnNames.includes('contract_end_date')) {
  db.exec("ALTER TABLE users ADD COLUMN contract_end_date TEXT");
}
if (!userColumnNames.includes('next_promotion_date')) {
  db.exec("ALTER TABLE users ADD COLUMN next_promotion_date TEXT");
}

const checkAnnColumns = db.prepare("PRAGMA table_info(announcements)").all();
const annColumnNames = (checkAnnColumns as any[]).map(c => c.name);
if (!annColumnNames.includes('issuer')) {
  db.exec("ALTER TABLE announcements ADD COLUMN issuer TEXT");
}

// Create initial manager if not exists
const managerExists = db.prepare('SELECT id FROM users WHERE role = ?').get('manager');
if (!managerExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)').run(
    'manager',
    hashedPassword,
    'manager',
    'Administrator'
  );
}

const app = express();
app.set('trust proxy', 1);
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

// Helper for notifications
function createNotification(userId: number, title: string, content: string, type: string, link: string = '') {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, title, content, type, link)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, title, content, type, link);
    io.emit('new_notification', { userId });
  } catch (err) {
    console.error('Notification Error:', err);
  }
}

app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// File Upload Setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (req, res) => {
  res.send('OK');
});

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// API Endpoints
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }
  
  // Set user to online
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run('online', user.id);
  
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, registration_number: user.registration_number, full_name: user.full_name, photo: user.photo } });
});

app.post('/api/logout', authenticate, (req: any, res) => {
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run('offline', req.user.id);
  res.json({ success: true });
});

app.get('/api/admin/backup', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const dbPath = path.join(__dirname, 'corp.db');
  if (fs.existsSync(dbPath)) {
    res.download(dbPath, `backup_corp_${new Date().toISOString().split('T')[0]}.db`);
  } else {
    res.status(404).send('Database file not found');
  }
});

app.post('/api/manager/change-password', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { oldPassword, newPassword } = req.body;
  const user: any = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
  res.json({ success: true });
});

app.get('/api/me', authenticate, (req: any, res) => {
  const user = db.prepare('SELECT id, username, role, registration_number, full_name, photo, rank, dob, pob, salary, penalties, status, job_title, department, hiring_date, contract_type, contract_end_date, next_promotion_date, phone, email, address FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.get('/api/users/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'غير مسموح لك بالوصول لهذه البيانات' });
  }
  const user = db.prepare('SELECT id, username, role, registration_number, full_name, photo, rank, dob, pob, salary, penalties, status, job_title, department, hiring_date, contract_type, contract_end_date, next_promotion_date, phone, email, address FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'الموظف غير موجود' });
  res.json(user);
});

// Manage Employees (Manager only)
app.get('/api/employees', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  const employees = db.prepare('SELECT * FROM users WHERE role IN (?, ?)').all('employee', 'accountant');
  res.json(employees);
});

app.post('/api/employees', authenticate, upload.single('photo'), (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  let { 
    username, password, full_name, rank, dob, pob, salary, 
    job_title, department, hiring_date, contract_type, 
    contract_end_date, next_promotion_date, phone, email, address,
    role = 'employee'
  } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  
  username = username?.trim();
  password = password?.trim();

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  // Validate role
  const validRoles = ['employee', 'accountant', 'manager'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'صلاحية غير صالحة' });

  // Generate registration number (5 digits) - Order by registration_number DESC
  const lastUser: any = db.prepare("SELECT registration_number FROM users WHERE registration_number IS NOT NULL AND registration_number GLOB '[0-9]*' ORDER BY CAST(registration_number AS INTEGER) DESC LIMIT 1").get();
  let nextId = 1;
  if (lastUser) {
    nextId = parseInt(lastUser.registration_number) + 1;
  }
  const registration_number = nextId.toString().padStart(5, '0');
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  try {
    db.prepare(`
      INSERT INTO users (
        username, password, role, registration_number, full_name, photo, 
        rank, dob, pob, salary, job_title, department, hiring_date, 
        contract_type, contract_end_date, next_promotion_date, phone, email, address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      username, hashedPassword, role, registration_number, full_name, photo, 
      rank, dob, pob, salary, job_title, department, hiring_date, 
      contract_type, contract_end_date, next_promotion_date, phone, email, address
    );
    res.json({ success: true, registration_number });
  } catch (err: any) {
    let errorMessage = err.message;
    if (err.message.includes('UNIQUE constraint failed: users.username')) {
      errorMessage = 'اسم المستخدم هذا مسجل مسبقاً، يرجى اختيار اسم آخر';
    }
    res.status(400).json({ error: errorMessage });
  }
});

app.delete('/api/employees/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  console.log(`[DELETE] Request to delete employee ID: ${id} by user: ${req.user.username}`);
  
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
  }

  const deleteTransaction = db.transaction(() => {
    // Delete related records to maintain integrity
    db.prepare('DELETE FROM attendance WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM requests WHERE sender_id = ?').run(id);
    db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(id, id);
    db.prepare('DELETE FROM documents WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM financial_adjustments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM payroll WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM goals WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM performance_evaluations WHERE user_id = ? OR manager_id = ?').run(id, id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);
    
    // Finally delete the user
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  try {
    const result = deleteTransaction();
    if (result.changes === 0) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete Error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة حذف الموظف' });
  }
});

// Requests
app.post('/api/requests', authenticate, upload.array('files'), (req: any, res) => {
  const { type, description } = req.body;
  const files = req.files ? JSON.stringify((req.files as any[]).map(f => `/uploads/${f.filename}`)) : '[]';
  db.prepare('INSERT INTO requests (sender_id, type, description, files) VALUES (?, ?, ?, ?)').run(
    req.user.id, type, description, files
  );
  
  // Notify Managers
  const managers = db.prepare('SELECT id FROM users WHERE role = ?').all('manager') as any[];
  managers.forEach(m => {
    createNotification(m.id, 'طلب جديد', `قام ${req.user.full_name} بإرسال طلب ${type === 'vacation' ? 'إجازة' : type === 'mission' ? 'مهمة' : 'جديد'}`, 'request', '/');
  });

  // If salary statement, also notify accountants
  if (type === 'salary_statement') {
    const accountants = db.prepare('SELECT id FROM users WHERE role = ?').all('accountant') as any[];
    accountants.forEach(a => {
      createNotification(a.id, 'طلب كشف راتب', `قام ${req.user.full_name} بطلب كشف راتب`, 'request', '/');
    });
  }

  io.to('all').emit('request_sent', { sender_name: req.user.full_name, type });
  res.json({ success: true });
});

app.get('/api/requests', authenticate, (req: any, res) => {
  let requests;
  if (req.user.role === 'manager') {
    requests = db.prepare('SELECT r.*, u.full_name as sender_name FROM requests r JOIN users u ON r.sender_id = u.id ORDER BY r.created_at DESC').all();
  } else if (req.user.role === 'accountant') {
    // Accountants see their own requests AND salary_statement requests of others
    requests = db.prepare(`
      SELECT r.*, u.full_name as sender_name 
      FROM requests r 
      JOIN users u ON r.sender_id = u.id 
      WHERE r.sender_id = ? OR r.type = 'salary_statement'
      ORDER BY r.created_at DESC
    `).all(req.user.id);
  } else {
    requests = db.prepare('SELECT * FROM requests WHERE sender_id = ? ORDER BY created_at DESC').all(req.user.id);
  }
  res.json(requests);
});

app.patch('/api/requests/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  
  const request: any = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  // Accountant can only manage salary_statement requests
  if (req.user.role === 'accountant' && request.type !== 'salary_statement') {
    return res.status(403).json({ error: 'ليس لديك صلاحية لإدارة هذا النوع من الطلبات' });
  }

  const { status, manager_comment } = req.body;
  
  // If approved, update user status based on request type
  if (status === 'approved') {
    if (request.type === 'vacation' || request.type === 'mission') {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(request.type, request.sender_id);
    }
  }

  db.prepare('UPDATE requests SET status = ?, manager_comment = ? WHERE id = ?').run(status, manager_comment, req.params.id);
  
  const updatedRequest: any = db.prepare('SELECT r.*, u.full_name as sender_name FROM requests r JOIN users u ON r.sender_id = u.id WHERE r.id = ?').get(req.params.id);
  if (updatedRequest) {
    const statusText = status === 'approved' ? 'مقبول' : 'مرفوض';
    createNotification(updatedRequest.sender_id, `تم ${statusText} طلبك`, `الطلب: ${updatedRequest.type === 'vacation' ? 'إجازة' : 'جديد'} - الحالة: ${statusText}`, 'request', '/');
    
    io.to('all').emit('request_update', {
      id: updatedRequest.id,
      status: updatedRequest.status,
      sender_id: updatedRequest.sender_id,
      type: updatedRequest.type
    });
  }

  res.json({ success: true });
});

// Chat & Announcements
app.post('/api/announcements', authenticate, upload.single('image'), (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { title, content, issuer } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  const info = db.prepare('INSERT INTO announcements (title, content, issuer, image_url) VALUES (?, ?, ?, ?)').run(title, content, issuer || null, image_url);
  
  const announcement = { id: info.lastInsertRowid, title, content, issuer, image_url, created_at: new Date().toISOString() };
  
  // Notify all users
  const allUsers = db.prepare('SELECT id FROM users').all() as any[];
  allUsers.forEach(u => {
    createNotification(u.id, 'إعلان رسمي جديد', title, 'system', '/announcements');
  });

  io.to('all').emit('announcement', announcement);
  
  res.json({ success: true });
});

app.get('/api/announcements', authenticate, (req, res) => {
  const ann = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
  res.json(ann);
});

app.get('/api/messages', authenticate, (req, res) => {
  const messages = db.prepare('SELECT m.*, u.full_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id ORDER BY created_at ASC').all();
  res.json(messages);
});

app.post('/api/messages', authenticate, upload.single('file'), (req: any, res) => {
  const { content, receiver_id, is_urgent } = req.body;
  const file_url = req.file ? `/uploads/${req.file.filename}` : null;
  const isUrgentBool = is_urgent === '1' || is_urgent === 1 || is_urgent === true;

  const info = db.prepare('INSERT INTO messages (sender_id, receiver_id, content, file_url, is_urgent) VALUES (?, ?, ?, ?, ?)').run(
    req.user.id, receiver_id || null, content, file_url, isUrgentBool ? 1 : 0
  );
  
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.user.id) as any;
  const message = {
    id: info.lastInsertRowid,
    sender_id: req.user.id,
    sender_name: user.full_name,
    content,
    file_url,
    receiver_id,
    is_urgent: isUrgentBool,
    created_at: new Date().toISOString()
  };
  
  if (receiver_id) {
    createNotification(parseInt(receiver_id), 'رسالة جديدة', `أرسل لك ${user.full_name} رسالة خاصة`, 'message', '/chat');
  }

  io.to('all').emit('message', message);
  res.json({ success: true });
});

// Stats (Manager)
app.get('/api/stats', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const month = today.substring(0, 7); // YYYY-MM
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Cleanup expired vacations
  db.prepare("UPDATE users SET status = 'active', vacation_start = NULL, vacation_end = NULL WHERE vacation_end < ? AND status = 'vacation'").run(today);

  const employeeStats = db.prepare('SELECT COUNT(*) as count FROM users WHERE role IN (?, ?)').all('employee', 'accountant')[0] as any;
  const onlineStats = db.prepare('SELECT COUNT(*) as count FROM users WHERE role IN (?, ?) AND is_online = 1').all('employee', 'accountant')[0] as any;
  const statusStats = db.prepare('SELECT status, COUNT(*) as count FROM users WHERE role IN (?, ?) GROUP BY status').all('employee', 'accountant');

  // Base data for everyone
  let responseData: any = {
    employeeCount: employeeStats,
    onlineCount: onlineStats,
    statusStats,
    enhancedStats: {
      month,
      totalPayroll: 0,
      absenceRate: 0,
      avgRating: 0,
      goalsStats: []
    },
    alerts: {
      contracts: [],
      promotions: []
    }
  };

  // Only manager sees these
  if (req.user.role === 'manager') {
    const attendanceToday = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM attendance WHERE date = ?').get(today) as any;
    const absenceCount = Math.max(0, employeeStats.count - (attendanceToday?.count || 0));
    const absenceRate = employeeStats.count > 0 ? (absenceCount / employeeStats.count) * 100 : 0;
    const avgRating = db.prepare('SELECT AVG(rating) as avg FROM performance_evaluations').get() as any;
    
    responseData.requestStats = db.prepare('SELECT status, COUNT(*) as count FROM requests GROUP BY status').all();
    responseData.enhancedStats.absenceRate = parseFloat(absenceRate.toFixed(1));
    responseData.enhancedStats.avgRating = parseFloat((avgRating?.avg || 0).toFixed(1));
    responseData.enhancedStats.goalsStats = db.prepare('SELECT status, COUNT(*) as count FROM goals GROUP BY status').all();
    responseData.alerts.contracts = db.prepare("SELECT id, full_name, contract_end_date FROM users WHERE role = 'employee' AND contract_end_date BETWEEN ? AND ?").all(today, nextMonth);
    responseData.alerts.promotions = db.prepare("SELECT id, full_name, next_promotion_date FROM users WHERE role = 'employee' AND next_promotion_date BETWEEN ? AND ?").all(today, nextMonth);
  }

  // Accountant and manager see payroll
  const totalPayroll = db.prepare('SELECT SUM(net_salary) as total FROM payroll WHERE month = ?').get(month) as any;
  responseData.enhancedStats.totalPayroll = totalPayroll?.total || 0;

  res.json(responseData);
});

app.patch('/api/employees/:id', authenticate, upload.single('photo'), (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { full_name, rank, dob, pob, salary, status, vacation_start, vacation_end, job_title, department, hiring_date, contract_type, contract_end_date, next_promotion_date, phone, email, address, role } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : undefined;

  let query = 'UPDATE users SET full_name = ?, rank = ?, dob = ?, pob = ?, salary = ?, status = ?, vacation_start = ?, vacation_end = ?, job_title = ?, department = ?, hiring_date = ?, contract_type = ?, contract_end_date = ?, next_promotion_date = ?, phone = ?, email = ?, address = ?';
  const params = [full_name, rank, dob, pob, salary, status, vacation_start || null, vacation_end || null, job_title, department, hiring_date, contract_type, contract_end_date, next_promotion_date, phone, email, address];

  if (photo) {
    query += ', photo = ?';
    params.push(photo);
  }

  if (role) {
    query += ', role = ?';
    params.push(role);
  }

  query += ' WHERE id = ?';
  params.push(req.params.id);

  db.prepare(query).run(...params);
  res.json({ success: true });
});

// Digital Archive (Documents)
app.post('/api/employees/:id/documents', authenticate, upload.single('document'), (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  const { doc_name, doc_type } = req.body;
  const file_url = req.file ? `/uploads/${req.file.filename}` : null;
  if (!file_url) return res.status(400).json({ error: 'No file uploaded' });

  db.prepare('INSERT INTO documents (user_id, doc_name, doc_type, file_url) VALUES (?, ?, ?, ?)').run(
    req.params.id, doc_name, doc_type, file_url
  );
  res.json({ success: true });
});

app.get('/api/employees/:id/documents', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const documents = db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(documents);
});

app.delete('/api/documents/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Financial Management
app.post('/api/employees/:id/adjustments', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { type, amount, reason, date } = req.body;
  db.prepare('INSERT INTO financial_adjustments (user_id, type, amount, reason, date) VALUES (?, ?, ?, ?, ?)').run(
    req.params.id, type, amount, reason, date
  );
  
  const typeText = type === 'bonus' ? 'منحة إضافية' : 'خصم';
  createNotification(parseInt(req.params.id), 'تعديل مالي', `تم إضافة ${typeText} بقيمة ${amount} دج`, 'financial', '/profile');

  io.to('all').emit('financial_update', { user_id: parseInt(req.params.id) });
  res.json({ success: true });
});

app.get('/api/employees/:id/adjustments', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const adjustments = db.prepare('SELECT * FROM financial_adjustments WHERE user_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(adjustments);
});

app.get('/api/attendance/report', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  const { month } = req.query;
  const report = db.prepare(`
    SELECT a.*, u.full_name, u.registration_number, u.rank
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.date LIKE ?
    ORDER BY a.date DESC, a.clock_in DESC
  `).all(`${month}%`);
  res.json(report);
});

app.post('/api/payroll/generate', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  const { month } = req.body; // YYYY-MM

  const employees = db.prepare('SELECT * FROM users WHERE role IN (?, ?)').all('employee', 'accountant') as any[];
  
  for (const emp of employees) {
    // Calculate Overtime Pay (assuming hourly rate based on base salary / 160 hours)
    const hourlyRate = (emp.salary || 0) / 160;
    const attendanceRecords = db.prepare('SELECT SUM(overtime_minutes) as total_overtime FROM attendance WHERE user_id = ? AND date LIKE ?').get(emp.id, `${month}%`) as any;
    const totalOvertimeMinutes = attendanceRecords?.total_overtime || 0;
    const overtimePay = (totalOvertimeMinutes / 60) * hourlyRate;

    // Calculate Bonuses and Deductions
    const bonusesRecord = db.prepare("SELECT SUM(amount) as total FROM financial_adjustments WHERE user_id = ? AND type = 'bonus' AND date LIKE ?").get(emp.id, `${month}%`) as any;
    const deductionsRecord = db.prepare("SELECT SUM(amount) as total FROM financial_adjustments WHERE user_id = ? AND type = 'deduction' AND date LIKE ?").get(emp.id, `${month}%`) as any;
    
    const bonuses = bonusesRecord?.total || 0;
    const deductions = deductionsRecord?.total || 0;

    const netSalary = (emp.salary || 0) + overtimePay + bonuses - deductions;

    // Check if payroll already exists for this month and update or insert
    const existing = db.prepare('SELECT id FROM payroll WHERE user_id = ? AND month = ?').get(emp.id, month);
    if (existing) {
      db.prepare(`
        UPDATE payroll 
        SET base_salary = ?, overtime_pay = ?, bonuses = ?, deductions = ?, net_salary = ? 
        WHERE id = ?
      `).run(emp.salary || 0, overtimePay, bonuses, deductions, netSalary, (existing as any).id);
    } else {
      db.prepare(`
        INSERT INTO payroll (user_id, month, base_salary, overtime_pay, bonuses, deductions, net_salary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(emp.id, month, emp.salary || 0, overtimePay, bonuses, deductions, netSalary);
    }
    io.to('all').emit('financial_update', { user_id: emp.id });
  }

  res.json({ success: true });
});

app.get('/api/payroll', authenticate, (req: any, res) => {
  const { month } = req.query;
  let payroll;
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    payroll = db.prepare(`
      SELECT p.*, u.full_name, u.registration_number, u.rank, u.job_title, u.department 
      FROM payroll p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.month = ?
    `).all(month);
  } else {
    payroll = db.prepare(`
      SELECT p.*, u.full_name, u.registration_number, u.rank, u.job_title, u.department 
      FROM payroll p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.user_id = ? AND p.month = ?
    `).all(req.user.id, month);
  }
  res.json( payroll);
});

app.post('/api/employees/:id/penalties', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { penalty } = req.body;
  const user: any = db.prepare('SELECT penalties FROM users WHERE id = ?').get(req.params.id);
  const currentPenalties = user.penalties ? JSON.parse(user.penalties) : [];
  currentPenalties.push({ text: penalty, date: new Date().toISOString() });
  db.prepare('UPDATE users SET penalties = ? WHERE id = ?').run(JSON.stringify(currentPenalties), req.params.id);
  
  createNotification(parseInt(req.params.id), 'عقوبة جديدة', `تم تسجيل عقوبة جديدة في ملفك: ${penalty}`, 'financial', '/profile');

  res.json({ success: true });
});

app.get('/api/employees/:id/payroll', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'accountant' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const payroll = db.prepare(`
    SELECT p.*, u.full_name, u.registration_number, u.rank, u.job_title, u.department 
    FROM payroll p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.user_id = ?
    ORDER BY p.month DESC
  `).all(req.params.id);
  res.json(payroll);
});

// Performance Management
app.get('/api/employees/:id/goals', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(goals);
});

app.post('/api/employees/:id/goals', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { title, description, target_date } = req.body;
  try {
    db.prepare('INSERT INTO goals (user_id, title, description, target_date) VALUES (?, ?, ?, ?)').run(req.params.id, title, description, target_date);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/goals/:id', authenticate, (req: any, res) => {
  const { status, progress } = req.body;
  const goal: any = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  
  if (req.user.role !== 'manager' && req.user.id !== goal.user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let query = 'UPDATE goals SET progress = ?';
  const params = [progress !== undefined ? progress : goal.progress];
  
  if (status) {
    query += ', status = ?';
    params.push(status);
  }
  
  query += ' WHERE id = ?';
  params.push(req.params.id);
  
  db.prepare(query).run(...params);
  res.json({ success: true });
});

app.delete('/api/goals/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/employees/:id/evaluations', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const evaluations = db.prepare('SELECT * FROM performance_evaluations WHERE user_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(evaluations);
});

app.post('/api/employees/:id/evaluations', authenticate, (req: any, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  const { date, rating, notes, kpis } = req.body;
  try {
    db.prepare('INSERT INTO performance_evaluations (user_id, manager_id, date, rating, notes, kpis) VALUES (?, ?, ?, ?, ?, ?)').run(
      req.params.id, req.user.id, date, rating, notes, JSON.stringify(kpis)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Socket.io integration
const socketToUser = new Map();
const userPresence = new Map(); // userId -> count

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join('all');
    socketToUser.set(socket.id, userId);
    
    const count = userPresence.get(userId) || 0;
    userPresence.set(userId, count + 1);

    if (count === 0) {
      db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
      const updatedUser: any = db.prepare('SELECT last_seen FROM users WHERE id = ?').get(userId);
      
      // Attendance Logic
      const today = new Date().toISOString().split('T')[0];
      const existingAttendance = db.prepare('SELECT id FROM attendance WHERE user_id = ? AND date = ?').get(userId, today);
      if (!existingAttendance) {
        db.prepare('INSERT INTO attendance (user_id, date) VALUES (?, ?)').run(userId, today);
      }

      io.to('all').emit('user_status', { userId, is_online: 1, last_seen: updatedUser.last_seen });
    }
  });
  
  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const count = (userPresence.get(userId) || 1) - 1;
      if (count <= 0) {
        userPresence.delete(userId);
        db.prepare('UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
        const updatedUser: any = db.prepare('SELECT last_seen FROM users WHERE id = ?').get(userId);

        // Update Clock Out and Overtime
        const today = new Date().toISOString().split('T')[0];
        db.prepare(`
          UPDATE attendance 
          SET clock_out = CURRENT_TIMESTAMP,
              overtime_minutes = MAX(0, CAST((julianday(CURRENT_TIMESTAMP) - julianday(clock_in)) * 24 * 60 AS INTEGER) - 480)
          WHERE user_id = ? AND date = ?
        `).run(userId, today);

        io.to('all').emit('user_status', { userId, is_online: 0, last_seen: updatedUser.last_seen });
      } else {
        userPresence.set(userId, count);
      }
      socketToUser.delete(socket.id);
    }
  });
});

app.get('/api/notifications', authenticate, (req: any, res) => {
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json(notifications);
});

app.post('/api/notifications/:id/read', authenticate, (req: any, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.post('/api/notifications/read-all', authenticate, (req: any, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

app.get('/api/attendance-stats', authenticate, (req: any, res) => {
  if (req.user.role === 'manager') {
    const stats = db.prepare(`
      SELECT a.*, u.full_name, u.registration_number 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id 
      ORDER BY a.date DESC, a.clock_in DESC
    `).all();
    res.json(stats);
  } else {
    const stats = db.prepare(`
      SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC, clock_in DESC
    `).all(req.user.id);
    res.json(stats);
  }
});

// Global Error Handler for API
app.use((err: any, req: any, res: any, next: any) => {
  if (req.path && req.path.startsWith('/api')) {
    console.error('API Error:', err);
    return res.status(err.status || 500).json({ 
      error: err.message || 'حدث خطأ غير متوقع في النظام',
      code: err.code || 'INTERNAL_ERROR'
    });
  }
  next(err);
});

// Final catch-all for /api routes to ensure JSON responses
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
});

// Vite Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
