import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ChatPage from './pages/ChatPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import ProfilePage from './pages/ProfilePage';
import DocumentsPage from './pages/DocumentsPage';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { api } from './services/api';

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('fontSize') || '16'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem('fontSize', fontSize.toString());
  }, [fontSize]);

  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <AppContent theme={theme} setTheme={setTheme} fontSize={fontSize} setFontSize={setFontSize} />
    </AuthProvider>
  );
}

function AppContent({ theme, setTheme, fontSize, setFontSize }: any) {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500 font-bold animate-pulse">جاري التحميل...</div>;

  return (
    <div className={`min-h-screen bg-[var(--color-bg-main)] dark:bg-neutral-950 font-sans transition-colors duration-200`}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
          <Route path="/" element={
            user ? (
              (user.role === 'manager' || user.role === 'accountant') ? <ManagerDashboard /> : <EmployeeDashboard />
            ) : <Navigate to="/login" />
          } />
          <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/login" />} />
          <Route path="/announcements" element={user ? <AnnouncementsPage /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/login" />} />
          <Route path="/profile/:id" element={user ? <ProfilePage /> : <Navigate to="/login" />} />
          <Route path="/documents" element={user ? <DocumentsPageWithLayout /> : <Navigate to="/login" />} />
          <Route path="/settings" element={user ? <SettingsPage theme={theme} setTheme={setTheme} fontSize={fontSize} setFontSize={setFontSize} /> : <Navigate to="/login" />} />
          <Route path="/help" element={user ? <HelpCenter /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

function DocumentsPageWithLayout() {
  return (
    <Layout>
      <DocumentsPage />
    </Layout>
  );
}

function SettingsPage({ theme, setTheme, fontSize, setFontSize }: any) {
  return (
    <Layout>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">الإعدادات المتقدمة</h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm">تخصيص مظهر وواجهة المستخدم للنظام</p>
      </header>
      
      <div className="max-w-2xl bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-[var(--color-border-subtle)] dark:border-neutral-800 p-8 space-y-8">
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-100 dark:border-neutral-700/50">
          <div>
            <p className="font-bold text-slate-800 dark:text-white">الوضع الليلي</p>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">تبديل بين المظهر الفاتح والداكن</p>
          </div>
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={`w-14 h-7 rounded-full transition-all relative ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300 shadow-inner'}`}
          >
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${theme === 'dark' ? 'right-8' : 'right-1'}`}></div>
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <p className="font-bold text-slate-800 dark:text-white">حجم الخط</p>
            <span className="text-xs font-mono font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-md border border-blue-100">{fontSize}px</span>
          </div>
          <input 
            type="range" 
            min="12" 
            max="24" 
            value={fontSize} 
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)] shadow-inner"
          />
          <p className="text-[10px] text-slate-400 font-bold uppercase text-center">اسحب لتعديل حجم الخط في كامل صفحات النظام</p>
        </div>
      </div>
    </Layout>
  );
}

function HelpCenter() {
  return (
    <Layout>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">مركز المساعدة والدعم</h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm">نحن هنا للإجابة على جميع استفساراتك التقنية والإدارية</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-900 p-8 rounded-xl border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
          <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">الأسئلة الشائعة</h3>
          <div className="space-y-4">
            <details className="group p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-100 dark:border-neutral-700/50 cursor-pointer">
              <summary className="font-bold text-sm text-slate-700 dark:text-neutral-200">كيف يمكنني تقديم طلب إجازة؟</summary>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">من لوحة التحكم الخاصة بك، اضغط على زر "إرسال طلب جديد"، اختر نوع الطلب (إجازة) واكتب الوصف ثم اضغط إرسال.</p>
            </details>
            <details className="group p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-100 dark:border-neutral-700/50 cursor-pointer">
              <summary className="font-bold text-sm text-slate-700 dark:text-neutral-200">هل يمكنني تغيير كلمة المرور؟</summary>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">حالياً يتم تعيين كلمات المرور من قبل المدير، يرجى مراجعة الإدارة للطلب.</p>
            </details>
          </div>
        </div>
        
        <div className="bg-[var(--color-primary)] p-8 rounded-xl shadow-xl shadow-blue-500/10 text-white flex flex-col justify-center text-center">
            <h3 className="text-xl font-bold mb-2">تواصل مباشر</h3>
            <p className="text-blue-100 text-sm mb-6 opacity-90">يمكنك مراسلة المسؤول التقني مباشرة عبر البريد الإلكتروني أو رقم الهاتف الداخلي.</p>
            <div className="flex flex-col gap-3 font-bold text-sm">
                <div className="p-3 bg-white/10 rounded-lg border border-white/20">IT-SUPPORT@CORP.DZ</div>
                <div className="p-3 bg-white/10 rounded-lg border border-white/20">رقم داخلي: 101</div>
            </div>
        </div>
      </div>
    </Layout>
  );
}
