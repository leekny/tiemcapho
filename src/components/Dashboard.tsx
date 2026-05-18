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
  limit,
  where,
  startAt,
  endAt
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
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
  XCircle,
  PlusCircle,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, cn } from '../lib/utils';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { deleteDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    monthRevenue: 0,
    todayOrders: 0,
    totalBalance: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersLimit, setOrdersLimit] = useState(6);
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
    const user = auth.currentUser;
    if (!user) return;
    const userId = user.uid;

    const ordersRef = collection(db, 'orders');
    const transactionsRef = collection(db, 'transactions');

    // 1. Precise Today Stats (Date range query to reduce data transfer)
    const today = new Date().toISOString().split('T')[0]; // Simple YYYY-MM-DD
    const startOfToday = startOfDay(new Date()).toISOString();
    const endOfToday = endOfDay(new Date()).toISOString();

    const todayOrdersQuery = query(
      ordersRef, 
      where('userId', '==', userId),
      where('createdAt', '>=', startOfToday),
      where('createdAt', '<=', endOfToday)
    );

    const unsubTodayStats = onSnapshot(todayOrdersQuery, (snapshot) => {
      let revenue = 0;
      snapshot.docs.forEach(doc => {
        revenue += (doc.data() as Order).totalAmount;
      });
      setStats(prev => ({ ...prev, todayRevenue: revenue, todayOrders: snapshot.docs.length }));
    });

    // 2. Recent Orders with Pagination (Load More via increasing limit)
    const recentOrdersQuery = query(
      ordersRef, 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'), 
      limit(ordersLimit)
    );
    const unsubRecentOrders = onSnapshot(recentOrdersQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setRecentOrders(orders);
    });

    // 3. Balance calculation from summary metadata
    const summaryRef = doc(db, 'metadata', userId);
    const unsubSummary = onSnapshot(summaryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setStats(prev => ({ ...prev, totalBalance: (data.income || 0) - (data.expense || 0) }));
      }
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
      unsubTodayStats();
      unsubRecentOrders();
      unsubSummary();
    };
  }, [ordersLimit]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "bg-white p-3 sm:p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between",
              i === 2 && "col-span-2 lg:col-span-1" // Make the last card full width on mobile or just regular
            )}
          >
            <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 sm:gap-4 mb-2 sm:mb-4">
              <div className={cn("p-2 sm:p-3 rounded-xl shrink-0", stat.bg)}>
                <stat.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-sm font-bold text-stone-400 uppercase tracking-wider truncate">{stat.title}</p>
                <h3 className="text-sm sm:text-2xl font-black text-stone-900 truncate">{stat.value}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9px] sm:text-xs font-bold uppercase tracking-tighter sm:tracking-normal">
               {stat.trend.startsWith('+') ? <ArrowUpRight className="w-2.5 h-2.5 text-emerald-500" /> : null}
               <span className={stat.trend.startsWith('+') ? "text-emerald-500" : "text-stone-400"}>{stat.trend}</span>
               <span className="text-stone-400 ml-1 hidden sm:inline">so với hôm qua</span>
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
           <div className="h-[200px] sm:h-[300px] w-full">
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col">
           <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-stone-900">Đơn hàng gần đây</h3>
             <button 
               onClick={() => setOrdersLimit(l => l + 5)}
               className="text-[10px] font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-widest flex items-center gap-1"
             >
               <PlusCircle className="w-3 h-3" /> Tải thêm
             </button>
           </div>
            <div className="space-y-3 flex-1">
             {recentOrders.length === 0 ? (
               <p className="text-center text-stone-400 py-8 italic">Chưa có đơn hàng nào.</p>
             ) : (
               recentOrders.map((order) => (
                 <div key={order.id} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-100">
                   <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                     <div className="w-8 h-8 sm:w-10 sm:h-10 bg-stone-100 rounded-full flex items-center justify-center shrink-0">
                       <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" />
                     </div>
                     <div className="min-w-0">
                       <p className="text-xs sm:text-sm font-bold text-stone-900 truncate">#{order.id.slice(-5)}</p>
                       <p className="text-[10px] text-stone-500">{format(new Date(order.createdAt), 'HH:mm dd/MM')}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                     <div className="text-right">
                       <p className="text-xs sm:text-sm font-black text-stone-900">{formatCurrency(order.totalAmount)}</p>
                       <span className={cn(
                         "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase",
                         order.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
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
                       <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                     </button>
                   </div>
                 </div>
               ))
             )}
           </div>
           {recentOrders.length > 0 && (
             <div className="mt-6 pt-4 border-t border-stone-100 flex justify-center">
                <button 
                  onClick={() => setOrdersLimit(l => l + 5)}
                  className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 uppercase tracking-widest"
                >
                  <History className="w-4 h-4" /> Xem thêm đơn hàng
                </button>
             </div>
           )}
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
