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
  endAt,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Order, Transaction, OrderItem } from '../types';
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
  History,
  Edit3,
  Check,
  Plus,
  Minus,
  Search,
  X
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

  // Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Detailed view & editing state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
  const [editedStatus, setEditedStatus] = useState<'completed' | 'cancelled'>('completed');
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  const handleDelete = async () => {
    if (!itemToDelete || !deleteReason.trim() || !auth.currentUser) return;
    try {
      const uId = auth.currentUser.uid;
      const orderToDel = recentOrders.find(o => o.id === itemToDelete);

      if (orderToDel) {
        // Find corresponding transaction
        const txQuery = query(collection(db, 'transactions'), where('relatedObjectId', '==', itemToDelete));
        const txSnap = await getDocs(txQuery);
        for (const txDoc of txSnap.docs) {
          await deleteDoc(doc(db, 'transactions', txDoc.id));
        }

        // Decrement income in summary if status was completed
        if (orderToDel.status === 'completed') {
          const summaryRef = doc(db, 'metadata', uId);
          await updateDoc(summaryRef, {
            income: increment(-orderToDel.totalAmount)
          }).catch(err => console.warn('Metadata state wasn\'t updated: ', err));
        }
      }

      await deleteDoc(doc(db, 'orders', itemToDelete));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteReason('');
    } catch (error: any) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedOrder || !auth.currentUser) return;
    setSaving(true);
    try {
      const user = auth.currentUser;
      const newTotal = editedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

      const oldAmount = selectedOrder.status === 'completed' ? selectedOrder.totalAmount : 0;
      const newAmount = editedStatus === 'completed' ? newTotal : 0;
      const diff = newAmount - oldAmount;

      // 1. Update order document
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        items: editedItems,
        totalAmount: newTotal,
        status: editedStatus,
      });

      // 2. Update associated transaction
      const txQuery = query(collection(db, 'transactions'), where('relatedObjectId', '==', selectedOrder.id));
      const txSnap = await getDocs(txQuery);
      if (!txSnap.empty) {
        const txDoc = txSnap.docs[0];
        if (editedStatus === 'completed') {
          await updateDoc(doc(db, 'transactions', txDoc.id), {
            amount: newTotal,
            description: `Order #${selectedOrder.id.slice(-5)} (Đã sửa)`
          });
        } else {
          await updateDoc(doc(db, 'transactions', txDoc.id), {
            amount: 0,
            description: `[Đã Hủy] Order #${selectedOrder.id.slice(-5)}`
          });
        }
      } else if (editedStatus === 'completed') {
        await addDoc(collection(db, 'transactions'), {
          type: 'income',
          amount: newTotal,
          category: 'Sales',
          description: `Order #${selectedOrder.id.slice(-5)} (Đã sửa)`,
          date: selectedOrder.createdAt,
          relatedObjectId: selectedOrder.id,
          userId: user.uid
        });
      }

      // 3. Update the metadata income balance
      if (diff !== 0) {
        const summaryRef = doc(db, 'metadata', user.uid);
        await updateDoc(summaryRef, {
          income: increment(diff)
        });
      }

      setIsDetailModalOpen(false);
      setSelectedOrder(null);
      setIsEditing(false);
      alert('Cập nhật hóa đơn thành công!');
    } catch (error: any) {
      console.error(error);
      alert('Lỗi khi lưu thay đổi: ' + error.message);
    } finally {
      setSaving(false);
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
        const orderData = doc.data() as Order;
        if (orderData.status === 'completed') {
          revenue += orderData.totalAmount;
        }
      });
      setStats(prev => ({ ...prev, todayRevenue: revenue, todayOrders: snapshot.docs.filter(d => (d.data() as Order).status === 'completed').length }));
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

    // 4. Products list listener for editing adding items
    const productsQuery = query(
      collection(db, 'products'),
      where('userId', '==', userId)
    );
    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
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
      unsubProducts();
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
                 <div 
                   key={order.id} 
                   onClick={() => {
                     setSelectedOrder(order);
                     setEditedItems([...(order.items || [])]);
                     setEditedStatus(order.status || 'completed');
                     setIsEditing(false);
                     setIsDetailModalOpen(true);
                   }}
                   className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors border border-transparent hover:border-stone-100"
                 >
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

        {isDetailModalOpen && selectedOrder && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-left my-8"
            >
              {/* Header */}
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div>
                  <h3 className="text-lg font-bold text-stone-950">
                    {isEditing ? 'Chỉnh sửa hóa đơn' : 'Chi tiết hóa đơn'} #{selectedOrder.id.slice(-5)}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {format(new Date(selectedOrder.createdAt), 'HH:mm dd/MM/yyyy')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1 px-1.5 hover:bg-stone-200 text-stone-500 hover:text-stone-900 rounded-lg transition-colors font-bold text-sm flex items-center gap-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {isEditing ? (
                  // Edit mode view
                  <div className="space-y-4">
                    {/* Add Product Search */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-600 uppercase">Thêm món vào hóa đơn</label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Tìm món để thêm..."
                          value={searchProductQuery}
                          onChange={(e) => setSearchProductQuery(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-200"
                        />
                      </div>
                      
                      {/* Search Dropdown */}
                      {searchProductQuery.trim() !== '' && (
                        <div className="bg-white border border-stone-200 rounded-xl max-h-40 overflow-y-auto shadow-md divide-y divide-stone-50">
                          {allProducts
                            .filter(p => p.name.toLowerCase().includes(searchProductQuery.toLowerCase()))
                            .map(prod => (
                              <div
                                key={prod.id}
                                onClick={() => {
                                  // Add product to editedItems
                                  const existing = editedItems.find(item => item.productId === prod.id);
                                  if (existing) {
                                    setEditedItems(prev => prev.map(item => 
                                      item.productId === prod.id ? { ...item, quantity: item.quantity + 1 } : item
                                    ));
                                  } else {
                                    setEditedItems(prev => [...prev, {
                                      productId: prod.id,
                                      name: prod.name,
                                      quantity: 1,
                                      price: prod.price
                                    }]);
                                  }
                                  setSearchProductQuery('');
                                }}
                                className="px-4 py-2 hover:bg-stone-50 cursor-pointer flex justify-between items-center text-sm"
                              >
                                <span className="font-semibold text-stone-900">{prod.name}</span>
                                <span className="text-stone-500 font-bold">{formatCurrency(prod.price)}</span>
                              </div>
                            ))
                          }
                          {allProducts.filter(p => p.name.toLowerCase().includes(searchProductQuery.toLowerCase())).length === 0 && (
                            <div className="px-4 py-2 text-xs text-stone-400 italic">Không tìm thấy sản phẩm phù hợp.</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Items list with quantity/price controls */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-600 uppercase">Danh sách mặt hàng</label>
                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {editedItems.map((item, index) => (
                          <div key={item.productId} className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-stone-100">
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-bold text-sm text-stone-900 truncate">{item.name}</p>
                              
                              {/* Price input edit */}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs text-stone-400">Giá:</span>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setEditedItems(prev => prev.map((itm, i) => 
                                      i === index ? { ...itm, price: val } : itm
                                    ));
                                  }}
                                  className="w-24 bg-white border border-stone-200 rounded-lg px-2 py-0.5 text-xs text-stone-800 font-bold text-center"
                                />
                                <span className="text-xs text-stone-400">đ</span>
                              </div>
                            </div>

                            {/* Quantity buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity <= 1) {
                                    setEditedItems(prev => prev.filter((_, i) => i !== index));
                                  } else {
                                    setEditedItems(prev => prev.map((itm, i) => 
                                      i === index ? { ...itm, quantity: itm.quantity - 1 } : itm
                                    ));
                                  }
                                }}
                                className="p-1 px-1.5 bg-white border border-stone-200 hover:border-stone-400 text-stone-500 hover:text-stone-900 rounded-lg transition-colors cursor-pointer text-xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setEditedItems(prev => prev.map((itm, i) => 
                                    i === index ? { ...itm, quantity: val } : itm
                                  ));
                                }}
                                className="w-12 bg-white border border-stone-200 rounded-lg py-0.5 text-xs text-center font-bold"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  setEditedItems(prev => prev.map((itm, i) => 
                                    i === index ? { ...itm, quantity: itm.quantity + 1 } : itm
                                  ));
                                }}
                                className="p-1 px-1.5 bg-white border border-stone-200 hover:border-stone-400 text-stone-500 hover:text-stone-900 rounded-lg transition-colors cursor-pointer text-xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>

                              {/* Remove fully */}
                              <button
                                type="button"
                                onClick={() => setEditedItems(prev => prev.filter((_, i) => i !== index))}
                                className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {editedItems.length === 0 && (
                          <div className="py-6 text-center text-xs text-stone-400 italic bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                             Hóa đơn chưa có sản phẩm nào. Hãy tìm và chọn thêm món ở trên.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Select */}
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase block mb-1.5">Trạng thái phát hành</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setEditedStatus('completed')}
                          className={cn(
                            "py-2.5 rounded-xl font-bold text-xs transition-all uppercase tracking-wider border",
                            editedStatus === 'completed'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"
                              : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50"
                          )}
                        >
                          Đã thanh toán (Xong)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditedStatus('cancelled')}
                          className={cn(
                            "py-2.5 rounded-xl font-bold text-xs transition-all uppercase tracking-wider border",
                            editedStatus === 'cancelled'
                              ? "bg-red-50 text-red-700 border-red-200 shadow-sm"
                              : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50"
                          )}
                        >
                          Đã hủy (Hủy)
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Detail mode view
                  <div className="space-y-4">
                    {/* Items List */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Danh sách món đã bán</p>
                      <div className="border border-stone-100 rounded-2xl overflow-hidden divide-y divide-stone-50">
                        {selectedOrder.items?.map((item) => (
                          <div key={item.productId} className="flex items-center justify-between p-3.5 bg-white text-sm">
                            <div>
                              <p className="font-bold text-stone-900">{item.name}</p>
                              <p className="text-xs text-stone-500">
                                {formatCurrency(item.price)} × {item.quantity}
                              </p>
                            </div>
                            <span className="font-black text-stone-900">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Additional meta */}
                    <div className="flex justify-between items-center py-2 border-t border-stone-100">
                      <div className="text-xs font-medium text-stone-500">Trạng thái đơn hàng</div>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider",
                        selectedOrder.status === 'completed' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                      )}>
                        {selectedOrder.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Total & Footer */}
              <div className="p-6 bg-stone-50 border-t border-stone-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-500 uppercase tracking-wider text-xs">Tổng số tiền thanh toán</span>
                  <span className="text-xl font-black text-stone-950">
                    {formatCurrency(
                      isEditing
                        ? editedItems.reduce((acc, item) => acc + item.price * item.quantity, 0)
                        : selectedOrder.totalAmount
                    )}
                  </span>
                </div>

                <div className="flex gap-3">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedItems([...selectedOrder.items]);
                          setEditedStatus(selectedOrder.status);
                        }}
                        className="flex-1 bg-white border border-stone-200 text-stone-600 font-bold py-3.5 rounded-2xl hover:bg-stone-100 transition-all font-sans text-sm h-12 flex items-center justify-center cursor-pointer"
                      >
                        HỦY SỬA
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        disabled={saving}
                        className="flex-1 bg-stone-950 text-white font-bold py-3 rounded-2xl hover:bg-stone-800 disabled:opacity-50 transition-all font-sans text-sm h-12 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {saving ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditedItems([...selectedOrder.items]);
                          setEditedStatus(selectedOrder.status);
                          setIsEditing(true);
                        }}
                        className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-3.5 rounded-2xl transition-all font-sans text-sm h-12 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" /> CHỈNH SỬA
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDetailModalOpen(false)}
                        className="flex-1 bg-stone-950 hover:bg-stone-800 text-white font-bold py-3.5 rounded-2xl transition-all font-sans text-sm h-12 flex items-center justify-center cursor-pointer"
                      >
                        ĐÓNG
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
