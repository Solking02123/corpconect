import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { LogIn, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/login', { username, password });
      login(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-100 dark:bg-neutral-950 font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-neutral-900 shadow-xl rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
      >
        <div className="p-8 pb-4 text-center">
          <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-900/30 text-[var(--color-primary)] rounded-xl mb-4">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 uppercase tracking-tight">نظام تواصل الشركات</h1>
          <p className="text-slate-500 dark:text-neutral-400 text-sm font-medium">أدخل بيانات الاعتماد للوصول إلى لوحة التحكم</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mr-1">اسم المستخدم</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white"
              placeholder="مثلا: manager"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mr-1">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-primary)] hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all shadow-md shadow-blue-500/10"
          >
            {loading ? 'جاري تسجيل الدخول...' : (
              <>
                <LogIn size={20} />
                <span>دخول النظام</span>
              </>
            )}
          </button>
        </form>

        <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            للمساعدة، اتصل بمسؤول النظام
          </p>
        </div>
      </motion.div>
      
      <div className="mt-8 text-neutral-400 dark:text-neutral-600 text-[10px] uppercase tracking-[0.2em] font-mono">
        CorpConnect Suite v1.0.0 &copy; 2026
      </div>
    </div>
  );
}
