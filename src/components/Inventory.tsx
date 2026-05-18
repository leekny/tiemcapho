import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, Timestamp, increment, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Category } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ArrowDownLeft, 
  CheckCircle2, 
  XCircle,
  Package,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    category: 'Coffee' as Category,
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'products'),
      where('userId', '==', user.uid)
    );

    return onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          userId: auth.currentUser?.uid,
          updatedAt: new Date().toISOString(),
          currentStock: 9999, // Placeholder
          minStock: 0,
          unit: 'ly'
        });
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', price: 0, category: 'Coffee' });
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
      await deleteDoc(doc(db, 'products', itemToDelete));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteReason('');
    } catch (error: any) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Quản lý thực đơn</h1>
          <p className="text-stone-500">Thêm, sửa hoặc xóa các món trong thực đơn của quán.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { setIsModalOpen(true); setEditingProduct(null); }}
            className="bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-stone-800 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Thêm món mới
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/50">
          <div className="relative group w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-stone-800 transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm món..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-stone-200"
            />
          </div>
          <div className="flex items-center gap-4 text-xs sm:text-sm text-stone-500 font-medium">
             <span className="flex items-center gap-1.5 whitespace-nowrap"><Package className="w-4 h-4" /> Tổng số: {products.length} món</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-500 text-[10px] uppercase tracking-widest font-bold border-b border-stone-100">
                <th className="px-4 sm:px-6 py-3 sm:py-4">Món / Loại</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Giá bán</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors group">
                  <td className="px-4 sm:px-6 py-2.5 sm:py-4">
                    <div className="font-bold text-stone-900 text-xs sm:text-sm">{p.name}</div>
                    <div className="text-[10px] sm:text-xs text-stone-500 font-medium">{p.category}</div>
                    <div className="sm:hidden font-black text-stone-900 mt-0.5 text-[10px]">{formatCurrency(p.price)}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-stone-700 hidden sm:table-cell text-sm">{formatCurrency(p.price)}</td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-4 text-right">
                    <div className="flex justify-end gap-1 sm:gap-2">
                       <button 
                         onClick={() => { setEditingProduct(p); setFormData({ name: p.name, price: p.price, category: p.category }); setIsModalOpen(true); }}
                         className="p-1.5 sm:p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                       >
                         <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                       </button>
                       <button 
                         onClick={() => { setItemToDelete(p.id); setIsDeleteModalOpen(true); }}
                         className="p-1.5 sm:p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                       >
                         <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                <h3 className="text-xl font-bold text-red-900">Xác nhận xóa món hàng</h3>
                <button onClick={() => setIsDeleteModalOpen(false)} className="text-red-400 hover:text-red-900"><XCircle /></button>
              </div>
              <div className="p-8 space-y-4">
                <p className="text-stone-600 text-sm">Hành động này sẽ xóa vĩnh viễn món hàng khỏi thực đơn. Vui lòng nhập lý do.</p>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Lý do xóa *</label>
                  <textarea 
                    required 
                    value={deleteReason} 
                    onChange={e => setDeleteReason(e.target.value)} 
                    placeholder="Ví dụ: Món này không còn bán, nhập sai thông tin..."
                    className="w-full border border-stone-200 rounded-xl px-4 py-2 h-24 outline-none focus:ring-2 focus:ring-red-200" 
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 bg-stone-100 text-stone-600 font-bold py-3 rounded-xl hover:bg-stone-200 transition-all"
                  >
                    HỦY BỎ
                  </button>
                  <button 
                    onClick={handleDelete}
                    disabled={!deleteReason.trim()}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-xl shadow-red-100 hover:bg-red-700 disabled:opacity-50 transition-all"
                  >
                    XÁC NHẬN XÓA
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Form Modal */}
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
                <h3 className="text-xl font-bold">{editingProduct ? 'Chỉnh sửa' : 'Thêm mới'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-900"><XCircle /></button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Tên món *</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Loại món</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})} className="w-full border border-stone-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-stone-200">
                    <option value="Coffee">Cà phê</option>
                    <option value="Tea">Trà / Nước trái cây</option>
                    <option value="Food">Đồ ăn / Bánh</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Giá bán (VNĐ) *</label>
                  <input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full border border-stone-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl mt-4 shadow-xl hover:bg-stone-800 transition-all">LƯU THÔNG TIN</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
