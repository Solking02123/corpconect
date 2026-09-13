import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { 
  FileText, Upload, Trash2, Download, Search, 
  FileCheck, Shield, Clock, Plus, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../lib/utils';

interface Document {
  id: number;
  user_id: number;
  doc_name: string;
  doc_type: string;
  file_url: string;
  created_at: string;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  const [newDoc, setNewDoc] = useState({
    name: '',
    type: 'contract',
    file: null as File | null
  });

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/employees/${user?.id}/documents`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      toast.error('فشل تحميل الوثائق');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.file || !newDoc.name) {
      toast.error('يرجى ملأ جميع الحقول');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('doc_name', newDoc.name);
    formData.append('doc_type', newDoc.type);
    formData.append('document', newDoc.file);

    try {
      const res = await fetch(`/api/employees/${user?.id}/documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      
      if (res.ok) {
        toast.success('تم رفع الوثيقة بنجاح');
        setIsUploadModalOpen(false);
        setNewDoc({ name: '', type: 'contract', file: null });
        fetchDocuments();
      } else {
        toast.error('فشل رفع الوثيقة');
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء الرفع');
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.doc_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.doc_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">أرشيفي الرقمي</h1>
          <p className="text-slate-500 dark:text-neutral-400 mt-1">إدارة وحفظ وثائقك الرسمية بأمان</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all font-medium"
          >
            <Plus size={18} />
            رفع وثيقة جديدة
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'إجمالي الوثائق', value: documents.length, icon: FileText, color: 'blue' },
          { label: 'وثائق معتمدة', value: documents.filter(d => d.doc_type === 'contract').length, icon: FileCheck, color: 'emerald' },
          { label: 'سعة التخزين', value: '45%', icon: Shield, color: 'amber' }
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900/30 flex items-center justify-center text-${stat.color}-600 dark:text-${stat.color}-400`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-neutral-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="البحث في الوثائق..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-neutral-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {['contract', 'id', 'certificate', 'other'].map((type) => (
              <button 
                key={type}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-50 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap"
              >
                {type === 'contract' ? 'عقود' : type === 'id' ? 'هوية' : type === 'certificate' ? 'شهادات' : 'أخرى'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-neutral-800/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">اسم الوثيقة</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">النوع</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">تاريخ الرفع</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-medium text-slate-500">جاري تحميل الوثائق...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <FileText size={48} />
                      <p className="text-sm font-medium">لا توجد وثائق متاحة حالياً</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{doc.doc_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">#{doc.id.toString().padStart(4, '0')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                        {doc.doc_type === 'contract' ? 'عقد عمل' : doc.doc_type === 'id' ? 'بطاقة هوية' : doc.doc_type === 'certificate' ? 'شهادة عليا' : 'أخرى'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400">
                        <Clock size={14} className="opacity-60" />
                        {formatDate(doc.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <a 
                          href={doc.file_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          title="عرض الوثيقة"
                        >
                          <ExternalLink size={18} />
                        </a>
                        <a 
                          href={doc.file_url} 
                          download 
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                          title="تحميل"
                        >
                          <Download size={18} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-slate-100 dark:border-neutral-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">رفع وثيقة جديدة</h3>
              <p className="text-sm text-slate-500">سيتم حفظ الوثيقة بشكل آمن في أرشيفك</p>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">اسم الوثيقة</label>
                <input 
                  type="text" 
                  required
                  placeholder="مثال: بطاقة التعريف الوطنية"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  value={newDoc.name}
                  onChange={(e) => setNewDoc({...newDoc, name: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">نوع الوثيقة</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none appearance-none"
                  value={newDoc.type}
                  onChange={(e) => setNewDoc({...newDoc, type: e.target.value})}
                >
                  <option value="contract">عقد عمل</option>
                  <option value="id">بطاقة هوية / جواز سفر</option>
                  <option value="certificate">شهادة علمية</option>
                  <option value="other">وثيقة أخرى</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">الملف</label>
                <div className="relative group">
                  <input 
                    type="file" 
                    required
                    onChange={(e) => setNewDoc({...newDoc, file: e.target.files?.[0] || null})}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full px-4 py-6 bg-slate-50 dark:bg-neutral-800 border-2 border-dashed border-slate-200 dark:border-neutral-700 rounded-2xl flex flex-col items-center gap-2 group-hover:border-[var(--color-primary)] group-hover:bg-blue-50/10 transition-all">
                    <Upload className="text-slate-400 group-hover:text-[var(--color-primary)]" size={32} />
                    <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                      {newDoc.file ? newDoc.file.name : 'اسحب الملف هنا أو انقر للإختيار'}
                    </span>
                    <span className="text-[10px] text-slate-400 italic">PDF, JPG, PNG (أقصى حجم 5MB)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {uploading ? 'جاري الرفع...' : 'رفع الوثيقة'}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-6 py-3 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
