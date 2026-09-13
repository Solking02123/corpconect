import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { Megaphone, Plus, X, Image as ImageIcon, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/utils';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [issuer, setIssuer] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchAnnouncements();
    
    socketRef.current = io();
    socketRef.current.emit('join', user.id);
    
    socketRef.current.on('announcement', (ann) => {
      setAnnouncements(prev => [ann, ...prev]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user.id]);

  const fetchAnnouncements = async () => {
    try {
      const data = await api.get('/api/announcements');
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    if (issuer) formData.append('issuer', issuer);
    if (image) formData.append('image', image);

    try {
      await api.post('/api/announcements', formData);
      setShowModal(false);
      fetchAnnouncements();
      setTitle('');
      setContent('');
      setIssuer('');
      setImage(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-8" dir="rtl">
        <header className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-neutral-900 p-8 rounded-xl border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm relative overflow-hidden gap-6">
          <div className="relative z-10 text-center md:text-right">
            <h1 className="text-3xl font-bold flex items-center justify-center md:justify-start gap-3 text-slate-800 dark:text-white uppercase tracking-tight">
              <Megaphone className="text-[var(--color-primary)]" size={32} />
              الإعلانات والإدارة العامة
            </h1>
            <p className="text-slate-500 mt-2 text-sm font-medium tracking-wide">القرارات الرسمية والتعليمات التنظيمية للمؤسسة</p>
          </div>
          {user.role === 'manager' && (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-[var(--color-primary)] hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-500/10 active:scale-95 transition-all relative z-10 w-full md:w-auto justify-center"
            >
              <Plus size={20} />
              تحرير بلاغ جديد
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {announcements.map((ann) => (
            <motion.article 
              key={ann.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow group"
            >
              {ann.image_url && (
                <div className="aspect-[21/9] overflow-hidden relative">
                  <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 text-white/90 text-[10px] uppercase font-bold tracking-widest">
                    <span className="p-1 bg-[var(--color-primary)] rounded shadow-sm">
                        <Megaphone size={10} />
                    </span>
                    نشر بتاريخ {formatDate(ann.created_at)}
                  </div>
                </div>
              )}
              <div className="p-8 flex-1 flex flex-col">
                {!ann.image_url && (
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"></div>
                    {formatDate(ann.created_at)}
                  </div>
                )}
                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white leading-tight uppercase tracking-tight">{ann.title}</h3>
                <div className="text-slate-600 dark:text-neutral-400 mb-6 flex-1 text-sm leading-relaxed font-medium">
                   {ann.content}
                </div>
                <div className="pt-6 border-t border-slate-50 dark:border-neutral-800 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   <span className="flex items-center gap-1">
                       {ann.issuer || 'مؤسسة CorpConnect'}
                   </span>
                   {ann.image_url && (
                     <button 
                       onClick={() => setSelectedImage(ann.image_url)}
                       className="text-[var(--color-primary)] flex items-center gap-1 hover:underline cursor-pointer"
                     >
                       تفاصيل أكثر
                     </button>
                   )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Post Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.form 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onSubmit={handleSubmit}
                className="bg-white dark:bg-neutral-900 w-full max-w-xl rounded-2xl shadow-2xl p-8"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">نشر إعلان جديد</h2>
                  <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-neutral-500">عنوان الإعلان</label>
                    <input 
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-neutral-500">جهة الإصدار (اختياري)</label>
                    <input 
                      placeholder="مثلا: مكتب المدير، الموارد البشرية..."
                      value={issuer}
                      onChange={(e) => setIssuer(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-neutral-500">المحتوى</label>
                    <textarea 
                      required
                      rows={5}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-neutral-500">إرفاق صورة</label>
                    <div className="relative group">
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImage(e.target.files?.[0] || null)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <div className="w-full px-4 py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-400 flex items-center justify-center gap-2 group-hover:border-[var(--color-primary)] transition-colors">
                        <ImageIcon size={20} />
                        {image ? image.name : 'اختر صورة من الجهاز'}
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full mt-8 bg-[var(--color-primary)] hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10">
                  <Send size={20} />
                  نشر في الصفحة العامة
                </button>
              </motion.form>
            </div>
          )}
        </AnimatePresence>

        {/* Image Zoom Modal */}
        <AnimatePresence>
          {selectedImage && (
            <div 
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setSelectedImage(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center"
              >
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-12 right-0 text-white hover:text-red-500 transition-colors bg-white/10 p-2 rounded-full backdrop-blur-sm"
                >
                  <X size={32} />
                </button>
                <img 
                  src={selectedImage} 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10" 
                  referrerPolicy="no-referrer"
                  onClick={(e) => e.stopPropagation()}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
