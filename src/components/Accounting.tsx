import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Plus, 
  Search, 
  Trash2, 
  Download,
  Calendar,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Accounting() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    amount: 0,
    category: 'Sales',
    description: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'transactions'), {
        ...formData,
        date: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({ type: 'income', amount: 0, category: 'Sales', description: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const handleDelete = async () => {
    if (!itemToDelete || !deleteReason.trim()) return;
    try {
      await deleteDoc(doc(db, 'transactions', itemToDelete));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteReason('');
    } catch (error: any) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    (filter === 'all' || t.type === filter) &&
    (t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))
  );

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Quản lý thu chi</h1>
          <p className="text-stone-500">Theo dõi dòng tiền và nguồn chi trong cửa hàng.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-stone-800 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Thêm giao dịch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ArrowUpCircle /></div>
             <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Tổng thu</p>
           </div>
           <h3 className="text-2xl font-black text-emerald-600">{formatCurrency(totalIncome)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-red-50 rounded-lg text-red-600"><ArrowDownCircle /></div>
             <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Tổng chi</p>
           </div>
           <h3 className="text-2xl font-black text-red-600">{formatCurrency(totalExpense)}</h3>
        </div>
        <div className="bg-stone-900 p-6 rounded-2xl shadow-xl border border-stone-800">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-stone-800 rounded-lg text-stone-400"><TrendingUp className="w-5 h-5" /></div>
             <p className="text-sm font-bold text-stone-400 uppercase tracking-wider">Số dư hiện tại</p>
           </div>
           <h3 className="text-2xl font-black text-white">{formatCurrency(totalIncome - totalExpense)}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-stone-50/50">
          <div className="flex gap-2">
            {(['all', 'income', 'expense'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide border",
                  filter === f 
                    ? "bg-stone-900 text-white border-stone-900 shadow-lg" 
                    : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                )}
              >
                {f === 'all' ? 'Tất cả' : f === 'income' ? 'Khoản thu' : 'Khoản chi'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative group flex-1 md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
               <input 
                 type="text" 
                 placeholder="Tìm giao dịch..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-white border border-stone-200 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-stone-200"
               />
             </div>
             <button className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50"><Download className="w-4 h-4 text-stone-500" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-stone-50 text-stone-500 text-[10px] uppercase tracking-widest font-bold">
                 <th className="px-6 py-4">Ngày giao dịch</th>
                 <th className="px-6 py-4">Mô tả</th>
                 <th className="px-6 py-4">Phân loại</th>
                 <th className="px-6 py-4 text-right">Số tiền</th>
                 <th className="px-6 py-4 text-right">Thao tác</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-stone-100">
               {filteredTransactions.map((t) => (
                 <tr key={t.id} className="hover:bg-stone-50 transition-colors group">
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-2 text-stone-900 font-medium">
                       <Calendar className="w-3 h-3 text-stone-400" />
                       {format(new Date(t.date), 'dd/MM/yyyy HH:mm')}
                     </div>
                   </td>
                   <td className="px-6 py-4">
                     <div className="text-sm font-bold text-stone-800">{t.description || 'Không có mô tả'}</div>
                     {t.relatedObjectId && <div className="text-[10px] text-stone-400 uppercase font-bold">REF: {t.relatedObjectId.slice(-8)}</div>}
                   </td>
                   <td className="px-6 py-4">
                     <span className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-stone-100 uppercase bg-stone-50 text-stone-500">
                       {t.category}
                     </span>
                   </td>
                   <td className="px-6 py-4 text-right">
                     <div className={cn(
                       "font-black text-base flex items-center justify-end gap-1",
                       t.type === 'income' ? "text-emerald-600" : "text-red-500"
                     )}>
                       {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                     </div>
                   </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                         onClick={() => { 
                           setItemToDelete(t.id);
                           setIsDeleteModalOpen(true);
                         }}
                         className="p-2 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded-lg transition-opacity"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                <h3 className="text-xl font-bold">Thêm giao dịch mới</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-900"><XCircle /></button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-4">
                <div className="flex p-1 bg-stone-100 rounded-xl">
                  {(['income', 'expense'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, type})}
                      className={cn(
                        "flex-1 py-3 rounded-lg text-sm font-bold transition-all",
                        formData.type === type ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                      )}
                    >
                      {type === 'income' ? 'Khoản thu' : 'Khoản chi'}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Số tiền (VNĐ) *</label>
                  <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="w-full border border-stone-200 rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Danh mục *</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2">
                    <option value="Sales">Doanh thu bán hàng</option>
                    <option value="Supplies">Nguyên liệu / Nhập hàng</option>
                    <option value="Rent">Mặt bằng</option>
                    <option value="Salary">Lương nhân viên</option>
                    <option value="Electricity">Điện nước</option>
                    <option value="Marketing">Quảng bá</option>
                    <option value="Other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Ghi chú</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2 h-24" />
                </div>
                <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl mt-4 shadow-xl hover:bg-stone-800 transition-all">LƯU GIAO DỊCH</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 bg-red-50 flex items-center justify-between">
                <h3 className="text-xl font-bold text-red-900 font-sans">Xác nhận xóa giao dịch</h3>
                <button onClick={() => setIsDeleteModalOpen(false)} className="text-red-400 hover:text-red-900"><XCircle /></button>
              </div>
              <div className="p-8 space-y-4">
                <p className="text-stone-600 text-sm font-sans">Hành động này không thể hoàn tác. Vui lòng nhập lý do xóa để tiếp tục.</p>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1 font-sans">Lý do xóa *</label>
                  <textarea 
                    required 
                    value={deleteReason} 
                    onChange={e => setDeleteReason(e.target.value)} 
                    placeholder="Ví dụ: Nhập sai số tiền, giao dịch bị hủy..."
                    className="w-full border border-stone-200 rounded-xl px-4 py-2 h-24 outline-none focus:ring-2 focus:ring-red-200 font-sans text-sm" 
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 bg-stone-100 text-stone-600 font-bold py-3 rounded-xl hover:bg-stone-200 transition-all font-sans"
                  >
                    HỦY BỎ
                  </button>
                  <button 
                    onClick={handleDelete}
                    disabled={!deleteReason.trim()}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-xl shadow-red-100 hover:bg-red-700 disabled:opacity-50 transition-all font-sans"
                  >
                    XÁC NHẬN XÓA
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
