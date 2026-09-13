import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Send, Paperclip, FileText, Download, User as UserIcon, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatPage() {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    
    if (socket) {
      socket.on('message', (msg) => {
        setMessages(prev => [...prev, msg]);
      });
    }

    return () => {
      socket?.off('message');
    };
  }, [socket]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const data = await api.get('/api/messages');
    setMessages(data);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input && !file) return;

    const formData = new FormData();
    formData.append('content', input);
    formData.append('is_urgent', isUrgent ? '1' : '0');
    if (file) formData.append('file', file);

    try {
      await api.post('/api/messages', formData);
      setInput('');
      setFile(null);
      setIsUrgent(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'فشل إرسال الرسالة');
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-160px)] bg-white dark:bg-neutral-900 rounded-xl border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm overflow-hidden" dir="rtl">
        <header className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white shadow-sm">
               <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight">غرفة الدردشة المركزية</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">تواصل مباشر وآمن بين أعضاء المؤسسة</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50/30 dark:bg-neutral-900/30">
          {messages.map((msg) => (
            <div 
              key={msg.id || Math.random()} 
              className={`flex ${msg.sender_id === user?.id ? 'justify-start' : 'justify-end'} group`}
            >
              <div className={`flex flex-col max-w-[70%] ${msg.sender_id === user?.id ? 'items-start' : 'items-end'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-bold text-neutral-400">{msg.sender_name || 'مستخدم'}</span>
                  <span className="text-[8px] text-neutral-400">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ar-DZ') : ''}</span>
                </div>
                <div className={`
                  p-4 rounded-xl shadow-sm border
                  ${msg.sender_id === user?.id 
                    ? 'bg-[var(--color-primary)] text-white border-blue-600 rounded-tr-none' 
                    : 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-100 border-slate-200 dark:border-neutral-700 rounded-tl-none'}
                  ${msg.is_urgent ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-neutral-900 border-red-500 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100' : ''}
                `}>
                  {msg.is_urgent && (
                    <div className="flex items-center gap-1 mb-2 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest animate-pulse">
                      🚨 رسالة عاجلة
                    </div>
                  )}
                  {msg.content && <p className="text-sm leading-relaxed font-medium">{msg.content}</p>}
                  {msg.file_url && (
                    <div className={`mt-2 p-3 rounded-lg flex items-center gap-3 border ${msg.sender_id === user.id ? 'bg-white/10 border-white/20' : 'bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800'}`}>
                      <FileText size={20} className={msg.sender_id === user.id ? 'text-white' : 'text-blue-500'} />
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-[10px] font-bold truncate">ملف وثيقة مرفق</p>
                        <a href={msg.file_url} download className="text-[10px] underline opacity-80 hover:opacity-100 flex items-center gap-1 font-bold">
                          <Download size={10} /> تحميل الآن
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-3 mb-3">
            <button 
              type="button"
              onClick={() => setIsUrgent(!isUrgent)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isUrgent ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-neutral-800 dark:border-neutral-700'}`}
            >
              🚨 {isUrgent ? 'إلغاء الحالة العاجلة' : 'تمييز كرسالة عاجلة'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button type="button" className={`p-3 rounded-xl transition-all ${file ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400'}`}>
                <Paperclip size={20} />
              </button>
            </div>
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالتك وتواصل مع الزملاء..."
              className="flex-1 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 focus:border-[var(--color-primary)] p-3.5 rounded-xl outline-none text-sm transition-all shadow-inner"
            />
            <button 
              type="submit"
              className="p-3.5 bg-[var(--color-primary)] hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/10 active:scale-95 transition-all flex items-center justify-center font-bold"
            >
              <Send size={20} />
            </button>
          </div>
          {file && (
            <div className="mt-2 px-4 py-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full flex items-center gap-1 border border-blue-100">
                <Paperclip size={10} /> {file.name}
              </span>
              <button onClick={() => setFile(null)} className="text-red-500 text-[10px] font-bold hover:underline">إلغاء الملف</button>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
}
