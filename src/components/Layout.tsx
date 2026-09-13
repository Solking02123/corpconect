import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, MessageCircle, FileText, 
  Settings, LogOut, Bell, HelpCircle, User, Info, Check, Trash2, Clock as ClockIcon, Coins
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { 
    user, logout, notifications, clearNotification, unreadCountsByType,
    persistentNotifications, unreadNotificationsCount, markNotificationAsRead, markAllAsRead
  } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (pathname === '/chat') clearNotification('chat');
    if (pathname === '/announcements') clearNotification('announcements');
    if (pathname === '/') clearNotification('requests');
    if (pathname === '/profile') clearNotification('financials');
  }, [pathname, clearNotification]);

  const navItems = [
    { icon: LayoutDashboard, label: 'لوحة التحكم', path: '/', notification: notifications.requests, count: unreadCountsByType.requests },
    { icon: MessageCircle, label: 'الدردشة', path: '/chat', notification: notifications.chat, count: unreadCountsByType.chat },
    { icon: Bell, label: 'الإعلانات واللوائح', path: '/announcements', notification: notifications.announcements, count: unreadCountsByType.announcements },
    { icon: User, label: 'الملف الشخصي', path: '/profile', notification: notifications.financials, count: unreadCountsByType.financials },
    { icon: FileText, label: 'أرشيف الوثائق', path: '/documents' },
    { icon: HelpCircle, label: 'مركز المساعدة', path: '/help' },
    { icon: Settings, label: 'الإعدادات المتقدمة', path: '/settings' },
  ];

  if (user?.role === 'manager') {
    // Add manager specific items or sections if needed
  }

  return (
    <div className="flex h-screen bg-[var(--color-bg-main)] dark:bg-neutral-950 font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] flex flex-col h-full sticky top-0 overflow-y-auto shrink-0 transition-all">
        <div className="flex flex-col h-full">
          <div className="p-5 font-bold text-lg border-b border-white/10 mb-5 text-[var(--color-sidebar-brand)]">
            نظام الإدارة الذكي
          </div>

          <nav className="flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center gap-3 px-5 py-3 transition-colors duration-200 text-[0.95rem]
                  ${isActive 
                    ? 'bg-white/10 text-white font-medium' 
                    : 'text-[var(--color-sidebar-text)] hover:bg-white/10 hover:text-white'}
                `}
              >
                <div className="relative">
                  <item.icon size={18} />
                  {(item.count ?? 0) > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 rounded-full border border-[var(--color-sidebar-bg)] shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                      {item.count! > 9 ? '+9' : item.count}
                    </span>
                  ) : !!item.notification && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-[var(--color-sidebar-bg)] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                  )}
                </div>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-5 border-t border-white/10 mt-auto">
            <div className="flex items-center gap-3 mb-6 p-2 rounded-xl bg-white/5">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white border-2 border-primary overflow-hidden shrink-0">
                {user?.photo ? <img src={user.photo} className="w-full h-full object-cover" /> : user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-white">{user?.full_name}</p>
                <p className="text-[10px] uppercase opacity-60 tracking-wider font-bold">{user?.role === 'manager' ? 'المدير العام' : 'موظف'}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg transition-all font-bold uppercase tracking-widest"
            >
              <LogOut size={16} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-[64px] bg-white dark:bg-neutral-900 border-b border-[var(--color-border-subtle)] dark:border-neutral-800 flex items-center justify-between px-8 shrink-0">
          <div>
            <h2 className="text-[1.1rem] font-bold text-slate-800 dark:text-neutral-100 uppercase tracking-tight">
              {user?.role === 'manager' ? 'مرحباً بك، المدير العام' : `مرحباً بك، ${user?.full_name}`}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative mr-2" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all relative group"
              >
                <Bell size={20} className="text-slate-400 dark:text-neutral-500 group-hover:text-[var(--color-primary)] transition-colors" />
                {(unreadNotificationsCount > 0 || Object.values(notifications).some(v => !!v)) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute left-[-50px] sm:left-0 top-full mt-2 w-80 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-[var(--color-border-subtle)] dark:border-neutral-800 z-[100] overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center bg-slate-50/50 dark:bg-neutral-800/50">
                      <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">الإشعارات الواردة</h3>
                      {unreadNotificationsCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md font-bold hover:bg-blue-100 transition-colors uppercase"
                        >
                          قراءة الكل
                        </button>
                      )}
                    </div>
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                      {(!persistentNotifications || persistentNotifications.length === 0) ? (
                        <div className="p-10 text-center text-slate-400">
                          <Bell size={32} className="mx-auto mb-3 opacity-20" />
                          <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">لا توجد إشعارات حالياً</p>
                        </div>
                      ) : (
                        persistentNotifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              if (n.link) navigate(n.link);
                              markNotificationAsRead(n.id);
                              setShowNotifications(false);
                            }}
                            className={`p-4 border-b border-slate-50 dark:border-neutral-800/50 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer relative ${!n.is_read ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}
                          >
                            {!n.is_read && <div className="absolute top-5 left-3 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                            <div className="flex gap-3">
                              <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${
                                n.type === 'request' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                                n.type === 'message' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                n.type === 'financial' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                                'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                              }`}>
                                {n.type === 'request' ? <FileText size={16} /> : 
                                 n.type === 'message' ? <MessageCircle size={16} /> : 
                                 n.type === 'financial' ? <Coins size={16} /> :
                                 <Info size={16} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight mb-1">{n.title}</p>
                                <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">{n.content}</p>
                                <p className="text-[9px] text-slate-400 mt-1.5 flex items-center gap-1 font-mono">
                                  <ClockIcon size={10} /> {n.created_at ? formatDate(n.created_at) : 'الآن'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {persistentNotifications.length > 0 && (
                      <div className="p-3 bg-slate-50 dark:bg-neutral-800/50 text-center border-t border-slate-100 dark:border-neutral-800">
                        <button 
                          onClick={() => { navigate('/announcements'); setShowNotifications(false); }}
                          className="text-[10px] font-bold text-slate-500 hover:text-[var(--color-primary)] uppercase tracking-widest transition-colors font-sans"
                        >
                          عرض كافة الإشعارات
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-neutral-400 hidden sm:block">{user?.full_name}</span>
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-neutral-800 border-2 border-primary overflow-hidden">
               {user?.photo && <img src={user.photo} className="w-full h-full object-cover" />}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
