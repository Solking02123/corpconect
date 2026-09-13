import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useParams } from 'react-router-dom';
import { 
  User, Mail, Shield, Briefcase, Calendar, MapPin, DollarSign, 
  AlertTriangle, Clock, Lock, Key, FileText, Upload, Trash2, ExternalLink,
  Archive, Award, CheckCircle2, History, Coins, Receipt, Printer, Plus, Phone
} from 'lucide-react';
import { formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function ProfilePage() {
  const { id } = useParams();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Archive Form State
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('ID');
  const [docFile, setDocFile] = useState<File | null>(null);

  // Performance Modals
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [evalData, setEvalData] = useState({ rating: 5, notes: '', kpis: { efficiency: 80, commitment: 80, teamwork: 80 } });
  const [goalData, setGoalData] = useState({ title: '', description: '', target_date: '' });
  const [selectedPayrollForPrint, setSelectedPayrollForPrint] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
    fetchDocuments();
    fetchFinancials();
    fetchPerformance();
  }, [id]);

  const fetchPerformance = async () => {
    try {
      const isManager = authUser?.role === 'manager';
      const targetId = id || authUser?.id;
      const isOwnProfile = !id || parseInt(id) === authUser?.id;

      if (targetId && (isManager || isOwnProfile)) {
        const [g, e] = await Promise.all([
          api.get(`/api/employees/${targetId}/goals`).catch(() => []),
          api.get(`/api/employees/${targetId}/evaluations`).catch(() => [])
        ]);
        setGoals(Array.isArray(g) ? g : []);
        setEvaluations(Array.isArray(e) ? e : []);
      }
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
    }
  };

  const fetchFinancials = async () => {
    try {
      const isManager = authUser?.role === 'manager';
      const isAccountant = authUser?.role === 'accountant';
      const targetId = id || authUser?.id;
      const isOwnProfile = !id || parseInt(id) === authUser?.id;

      if (targetId) {
        // Accountant can only see payroll for others, and everything for themselves
        const canSeeAdjustments = isManager || isOwnProfile;
        const canSeePayroll = isManager || isAccountant || isOwnProfile;

        const [adj, pay] = await Promise.all([
          canSeeAdjustments ? api.get(`/api/employees/${targetId}/adjustments`).catch(() => []) : Promise.resolve([]),
          canSeePayroll ? api.get(`/api/employees/${targetId}/payroll`).catch(() => []) : Promise.resolve([])
        ]);
        setAdjustments(adj);
        setPayroll(pay);
      }
    } catch (err) {
      console.error('Failed to fetch financials:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const isManager = authUser?.role === 'manager';
      const targetId = id || authUser?.id;
      const isOwnProfile = !id || parseInt(id) === authUser?.id;

      if (targetId && (isManager || isOwnProfile)) {
        const data = await api.get(`/api/employees/${targetId}/documents`);
        setDocuments(data);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('doc_name', docName);
    formData.append('doc_type', docType);
    formData.append('document', docFile);

    try {
      await api.post(`/api/employees/${id || authUser?.id}/documents`, formData);
      setDocName('');
      setDocFile(null);
      fetchDocuments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (confirm('هل أنت متأكد من حذف هذه الوثيقة؟')) {
      try {
        await api.delete(`/api/documents/${docId}`);
        fetchDocuments();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('كلمات المرور الجديدة غير متطابقة');
      return;
    }

    try {
      await api.post('/api/manager/change-password', {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordSuccess(true);
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordError(err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
    }
  };

  const handleAddEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/employees/${id}/evaluations`, {
        ...evalData,
        date: new Date().toISOString().split('T')[0]
      });
      setShowEvalModal(false);
      setEvalData({ rating: 5, notes: '', kpis: { efficiency: 80, commitment: 80, teamwork: 80 } });
      fetchPerformance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/employees/${id}/goals`, goalData);
      setShowGoalModal(false);
      setGoalData({ title: '', description: '', target_date: '' });
      fetchPerformance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const endpoint = id ? `/api/users/${id}` : '/api/me';
      const data = await api.get(endpoint);
      setUser(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPayroll = (p: any) => {
    setSelectedPayrollForPrint(p);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (loading) return <Layout>جاري التحميل...</Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8" dir="rtl">
        <header className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 rounded-xl bg-[var(--color-primary)] overflow-hidden shadow-md relative group border-4 border-white dark:border-neutral-800">
            {user?.photo ? <img src={user.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white text-5xl font-bold">{user?.full_name?.charAt(0)}</div>}
          </div>
          <div className="text-center md:text-right flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-800 dark:text-white">{user?.full_name}</h1>
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-[var(--color-primary)] text-[10px] font-bold rounded-full uppercase tracking-widest w-fit mx-auto md:mx-0">
                {user?.role === 'manager' ? 'المدير العام' : 'موظف مؤسسة'}
              </span>
            </div>
            <p className="text-slate-500 font-mono text-sm tracking-widest font-bold">رقم تسجيل الموظف: {user?.registration_number || 'AD-00000'}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
              <User size={20} className="text-[var(--color-primary)]" />
              المعلومات الشخصية
            </h3>
            <div className="space-y-6">
              <InfoItem icon={Clock} label="آخر ظهور للنظام" value={user?.last_seen ? formatDate(user.last_seen) : 'لم يسجل دخول بعد'} />
              <InfoItem icon={Calendar} label="تاريخ الميلاد" value={user?.dob || 'غير متوفر'} />
              <InfoItem icon={MapPin} label="مكان الميلاد" value={user?.pob || 'غير متوفر'} />
              <div className="pt-4 border-t border-slate-100 dark:border-neutral-800 space-y-6">
                <InfoItem icon={Shield} label="الرتبة الوظيفية" value={user?.rank || 'غير متوفر'} />
                <div className="grid grid-cols-1 gap-6 pt-4">
                  <InfoItem icon={Mail} label="البريد الإلكتروني" value={user?.email || 'غير متوفر'} />
                  <InfoItem icon={Phone} label="رقم الهاتف" value={user?.phone || 'غير متوفر'} />
                  <InfoItem icon={MapPin} label="عنوان السكن (البلدية/الولاية)" value={user?.address || 'غير متوفر'} />
                </div>
              </div>
              {user?.status === 'vacation' && (
                <div className="col-span-full p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800/30">
                  <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400">
                    <Clock size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">وضعية الإجازة الحالية</span>
                  </div>
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    من {user.vacation_start} إلى {user.vacation_end}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
              <Briefcase size={20} className="text-[var(--color-primary)]" />
              المعلومات الإدارية
            </h3>
            <div className="space-y-6">
              <InfoItem icon={Briefcase} label="المسمى الوظيفي" value={user?.job_title || 'غير محدد'} />
              <InfoItem icon={Archive} label="القسم / المصالح" value={user?.department || 'غير محدد'} />
              <InfoItem icon={Calendar} label="تاريخ التعيين" value={user?.hiring_date || 'غير محدد'} />
              <InfoItem icon={Award} label="نوع العقد" value={user?.contract_type || 'غير محدد'} />
              <div className="pt-4 border-t border-slate-100 dark:border-neutral-800">
                <InfoItem icon={DollarSign} label="الراتب الشهري" value={`${user?.salary || 0} دج`} />
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                  <AlertTriangle size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">السجل التأديبي</span>
                </div>
                {(() => {
                  try {
                    const penaltyList = user?.penalties ? JSON.parse(user.penalties) : [];
                    if (Array.isArray(penaltyList) && penaltyList.length > 0) {
                      return (
                        <div className="space-y-3">
                          {penaltyList.map((p: any, i: number) => (
                            <div key={i} className="text-xs border-b border-red-100 last:border-0 pb-2 mb-2">
                              <p className="text-red-700 dark:text-red-400 font-bold">{p.text}</p>
                              <p className="text-[10px] opacity-60">{formatDate(p.date)}</p>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) {
                    console.error("Error parsing penalties:", e);
                  }
                  return <p className="text-sm text-slate-600 dark:text-neutral-400 font-medium">لا توجد عقوبات مسجلة في حقك حالياً.</p>;
                })()}
              </div>
            </div>
          </section>
        </div>

        {/* Digital Archive Section */}
        <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
                <FileText size={20} className="text-blue-600" />
                الأرشيف الرقمي للوثائق
              </h3>
              {authUser?.role === 'manager' && (
                <div className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                   مساحة إدارية
                </div>
              )}
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Document List */}
              <div className="lg:col-span-2 space-y-4">
                 {documents.length === 0 && (
                   <div className="text-center py-12 bg-slate-50 dark:bg-neutral-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-neutral-700">
                      <Archive className="mx-auto mb-3 text-slate-300" size={40} />
                      <p className="text-slate-400 font-medium">لا توجد وثائق مؤرشفة حالياً.</p>
                   </div>
                 )}
                 {documents.map((doc) => (
                   <div key={doc.id} className="p-4 bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-xl shadow-sm flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-900/30 transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl flex items-center justify-center">
                            {doc.doc_type === 'ID' && <Shield size={24} />}
                            {doc.doc_type === 'Degree' && <Award size={24} />}
                            {doc.doc_type === 'Contract' && <FileText size={24} />}
                            {(!['ID', 'Degree', 'Contract'].includes(doc.doc_type)) && <FileText size={24} />}
                         </div>
                         <div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">{doc.doc_name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                               {doc.doc_type === 'ID' ? 'بطاقة هوية' : doc.doc_type === 'Degree' ? 'شهادة علمية' : 'عقد عمل / قرار'} • {formatDate(doc.created_at)}
                            </p>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <a 
                           href={doc.file_url} 
                           target="_blank" 
                           rel="noreferrer"
                           className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all"
                           title="عرض الوثيقة"
                         >
                            <ExternalLink size={18} />
                         </a>
                         {authUser?.role === 'manager' && (
                           <button 
                             onClick={() => handleDeleteDocument(doc.id)}
                             className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                             title="حذف"
                           >
                              <Trash2 size={18} />
                           </button>
                         )}
                      </div>
                   </div>
                 ))}
              </div>

              {/* Upload Form (Manager Only) */}
              {authUser?.role === 'manager' && (
                <div className="bg-slate-50 dark:bg-neutral-800/30 p-6 rounded-2xl border border-slate-100 dark:border-neutral-800 h-fit">
                   <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <Upload size={18} className="text-blue-600" />
                      أرشفة وثيقة جديدة
                   </h4>
                   <form onSubmit={handleUploadDocument} className="space-y-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">تسمية الوثيقة</label>
                         <input 
                           type="text" 
                           required 
                           value={docName}
                           onChange={(e) => setDocName(e.target.value)}
                           className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl outline-none text-sm"
                           placeholder="مثال: بطاقة التعريف الوطنية"
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">نوع الوثيقة</label>
                         <select 
                           value={docType}
                           onChange={(e) => setDocType(e.target.value)}
                           className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl outline-none text-sm"
                         >
                            <option value="ID">بطاقة هوية</option>
                            <option value="Degree">شهادة / دبلوم</option>
                            <option value="Contract">عقد عمل</option>
                            <option value="Other">وثيقة أخرى</option>
                         </select>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">ملف الوثيقة (صورة/PDF)</label>
                         <input 
                           type="file" 
                           required 
                           onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                           className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                         />
                      </div>
                      <button 
                        disabled={uploading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-sm flex items-center justify-center gap-2 ring-offset-white dark:ring-offset-neutral-900 focus:ring-2 focus:ring-blue-500"
                      >
                         {uploading ? 'جاري الأرشفة...' : (
                           <>
                              <CheckCircle2 size={18} />
                              تأكيد الأرشفة
                           </>
                         )}
                      </button>
                   </form>
                </div>
              )}
           </div>
        </section>

        {/* Performance & Goals Section */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 ${authUser?.role === 'accountant' ? 'hidden' : ''}`}>
           {/* Goals Tracking */}
           <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
                  <Award size={20} className="text-blue-600" />
                  الأهداف المهنية وتتبع التقدم
                </h3>
                {authUser?.role === 'manager' && id && (
                  <button 
                    onClick={() => setShowGoalModal(true)}
                    className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                )}
             </div>
             <div className="space-y-4">
                {goals.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">لا توجد أهداف محددة حالياً.</p>}
                {goals.map((goal) => (
                  <div key={goal.id} className="p-4 rounded-xl border border-slate-50 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/20">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1">{goal.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{goal.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        goal.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                        goal.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                         {goal.status === 'completed' ? 'مكتمل' : goal.status === 'in_progress' ? 'قيد التنفيذ' : 'معلق'}
                      </span>
                    </div>
                    <div className="space-y-2">
                       <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>التقدم: {goal.progress}%</span>
                          <span>الموعد: {goal.target_date || 'غير محدد'}</span>
                       </div>
                       <div className="w-full h-1.5 bg-slate-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 transition-all duration-500" 
                            style={{ width: `${goal.progress}%` }}
                          />
                       </div>
                       {(authUser?.role === 'manager' || (!id)) && goal.status !== 'completed' && (
                         <div className="flex gap-2 pt-2">
                            <input 
                              type="range" 
                              min="0" max="100" 
                              value={goal.progress}
                              onChange={(e) => {
                                const progress = parseInt(e.target.value);
                                api.patch(`/api/goals/${goal.id}`, { 
                                  progress,
                                  status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending'
                                }).then(() => fetchPerformance());
                              }}
                              className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            {authUser?.role === 'manager' && (
                              <button 
                                onClick={() => {
                                  if(confirm('حذف الهدف؟')) {
                                    api.delete(`/api/goals/${goal.id}`).then(() => fetchPerformance());
                                  }
                                }}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                         </div>
                       )}
                    </div>
                  </div>
                ))}
             </div>
           </section>

           {/* Performance Evaluations (KPIs) */}
           <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
                  <History size={20} className="text-emerald-600" />
                  التقييم الدوري والأداء (KPIs)
                </h3>
                {authUser?.role === 'manager' && id && (
                  <button 
                    onClick={() => setShowEvalModal(true)}
                    className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                )}
             </div>
             <div className="space-y-4">
                {evaluations.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">لا توجد تقييمات مسجلة.</p>}
                {evaluations.map((evalItem) => (
                  <div key={evalItem.id} className="p-4 rounded-xl border border-emerald-50 dark:border-emerald-900/10 bg-emerald-50/30 dark:bg-emerald-900/5">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Shield 
                            key={star} 
                            size={14} 
                            className={star <= evalItem.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} 
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold tracking-widest">{formatDate(evalItem.date)}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-neutral-200 mb-2">{evalItem.notes}</p>
                    <div className="grid grid-cols-3 gap-2">
                       {(() => {
                         try {
                           const kpis = JSON.parse(evalItem.kpis || '{}');
                           return Object.entries(kpis).map(([key, value]: [string, any]) => (
                             <div key={key} className="text-center p-2 rounded-lg bg-white dark:bg-neutral-800 border border-emerald-50 dark:border-neutral-700">
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter mb-1">
                                   {key === 'efficiency' ? 'الكفاءة' : key === 'commitment' ? 'الالتزام' : 'التعاون'}
                                </p>
                                <p className="text-xs font-bold text-emerald-600">{value}%</p>
                             </div>
                           ));
                         } catch (e) {
                           return <p className="text-[10px] text-slate-400">بيانات غير صالحة</p>;
                         }
                       })()}
                    </div>
                  </div>
                ))}
             </div>
           </section>
        </div>

        {/* Financial Records Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Financial Adjustments */}
           <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
             <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
               <Coins size={20} className="text-emerald-600" />
               سجل المكافآت والجزاءات المالية
             </h3>
             <div className="space-y-4">
                {adjustments.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">لا توجد تسويات مالية مسجلة.</p>}
                {adjustments.map((adj) => (
                  <div key={adj.id} className="p-4 rounded-xl border border-slate-50 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/20 flex justify-between items-center group transition-all hover:bg-slate-50 dark:hover:bg-neutral-800/40">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${adj.type === 'bonus' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                           {adj.type === 'bonus' ? 'مكافأة' : 'خصم'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-300">{adj.reason}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold tracking-widest">{formatDate(adj.date)}</span>
                    </div>
                    <div className={`font-mono font-bold ${adj.type === 'bonus' ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {adj.type === 'bonus' ? '+' : '-'}{adj.amount.toLocaleString()} دج
                    </div>
                  </div>
                ))}
             </div>
           </section>

           {/* Monthly Payroll History */}
           <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm">
             <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
               <Receipt size={20} className="text-blue-600" />
               أرشيف كشوف الرواتب الشهرية
             </h3>
             <div className="space-y-4">
                {payroll.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">لم يتم توليد أي كشوف رواتب بعد.</p>}
                {payroll.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl border border-slate-100 dark:border-neutral-800 flex justify-between items-center hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                    <div>
                      <p className="font-bold text-sm mb-1">كشف شهر {p.month}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">تم التوليد في: {formatDate(p.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">الصافي للدفع</p>
                          <p className="font-mono font-bold text-blue-600">{p.net_salary.toLocaleString()} دج</p>
                       </div>
                       <button 
                         onClick={() => handlePrintPayroll(p)}
                         className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                       >
                          <Printer size={20} />
                       </button>
                    </div>
                  </div>
                ))}
             </div>
           </section>
        </div>

        {authUser?.role === 'manager' && !id && (
          <section className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white uppercase tracking-tight">
              <Lock size={20} className="text-red-600" />
              إعدادات الأمان
            </h3>
            <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-800/30">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                  تم تغيير كلمة المرور بنجاح!
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-widest block">كلمة المرور الحالية</label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="password"
                    required
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-widest block">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="password"
                    required
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-widest block">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="password"
                    required
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-slate-800 hover:bg-black text-white px-8 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all transform active:scale-95"
              >
                حفظ كلمة المرور الجديدة
              </button>
            </form>
          </section>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showGoalModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.form 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onSubmit={handleAddGoal}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl p-8"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Award className="text-blue-600" /> تحديد هدف مهني
              </h2>
              <div className="space-y-4 mb-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">عنوان الهدف</label>
                  <input type="text" required value={goalData.title} onChange={(e) => setGoalData({...goalData, title: e.target.value})} className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">الوصف</label>
                  <textarea value={goalData.description} onChange={(e) => setGoalData({...goalData, description: e.target.value})} className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none min-h-[80px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">تاريخ الإنجاز المستهدف</label>
                  <input type="date" value={goalData.target_date} onChange={(e) => setGoalData({...goalData, target_date: e.target.value})} className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none" />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl">حفظ</button>
                <button type="button" onClick={() => setShowGoalModal(false)} className="flex-1 bg-neutral-100 dark:bg-neutral-800 font-bold py-3 rounded-xl">إلغاء</button>
              </div>
            </motion.form>
          </div>
        )}

        {showEvalModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.form 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onSubmit={handleAddEvaluation}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl p-8"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <History className="text-emerald-600" /> تقييم الأداء الدوري
              </h2>
              <div className="space-y-5 mb-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-center">التقييم العام (1-5)</label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button 
                        key={star} 
                        type="button"
                        onClick={() => setEvalData({...evalData, rating: star})}
                        className="transition-all transform hover:scale-110"
                      >
                        <Award size={32} className={star <= evalData.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} />
                      </button>
                    ))}
                  </div>
                </div>

                {Object.keys(evalData.kpis).map((kpi) => (
                  <div key={kpi} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                       <span>{kpi === 'efficiency' ? 'الكفاءة' : kpi === 'commitment' ? 'الالتزام' : 'التعاون'}</span>
                       <span>{(evalData.kpis as any)[kpi]}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={(evalData.kpis as any)[kpi]}
                      onChange={(e) => setEvalData({...evalData, kpis: {...evalData.kpis, [kpi]: parseInt(e.target.value)}})}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none accent-emerald-500"
                    />
                  </div>
                ))}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">ملاحظات إضافية</label>
                  <textarea 
                    value={evalData.notes} 
                    onChange={(e) => setEvalData({...evalData, notes: e.target.value})} 
                    placeholder="اكتب ملاحظاتك حول أداء الموظف..."
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none min-h-[80px]"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20">تأكيد التقييم</button>
                <button type="button" onClick={() => setShowEvalModal(false)} className="flex-1 bg-neutral-100 dark:bg-neutral-800 font-bold py-3 rounded-xl">إلغاء</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Printable Payroll Slip */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-12 text-black" dir="rtl">
        <div className="border-4 border-double border-slate-800 p-8 h-full">
          <div className="flex justify-between items-start mb-12 border-b-2 border-slate-200 pb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 mb-2">نموذج كشف رواتب الموظفين</h1>
              <p className="text-lg font-bold text-slate-500">كشف راتب شهر: {selectedPayrollForPrint?.month}</p>
            </div>
            <div className="text-left font-bold text-slate-400">
               <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-DZ')}</p>
               <p>الرقم المرجعي: #{selectedPayrollForPrint?.id}</p>
            </div>
          </div>

          <table className="w-full border-collapse mb-12">
            <thead>
              <tr className="bg-slate-100">
                <th className="border-2 border-slate-200 p-4 text-sm font-black text-right">مسلسل</th>
                <th className="border-2 border-slate-200 p-4 text-sm font-black text-right">الرقم الوظيفي</th>
                <th className="border-2 border-slate-200 p-4 text-sm font-black text-right">اسم الموظف</th>
                <th className="border-2 border-slate-200 p-4 text-sm font-black text-right">القسم</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-2 border-slate-200 p-4 text-base font-bold">{selectedPayrollForPrint?.id}</td>
                <td className="border-2 border-slate-200 p-4 text-base font-bold">{selectedPayrollForPrint?.registration_number}</td>
                <td className="border-2 border-slate-200 p-4 text-base font-bold">{selectedPayrollForPrint?.full_name}</td>
                <td className="border-2 border-slate-200 p-4 text-base font-bold">{selectedPayrollForPrint?.department || '-'}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-12 mb-12 text-right">
            <div className="space-y-4">
               <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">تفاصيل المستحقات</h4>
               <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-bold">الراتب الأساسي:</span>
                  <span className="font-mono">{selectedPayrollForPrint?.base_salary?.toLocaleString()} دج</span>
               </div>
               <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-bold">المستحقات المتغيرة (علاوات/ساعات):</span>
                  <span className="font-mono">{( (selectedPayrollForPrint?.overtime_pay || 0) + (selectedPayrollForPrint?.bonuses || 0) ).toLocaleString()} دج</span>
               </div>
            </div>
            <div className="space-y-4 text-right">
               <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">الاستقطاعات والملاحظات</h4>
               <div className="flex justify-between py-2 border-b border-slate-100 text-rose-600">
                  <span className="font-bold">إجمالي الاستقطاعات:</span>
                  <span className="font-mono">-{selectedPayrollForPrint?.deductions?.toLocaleString()} دج</span>
               </div>
               <div className="py-2">
                  <span className="font-bold block mb-1">ملاحظات:</span>
                  <p className="text-sm text-slate-500 italic pr-4">لا توجد ملاحظات إدارية لهذا الشهر.</p>
               </div>
            </div>
          </div>

          <div className="mt-auto pt-12 border-t-4 border-double border-slate-800">
            <div className="flex justify-between items-center px-8">
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-4">ختم الإدارة</p>
                  <div className="w-32 h-32 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-[10px] text-slate-300">
                    مكان الختم الرسمي
                  </div>
               </div>
               <div className="text-center">
                  <p className="text-2xl font-black text-slate-900 mb-2">صافي الراتب المستحق</p>
                  <p className="text-4xl font-black text-blue-600 font-mono underline decoration-double underline-offset-8">
                    {selectedPayrollForPrint?.net_salary?.toLocaleString()} دج
                  </p>
               </div>
               <div className="text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-8 text-right">توقيع المستلم</p>
                  <div className="w-48 border-b-2 border-slate-900 mt-12"></div>
               </div>
            </div>
          </div>

          <footer className="mt-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            هذا المستند تم توليده آلياً من نظام الإدارة الذكي - شركة CORP.DZ
          </footer>
        </div>
      </div>
    </Layout>
  );
}

function InfoItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4 group">
      <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl text-neutral-400 group-hover:text-blue-600 transition-colors">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">{label}</p>
        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{value}</p>
      </div>
    </div>
  );
}
