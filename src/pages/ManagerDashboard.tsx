import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Users, FileCheck, AlertCircle, Plus, Trash2, 
  ExternalLink, Check, X, Filter, Search, Edit3, ShieldAlert,
  Download, Database, Coins, Receipt, TrendingDown, CalendarDays,
  Printer, Award, Paperclip, FileText as FileTextIcon
} from 'lucide-react';

import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

export default function ManagerDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [penaltyData, setPenaltyData] = useState({ text: '', authority: '' });
  const [adjustmentData, setAdjustmentData] = useState({ type: 'bonus', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  const { socket, user } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    username: '', password: '', full_name: '', rank: '', 
    dob: '', pob: '', salary: '', status: 'offline', 
    vacation_start: '', vacation_end: '',
    job_title: '', department: '', hiring_date: '', contract_type: '',
    contract_end_date: '', next_promotion_date: '',
    phone: '', email: '', address: '', role: 'employee'
  });
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    fetchData();
    
    if (socket) {
      socket.on('user_status', ({ userId, is_online, last_seen }) => {
        setEmployees(prev => prev.map(emp => emp.id === userId ? { ...emp, is_online, last_seen } : emp));
        api.get('/api/stats').then(setStats);
      });
    }

    return () => {
      socket?.off('user_status');
    };
  }, [socket]);

  const handleExportExcel = () => {
    const dataToExport = employees.map(emp => ({
      'الاسم الكامل': emp.full_name,
      'رقم التسجيل': emp.registration_number,
      'الرتبة': emp.rank,
      'الراتب': emp.salary,
      'تاريخ الميلاد': emp.dob,
      'رقم الهاتف': emp.phone || '',
      'البريد الإلكتروني': emp.email || '',
      'العنوان': emp.address || '',
      'الحالة': emp.is_online ? 'متصل' : 'خارج العمل',
      'آخر ظهور': emp.last_seen
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الموظفون");
    XLSX.writeFile(wb, `تقرير_الموظفين_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPayrollPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(20);
    doc.text('ERP SYSTEM - PAYROLL REPORT', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Month: ${selectedMonth}`, 105, 22, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });

    const tableData = payroll.map(p => [
      p.registration_number,
      p.full_name,
      p.rank,
      p.base_salary.toLocaleString() + ' DZD',
      p.bonuses.toLocaleString() + ' DZD',
      p.deductions.toLocaleString() + ' DZD',
      p.net_salary.toLocaleString() + ' DZD'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Registration', 'Name', 'Rank', 'Base Salary', 'Bonuses', 'Deductions', 'Net Salary']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
    });

    doc.save(`Payroll_${selectedMonth}.pdf`);
  };

  const handleExportPayrollExcel = () => {
    const dataToExport = payroll.map(p => ({
      'رقم التسجيل': p.registration_number,
      'الاسم الكامل': p.full_name,
      'الرتبة': p.rank,
      'الراتب الأساسي': p.base_salary,
      'المنح': p.bonuses,
      'الخصومات': p.deductions,
      'صافي الراتب': p.net_salary
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الرواتب");
    XLSX.writeFile(wb, `كشف_الرواتب_${selectedMonth}.xlsx`);
  };

  const handleExportAttendancePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(20);
    doc.text('ERP SYSTEM - ATTENDANCE REPORT', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 22, { align: 'center' });

    const tableData = attendance.map(a => [
      a.full_name,
      a.date,
      a.clock_in ? new Date(a.clock_in).toLocaleTimeString('ar-DZ') : '-',
      a.clock_out ? new Date(a.clock_out).toLocaleTimeString('ar-DZ') : '-',
      a.overtime_minutes + ' min'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Employee', 'Date', 'Clock In', 'Clock Out', 'Overtime']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255] },
    });

    doc.save(`Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleBackup = async () => {
    try {
      const response = await fetch('/api/admin/backup', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('فشل تحميل النسخة الاحتياطية');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_corp_${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchData = async () => {
    try {
      const isAccountant = user?.role === 'accountant';
      const [s, e, r, a, p] = await Promise.all([
        api.get('/api/stats').catch(err => { console.error('Stats fail:', err); return null; }),
        api.get('/api/employees').catch(err => { console.error('Employees fail:', err); return []; }),
        api.get('/api/requests').catch(err => { console.error('Requests fail:', err); return []; }),
        isAccountant ? Promise.resolve([]) : api.get('/api/attendance-stats').catch(err => { console.error('Attendance fail:', err); return []; }),
        api.get(`/api/payroll?month=${selectedMonth}`).catch(err => { console.error('Payroll fail:', err); return []; })
      ]);
      setStats(s);
      setEmployees(Array.isArray(e) ? e : []);
      setRequests(Array.isArray(r) ? r : []);
      setAttendance(Array.isArray(a) ? a : []);
      setPayroll(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const totalOvertime = Array.isArray(attendance) ? attendance.reduce((acc, curr) => acc + (curr.overtime_minutes || 0), 0) : 0;

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    Object.entries(formData).forEach(([k, v]) => form.append(k, v as string));
    if (photo) form.append('photo', photo);

    try {
      if (showEditModal && editingEmployee) {
        await api.patch(`/api/employees/${editingEmployee.id}`, form);
        setShowEditModal(false);
      } else {
        await api.post('/api/employees', form);
        setShowAddModal(false);
      }
      fetchData();
      setFormData({ 
        username: '', password: '', full_name: '', rank: '', dob: '', pob: '', salary: '', 
        status: 'offline', vacation_start: '', vacation_end: '',
        job_title: '', department: '', hiring_date: '', contract_type: '',
        contract_end_date: '', next_promotion_date: '',
        phone: '', email: '', address: '', role: 'employee'
      });
      setPhoto(null);
      setEditingEmployee(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditClick = (emp: any) => {
    setEditingEmployee(emp);
    setFormData({
      username: emp.username,
      password: '',
      full_name: emp.full_name,
      rank: emp.rank,
      dob: emp.dob || '',
      pob: emp.pob || '',
      salary: emp.salary?.toString() || '',
      status: emp.status,
      vacation_start: emp.vacation_start || '',
      vacation_end: emp.vacation_end || '',
      job_title: emp.job_title || '',
      department: emp.department || '',
      hiring_date: emp.hiring_date || '',
      contract_type: emp.contract_type || '',
      contract_end_date: emp.contract_end_date || '',
      next_promotion_date: emp.next_promotion_date || '',
      phone: emp.phone || '',
      email: emp.email || '',
      address: emp.address || '',
      role: emp.role || 'employee'
    });
    setShowEditModal(true);
  };

  const handleIssuePenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee && penaltyData.text) {
      try {
        await api.post(`/api/employees/${editingEmployee.id}/penalties`, { 
          penalty: `${penaltyData.text} (صادر عن: ${penaltyData.authority || 'المدير العام'})` 
        });
        setShowPenaltyModal(false);
        setPenaltyData({ text: '', authority: '' });
        alert('تم تسجيل العقوبة بنجاح في ملف الموظف');
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee && adjustmentData.amount) {
      try {
        await api.post(`/api/employees/${editingEmployee.id}/adjustments`, adjustmentData);
        setShowAdjustmentModal(false);
        setAdjustmentData({ type: 'bonus', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
        alert('تمت إضافة التسوية المالية بنجاح');
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleGeneratePayroll = async () => {
    setLoading(true);
    try {
      await api.post('/api/payroll/generate', { month: selectedMonth });
      alert(`تم توليد كشوف الرواتب لشهر ${selectedMonth} بنجاح`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openPenaltyModal = (emp: any) => {
    setEditingEmployee(emp);
    setPenaltyData({ text: '', authority: 'الإدارة العامة' });
    setShowPenaltyModal(true);
  };

  const filteredEmployees = employees.filter(emp => 
    (emp.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.registration_number || '').includes(searchQuery)
  );

  const handleDeleteEmployee = async (id: number) => {
    console.log('Attempting to delete employee with ID:', id);
    if (confirm('هل أنت متأكد من حذف هذا الموظف؟ سيتم حذف جميع بياناته المرتبطة (الحضور، الطلبات، الرواتب، إلخ).')) {
      try {
        await api.delete(`/api/employees/${id}`);
        toast.success('تم حذف الموظف بنجاح');
        fetchData();
      } catch (err: any) {
        console.error('Delete error:', err);
        toast.error(err.message || 'فشل حذف الموظف');
      }
    }
  };

  const handleRequestStatus = async (id: number, status: string) => {
    const comment = prompt('إضافة ملاحظة (اختياري):');
    await api.patch(`/api/requests/${id}`, { status, manager_comment: comment });
    fetchData();
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  if (loading) return <Layout>جاري التحميل...</Layout>;

  const pieData = [
    { name: 'مقبول', value: stats?.requestStats?.find((s: any) => s.status === 'approved')?.count || 0 },
    { name: 'مرفوض', value: stats?.requestStats?.find((s: any) => s.status === 'rejected')?.count || 0 },
    { name: 'قيد الانتظار', value: stats?.requestStats?.find((s: any) => s.status === 'pending')?.count || 0 },
  ];

  return (
    <Layout>
      <div className="space-y-8" dir="rtl">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">لوحة التحكم</h1>
            <p className="text-slate-500 dark:text-neutral-400 text-sm">إدارة الموظفين والطلبات والبيانات العامة</p>
          </div>
          <div className="flex gap-3">
            {user?.role === 'manager' && (
              <button 
                onClick={handleBackup}
                className="bg-neutral-800 hover:bg-black text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all"
                title="نسخة احتياطية لقاعدة البيانات"
              >
                <Database size={18} />
                <span className="hidden md:inline">نسخة احتياطية</span>
              </button>
            )}
            <button 
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all"
            >
              <Download size={18} />
              <span className="hidden md:inline">تصدير Excel</span>
            </button>
            {user?.role === 'manager' && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-[var(--color-primary)] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all transform active:scale-95"
              >
                <Plus size={18} />
                <span>إضافة موظف</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-neutral-800 mb-8 overflow-x-auto no-scrollbar">
          {[
            { id: 'employees', label: 'الموظفون', icon: Users },
            { id: 'requests', label: 'الطلبات', icon: FileCheck },
            { id: 'payroll', label: 'الرواتب', icon: Receipt },
            { id: 'attendance', label: 'الحضور', icon: CalendarDays },
            { id: 'analytics', label: 'التحليلات', icon: Database },
            { id: 'personal_requests', label: 'طلباتي الشخصية', icon: Plus },
          ].filter(tab => {
            if (user?.role !== 'manager') {
              // Accountant: No attendance, no analytics (performance/stats)
              if (tab.id === 'attendance' || tab.id === 'analytics') return false;
            } else {
              // Manager: No personal requests in management tabs (they manage others)
              if (tab.id === 'personal_requests') return false;
            }
            return true;
          }).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 min-w-fit
                ${activeTab === tab.id 
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-blue-50/30' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'personal_requests' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Plus className="text-blue-600" />
                تقديم طلب جديد للمدير
              </h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as any;
                const fd = new FormData(form);
                
                try {
                  await api.post('/api/requests', fd);
                  toast.success('تم إرسال الطلب بنجاح');
                  form.reset();
                  fetchData();
                } catch (err) {
                  toast.error('فشل إرسال الطلب');
                }
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">نوع الطلب</label>
                    <select name="type" className="w-full p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700 outline-none font-bold">
                      <option value="vacation">طلب إجازة</option>
                      <option value="mission">مهمة عمل</option>
                      <option value="salary_statement">كشف راتب</option>
                      <option value="interview">طلب مقابلة</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">إرفاق مستندات</label>
                    <input type="file" name="files" multiple className="w-full text-xs p-2 bg-white dark:bg-neutral-900 border border-dashed border-slate-300 dark:border-neutral-700 rounded-xl" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">تفاصيل ومبررات الطلب</label>
                  <textarea name="description" required className="w-full p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700 outline-none h-32 resize-none" placeholder="اشرح تفاصيل طلبك هنا بالكامل..."></textarea>
                </div>
                <button type="submit" className="w-full bg-[var(--color-primary)] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all">
                  <Paperclip size={18} />
                  إرسال الطلب والمرفقات
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Alerts Section */}
            {(stats?.alerts?.contracts?.length > 0 || stats?.alerts?.promotions?.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {stats.alerts.contracts.length > 0 && (
                   <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-4 text-amber-700 dark:text-amber-400">
                         <AlertCircle size={24} />
                         <h3 className="font-bold">تنبيهات العقود (قريبة الانتهاء)</h3>
                      </div>
                      <div className="space-y-2">
                         {stats.alerts.contracts.map((alert: any) => (
                           <Link key={alert.id} to={`/profile/${alert.id}`} className="flex justify-between items-center text-sm font-medium hover:underline">
                              <span>{alert.full_name}</span>
                              <span className="text-amber-600 font-mono">{alert.contract_end_date}</span>
                           </Link>
                         ))}
                      </div>
                   </div>
                 )}
                 {stats.alerts.promotions.length > 0 && (
                   <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-4 text-blue-700 dark:text-blue-400">
                         <TrendingDown className="rotate-180" size={24} />
                         <h3 className="font-bold">مواعيد الترقية القادمة</h3>
                      </div>
                      <div className="space-y-2">
                         {stats.alerts.promotions.map((alert: any) => (
                           <Link key={alert.id} to={`/profile/${alert.id}`} className="flex justify-between items-center text-sm font-medium hover:underline">
                              <span>{alert.full_name}</span>
                              <span className="text-blue-600 font-mono">{alert.next_promotion_date}</span>
                           </Link>
                         ))}
                      </div>
                   </div>
                 )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard title="إجمالي الموظفين" value={stats?.employeeCount?.count || 0} icon={Users} color="bg-blue-600" />
              <StatCard title="المتصلون الآن" value={stats?.onlineCount?.count || 0} icon={Check} color="bg-emerald-600" />
              {user?.role === 'manager' && <StatCard title="نسبة الغياب" value={`${stats?.enhancedStats?.absenceRate || 0}%`} icon={TrendingDown} color="bg-rose-600" />}
              <StatCard title="إجمالي الرواتب" value={`${(stats?.enhancedStats?.totalPayroll || 0).toLocaleString()} دج`} icon={Coins} color="bg-slate-800" />
              {user?.role === 'manager' && <StatCard title="تقييم الأداء" value={`${stats?.enhancedStats?.avgRating || 0}/5`} icon={Award} color="bg-amber-500" />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                  <Receipt className="text-blue-600" />
                  تحليل توزيع الميزانية
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payroll.slice(0, 5).map(p => ({ name: p.full_name, total: p.net_salary }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col items-center">
                <h3 className="text-lg font-bold mb-8 w-full">حالة الأهداف المهنية</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.enhancedStats?.goalsStats?.map((s: any) => ({
                          name: s.status === 'completed' ? 'مكتمل' : s.status === 'in_progress' ? 'قيد التنفيذ' : 'معلق',
                          value: s.count
                        })) || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats?.enhancedStats?.goalsStats?.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b'][index % 3]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                   <span>مكتمل</span>
                   <span>تنفيذ</span>
                   <span>معلق</span>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col items-center">
                <h3 className="text-lg font-bold mb-8 w-full">حالة طلبات الموظفين</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                      <span>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm lg:col-span-3">
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                   <CalendarDays className="text-rose-500" />
                   تطور الحضور والعمل الإضافي (آخر 7 أيام)
                </h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(Array.isArray(attendance) ? [...attendance] : []).reverse().slice(0, 7).map(a => ({ date: a.date, overtime: a.overtime_minutes }))}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} />
                         <XAxis dataKey="date" fontSize={10} />
                         <YAxis fontSize={10} />
                         <Tooltip />
                         <Bar dataKey="overtime" fill="#f43f5e" radius={[4, 4, 0, 0]} name="دقائق إضافية" />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <section className="bg-white dark:bg-neutral-900 rounded-xl border border-[var(--color-border-subtle)] dark:border-neutral-800 shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-xl font-bold">قائمة الموظفين</h3>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="بحث بالاسم أو الرقم..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#f1f5f9] dark:bg-neutral-800/50">
                  <th className="p-4 text-[0.85rem] font-semibold text-slate-500 uppercase">رقم التسجيل</th>
                  <th className="p-4 text-[0.85rem] font-semibold text-slate-500 uppercase">الموظف</th>
                  <th className="p-4 text-[0.85rem] font-semibold text-slate-500 uppercase">الرتبة</th>
                  <th className="p-4 text-[0.85rem] font-semibold text-slate-500 uppercase">الحالة</th>
                  <th className="p-4 text-[0.85rem] font-semibold text-slate-500 uppercase">آخر ظهور</th>
                  <th className="p-4 text-[0.85rem] font-semibold text-slate-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 text-[0.9rem]">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-[var(--color-primary)]">{emp.registration_number}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : emp.full_name[0]}
                        </div>
                        <span className="font-medium">{emp.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-neutral-400">{emp.rank}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className={`badge px-3 py-1 rounded-md text-[0.75rem] font-bold uppercase tracking-wider w-fit
                          ${emp.is_online === 1 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                            emp.status === 'vacation' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                            emp.status === 'mission' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            'bg-slate-50 text-slate-600 border border-slate-100'}
                        `}>
                          {emp.is_online === 1 ? 'متصل' : 
                           emp.status === 'vacation' ? 'في إجازة' : 
                           emp.status === 'mission' ? 'في مهمة' : 'خارج العمل'}
                        </span>
                        {emp.status === 'vacation' && emp.vacation_end && (
                          <span className="text-[10px] text-rose-500 font-bold tracking-tight">إلى {emp.vacation_end}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                       <div className="flex flex-col">
                         <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{emp.last_seen ? formatDate(emp.last_seen) : 'لم يسجل دخول'}</span>
                       </div>
                    </td>
                    <td className="p-4 flex gap-3 justify-end items-center">
                      {user?.role === 'manager' && (
                        <>
                          <button onClick={() => handleEditClick(emp)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg text-slate-600" title="تعديل">
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => { setEditingEmployee(emp); setShowAdjustmentModal(true); }} 
                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-600" 
                            title="تسوية مالية"
                          >
                            <Coins size={16} />
                          </button>
                        </>
                      )}
                      {user?.role === 'manager' && (
                        <button onClick={() => openPenaltyModal(emp)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-rose-600" title="عقوبة">
                          <ShieldAlert size={16} />
                        </button>
                      )}
                      <Link 
                        to={`/profile/${emp.id}`}
                        className="text-[var(--color-primary)] hover:underline text-xs font-bold uppercase tracking-widest"
                      >
                        عرض
                      </Link>
                      {user?.role === 'manager' && (
                        <button 
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-rose-500 transition-colors"
                          title="حذف الموظف"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {activeTab === 'requests' && (
          <section className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xl font-bold">طلبات الموظفين</h3>
            </div>
            <div className="p-6 space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="p-4 bg-neutral-50 dark:bg-neutral-800 shadow-sm border border-neutral-100 dark:border-neutral-700 rounded-xl flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-neutral-900 dark:text-white">{req.sender_name}</span>
                      <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-[10px] font-bold uppercase">
                        {req.type === 'vacation' ? 'إجازة' : req.type === 'mission' ? 'مهمة عمل' : req.type === 'salary_statement' ? 'كشف راتب' : 'طلب مقابلة'}
                      </span>
                      <span className="text-[10px] text-neutral-500">{formatDate(req.created_at)}</span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{req.description}</p>
                    {req.files && (
                      <div className="flex gap-2">
                        {JSON.parse(req.files).map((f: string, i: number) => (
                          <a key={i} href={f} target="_blank" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            <ExternalLink size={12} /> ملف {i+1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {req.status === 'pending' ? (
                    (user?.role === 'manager' || user?.role === 'accountant') ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRequestStatus(req.id, 'approved')}
                          className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          onClick={() => handleRequestStatus(req.id, 'rejected')}
                          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold uppercase">قيد الانتظار</span>
                    )
                  ) : (
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                      ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                    `}>
                      {req.status === 'approved' ? 'تم القبول' : 'مرفوض'}
                    </span>
                  )}
                </div>
              ))}
              {requests.length === 0 && <p className="text-center py-8 text-slate-400">لا توجد طلبات حالياً</p>}
            </div>
          </section>
        )}

        {activeTab === 'attendance' && (
          <section className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-bold">سجل الحضور والعمل الإضافي التلقائي</h3>
              <button 
                onClick={handleExportAttendancePDF}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all"
              >
                <Printer size={18} />
                تصدير PDF
              </button>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] uppercase font-bold text-slate-400 tracking-widest bg-slate-50/50 dark:bg-neutral-800/30">
                      <th className="px-4 py-4">الموظف</th>
                      <th className="px-4 py-4 text-center">التاريخ</th>
                      <th className="px-4 py-4 text-center">وقت الدخول</th>
                      <th className="px-4 py-4 text-center">وقت الخروج</th>
                      <th className="px-4 py-4 text-left">العمل الإضافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
                    {(Array.isArray(attendance) ? attendance : []).map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-bold text-sm text-slate-800 dark:text-neutral-100">{att.full_name}</p>
                          <p className="text-[10px] text-slate-400 tracking-tighter">#{att.registration_number}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-center font-medium">{att.date}</td>
                        <td className="px-4 py-4 text-sm text-center font-medium font-mono text-blue-600">
                          {att.clock_in ? new Date(att.clock_in).toLocaleTimeString('ar-DZ') : '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-center font-medium font-mono text-emerald-600">
                          {att.clock_out ? new Date(att.clock_out).toLocaleTimeString('ar-DZ') : '-'}
                        </td>
                        <td className="px-4 py-4 text-left">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${att.overtime_minutes > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-400'}`}>
                             {att.overtime_minutes} دقيقة إضافية
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(Array.isArray(attendance) ? attendance : []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">لا توجد سجلات حضور بعد</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'payroll' && (
          <section className="space-y-6">
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">إدارة الرواتب الشهرية</h3>
                    <p className="text-xs text-slate-500">توليد ومراجعة كشوف الرواتب بناءً على الحضور والجزاءات</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl outline-none text-sm font-bold"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleExportPayrollExcel}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                    >
                      <Download size={18} />
                      Excel
                    </button>
                    <button 
                      onClick={handleExportPayrollPDF}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center gap-2"
                    >
                      <Printer size={18} />
                      PDF
                    </button>
                    <button 
                      onClick={handleGeneratePayroll}
                      className="bg-neutral-800 hover:bg-black text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-neutral-500/20 flex items-center gap-2"
                    >
                      <Receipt size={18} />
                      تحديث
                    </button>
                  </div>
               </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
               <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-neutral-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <th className="px-6 py-4">الموظف</th>
                       <th className="px-6 py-4">الراتب الأساسي</th>
                       <th className="px-6 py-4 text-emerald-600">منح / إضافي</th>
                       <th className="px-6 py-4 text-rose-600">خصومات</th>
                       <th className="px-6 py-4">الصافي</th>
                       <th className="px-6 py-4 text-left">وصل الراتب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                     {payroll.map((p) => (
                       <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-neutral-800/20 transition-all">
                          <td className="px-6 py-4">
                             <p className="font-bold text-sm">{p.full_name}</p>
                             <p className="text-[10px] text-slate-400">#{p.registration_number}</p>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono">{p.base_salary.toLocaleString()} دج</td>
                          <td className="px-6 py-4 text-sm text-emerald-600 font-mono">
                             +{(p.overtime_pay + p.bonuses).toLocaleString()} دج
                          </td>
                          <td className="px-6 py-4 text-sm text-rose-600 font-mono">
                             -{p.deductions.toLocaleString()} دج
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-blue-600 font-mono">{p.net_salary.toLocaleString()} دج</td>
                          <td className="px-6 py-4 text-left">
                             <button 
                               onClick={() => {
                                 // Printable PaySlip logic or Modal
                                 alert('جاري تجهيز وصل الراتب للطباعة...');
                               }}
                               className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg"
                             >
                                <Printer size={18} />
                             </button>
                          </td>
                       </tr>
                     ))}
                     {payroll.length === 0 && (
                       <tr>
                         <td colSpan={6} className="py-12 text-center text-slate-400">لا توجد بيانات رواتب متوفرة لهذا الشهر</td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
          </section>
        )}

        {/* Add/Edit Employee Modal */}
        <AnimatePresence>
          {(showAddModal || showEditModal) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.form 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onSubmit={handleAddEmployee}
                className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold">{showEditModal ? 'تعديل بيانات موظف' : 'تسجيل موظف جديد'}</h2>
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingEmployee(null); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {!showEditModal && <Input label="اسم المستخدم" type="text" value={formData.username} onChange={(e: any) => setFormData({...formData, username: e.target.value})} required />}
                  {!showEditModal && <Input label="كلمة السر" type="password" value={formData.password} onChange={(e: any) => setFormData({...formData, password: e.target.value})} required />}
                  <Input label="الاسم الكامل" type="text" value={formData.full_name} onChange={(e: any) => setFormData({...formData, full_name: e.target.value})} required />
                  <Input label="الرتبة" type="text" value={formData.rank} onChange={(e: any) => setFormData({...formData, rank: e.target.value})} />
                  <Input label="تاريخ الميلاد" type="date" value={formData.dob} onChange={(e: any) => setFormData({...formData, dob: e.target.value})} />
                  <Input label="مكان الميلاد" type="text" value={formData.pob} onChange={(e: any) => setFormData({...formData, pob: e.target.value})} />
                  <Input label="الراتب" type="number" value={formData.salary} onChange={(e: any) => setFormData({...formData, salary: e.target.value})} />
                  
                  <div className="col-span-full border-t border-slate-100 dark:border-neutral-800 pt-6 mt-2">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-4">البيانات الوظيفية الإضافية</h4>
                  </div>
                  <Input label="المسمى الوظيفي" type="text" value={formData.job_title} onChange={(e: any) => setFormData({...formData, job_title: e.target.value})} />
                  <Input label="القسم" type="text" value={formData.department} onChange={(e: any) => setFormData({...formData, department: e.target.value})} />
                  <Input label="تاريخ التعيين" type="date" value={formData.hiring_date} onChange={(e: any) => setFormData({...formData, hiring_date: e.target.value})} />
                  <Input label="نهاية العقد" type="date" value={formData.contract_end_date} onChange={(e: any) => setFormData({...formData, contract_end_date: e.target.value})} />
                  <Input label="موعد الترقية القادم" type="date" value={formData.next_promotion_date} onChange={(e: any) => setFormData({...formData, next_promotion_date: e.target.value})} />
                  
                  <Input label="رقم الهاتف" type="text" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} placeholder="05XXXXXXXX" />
                  <Input label="البريد الإلكتروني" type="email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} placeholder="example@mail.com" />
                  <Input label="عنوان السكن (البلدية/الولاية)" type="text" value={formData.address} onChange={(e: any) => setFormData({...formData, address: e.target.value})} placeholder="اسم البلدية، الولاية" />
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">نوع العقد</label>
                    <select 
                      value={formData.contract_type} 
                      onChange={(e) => setFormData({...formData, contract_type: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl outline-none"
                    >
                      <option value="">اختر نوع العقد...</option>
                      <option value="CDI">عقد غير محدد المدة (CDI)</option>
                      <option value="CDD">عقد محدد المدة (CDD)</option>
                      <option value="CTA">عقد العمل المدعم (CTA)</option>
                      <option value="DAIP">جهاز المساعدة على الإدماج المهني (DAIP)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">مستوى الدخول</label>
                    <select 
                      value={formData.role} 
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl outline-none"
                    >
                      <option value="employee">موظف عادي</option>
                      <option value="accountant">محاسب</option>
                      <option value="manager">مدير</option>
                    </select>
                  </div>

                  {showEditModal && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">حالة الدوام</label>
                      <select 
                        value={formData.status} 
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl outline-none"
                      >
                        <option value="online">متصل</option>
                        <option value="offline">غير متصل</option>
                        <option value="vacation">في إجازة</option>
                        <option value="mission">في مهمة</option>
                      </select>
                    </div>
                  )}

                  {formData.status === 'vacation' && (
                    <>
                      <Input label="بداية الإجازة" type="date" value={formData.vacation_start} onChange={(e: any) => setFormData({...formData, vacation_start: e.target.value})} />
                      <Input label="نهاية الإجازة" type="date" value={formData.vacation_end} onChange={(e: any) => setFormData({...formData, vacation_end: e.target.value})} />
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">الصورة الشخصية</label>
                    <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="w-full text-sm" />
                  </div>
                </div>

                <div className="mt-8 flex gap-4">
                  <button type="submit" className="flex-1 bg-[var(--color-primary)] hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/10 transition-all active:scale-95">
                    {showEditModal ? 'تحديث البيانات' : 'حفظ بيانات الموظف'}
                  </button>
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingEmployee(null); }} className="flex-1 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 font-bold py-3.5 rounded-xl transition-all">إلغاء الأمر</button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Adjustment Modal */}
        <AnimatePresence>
          {showAdjustmentModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.form 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onSubmit={handleAddAdjustment}
                className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl p-8"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                    <Coins /> إضافة تسوية مالية
                  </h2>
                  <button type="button" onClick={() => setShowAdjustmentModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl mb-4 border border-emerald-100 dark:border-emerald-900/20">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">الموظف المعني</p>
                    <p className="font-bold text-slate-800 dark:text-white text-lg">{editingEmployee?.full_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-widest">نوع التسوية</label>
                      <select 
                        required
                        value={adjustmentData.type}
                        onChange={(e) => setAdjustmentData({...adjustmentData, type: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                      >
                        <option value="bonus">مكافأة (+)</option>
                        <option value="deduction">خصم (-)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-widest">المبلغ (دج)</label>
                      <input 
                        type="number"
                        required
                        value={adjustmentData.amount}
                        onChange={(e) => setAdjustmentData({...adjustmentData, amount: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-widest">التاريخ</label>
                    <input 
                      type="date"
                      required
                      value={adjustmentData.date}
                      onChange={(e) => setAdjustmentData({...adjustmentData, date: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-widest">بسبب / الملاحظة</label>
                    <textarea 
                      required
                      value={adjustmentData.reason}
                      onChange={(e) => setAdjustmentData({...adjustmentData, reason: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-h-[80px]"
                      placeholder="مثال: منحة تشجيعية، تعويض عن غياب..."
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    تأكيد التسوية
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAdjustmentModal(false)}
                    className="flex-1 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 font-bold py-3 rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Penalty Modal */}
        <AnimatePresence>
          {showPenaltyModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.form 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onSubmit={handleIssuePenalty}
                className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl p-8"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-rose-600 flex items-center gap-2">
                    <ShieldAlert /> تسجيل عقوبة إدارية
                  </h2>
                  <button type="button" onClick={() => setShowPenaltyModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-xl mb-4">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">الموظف المعني</p>
                    <p className="font-bold text-slate-800 dark:text-white">{editingEmployee?.full_name}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">نوع العقوبة وسببها</label>
                    <textarea 
                      required
                      value={penaltyData.text}
                      onChange={(e) => setPenaltyData({...penaltyData, text: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-rose-500 outline-none min-h-[100px]"
                      placeholder="مثال: تأخر متكرر، إهمال في العمل..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">جهة إصدار العقوبة</label>
                    <input 
                      type="text"
                      required
                      value={penaltyData.authority}
                      onChange={(e) => setPenaltyData({...penaltyData, authority: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                      placeholder="مثال: الإدارة العامة، مصلحة الموارد البشرية..."
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95"
                >
                  تأكيد وتسجيل العقوبة
                </button>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
      {Icon && (
        <div className={`p-3 rounded-xl text-white ${color || 'bg-blue-600 shadow-lg shadow-blue-500/20'}`}>
          <Icon size={24} />
        </div>
      )}
      <div>
        <div className="text-xl font-bold text-slate-900 dark:text-white leading-none mb-1">{value}</div>
        <div className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-widest">{title}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }: any) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 mr-1">{label}</label>
      <input 
        {...props} 
        className="w-full px-4 py-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all shadow-sm"
      />
    </div>
  );
}
