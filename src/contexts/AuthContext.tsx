import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface AuthContextType {
  user: any;
  login: (data: any) => void;
  logout: () => void;
  loading: boolean;
  socket: Socket | null;
  notifications: {
    chat: boolean;
    announcements: boolean;
    requests: boolean;
    financials: boolean;
  };
  persistentNotifications: any[];
  unreadNotificationsCount: number;
  unreadCountsByType: {
    chat: number;
    announcements: number;
    requests: number;
    financials: number;
  };
  fetchNotifications: () => void;
  markNotificationAsRead: (id: number) => void;
  markAllAsRead: () => void;
  clearNotification: (key: keyof AuthContextType['notifications']) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState({
    chat: false,
    announcements: false,
    requests: false,
    financials: false
  });
  const [persistentNotifications, setPersistentNotifications] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get('/api/notifications');
      setPersistentNotifications(data);
    } catch (err) {
      console.error('Fetch Notifications Error:', err);
    }
  }, []);

  const markNotificationAsRead = async (id: number) => {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setPersistentNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/api/notifications/read-all', {});
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const unreadNotificationsCount = useMemo(() => {
    return persistentNotifications.filter(n => !n.is_read).length;
  }, [persistentNotifications]);

  const unreadCountsByType = useMemo(() => {
    const counts = { chat: 0, announcements: 0, requests: 0, financials: 0 };
    persistentNotifications.filter(n => !n.is_read).forEach(n => {
      if (n.type === 'message') counts.chat++;
      else if (n.type === 'announcement') counts.announcements++;
      else if (n.type === 'request') counts.requests++;
      else if (n.type === 'financial') counts.financials++;
    });
    return counts;
  }, [persistentNotifications]);

  const clearNotification = useCallback((key: keyof typeof notifications) => {
    setNotifications(prev => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: false };
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await api.get('/api/me');
          setUser(userData);
          fetchNotifications();
        } catch (e) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (user) {
      if (!socketRef.current) {
        socketRef.current = io();
      }
      socketRef.current.emit('join', user.id);

      socketRef.current.on('user_status', ({ userId, is_online, last_seen }) => {
        if (userId === user.id) {
          setUser((prev: any) => prev ? { ...prev, is_online, last_seen } : null);
        }
      });

      socketRef.current.on('announcement', (ann) => {
        setNotifications(prev => ({ ...prev, announcements: true }));
        fetchNotifications();
        toast.info('إعلان جديد', {
          description: ann.title,
          action: {
            label: 'عرض',
            onClick: () => window.location.href = '/announcements'
          }
        });
      });

      socketRef.current.on('request_update', (data) => {
        if (data.sender_id == user.id) {
          setNotifications(prev => ({ ...prev, requests: true }));
          fetchNotifications();
          const statusText = data.status === 'approved' ? 'مقبول' : 'مرفوض';
          const typeText = data.type === 'vacation' ? 'طلب عطلة' : data.type === 'advance' ? 'طلب سلفة' : 'طلب مهمة';
          toast(data.status === 'approved' ? 'تم قبول طلبك' : 'تم رفض طلبك', {
            description: `${typeText}: ${statusText}`,
            icon: data.status === 'approved' ? '✅' : '❌'
          });
        }
      });

      socketRef.current.on('request_sent', (data) => {
        const canSee = user.role === 'manager' || (user.role === 'accountant' && data.type === 'salary_statement');
        if (canSee) {
          setNotifications(prev => ({ ...prev, requests: true }));
          fetchNotifications();
          toast.info('طلب جديد', {
            description: `قام ${data.sender_name} بإرسال طلب جديد للمراجعة`,
          });
        }
      });

      socketRef.current.on('message', (msg) => {
        if (msg.sender_id != user.id && (!msg.receiver_id || msg.receiver_id == user.id)) {
          setNotifications(prev => ({ ...prev, chat: true }));
          fetchNotifications(); // Add this line
          if (msg.is_urgent) {
            toast.error('رسالة عاجلة', {
              description: `${msg.sender_name}: ${msg.content}`,
              duration: 10000,
            });
          } else {
            toast.message('رسالة جديدة', {
              description: `${msg.sender_name}: ${msg.content}`,
            });
          }
        }
      });

      socketRef.current.on('financial_update', (data) => {
        if (data.user_id == user.id || user.role === 'manager') {
          setNotifications(prev => ({ ...prev, financials: true }));
          fetchNotifications();
          toast.success('تحديث مالي', {
            description: user.role === 'manager' ? 'تم تحديث سجلات مالية لموظف' : 'تم تحديث سجلاتك المالية (راتب/علاوات)',
          });
        }
      });

      socketRef.current.on('new_notification', (data) => {
        if (data.userId == user.id) {
          fetchNotifications();
        }
      });
    } else {
      if (socketRef.current) {
        socketRef.current.off('user_status');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
    return () => {
      socketRef.current?.off('user_status');
      socketRef.current?.off('announcement');
      socketRef.current?.off('request_update');
      socketRef.current?.off('request_sent');
      socketRef.current?.off('message');
      socketRef.current?.off('financial_update');
      socketRef.current?.off('new_notification');
    };
  }, [user, fetchNotifications]);

  const login = useCallback((data: any) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    fetchNotifications();
  }, [fetchNotifications]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/logout', {});
    } catch (e) {
      console.error('Logout failed', e);
    }
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ 
    user, 
    login, 
    logout, 
    loading, 
    socket: socketRef.current, 
    notifications, 
    clearNotification,
    persistentNotifications,
    unreadNotificationsCount,
    unreadCountsByType,
    fetchNotifications,
    markNotificationAsRead,
    markAllAsRead
  }), [user, loading, notifications, clearNotification, persistentNotifications, unreadNotificationsCount, fetchNotifications, markNotificationAsRead, markAllAsRead]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
