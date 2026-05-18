import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  increment,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Order, Transaction } from '../types';
import { 
  TrendingUp, 
  AlertTriangle, 
  ShoppingBag, 
  Wallet,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Coffee,
  Trash2,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { deleteDoc } from 'firebase/firestore';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    monthRevenue: 0,
    todayOrders: 0,
    totalBalance: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const handleDelete = async () => {
    if (!itemToDelete || !deleteReason.trim()) return;
    try {
      await deleteDoc(doc(db, 'orders', itemToDelete));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteReason('');
    } catch (error: any) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  useEffect(() => {
    // Basic stats aggregation
    const ordersRef = collection(db, 'orders');
    const transactionsRef = collection(db, 'transactions');

    const unsubOrders = onSnapshot(query(ordersRef, orderBy('createdAt', 'desc'), limit(10)), (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setRecentOrders(orders);
      
      // Calculate today stats (mocking today for simplicity in this demo)
      let todayRev = 0;
      orders.forEach(o => todayRev += o.totalAmount);
      setStats(prev => ({ ...prev, todayRevenue: todayRev, todayOrders: orders.length }));
    });

    const unsubTransactions = onSnapshot(transactionsRef, (snapshot) => {
      const transactions = snapshot.docs.map(doc => doc.data() as Transaction);
      let income = 0;
      let expense = 0;
      transactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      });
      setStats(prev => ({ ...prev, totalBalance: income - expense }));
    });

    // Mock chart data
    setChartData([
      { date: '01/05', rev: 1200000 },
      { date: '02/05', rev: 1500000 },
      { date: '03/05', rev: 1100000 },
      { date: '04/05', rev: 1800000 },
      { date: '05/05', rev: 2200000 },
      { date: '06/05', rev: 1900000 },
      { date: '07/05', rev: 2500000 },
    ]);

    return () => {
      unsubOrders();
      unsubTransactions();
    };
  }, []);

  const statCards = [
    { title: 'Doanh thu hôm nay', value: formatCurrency(stats.todayRevenue), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+12%' },
    { title: 'Đơn hàng hôm nay', value: stats.todayOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+5%' },
    { title: 'Số dư quỹ', value: formatCurrency(stats.totalBalance), icon: Wallet, color: 'text-stone-600', bg: 'bg-stone-50', trend: 'Cập nhật live' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Tổng quan cửa hàng</h1>
        <p className="text-stone-500">Chào mừng trở lại! Tại đây là tóm tắt tình hình kinh doanh của bạn.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">{stat.title}</p>
                <div className="flex items-baseline gap-2">
                   <h3 className="text-2xl font-bold text-stone-900">{stat.value}</h3>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
               {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : null}
               <span className={stat.trend.startsWith('+') ? "text-emerald-500" : "text-stone-400"}>{stat.trend}</span>
               <span className="text-stone-400 ml-1">so với hôm qua</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-stone-900">Biểu đồ doanh thu (7 ngày qua)</h3>
             <select className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-stone-200">
               <option>7 ngày qua</option>
               <option>30 ngày qua</option>
             </select>
           </div>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c4a484" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#c4a484" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#78716c'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#78716c'}} tickFormatter={(v) => `${v/1000000}M`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="rev" stroke="#3d2b1f" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-stone-900">Đơn hàng gần đây</h3>
             <button className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-wider">Xem tất cả</button>
           </div>
           <div className="space-y-4">
             {recentOrders.length === 0 ? (
               <p className="text-center text-stone-400 py-8 italic">Chưa có đơn hàng nào.</p>
             ) : (
               recentOrders.map((order) => (
                 <div key={order.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-100">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center shrink-0">
                       <Coffee className="w-5 h-5 text-stone-600" />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-stone-900">#{order.id.slice(-5)}</p>
                       <p className="text-xs text-stone-500">{format(new Date(order.createdAt), 'HH:mm dd/MM')}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="text-right">
                       <p className="text-sm font-bold text-stone-900">{formatCurrency(order.totalAmount)}</p>
                       <span className={cn(
                         "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                         order.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                       )}>
                         {order.status === 'completed' ? 'Xong' : 'Hủy'}
                       </span>
                     </div>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         setItemToDelete(order.id);
                         setIsDeleteModalOpen(true);
                       }}
                       className="p-1.5 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-lg transition-colors"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
               ))
             )}
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-left"
            >
              <div className="p-8 border-b border-stone-100 bg-red-50 flex items-center justify-between">
                <h3 className="text-xl font-bold text-red-900 text-pretty">Xác nhận hủy/xóa đơn hàng</h3>
                <button onClick={() => setIsDeleteModalOpen(false)} className="text-red-400 hover:text-red-900"><XCircle className="w-5 h-5"/></button>
              </div>
              <div className="p-8 space-y-4">
                <p className="text-stone-600 text-sm">Vui lòng nhập lý do trước khi xóa đơn hàng này từ lịch sử.</p>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Lý do xóa *</label>
                  <textarea 
                    required 
                    value={deleteReason} 
                    onChange={e => setDeleteReason(e.target.value)} 
                    placeholder="Lý do: Khách đổi ý, nhập nhầm đơn..."
                    className="w-full border border-stone-200 rounded-xl px-4 py-2 h-24 outline-none focus:ring-2 focus:ring-red-200" 
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
