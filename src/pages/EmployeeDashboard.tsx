import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FilePlus, Clock, CheckCircle, XCircle, 
  Send, Paperclip, MessageSquare, Bell, TrendingUp,
  Receipt, Download, Printer
} from 'lucide-react';

import { motion } from 'motion/react';
import { formatDate } from '../lib/utils';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [type, setType] = useState('vacation');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const month = new Date().toISOString().split('T')[0].substring(0, 7);
      const [reqs, att, pay] = await Promise.all([
        api.get('/api/requests'),
        api.get('/api/attendance-stats'),
        api.get(`/api/payroll?month=${month}`)
      ]);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setAttendance(Array.isArray(att) ? att : []);
      setPayroll(Array.isArray(pay) ? pay : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSalaryStatement = () => {
    // Current month payroll for the user
    // The API returns an array for the specified month
    const myPayroll = Array.isArray(payroll) ? payroll.find(p => p.user_id === user?.id) : null;
    
    if (!myPayroll) {
      toast.error('لا يوجد كشف راتب متاح لهذا الشهر بعد');
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246);
    doc.text('CORPORATE SALARY STATEMENT', 105, 20, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 25, 190, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Reference: PAY-${myPayroll.id}-${myPayroll.month}`, 20, 32);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 190, 32, { align: 'right' });

    // Employee Info
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Employee Information', 20, 45);
    
    doc.setFontSize(11);
    doc.text(`Full Name: ${user?.full_name}`, 20, 52);
    doc.text(`Registration No: ${user?.registration_number}`, 20, 58);
    doc.text(`Rank: ${user?.rank}`, 20, 64);
    doc.text(`Month: ${myPayroll.month}`, 190, 52, { align: 'right' });

    // Table
    autoTable(doc, {
      startY: 75,
      head: [['Description', 'Amount (DZD)']],
      body: [
        ['Base Salary', myPayroll.base_salary.toLocaleString()],
        ['Overtime Pay', myPayroll.overtime_pay.toLocaleString()],
        ['Bonuses & Additions', myPayroll.bonuses.toLocaleString()],
        ['Deductions', `-${myPayroll.deductions.toLocaleString()}`],
        [{ content: 'NET SALARY', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
         { content: myPayroll.net_salary.toLocaleString() + ' DZD', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('Note: This is an automatically generated document from the ERP System.', 105, finalY + 20, { align: 'center' });
    doc.text('© Corporate ERP Intelligence', 105, finalY + 28, { align: 'center' });

    doc.save(`Salary_Statement_${user?.registration_number}_${myPayroll.month}.pdf`);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('type', type);
    formData.append('description', description);
    if (files) {
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
    }

    try {
      await api.post('/api/requests', formData);
      setShowRequestForm(false);
      fetchData();
      setDescription('');
      setFiles(null);
      toast.success('تم إرسال الطلب بنجاح');
    } catch (err: any) {
      toast.error(err.message || 'فشل إرسال الطلب');
    }
  };

  if (loading) return <Layout>جاري التحميل...</Layout>;

  return (
    <Layout>
      <div className="space-y-8" dir="rtl">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">مرحباً، {user?.full_name} 👋</h1>
            <p className="text-slate-500 mt-1 font-medium">رقم التسجيل: <span className="font-mono text-[var(--color-primary)] font-bold">{user?.registration_number}</span></p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
             <NavLink to="/chat" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-neutral-900 border border-[var(--color-border-subtle)] dark:border-neutral-800 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all">
                <MessageSquare size={18} />
                الدردشة
             </NavLink>
             <NavLink to="/announcements" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-neutral-900 border border-[var(--color-border-subtle)] dark:border-neutral-800 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all">
                <Bell size={18} />
                الإعلانات
             </NavLink>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                    <Clock size={24} />
                 </div>
                 <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">ساعات العمل اليوم</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-neutral-100">
                       {attendance[0]?.clock_in ? 
                         `${Math.floor((new Date().getTime() - new Date(attendance[0].clock_in).getTime()) / (1000 * 60 * 60))} ساعة` : 
                         '0 ساعة'}
                    </p>
                 </div>
              </div>
           </div>
           <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl">
                    <TrendingUp size={24} />
                 </div>
                 <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">العمل الإضافي (هذا الشهر)</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-neutral-100">
                       {Array.isArray(attendance) ? attendance.reduce((acc, curr) => acc + (curr.overtime_minutes || 0), 0) : 0} دقيقة
                    </p>
                 </div>
              </div>
           </div>
           <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                    <CheckCircle size={24} />
                 </div>
                 <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">أيام الحضور</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-neutral-100">{(Array.isArray(attendance) ? attendance : []).length} أيام</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Financial Summary Section */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden mb-8">
           <div className="p-6 border-b border-slate-100 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Receipt size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight">ملخص كشف الراتب</h3>
                    <p className="text-xs text-slate-500">الحالة المالية لهذا الشهر الحالي</p>
                  </div>
               </div>
               <button 
                  onClick={handleExportSalaryStatement}
                  className="flex items-center gap-2 bg-slate-900 dark:bg-neutral-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-black transition-all"
               >
                  <Printer size={18} />
                  تحميل كشف الراتب (PDF)
               </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-slate-100 dark:divide-neutral-800">
               {[
                  { label: 'الراتب الأساسي', value: (user?.salary || 0).toLocaleString() + ' دج', color: 'slate' },
                  { label: 'العمل الإضافي', value: (Array.isArray(payroll) && payroll.find(p => p.user_id === user?.id)?.overtime_pay.toLocaleString() || '0') + ' دج', color: 'blue' },
                  { label: 'إجمالي المنح', value: (Array.isArray(payroll) && payroll.find(p => p.user_id === user?.id)?.bonuses.toLocaleString() || '0') + ' دج', color: 'emerald' },
                  { label: 'صافي الإستلام', value: (Array.isArray(payroll) && payroll.find(p => p.user_id === user?.id)?.net_salary.toLocaleString() || user?.salary?.toLocaleString() || '0') + ' دج', color: 'blue' }
               ].map((stat) => (
                  <div key={stat.label} className="p-6 text-center">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                     <p className={`text-lg font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight`}>{stat.value}</p>
                  </div>
               ))}
            </div>
         </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Area: Requests */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-neutral-900 rounded-xl border border-[var(--color-border-subtle)] dark:border-neutral-800 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">طلباتي</h3>
                <button 
                  onClick={() => setShowRequestForm(!showRequestForm)}
                  className="text-sm bg-[var(--color-primary)] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-all"
                >
                  <FilePlus size={18} />
                  إرسال طلب جديد
                </button>
              </div>

              {showRequestForm && (
                <motion.form 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onSubmit={handleSubmitRequest}
                  className="mb-8 p-6 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700 space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase text-slate-500 mr-1">نوع الطلب</label>
                      <select 
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg outline-none"
                      >
                        <option value="vacation">طلب إجازة</option>
                        <option value="mission">مهمة عمل</option>
                        <option value="interview">طلب مقابلة</option>
                        <option value="salary_statement">طلب كشف راتب</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase text-slate-500 mr-1">إرفاق وثائق</label>
                      <div className="relative">
                        <input 
                          type="file" 
                          multiple 
                          onChange={(e) => setFiles(e.target.files)}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                        <div className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-dashed border-slate-300 dark:border-neutral-600 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                           <Paperclip size={14} />
                           {files ? `${files.length} ملفات مختارة` : 'اختر ملفات...'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-slate-500 mr-1">وصف الطلب</label>
                    <textarea 
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg outline-none resize-none"
                      placeholder="اشرح تفاصيل طلبك هنا..."
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowRequestForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500">إلغاء</button>
                    <button type="submit" className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                      <Send size={16} />
                      إرسال الطلب
                    </button>
                  </div>
                </motion.form>
              )}

              <div className="space-y-4">
                {requests.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Clock size={48} className="mx-auto mb-4 opacity-20" />
                    <p>لا توجد طلبات سابقة</p>
                  </div>
                )}
                {requests.map((req) => (
                  <div key={req.id} className="p-4 bg-slate-50/50 dark:bg-neutral-800/50 rounded-xl border border-slate-100 dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 dark:text-neutral-100">
                          {req.type === 'vacation' ? 'طلب إجازة' : req.type === 'mission' ? 'مهمة عمل' : req.type === 'salary_statement' ? 'كشف راتب' : 'طلب مقابلة'}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(req.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-neutral-400 truncate max-w-md">{req.description}</p>
                      {req.manager_comment && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs rounded border border-blue-100 dark:border-blue-800/30">
                          <span className="font-bold">رد المدير:</span> {req.manager_comment}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-[10px] font-bold uppercase tracking-widest">
                      {req.status === 'pending' ? (
                        <span className="text-amber-500 flex items-center gap-1"><Clock size={12} /> قيد الانتظار</span>
                      ) : req.status === 'approved' ? (
                        <span className="text-green-500 flex items-center gap-1"><CheckCircle size={12} /> تم القبول</span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1"><XCircle size={12} /> مرفوض</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Area: Personal Info */}
          <div className="space-y-6">
            <section className="bg-white dark:bg-neutral-900 rounded-xl border border-[var(--color-border-subtle)] dark:border-neutral-800 p-8 shadow-sm text-center">
              <div className="w-24 h-24 rounded-full bg-[var(--color-primary)] mx-auto mb-4 overflow-hidden shadow-md border-4 border-white dark:border-neutral-800">
                {user?.photo ? <img src={user.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">{user?.full_name?.charAt(0)}</div>}
              </div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-white leading-none mb-2">{user?.full_name}</h4>
              <p className="text-sm text-slate-500 font-medium mb-6 uppercase tracking-wider">{user?.rank || 'موظف'}</p>
              
              <div className="grid grid-cols-2 gap-3 text-right">
                <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-100 dark:border-neutral-800/50">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">الرتبة</p>
                  <p className="text-xs font-bold truncate">{user?.rank || 'غير محدد'}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-100 dark:border-neutral-800/50">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">الحالة</p>
                  <p className={`text-xs font-bold ${
                    user?.is_online === 1 ? 'text-green-500' : 
                    user?.status === 'vacation' ? 'text-rose-500' :
                    user?.status === 'mission' ? 'text-blue-500' : 'text-slate-400'
                  }`}>
                    {user?.is_online === 1 ? 'نشط' : 
                     user?.status === 'vacation' ? 'في إجازة' : 
                     user?.status === 'mission' ? 'في مهمة' : 'خارج العمل'}
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-[var(--color-primary)] rounded-xl p-6 text-white shadow-xl shadow-blue-500/10 relative overflow-hidden group">
              <div className="relative z-10">
                <h5 className="font-bold mb-2">هل تحتاج للمساعدة؟</h5>
                <p className="text-sm text-blue-100 mb-4 opacity-90">يمكنك المراسلة عبر مركز المساعدة في أي وقت.</p>
                <button className="w-full bg-white text-blue-600 font-bold py-2.5 rounded-lg text-sm transition-all active:scale-95 shadow-lg">ارسل استفسار</button>
              </div>
              <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
