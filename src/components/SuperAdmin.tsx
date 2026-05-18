import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  ShieldAlert, 
  Users, 
  Store, 
  BarChart3, 
  Trash2, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign,
  Coffee,
  AlertTriangle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, cn } from '../lib/utils';

interface StoreData {
  id: string;
  storeName?: string;
  ownerName?: string;
  income?: number;
  expense?: number;
  address?: string;
  phone?: string;
}

export default function SuperAdmin() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Listen to all metadata docs (each docId = userId)
    return onSnapshot(collection(db, 'metadata'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoreData));
      setStores(data);
      setLoading(false);
    });
  }, []);

  const handleDeleteStore = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'metadata', itemToDelete));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  const totalRevenue = stores.reduce((acc, s) => acc + (s.income || 0), 0);
  const totalExpense = stores.reduce((acc, s) => acc + (s.expense || 0), 0);
  const filteredStores = stores.filter(s => 
    s.storeName?.toLowerCase().includes(search.toLowerCase()) || 
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
             QUẢN TRỊ HỆ THỐNG
          </h1>
          <p className="text-stone-500 text-sm font-medium">Bảng điều khiển tối cao dành cho Admin hệ thống.</p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-stone-900 p-6 rounded-2xl shadow-xl text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/10 rounded-lg"><Store className="w-5 h-5 text-emerald-400" /></div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Tổng số cửa hàng</span>
          </div>
          <h2 className="text-3xl font-black">{stores.length}</h2>
          <p className="text-stone-500 text-[10px] mt-2 font-bold uppercase tracking-tighter">Đang hoạt động trên hệ thống</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Tổng doanh thu hệ thống</span>
          </div>
          <h2 className="text-3xl font-black text-emerald-600">{formatCurrency(totalRevenue)}</h2>
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 mt-2 uppercase">
            <ArrowUpRight className="w-3 h-3" /> Toàn thời gian
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-50 rounded-lg"><BarChart3 className="w-5 h-5 text-red-600" /></div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Tổng chi phí hệ thống</span>
          </div>
          <h2 className="text-3xl font-black text-red-600">{formatCurrency(totalExpense)}</h2>
          <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 mt-2 uppercase">
            <ArrowDownRight className="w-3 h-3" /> Toàn thời gian
          </div>
        </div>
      </div>

      {/* Stores List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <h3 className="font-black text-stone-900 uppercase tracking-widest text-sm">Danh sách cửa hàng</h3>
           <div className="relative w-full sm:w-64">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
             <input 
               type="text" 
               placeholder="Tìm theo tên hoặc ID..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-200 transition-all font-medium"
             />
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 text-[10px] uppercase font-black tracking-widest text-stone-400 border-b border-stone-100">
                <th className="px-6 py-4">Cửa hàng</th>
                <th className="px-6 py-4">Chủ sở hữu</th>
                <th className="px-6 py-4">Doanh thu</th>
                <th className="px-6 py-4">Chi phí</th>
                <th className="px-6 py-4">Lợi nhuận</th>
                <th className="px-6 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-stone-400 italic">Đang tải dữ liệu...</td></tr>
              ) : filteredStores.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-stone-400 italic">Không có cửa hàng nào.</td></tr>
              ) : filteredStores.map(s => (
                <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-stone-600" />
                      </div>
                      <div>
                        <div className="font-black text-stone-900 text-sm">{s.storeName || 'Cửa hàng chưa đặt tên'}</div>
                        <div className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">ID: {s.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-stone-800">{s.ownerName || '---'}</div>
                    <div className="text-[10px] text-stone-400">{s.phone || '---'}</div>
                  </td>
                  <td className="px-6 py-4 font-black text-emerald-600 text-sm">{formatCurrency(s.income || 0)}</td>
                  <td className="px-6 py-4 font-black text-red-500 text-sm">{formatCurrency(s.expense || 0)}</td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "font-black text-sm",
                      (s.income || 0) - (s.expense || 0) >= 0 ? "text-stone-900" : "text-orange-500"
                    )}>
                      {formatCurrency((s.income || 0) - (s.expense || 0))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setItemToDelete(s.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
              <div className="flex flex-col items-center text-center pt-2">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-2 uppercase italic tracking-tight">Xác nhận xóa?</h3>
                <p className="text-stone-500 text-sm mb-6 leading-relaxed">
                  Bạn có chắc chắn muốn xóa vĩnh viễn cửa hàng này? <br/>
                  <span className="font-bold text-red-500 text-xs mt-2 block">Cảnh báo: Hành động này không thể hoàn tác!</span>
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={handleDeleteStore}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                  >
                    ĐỒNG Ý XÓA
                  </button>
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-4 rounded-2xl transition-all"
                  >
                    HỦY BỎ
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
