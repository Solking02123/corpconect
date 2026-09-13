#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
نظام إدارة الموارد البشرية والموظفين (CorpConnect) - إصدار بايثون المباشر
تطبيق ويب متكامل يعمل بمكتبات بايثون القياسية دون الحاجة لتثبيت أي حزم إضافية (Zero Dependencies)!
"""

import http.server
import socketserver
import json
import sqlite3
import os
import sys
import hashlib
import time
import datetime
import urllib.parse
import webbrowser
from typing import Dict, Any, Optional

PORT = 8000
DB_FILE = "corp.db"

# ---------------------------------------------------------
# تهيئة قاعدة البيانات والجداول
# ---------------------------------------------------------
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
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
        salary REAL DEFAULT 0,
        penalties TEXT,
        status TEXT DEFAULT 'active',
        is_online INTEGER DEFAULT 0,
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
    """)

    cursor.execute("""
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
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        issuer TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        clock_in DATETIME DEFAULT CURRENT_TIMESTAMP,
        clock_out DATETIME,
        overtime_minutes INTEGER DEFAULT 0,
        date TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS financial_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payroll (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        base_salary REAL NOT NULL,
        overtime_pay REAL DEFAULT 0,
        bonuses REAL DEFAULT 0,
        deductions REAL DEFAULT 0,
        net_salary REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    """)

    cursor.execute("""
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
    """)

    # التحقق من وجود المدير الافتراضي
    cursor.execute("SELECT id FROM users WHERE role = 'manager'")
    manager = cursor.fetchone()
    if not manager:
        hashed_pass = hash_password("admin123")
        cursor.execute("""
            INSERT INTO users (username, password, role, full_name, registration_number, job_title, department, salary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ('manager', hashed_pass, 'manager', 'مدير النظام العام', 'MNG-001', 'المدير العام', 'الإدارة التنفيذية', 15000))
        
        # إضافة موظفين نموذجيين لتسهيل التجربة
        emp1_pass = hash_password("123456")
        cursor.execute("""
            INSERT INTO users (username, password, role, full_name, registration_number, job_title, department, salary, phone, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('ahmed', emp1_pass, 'employee', 'أحمد محمد العلي', 'EMP-101', 'مهندس برمجيات', 'تقنية المعلومات', 8500, '0501234567', 'ahmed@company.com'))
        
        cursor.execute("""
            INSERT INTO users (username, password, role, full_name, registration_number, job_title, department, salary, phone, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('sara', emp1_pass, 'employee', 'سارة خالد المنصور', 'EMP-102', 'أخصائية موارد بشرية', 'الموارد البشرية', 7800, '0559876543', 'sara@company.com'))

        # إعلان ترحيبي
        cursor.execute("""
            INSERT INTO announcements (title, content, issuer)
            VALUES (?, ?, ?)
        """, ('مرحباً بكم في نظام CorpConnect', 'يسر إدارة الشركة الإعلان عن إطلاق البوابة الرقمية للموظفين لتقديم الإجازات وتسجيل الحضور والرواتب.', 'الإدارة العامة'))

    conn.commit()
    conn.close()

# ---------------------------------------------------------
# جلسات المستخدمين البسيطة في الذاكرة
# ---------------------------------------------------------
active_sessions: Dict[str, Dict[str, Any]] = {}

def create_session(user_row: sqlite3.Row) -> str:
    token = hashlib.sha256(f"{user_row['id']}-{time.time()}-{os.urandom(16).hex()}".encode()).hexdigest()
    active_sessions[token] = {
        "id": user_row["id"],
        "username": user_row["username"],
        "role": user_row["role"],
        "full_name": user_row["full_name"],
        "registration_number": user_row["registration_number"],
        "job_title": user_row["job_title"],
        "department": user_row["department"],
        "salary": user_row["salary"],
    }
    return token

def get_user_from_auth_header(headers) -> Optional[Dict[str, Any]]:
    auth = headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        return active_sessions.get(token)
    return None

# ---------------------------------------------------------
# خادم الويب ومعالج الطلبات
# ---------------------------------------------------------
class CorpRequestHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def read_json_body(self) -> Dict[str, Any]:
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw_body = self.rfile.read(content_length).decode('utf-8')
            try:
                return json.loads(raw_body)
            except Exception:
                return {}
        return {}

    def send_json(self, data: Any, status: int = 200):
        response_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # واجهة الويب الأساسية
        if path == "/" or path == "/index.html":
            self.serve_html_app()
            return

        # المسارات البرمجية API
        user = get_user_from_auth_header(self.headers)

        if path == "/api/me":
            if not user:
                self.send_json({"error": "غير مصرح"}, 401)
                return
            conn = get_db()
            db_user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            conn.close()
            if db_user:
                d = dict(db_user)
                d.pop("password", None)
                self.send_json(d)
            else:
                self.send_json({"error": "المستخدم غير موجود"}, 404)
            return

        if path == "/api/employees":
            if not user:
                self.send_json({"error": "غير مصرح"}, 401)
                return
            conn = get_db()
            employees = conn.execute("""
                SELECT id, username, role, registration_number, full_name, rank, salary, 
                       job_title, department, phone, email, status, hiring_date 
                FROM users ORDER BY role DESC, id ASC
            """).fetchall()
            conn.close()
            self.send_json([dict(emp) for emp in employees])
            return

        if path == "/api/attendance":
            if not user:
                self.send_json({"error": "غير مصرح"}, 401)
                return
            conn = get_db()
            if user["role"] == "manager":
                rows = conn.execute("""
                    SELECT a.*, u.full_name, u.registration_number
                    FROM attendance a
                    JOIN users u ON a.user_id = u.id
                    ORDER BY a.date DESC, a.clock_in DESC
                    LIMIT 100
                """).fetchall()
            else:
                rows = conn.execute("""
                    SELECT * FROM attendance
                    WHERE user_id = ?
                    ORDER BY date DESC, clock_in DESC
                    LIMIT 50
                """, (user["id"],)).fetchall()
            conn.close()
            self.send_json([dict(r) for r in rows])
            return

        if path == "/api/requests":
            if not user:
                self.send_json({"error": "غير مصرح"}, 401)
                return
            conn = get_db()
            if user["role"] == "manager":
                rows = conn.execute("""
                    SELECT r.*, u.full_name, u.registration_number, u.job_title, u.department
                    FROM requests r
                    JOIN users u ON r.sender_id = u.id
                    ORDER BY r.created_at DESC
                """).fetchall()
            else:
                rows = conn.execute("""
                    SELECT * FROM requests
                    WHERE sender_id = ?
                    ORDER BY created_at DESC
                """, (user["id"],)).fetchall()
            conn.close()
            self.send_json([dict(r) for r in rows])
            return

        if path == "/api/announcements":
            conn = get_db()
            rows = conn.execute("SELECT * FROM announcements ORDER BY created_at DESC").fetchall()
            conn.close()
            self.send_json([dict(r) for r in rows])
            return

        if path == "/api/payroll":
            if not user:
                self.send_json({"error": "غير مصرح"}, 401)
                return
            conn = get_db()
            if user["role"] == "manager":
                rows = conn.execute("""
                    SELECT p.*, u.full_name, u.registration_number, u.department 
                    FROM payroll p
                    JOIN users u ON p.user_id = u.id
                    ORDER BY p.month DESC, p.id DESC
                """).fetchall()
            else:
                rows = conn.execute("SELECT * FROM payroll WHERE user_id = ? ORDER BY month DESC", (user["id"],)).fetchall()
            conn.close()
            self.send_json([dict(r) for r in rows])
            return

        if path == "/api/notifications":
            if not user:
                self.send_json([], 200)
                return
            conn = get_db()
            rows = conn.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", (user["id"],)).fetchall()
            conn.close()
            self.send_json([dict(r) for r in rows])
            return

        # مسار غير موجود
        self.send_json({"error": "المسار غير متوفر"}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        # تسجيل الدخول
        if path == "/api/login":
            username = body.get("username", "").strip()
            password = body.get("password", "")
            
            conn = get_db()
            user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            conn.close()

            if user and (user["password"] == hash_password(password) or user["password"] == password):
                token = create_session(user)
                user_dict = dict(user)
                user_dict.pop("password", None)
                self.send_json({
                    "token": token,
                    "user": user_dict,
                    "message": "تم تسجيل الدخول بنجاح"
                })
            else:
                self.send_json({"error": "اسم المستخدم أو كلمة المرور غير صحيحة"}, 400)
            return

        user = get_user_from_auth_header(self.headers)
        if not user:
            self.send_json({"error": "يرجى تسجيل الدخول أولاً"}, 401)
            return

        # تسجيل الحضور
        if path == "/api/attendance/clock-in":
            today = datetime.date.today().isoformat()
            now_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn = get_db()
            existing = conn.execute("SELECT id FROM attendance WHERE user_id = ? AND date = ?", (user["id"], today)).fetchone()
            if existing:
                conn.close()
                self.send_json({"error": "لقد قمت بتسجيل الحضور اليوم بالفعل"}, 400)
                return
            conn.execute("INSERT INTO attendance (user_id, clock_in, date) VALUES (?, ?, ?)", (user["id"], now_time, today))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم تسجيل الحضور بنجاح"})
            return

        # تسجيل الانصراف
        if path == "/api/attendance/clock-out":
            today = datetime.date.today().isoformat()
            now_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn = get_db()
            att = conn.execute("SELECT id, clock_in FROM attendance WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1", (user["id"], today)).fetchone()
            if not att:
                conn.close()
                self.send_json({"error": "لم تقم بتسجيل الدخول اليوم لتسجيل الانصراف"}, 400)
                return
            conn.execute("UPDATE attendance SET clock_out = ? WHERE id = ?", (now_time, att["id"]))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم تسجيل الانصراف بنجاح"})
            return

        # إضافة موظف جديد (للمدير فقط)
        if path == "/api/employees":
            if user["role"] != "manager":
                self.send_json({"error": "غير مصرح لك بإضافة موظفين"}, 403)
                return
            username = body.get("username", "").strip()
            password = body.get("password", "123456")
            full_name = body.get("full_name", "").strip()
            reg_num = body.get("registration_number", f"EMP-{int(time.time()) % 10000}").strip()
            role = body.get("role", "employee")
            job_title = body.get("job_title", "")
            department = body.get("department", "")
            salary = float(body.get("salary", 0) or 0)
            phone = body.get("phone", "")
            email = body.get("email", "")

            if not username or not full_name:
                self.send_json({"error": "الرجاء تعبئة اسم المستخدم والاسم الكامل"}, 400)
                return

            conn = get_db()
            try:
                conn.execute("""
                    INSERT INTO users (username, password, full_name, registration_number, role, job_title, department, salary, phone, email, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
                """, (username, hash_password(password), full_name, reg_num, role, job_title, department, salary, phone, email))
                conn.commit()
                conn.close()
                self.send_json({"success": True, "message": "تم إضافة الموظف بنجاح"})
            except sqlite3.IntegrityError:
                conn.close()
                self.send_json({"error": "اسم المستخدم أو الرقم الوظيفي موجود مسبقاً"}, 400)
            return

        # تقديم طلب جديد
        if path == "/api/requests":
            req_type = body.get("type", "إجازة")
            description = body.get("description", "").strip()
            if not description:
                self.send_json({"error": "يرجى كتابة تفاصيل الطلب"}, 400)
                return
            conn = get_db()
            conn.execute("INSERT INTO requests (sender_id, type, description, status) VALUES (?, ?, ?, 'pending')",
                         (user["id"], req_type, description))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم تقديم الطلب بنجاح"})
            return

        # إضافة إعلان جديد (للمدير)
        if path == "/api/announcements":
            if user["role"] != "manager":
                self.send_json({"error": "غير مصرح"}, 403)
                return
            title = body.get("title", "").strip()
            content = body.get("content", "").strip()
            if not title or not content:
                self.send_json({"error": "الرجاء تعبئة العنوان والمحتوى"}, 400)
                return
            conn = get_db()
            conn.execute("INSERT INTO announcements (title, content, issuer) VALUES (?, ?, ?)",
                         (title, content, user["full_name"]))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم نشر الإعلان بنجاح"})
            return

        # توليد مسير الرواتب (للمدير)
        if path == "/api/payroll/generate":
            if user["role"] != "manager":
                self.send_json({"error": "غير مصرح"}, 403)
                return
            month = body.get("month", datetime.date.today().strftime("%Y-%m"))
            conn = get_db()
            employees = conn.execute("SELECT id, salary FROM users WHERE role != 'manager'").fetchall()
            for emp in employees:
                base = emp["salary"] or 0
                conn.execute("""
                    INSERT INTO payroll (user_id, month, base_salary, bonuses, deductions, net_salary)
                    VALUES (?, ?, ?, 0, 0, ?)
                """, (emp["id"], month, base, base))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": f"تم إنشاء مسير رواتب شهر {month} بنجاح"})
            return

        self.send_json({"error": "المسار غير معروف"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()
        user = get_user_from_auth_header(self.headers)
        if not user:
            self.send_json({"error": "غير مصرح"}, 401)
            return

        # تحديث حالة الطلب من قبل المدير (موافقة / رفض)
        if path.startswith("/api/requests/") and path.endswith("/status"):
            if user["role"] != "manager":
                self.send_json({"error": "غير مصرح لك بتعديل الطلبات"}, 403)
                return
            parts = path.split("/")
            req_id = parts[3]
            status = body.get("status", "approved")
            comment = body.get("manager_comment", "")

            conn = get_db()
            conn.execute("UPDATE requests SET status = ?, manager_comment = ? WHERE id = ?", (status, comment, req_id))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم تحديث حالة الطلب"})
            return

        # تحديث بيانات موظف
        if path.startswith("/api/employees/"):
            if user["role"] != "manager":
                self.send_json({"error": "غير مصرح"}, 403)
                return
            emp_id = path.split("/")[3]
            conn = get_db()
            conn.execute("""
                UPDATE users SET full_name = ?, job_title = ?, department = ?, salary = ?, phone = ?, email = ?
                WHERE id = ?
            """, (
                body.get("full_name"), body.get("job_title"), body.get("department"),
                float(body.get("salary", 0) or 0), body.get("phone"), body.get("email"), emp_id
            ))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم تحديث بيانات الموظف بنجاح"})
            return

        self.send_json({"error": "المسار غير متوفر"}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        user = get_user_from_auth_header(self.headers)
        if not user:
            self.send_json({"error": "غير مصرح"}, 401)
            return

        # حذف موظف
        if path.startswith("/api/employees/"):
            if user["role"] != "manager":
                self.send_json({"error": "غير مصرح لك بحذف الموظفين"}, 403)
                return
            emp_id = int(path.split("/")[3])
            if emp_id == user["id"]:
                self.send_json({"error": "لا يمكنك حذف حسابك الخاص كمدير"}, 400)
                return

            conn = get_db()
            conn.execute("DELETE FROM attendance WHERE user_id = ?", (emp_id,))
            conn.execute("DELETE FROM requests WHERE sender_id = ?", (emp_id,))
            conn.execute("DELETE FROM payroll WHERE user_id = ?", (emp_id,))
            conn.execute("DELETE FROM notifications WHERE user_id = ?", (emp_id,))
            conn.execute("DELETE FROM users WHERE id = ?", (emp_id,))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم حذف الموظف وكافة بياناته بنجاح"})
            return

        # حذف إعلان
        if path.startswith("/api/announcements/"):
            if user["role"] != "manager":
                self.send_json({"error": "غير مصرح"}, 403)
                return
            ann_id = int(path.split("/")[3])
            conn = get_db()
            conn.execute("DELETE FROM announcements WHERE id = ?", (ann_id,))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "تم حذف الإعلان بنجاح"})
            return

        self.send_json({"error": "المسار غير متوفر"}, 404)

    # ---------------------------------------------------------
    # واجهة الويب المتكاملة (HTML + Tailwind RTL + JS)
    # ---------------------------------------------------------
    def serve_html_app(self):
        html_content = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CorpConnect - نظام إدارة الموظفين والموارد البشرية (إصدار بايثون)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body { font-family: 'Cairo', sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">

    <!-- شاشة تسجيل الدخول -->
    <div id="loginSection" class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800">
        <div class="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
            <div class="text-center mb-6">
                <div class="inline-flex p-3 rounded-2xl bg-indigo-600 text-white mb-3 shadow-lg shadow-indigo-500/30">
                    <i data-lucide="building-2" class="w-8 h-8"></i>
                </div>
                <h1 class="text-2xl font-black text-slate-800">CorpConnect</h1>
                <p class="text-sm text-slate-500 mt-1">بوابة الموارد البشرية وإدارة الموظفين (بايثون)</p>
            </div>

            <form id="loginForm" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
                    <input type="text" id="loginUsername" required class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="manager أو اسم الموظف" value="manager">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                    <input type="password" id="loginPassword" required class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="••••••••" value="admin123">
                </div>
                <div id="loginError" class="hidden text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg font-bold"></div>
                <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm flex items-center justify-center gap-2">
                    <i data-lucide="log-in" class="w-4 h-4"></i>
                    تسجيل الدخول
                </button>
            </form>

            <div class="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
                حساب المدير الافتراضي: <span class="text-indigo-600 font-bold">manager / admin123</span>
            </div>
        </div>
    </div>

    <!-- التطبيق الرئيسي بعد تسجيل الدخول -->
    <div id="appSection" class="hidden min-h-screen flex flex-col">
        <!-- شريط الرأس العلوي -->
        <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="bg-indigo-600 text-white p-2 rounded-xl shadow-md">
                        <i data-lucide="shield-check" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h2 class="font-extrabold text-base text-slate-800 leading-tight">CorpConnect</h2>
                        <span class="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            خادم بايثون المحلي متصل
                        </span>
                    </div>
                </div>

                <div class="flex items-center gap-4">
                    <div class="text-left">
                        <div id="userFullName" class="font-bold text-sm text-slate-800"></div>
                        <div id="userBadge" class="text-xs text-indigo-600 font-semibold"></div>
                    </div>
                    <button onclick="logout()" class="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors" title="تسجيل الخروج">
                        <i data-lucide="log-out" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        </header>

        <!-- التبويبات والمحتوى -->
        <div class="max-w-7xl mx-auto px-4 py-6 w-full flex-1">
            <!-- أزرار التبويبات -->
            <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-3 mb-6">
                <button onclick="switchTab('dashboard')" class="tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-indigo-600 text-white" data-tab="dashboard">
                    <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
                    الرئيسية
                </button>
                <button id="empTabBtn" onclick="switchTab('employees')" class="tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200" data-tab="employees">
                    <i data-lucide="users" class="w-4 h-4"></i>
                    الموظفون
                </button>
                <button onclick="switchTab('attendance')" class="tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200" data-tab="attendance">
                    <i data-lucide="calendar-check" class="w-4 h-4"></i>
                    الحضور والانصراف
                </button>
                <button onclick="switchTab('requests')" class="tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200" data-tab="requests">
                    <i data-lucide="file-text" class="w-4 h-4"></i>
                    الطلبات والإجازات
                </button>
                <button onclick="switchTab('payroll')" class="tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200" data-tab="payroll">
                    <i data-lucide="banknote" class="w-4 h-4"></i>
                    الرواتب والمالية
                </button>
                <button onclick="switchTab('announcements')" class="tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200" data-tab="announcements">
                    <i data-lucide="megaphone" class="w-4 h-4"></i>
                    التعميمات والإعلانات
                </button>
            </div>

            <!-- تبويب الرئيسية -->
            <div id="tab_dashboard" class="tab-content space-y-6">
                <!-- بطاقات إحصائية -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div class="text-xs font-bold text-slate-500 mb-1">إجمالي الموظفين</div>
                            <div id="statEmployees" class="text-2xl font-black text-slate-800">0</div>
                        </div>
                        <div class="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><i data-lucide="users" class="w-6 h-6"></i></div>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div class="text-xs font-bold text-slate-500 mb-1">حضور اليوم</div>
                            <div id="statAttendance" class="text-2xl font-black text-emerald-600">0</div>
                        </div>
                        <div class="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><i data-lucide="user-check" class="w-6 h-6"></i></div>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div class="text-xs font-bold text-slate-500 mb-1">طلبات معلقة</div>
                            <div id="statPendingRequests" class="text-2xl font-black text-amber-600">0</div>
                        </div>
                        <div class="p-3 bg-amber-50 text-amber-600 rounded-xl"><i data-lucide="clock" class="w-6 h-6"></i></div>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div class="text-xs font-bold text-slate-500 mb-1">إعلانات نشطة</div>
                            <div id="statAnnouncements" class="text-2xl font-black text-blue-600">0</div>
                        </div>
                        <div class="p-3 bg-blue-50 text-blue-600 rounded-xl"><i data-lucide="bell" class="w-6 h-6"></i></div>
                    </div>
                </div>

                <!-- الإجراءات السريعة والحضور -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 class="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                            <i data-lucide="timer" class="w-5 h-5 text-indigo-600"></i>
                            تسجيل الحضور الفوري
                        </h3>
                        <p class="text-xs text-slate-500 mb-6">سجل حضورك اليومي وانصرافك بسهولة بضغطة زر واحدة.</p>
                        <div class="flex gap-3">
                            <button onclick="clockIn()" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all">
                                <i data-lucide="log-in" class="w-4 h-4"></i>
                                تسجيل الحضور
                            </button>
                            <button onclick="clockOut()" class="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all">
                                <i data-lucide="log-out" class="w-4 h-4"></i>
                                تسجيل الانصراف
                            </button>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 class="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                            <i data-lucide="send" class="w-5 h-5 text-indigo-600"></i>
                            تقديم طلب جديد سريع
                        </h3>
                        <form onsubmit="submitQuickRequest(event)" class="space-y-3">
                            <select id="quickReqType" class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300">
                                <option value="إجازة سنوية">إجازة سنوية</option>
                                <option value="إجازة مرضية">إجازة مرضية</option>
                                <option value="سلفة مالية">سلفة مالية</option>
                                <option value="إذن خروج مؤقت">إذن خروج مؤقت</option>
                            </select>
                            <textarea id="quickReqDesc" required placeholder="اكتب تفاصيل طلبك هنا..." class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 h-20 resize-none"></textarea>
                            <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs">
                                إرسال الطلب
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- تبويب الموظفون -->
            <div id="tab_employees" class="tab-content hidden space-y-4">
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                    <div class="relative w-full sm:w-80">
                        <i data-lucide="search" class="w-4 h-4 absolute right-3 top-3 text-slate-400"></i>
                        <input type="text" id="employeeSearch" oninput="filterEmployees()" placeholder="البحث بالاسم أو الرقم الوظيفي..." class="w-full pr-9 pl-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <button onclick="openAddEmployeeModal()" class="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm">
                        <i data-lucide="user-plus" class="w-4 h-4"></i>
                        إضافة موظف جديد
                    </button>
                </div>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                <tr>
                                    <th class="p-3.5">الرقم الوظيفي</th>
                                    <th class="p-3.5">الموظف</th>
                                    <th class="p-3.5">المسمى الوظيفي</th>
                                    <th class="p-3.5">القسم</th>
                                    <th class="p-3.5">الراتب الأساسي</th>
                                    <th class="p-3.5">الهاتف</th>
                                    <th class="p-3.5 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="employeesTableBody" class="divide-y divide-slate-100">
                                <!-- سيتم تعبئته بواسطة JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- تبويب الحضور والانصراف -->
            <div id="tab_attendance" class="tab-content hidden space-y-4">
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
                    <h3 class="font-black text-sm text-slate-800 mb-4">سجل الحضور والانصراف</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                <tr>
                                    <th class="p-3">التاريخ</th>
                                    <th class="p-3">الموظف</th>
                                    <th class="p-3">وقت الحضور</th>
                                    <th class="p-3">وقت الانصراف</th>
                                    <th class="p-3">الحالة</th>
                                </tr>
                            </thead>
                            <tbody id="attendanceTableBody" class="divide-y divide-slate-100">
                                <!-- سيتم تعبئته بواسطة JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- تبويب الطلبات والإجازات -->
            <div id="tab_requests" class="tab-content hidden space-y-4">
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h3 class="font-black text-sm text-slate-800 mb-4">قائمة الطلبات والإجازات</h3>
                    <div id="requestsContainer" class="space-y-3">
                        <!-- سيتم تعبئته بواسطة JS -->
                    </div>
                </div>
            </div>

            <!-- تبويب الرواتب -->
            <div id="tab_payroll" class="tab-content hidden space-y-4">
                <div class="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                    <h3 class="font-black text-sm text-slate-800">مسير الرواتب والمستحقات</h3>
                    <button id="generatePayrollBtn" onclick="generatePayroll()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2">
                        <i data-lucide="calculator" class="w-4 h-4"></i>
                        توليد مسير رواتب الشهر الحالي
                    </button>
                </div>
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                <tr>
                                    <th class="p-3">الشهر</th>
                                    <th class="p-3">الموظف</th>
                                    <th class="p-3">الراتب الأساسي</th>
                                    <th class="p-3">المكافآت</th>
                                    <th class="p-3">الخصومات</th>
                                    <th class="p-3">صافي الراتب</th>
                                </tr>
                            </thead>
                            <tbody id="payrollTableBody" class="divide-y divide-slate-100">
                                <!-- سيتم تعبئته بواسطة JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- تبويب التعميمات والإعلانات -->
            <div id="tab_announcements" class="tab-content hidden space-y-4">
                <div id="managerAnnounceSection" class="bg-white p-4 rounded-2xl border border-slate-200 hidden">
                    <h3 class="font-black text-sm text-slate-800 mb-3">نشر تعميم أو إعلان جديد</h3>
                    <form onsubmit="publishAnnouncement(event)" class="space-y-3">
                        <input type="text" id="announceTitle" required placeholder="عنوان التعميم..." class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300">
                        <textarea id="announceContent" required placeholder="تفاصيل الإعلان..." class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 h-20 resize-none"></textarea>
                        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl">نشر الإعلان</button>
                    </form>
                </div>
                <div id="announcementsList" class="space-y-3"></div>
            </div>
        </div>
    </div>

    <!-- نافذة إضافة موظف جديد (Modal) -->
    <div id="addEmployeeModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div class="flex items-center justify-between border-b pb-3 mb-4">
                <h3 class="font-black text-sm text-slate-800">إضافة موظف جديد</h3>
                <button onclick="closeAddEmployeeModal()" class="text-slate-400 hover:text-slate-600"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <form id="addEmployeeForm" onsubmit="saveEmployee(event)" class="space-y-3 text-xs">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold mb-1">اسم المستخدم *</label>
                        <input type="text" id="newUsername" required class="w-full p-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block font-bold mb-1">كلمة المرور *</label>
                        <input type="password" id="newPassword" required value="123456" class="w-full p-2 border rounded-lg">
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-1">الاسم الكامل *</label>
                    <input type="text" id="newFullName" required class="w-full p-2 border rounded-lg">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold mb-1">المسمى الوظيفي</label>
                        <input type="text" id="newJobTitle" class="w-full p-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block font-bold mb-1">القسم</label>
                        <input type="text" id="newDepartment" class="w-full p-2 border rounded-lg">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold mb-1">الراتب الأساسي (ريال)</label>
                        <input type="number" id="newSalary" value="5000" class="w-full p-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block font-bold mb-1">الهاتف</label>
                        <input type="text" id="newPhone" class="w-full p-2 border rounded-lg">
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" onclick="closeAddEmployeeModal()" class="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg">إلغاء</button>
                    <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg">حفظ الموظف</button>
                </div>
            </form>
        </div>
    </div>

    <!-- كود الجافاسكريبت للربط بالـ API -->
    <script>
        let currentUser = null;
        let authToken = localStorage.getItem('corp_token') || '';
        let employeesData = [];

        function api(url, method = 'GET', data = null) {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? 'Bearer ' + authToken : ''
                }
            };
            if (data) options.body = JSON.stringify(data);
            return fetch(url, options).then(async res => {
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'حدث خطأ في الاتصال');
                return json;
            });
        }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errDiv = document.getElementById('loginError');
            errDiv.classList.add('hidden');
            try {
                const res = await api('/api/login', 'POST', {
                    username: document.getElementById('loginUsername').value,
                    password: document.getElementById('loginPassword').value
                });
                authToken = res.token;
                localStorage.setItem('corp_token', authToken);
                currentUser = res.user;
                initApp();
            } catch (err) {
                errDiv.textContent = err.message;
                errDiv.classList.remove('hidden');
            }
        });

        async function initApp() {
            try {
                if (!currentUser) {
                    currentUser = await api('/api/me');
                }
                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('appSection').classList.remove('hidden');
                document.getElementById('userFullName').textContent = currentUser.full_name || currentUser.username;
                document.getElementById('userBadge').textContent = currentUser.role === 'manager' ? 'مدير النظام' : (currentUser.job_title || 'موظف');

                if (currentUser.role === 'manager') {
                    document.getElementById('managerAnnounceSection').classList.remove('hidden');
                } else {
                    document.getElementById('empTabBtn').classList.add('hidden');
                    document.getElementById('generatePayrollBtn')?.classList.add('hidden');
                }

                loadDashboard();
                loadEmployees();
                loadAttendance();
                loadRequests();
                loadPayroll();
                loadAnnouncements();
                lucide.createIcons();
            } catch (err) {
                logout();
            }
        }

        function logout() {
            localStorage.removeItem('corp_token');
            authToken = '';
            currentUser = null;
            document.getElementById('appSection').classList.add('hidden');
            document.getElementById('loginSection').classList.remove('hidden');
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(b => {
                if (b.dataset.tab === tabId) {
                    b.className = 'tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-indigo-600 text-white';
                } else {
                    b.className = 'tab-btn px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200';
                }
            });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('tab_' + tabId).classList.remove('hidden');
            lucide.createIcons();
        }

        async function loadDashboard() {
            try {
                const emps = await api('/api/employees');
                const atts = await api('/api/attendance');
                const reqs = await api('/api/requests');
                const anns = await api('/api/announcements');

                document.getElementById('statEmployees').textContent = emps.length;
                const today = new Date().toISOString().split('T')[0];
                const todayAtt = atts.filter(a => a.date === today);
                document.getElementById('statAttendance').textContent = todayAtt.length;
                const pending = reqs.filter(r => r.status === 'pending');
                document.getElementById('statPendingRequests').textContent = pending.length;
                document.getElementById('statAnnouncements').textContent = anns.length;
            } catch (e) {}
        }

        async function clockIn() {
            try {
                const res = await api('/api/attendance/clock-in', 'POST');
                alert(res.message);
                loadAttendance();
                loadDashboard();
            } catch (err) {
                alert(err.message);
            }
        }

        async function clockOut() {
            try {
                const res = await api('/api/attendance/clock-out', 'POST');
                alert(res.message);
                loadAttendance();
            } catch (err) {
                alert(err.message);
            }
        }

        async function loadEmployees() {
            try {
                employeesData = await api('/api/employees');
                renderEmployees(employeesData);
            } catch (e) {}
        }

        function renderEmployees(list) {
            const tbody = document.getElementById('employeesTableBody');
            tbody.innerHTML = '';
            list.forEach(emp => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 transition-colors';
                tr.innerHTML = `
                    <td class="p-3 font-mono font-bold text-indigo-600">${emp.registration_number || '-'}</td>
                    <td class="p-3 font-bold">${emp.full_name}</td>
                    <td class="p-3 text-slate-500">${emp.job_title || '-'}</td>
                    <td class="p-3 text-slate-500">${emp.department || '-'}</td>
                    <td class="p-3 font-semibold">${emp.salary ? emp.salary.toLocaleString() + ' ر.س' : '-'}</td>
                    <td class="p-3 text-slate-500">${emp.phone || '-'}</td>
                    <td class="p-3 text-center">
                        ${emp.role !== 'manager' ? `
                            <button onclick="deleteEmployee(${emp.id}, '${emp.full_name}')" class="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors" title="حذف الموظف">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        ` : '<span class="text-slate-400 font-bold">المدير</span>'}
                    </td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        }

        function filterEmployees() {
            const q = document.getElementById('employeeSearch').value.toLowerCase();
            const filtered = employeesData.filter(e => 
                (e.full_name || '').toLowerCase().includes(q) || 
                (e.registration_number || '').toLowerCase().includes(q)
            );
            renderEmployees(filtered);
        }

        async function deleteEmployee(id, name) {
            if (confirm(`هل أنت متأكد من حذف الموظف "${name}"؟ سيتم حذف جميع بياناته المرتبطة.`)) {
                try {
                    const res = await api('/api/employees/' + id, 'DELETE');
                    alert(res.message);
                    loadEmployees();
                    loadDashboard();
                } catch (err) {
                    alert(err.message);
                }
            }
        }

        function openAddEmployeeModal() { document.getElementById('addEmployeeModal').classList.remove('hidden'); }
        function closeAddEmployeeModal() { document.getElementById('addEmployeeModal').classList.add('hidden'); }

        async function saveEmployee(e) {
            e.preventDefault();
            try {
                const data = {
                    username: document.getElementById('newUsername').value,
                    password: document.getElementById('newPassword').value,
                    full_name: document.getElementById('newFullName').value,
                    job_title: document.getElementById('newJobTitle').value,
                    department: document.getElementById('newDepartment').value,
                    salary: document.getElementById('newSalary').value,
                    phone: document.getElementById('newPhone').value
                };
                const res = await api('/api/employees', 'POST', data);
                alert(res.message);
                closeAddEmployeeModal();
                loadEmployees();
                loadDashboard();
            } catch (err) {
                alert(err.message);
            }
        }

        async function loadAttendance() {
            try {
                const list = await api('/api/attendance');
                const tbody = document.getElementById('attendanceTableBody');
                tbody.innerHTML = '';
                list.forEach(a => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="p-3 font-mono">${a.date}</td>
                        <td class="p-3 font-bold">${a.full_name || currentUser.full_name}</td>
                        <td class="p-3 text-emerald-600 font-mono">${a.clock_in ? a.clock_in.split(' ')[1] : '-'}</td>
                        <td class="p-3 text-slate-600 font-mono">${a.clock_out ? a.clock_out.split(' ')[1] : 'قيد العمل'}</td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded-full text-xs font-bold ${a.clock_out ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}">${a.clock_out ? 'مكتمل' : 'نشط الآن'}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch (e) {}
        }

        async function loadRequests() {
            try {
                const list = await api('/api/requests');
                const container = document.getElementById('requestsContainer');
                container.innerHTML = '';
                if (list.length === 0) {
                    container.innerHTML = '<div class="text-center text-slate-400 py-8">لا توجد طلبات مسجلة حالياً</div>';
                    return;
                }
                list.forEach(r => {
                    const div = document.createElement('div');
                    div.className = 'p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3';
                    const statusBadge = r.status === 'approved' ? '<span class="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md">تمت الموافقة</span>' :
                                       (r.status === 'rejected' ? '<span class="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md">مرفوض</span>' : '<span class="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md">قيد المراجعة</span>');
                    div.innerHTML = `
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-black text-indigo-600 text-sm">${r.type}</span>
                                ${statusBadge}
                                <span class="text-slate-400 text-xs">${r.created_at}</span>
                            </div>
                            <div class="text-xs text-slate-700 font-medium">${r.description}</div>
                            ${r.full_name ? `<div class="text-xs text-slate-400 mt-1">مقدم الطلب: <b>${r.full_name}</b> (${r.job_title || ''})</div>` : ''}
                            ${r.manager_comment ? `<div class="text-xs text-slate-500 mt-1 bg-white p-2 rounded border">ملاحظة المدير: ${r.manager_comment}</div>` : ''}
                        </div>
                        ${currentUser.role === 'manager' && r.status === 'pending' ? `
                            <div class="flex gap-2">
                                <button onclick="updateRequestStatus(${r.id}, 'approved')" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">موافقة</button>
                                <button onclick="updateRequestStatus(${r.id}, 'rejected')" class="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700">رفض</button>
                            </div>
                        ` : ''}
                    `;
                    container.appendChild(div);
                });
            } catch (e) {}
        }

        async function updateRequestStatus(id, status) {
            const comment = prompt('إضافة ملاحظة على القرار (اختياري):', '');
            try {
                await api(`/api/requests/${id}/status`, 'PUT', { status, manager_comment: comment || '' });
                alert('تم تحديث حالة الطلب');
                loadRequests();
                loadDashboard();
            } catch (err) {
                alert(err.message);
            }
        }

        async function submitQuickRequest(e) {
            e.preventDefault();
            try {
                const res = await api('/api/requests', 'POST', {
                    type: document.getElementById('quickReqType').value,
                    description: document.getElementById('quickReqDesc').value
                });
                alert(res.message);
                document.getElementById('quickReqDesc').value = '';
                loadRequests();
                loadDashboard();
            } catch (err) {
                alert(err.message);
            }
        }

        async function loadPayroll() {
            try {
                const list = await api('/api/payroll');
                const tbody = document.getElementById('payrollTableBody');
                tbody.innerHTML = '';
                list.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="p-3 font-mono">${p.month}</td>
                        <td class="p-3 font-bold">${p.full_name || currentUser.full_name}</td>
                        <td class="p-3 font-mono">${(p.base_salary || 0).toLocaleString()} ر.س</td>
                        <td class="p-3 font-mono text-emerald-600">+${(p.bonuses || 0).toLocaleString()}</td>
                        <td class="p-3 font-mono text-rose-600">-${(p.deductions || 0).toLocaleString()}</td>
                        <td class="p-3 font-mono font-bold text-indigo-700">${(p.net_salary || 0).toLocaleString()} ر.س</td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch (e) {}
        }

        async function generatePayroll() {
            const currentMonth = new Date().toISOString().slice(0, 7);
            if (confirm(`هل تريد إنشاء مسير رواتب موظفي الشركة لشهر ${currentMonth}؟`)) {
                try {
                    const res = await api('/api/payroll/generate', 'POST', { month: currentMonth });
                    alert(res.message);
                    loadPayroll();
                } catch (err) {
                    alert(err.message);
                }
            }
        }

        async function loadAnnouncements() {
            try {
                const list = await api('/api/announcements');
                const container = document.getElementById('announcementsList');
                container.innerHTML = '';
                list.forEach(a => {
                    const div = document.createElement('div');
                    div.className = 'bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between gap-4';
                    div.innerHTML = `
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="font-extrabold text-sm text-slate-800">${a.title}</h4>
                                <span class="text-xs text-slate-400 font-mono">${a.created_at}</span>
                            </div>
                            <p class="text-xs text-slate-600 leading-relaxed">${a.content}</p>
                            <div class="text-xs text-indigo-600 font-bold mt-2">صادر عن: ${a.issuer || 'الإدارة'}</div>
                        </div>
                        ${currentUser.role === 'manager' ? `
                            <button onclick="deleteAnnouncement(${a.id})" class="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500" title="حذف التعميم">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        ` : ''}
                    `;
                    container.appendChild(div);
                });
                lucide.createIcons();
            } catch (e) {}
        }

        async function publishAnnouncement(e) {
            e.preventDefault();
            try {
                const res = await api('/api/announcements', 'POST', {
                    title: document.getElementById('announceTitle').value,
                    content: document.getElementById('announceContent').value
                });
                alert(res.message);
                document.getElementById('announceTitle').value = '';
                document.getElementById('announceContent').value = '';
                loadAnnouncements();
                loadDashboard();
            } catch (err) {
                alert(err.message);
            }
        }

        async function deleteAnnouncement(id) {
            if (confirm('هل أنت متأكد من حذف هذا التعميم؟')) {
                try {
                    const res = await api('/api/announcements/' + id, 'DELETE');
                    alert(res.message);
                    loadAnnouncements();
                    loadDashboard();
                } catch (err) {
                    alert(err.message);
                }
            }
        }

        if (authToken) {
            initApp();
        }
    </script>
</body>
</html>
"""
        response_bytes = html_content.encode('utf-8')
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

# ---------------------------------------------------------
# نقطة الإقلاع والتشغيل
# ---------------------------------------------------------
def run_server():
    init_database()
    
    server_address = ('', PORT)
    # تفعيل إعادة استخدام العنوان لتجنب مشاكل Address already in use
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(server_address, CorpRequestHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 65)
        print("    ★ تم تشغيل تطبيق CorpConnect بنجاح بلغة بايثون ★")
        print("=" * 65)
        print(f" ► الرابط المحلي: {url}")
        print(f" ► بيانات المدير: اسم المستخدم: manager  |  كلمة المرور: admin123")
        print(f" ► قاعدة البيانات: SQLite ({DB_FILE})")
        print("=" * 65)
        print("جاري فتح المتصفح تلقائياً... (اضغط Ctrl+C للإيقاف)")
        
        try:
            webbrowser.open(url)
        except Exception:
            pass
            
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nتم إيقاف الخادم.")

if __name__ == "__main__":
    run_server()
