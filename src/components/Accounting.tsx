import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  limit, 
  startAfter, 
  getDocs, 
  QueryDocumentSnapshot, 
  setDoc,
  getDoc,
  increment,
  updateDoc,
  where
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
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
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter as FilterIcon,
  Edit2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Accounting() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalStats, setTotalStats] = useState({ income: 0, expense: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setFormData({ type: 'income', amount: 0, category: 'Sales', description: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setFormData({
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description || '',
    });
    setIsModalOpen(true);
  };
  
  // Advanced Pagination State
  const [pageSnapshots, setPageSnapshots] = useState<QueryDocumentSnapshot[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 12;

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    amount: 0,
    category: 'Sales',
    description: '',
  });

  // Listen for overall stats from a summary document
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const summaryRef = doc(db, 'metadata', user.uid);
    
    // Initialize summary if not exists (quietly)
    const initSummary = async () => {
      const snap = await getDoc(summaryRef);
      if (!snap.exists()) {
        await setDoc(summaryRef, { income: 0, expense: 0 });
      }
    };
    initSummary();

    return onSnapshot(summaryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTotalStats({ income: data.income || 0, expense: data.expense || 0 });
      }
    });
  }, []);

  // Fetch paginated transactions using a snapshot stack
  const fetchTransactions = async (pageToFetch: number) => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      let q = query(
        collection(db, 'transactions'), 
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(PAGE_SIZE)
      );

      // If fetching a page higher than 1, use the snapshot before it
      if (pageToFetch > 1 && pageSnapshots[pageToFetch - 2]) {
        q = query(
          collection(db, 'transactions'), 
          where('userId', '==', user.uid),
          orderBy('date', 'desc'), 
          startAfter(pageSnapshots[pageToFetch - 2]), 
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      
      setTransactions(items);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      
      // Update the snapshot for the current page
      if (snapshot.docs.length > 0) {
        setPageSnapshots(prev => {
          const newStack = [...prev];
          newStack[pageToFetch - 1] = snapshot.docs[snapshot.docs.length - 1];
          return newStack;
        });
      }
      
      setPage(pageToFetch);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);
  }, []); // Initial load

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    try {
      const summaryRef = doc(db, 'metadata', user.uid);

      if (editingTransaction) {
        // Mode: CHỈNH SỬA GIAO DỊCH BẰNG UPDATE
        const transactionRef = doc(db, 'transactions', editingTransaction.id);
        const oldType = editingTransaction.type;
        const oldAmount = editingTransaction.amount;
        const newType = formData.type;
        const newAmount = formData.amount;

        const updatedData = {
          type: newType,
          amount: newAmount,
          category: formData.category,
          description: formData.description,
          updatedAt: new Date().toISOString()
        };

        try {
          await updateDoc(transactionRef, updatedData);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `transactions/${editingTransaction.id}`);
        }

        // Adjust overall stats
        const statsUpdates: any = {};
        if (oldType === newType) {
          const delta = newAmount - oldAmount;
          if (delta !== 0) {
            statsUpdates[newType] = increment(delta);
          }
        } else {
          statsUpdates[oldType] = increment(-oldAmount);
          statsUpdates[newType] = increment(newAmount);
        }

        if (Object.keys(statsUpdates).length > 0) {
          try {
            await updateDoc(summaryRef, statsUpdates);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `metadata/${user.uid}`);
          }
        }
      } else {
        // Mode: THÊM MỚI GIAO DỊCH BẰNG ADD
        const transactionData = {
          ...formData,
          userId: user.uid,
          date: new Date().toISOString()
        };
        
        try {
          await addDoc(collection(db, 'transactions'), transactionData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'transactions');
        }
        
        // Update summary document atomically
        try {
          await updateDoc(summaryRef, {
            [formData.type]: increment(formData.amount)
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `metadata/${user.uid}`);
        }
      }

      setIsModalOpen(false);
      setEditingTransaction(null);
      setFormData({ type: 'income', amount: 0, category: 'Sales', description: '' });
      fetchTransactions(editingTransaction ? page : 1); // Stay on current page if editing, otherwise back to page 1
    } catch (err) {
      console.error('Error saving transaction:', err);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Transaction | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!itemToDelete || !deleteReason.trim() || !user) return;
    try {
      await deleteDoc(doc(db, 'transactions', itemToDelete.id));
      
      // Update summary document atomically
      const summaryRef = doc(db, 'metadata', user.uid);
      await updateDoc(summaryRef, {
        [itemToDelete.type]: increment(-itemToDelete.amount)
      });

      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteReason('');
      fetchTransactions(page); // Refresh current page
    } catch (error: any) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    (filter === 'all' || t.type === filter) &&
    (t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Quản lý thu chi</h1>
          <p className="text-stone-500">Theo dõi dòng tiền và nguồn chi trong cửa hàng.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-stone-800 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5" /> Thêm giao dịch
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ArrowUpCircle /></div>
             <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Tổng thu</p>
           </div>
           <h3 className="text-2xl font-black text-emerald-600">{formatCurrency(totalStats.income)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-red-50 rounded-lg text-red-600"><ArrowDownCircle /></div>
             <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Tổng chi</p>
           </div>
           <h3 className="text-2xl font-black text-red-600">{formatCurrency(totalStats.expense)}</h3>
        </div>
        <div className="bg-stone-900 p-6 rounded-2xl shadow-xl border border-stone-800">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-stone-800 rounded-lg text-stone-400"><TrendingUp className="w-5 h-5" /></div>
             <p className="text-sm font-bold text-stone-400 uppercase tracking-wider">Số dư hiện tại</p>
           </div>
           <h3 className="text-2xl font-black text-white">{formatCurrency(totalStats.income - totalStats.expense)}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-stone-50/50">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {(['all', 'income', 'expense'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wide border whitespace-nowrap",
                  filter === f 
                    ? "bg-stone-900 text-white border-stone-900 shadow-lg" 
                    : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                )}
              >
                {f === 'all' ? 'Tất cả' : f === 'income' ? 'Khoản thu' : 'Khoản chi'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
             <div className="relative group flex-1 lg:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
               <input 
                 type="text" 
                 placeholder="Tìm giao dịch..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-white border border-stone-200 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-stone-200 text-sm"
               />
             </div>
             <button className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 shrink-0"><Download className="w-4 h-4 text-stone-500" /></button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
           <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-stone-50 text-stone-500 text-[10px] uppercase tracking-widest font-bold border-b border-stone-100">
                 <th className="px-4 sm:px-6 py-2 sm:py-4">Mô tả / Ngày</th>
                 <th className="px-6 py-4 hidden sm:table-cell">Phân loại</th>
                 <th className="px-4 sm:px-6 py-2 sm:py-4 text-right">Số tiền</th>
                 <th className="px-4 py-2 sm:py-4 text-right"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-stone-100">
               {loading && filteredTransactions.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic text-xs">Đang tải dữ liệu...</td>
                 </tr>
               ) : filteredTransactions.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic text-xs">Không tìm thấy giao dịch nào.</td>
                 </tr>
               ) : (
                 filteredTransactions.map((t) => (
                   <tr key={t.id} className="hover:bg-stone-50/50 transition-colors group">
                     <td className="px-4 sm:px-6 py-1.5 sm:py-4">
                        <div className="text-[9px] sm:text-xs text-stone-400 font-bold mb-0">
                          {format(new Date(t.date), 'dd/MM HH:mm')}
                        </div>
                        <div className="text-[11px] sm:text-sm font-bold text-stone-800 line-clamp-1 leading-tight">{t.description || 'Không mô tả'}</div>
                        <div className="sm:hidden text-[8px] text-stone-400 font-bold uppercase tracking-tighter">{t.category}</div>
                     </td>
                     <td className="px-6 py-4 hidden sm:table-cell">
                       <span className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-stone-100 uppercase bg-stone-50 text-stone-500">
                         {t.category}
                       </span>
                     </td>
                     <td className="px-4 sm:px-6 py-1.5 sm:py-4 text-right">
                       <div className={cn(
                         "font-black text-xs sm:text-base flex items-center justify-end gap-1 leading-none",
                         t.type === 'income' ? "text-emerald-600" : "text-red-500"
                       )}>
                         {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                       </div>
                     </td>
                      <td className="px-4 py-1.5 sm:py-4 text-right">
                         <div className="flex justify-end items-center gap-1.5 sm:gap-2">
                           <button 
                             onClick={() => handleOpenEdit(t)}
                             className="p-1 sm:p-2 hover:bg-stone-100 text-stone-300 hover:text-stone-700 rounded-lg transition-colors cursor-pointer"
                             title="Chỉnh sửa"
                           >
                             <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                           </button>
                           <button 
                             onClick={() => { 
                               setItemToDelete(t);
                               setIsDeleteModalOpen(true);
                             }}
                             className="p-1 sm:p-2 hover:bg-red-50 text-stone-300 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                             title="Xoá"
                           >
                             <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                           </button>
                         </div>
                      </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-4">
           <div className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-4">
             <span>Trang {page}</span>
             {loading && <span className="text-[10px] animate-pulse">Đang tải...</span>}
           </div>
           <div className="flex gap-2">
             <button
               onClick={() => fetchTransactions(1)}
               disabled={page === 1 || loading}
               className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider"
             >
               Đầu trang
             </button>
             <button
               onClick={() => fetchTransactions(page - 1)}
               disabled={page === 1 || loading}
               className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider shadow-sm"
             >
               <ChevronLeft className="w-3 h-3" />
               Trước
             </button>
             <button
               onClick={() => fetchTransactions(page + 1)}
               disabled={!hasMore || loading}
               className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-stone-200"
             >
               Tiếp
               <ChevronRight className="w-3 h-3" />
             </button>
           </div>
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
                <h3 className="text-xl font-bold font-sans">
                  {editingTransaction ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch mới'}
                </h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-900 cursor-pointer"><XCircle /></button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-4 font-sans">
                <div className="flex p-1 bg-stone-100 rounded-xl">
                  {(['income', 'expense'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({
                        ...formData, 
                        type, 
                        category: type === 'income' ? 'Sales' : 'Supplies'
                      })}
                      className={cn(
                        "flex-1 py-3 rounded-lg text-sm font-bold transition-all cursor-pointer",
                        formData.type === type ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                      )}
                    >
                      {type === 'income' ? 'Khoản thu' : 'Khoản chi'}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Số tiền (VNĐ) *</label>
                  <input type="number" required value={formData.amount || ''} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Danh mục *</label>
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-200"
                  >
                    {formData.type === 'income' ? (
                      <>
                        <option value="Sales">Doanh thu bán hàng</option>
                        <option value="Other">Khác</option>
                      </>
                    ) : (
                      <>
                        <option value="Supplies">Nguyên liệu / Nhập hàng</option>
                        <option value="Rent">Mặt bằng</option>
                        <option value="Salary">Lương nhân viên</option>
                        <option value="Electricity">Điện nước</option>
                        <option value="Marketing">Quảng bá</option>
                        <option value="Other">Khác</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Ghi chú</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2 h-24 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-3 rounded-xl mt-4 shadow-xl transition-all cursor-pointer">
                  {editingTransaction ? 'CẬP NHẬT GIAO DỊCH' : 'LƯU GIAO DỊCH'}
                </button>
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
