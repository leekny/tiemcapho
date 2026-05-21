import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, limit, getDocs, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, Order } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  BarChart3, 
  BrainCircuit, 
  Calendar, 
  ChevronRight,
  TrendingUp,
  PieChart as PieChartIcon,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Award,
  ShoppingBag
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Reports() {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Date Range State
  const [filterType, setFilterType] = useState<'today' | 'yesterday' | 'thisMonth' | 'lastMonth' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: startOfDay(now).toISOString(),
      end: endOfDay(now).toISOString()
    };
  });

  useEffect(() => {
    const now = new Date();
    if (filterType === 'today') {
      setDateRange({
        start: startOfDay(now).toISOString(),
        end: endOfDay(now).toISOString()
      });
    } else if (filterType === 'yesterday') {
      const yesterday = subDays(now, 1);
      setDateRange({
        start: startOfDay(yesterday).toISOString(),
        end: endOfDay(yesterday).toISOString()
      });
    } else if (filterType === 'thisMonth') {
      setDateRange({
        start: startOfMonth(now).toISOString(),
        end: endOfMonth(now).toISOString()
      });
    } else if (filterType === 'lastMonth') {
      const lm = subMonths(now, 1);
      setDateRange({
        start: startOfMonth(lm).toISOString(),
        end: endOfMonth(lm).toISOString()
      });
    } else if (filterType === 'custom') {
      const startParts = customStartDate.split('-').map(Number);
      const endParts = customEndDate.split('-').map(Number);
      if (startParts.length === 3 && endParts.length === 3) {
        const sD = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
        const eD = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);
        setDateRange({
          start: sD.toISOString(),
          end: eD.toISOString()
        });
      }
    }
  }, [filterType, customStartDate, customEndDate]);

  const [soldItems, setSoldItems] = useState<{ name: string; quantity: number; revenue: number; percentage: number }[]>([]);
  const [totalSoldQuantity, setTotalSoldQuantity] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ordersQuery = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('createdAt', '>=', dateRange.start),
      where('createdAt', '<=', dateRange.end)
    );

    return onSnapshot(ordersQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data() as Order);
      
      const itemSummaries: Record<string, { quantity: number; revenue: number }> = {};
      let aggregateQty = 0;
      let totalRev = 0;

      orders.forEach(order => {
        if (order.status === 'completed') {
          order.items?.forEach(item => {
            const currentItem = itemSummaries[item.name] || { quantity: 0, revenue: 0 };
            currentItem.quantity += item.quantity || 1;
            currentItem.revenue += (item.quantity || 1) * (item.price || 0);
            
            itemSummaries[item.name] = currentItem;
            aggregateQty += (item.quantity || 1);
            totalRev += (item.quantity || 1) * (item.price || 0);
          });
        }
      });

      const sortedItems = Object.entries(itemSummaries)
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          revenue: data.revenue,
          percentage: totalRev > 0 ? Math.round((data.revenue / totalRev) * 100) : 0
        }))
        .sort((a, b) => b.quantity - a.quantity);

      setSoldItems(sortedItems);
      setTotalSoldQuantity(aggregateQty);
    });
  }, [dateRange]);

  // Detailed List Pagination
  const [detailedTxs, setDetailedTxs] = useState<Transaction[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Fetch data for Charts (Filtered by Month and User)
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('date', '>=', dateRange.start),
      where('date', '<=', dateRange.end),
      orderBy('date', 'desc')
    );

    return onSnapshot(txQuery, (snapshot) => {
      const txs = snapshot.docs.map(doc => doc.data() as Transaction);
      setTransactions(txs);
      
      const categories: Record<string, number> = {};
      txs.forEach(t => {
        if (t.type === 'expense') {
          categories[t.category] = (categories[t.category] || 0) + t.amount;
        }
      });
      
      setData(Object.entries(categories).map(([name, value]) => ({ name, value })));
    });
  }, [dateRange]);

  const fetchDetailedReport = async (isNew = true) => {
    const user = auth.currentUser;
    if (!user) return;
    setLoadingList(true);
    try {
      let q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(PAGE_SIZE)
      );

      if (!isNew && lastDoc) {
        q = query(
          collection(db, 'transactions'), 
          where('userId', '==', user.uid),
          orderBy('date', 'desc'), 
          startAfter(lastDoc), 
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      
      if (isNew) {
        setDetailedTxs(items);
        setPage(1);
      } else {
        setDetailedTxs(prev => [...prev, ...items]);
        setPage(p => p + 1);
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchDetailedReport();
  }, []);

  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reportData: {
            transactions,
            topSoldProducts: soldItems.slice(0, 8).map(x => ({ name: x.name, quantity: x.quantity, revenue: x.revenue }))
          }
        })
      });
      const result = await response.json();
      setAiAnalysis(result.analysis);
    } catch (error) {
      console.error(error);
      setAiAnalysis('Không thể phân tích dữ liệu lúc này.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const COLORS = ['#3d2b1f', '#c4a484', '#78716c', '#a8a29e', '#d6d3d1'];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Báo cáo chi tiết</h1>
          <p className="text-stone-500">Phân tích sâu về doanh thu, chi phí và hiệu quả kinh doanh.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-stone-200 shadow-sm">
             <Calendar className="w-4 h-4 text-stone-400 ml-2" />
             <select 
               className="bg-transparent border-none text-sm font-bold text-stone-700 outline-none pr-4 cursor-pointer"
               value={filterType}
               onChange={(e) => setFilterType(e.target.value as any)}
             >
               <option value="today">Hôm nay</option>
               <option value="yesterday">Hôm qua</option>
               <option value="thisMonth">Tháng này</option>
               <option value="lastMonth">Tháng trước</option>
               <option value="custom">Tùy chọn ngày...</option>
             </select>
          </div>

          <AnimatePresence>
            {filterType === 'custom' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-stone-200 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-400 uppercase">Từ</span>
                  <input 
                    type="date" 
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-stone-800 outline-none focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-stone-400 uppercase">Đến</span>
                  <input 
                    type="date" 
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-stone-800 outline-none focus:ring-0 cursor-pointer"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie Chart - Expenses */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
           <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
             <PieChartIcon className="w-5 h-5 text-stone-400" />
             Cơ cấu chi phí
           </h3>
           <div className="h-[350px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={data}
                   cx="50%"
                   cy="50%"
                   innerRadius={80}
                   outerRadius={120}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {data.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip formatter={(v: any) => formatCurrency(v)} />
                 <Legend />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* AI Analysis Box */}
        <div className="bg-stone-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
           
           <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
               <BrainCircuit className="w-6 h-6 text-stone-300" />
             </div>
             <div>
               <h3 className="text-xl font-bold">Phân tích AI</h3>
               <p className="text-stone-400 text-sm">Gợi ý thông minh từ Gemini</p>
             </div>
           </div>

           <div className="flex-1 space-y-4">
             {aiAnalysis ? (
               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }} 
                 className="text-stone-300 leading-relaxed bg-white/5 p-6 rounded-2xl border border-white/10"
               >
                 <div className="whitespace-pre-wrap">{aiAnalysis}</div>
               </motion.div>
             ) : (
               <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                 <p className="text-stone-400">Nhấn nút để bắt đầu phân tích dữ liệu kinh doanh của bạn.</p>
               </div>
             )}
           </div>

           <button 
             onClick={analyzeWithAI}
             disabled={isAnalyzing}
             className="w-full bg-white text-stone-900 font-bold py-4 rounded-xl mt-8 shadow-xl hover:bg-stone-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
           >
             {isAnalyzing ? (
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-stone-900 rounded-full animate-bounce [animation-delay:-0.3s]" />
                 <div className="w-2 h-2 bg-stone-900 rounded-full animate-bounce [animation-delay:-0.15s]" />
                 <div className="w-2 h-2 bg-stone-900 rounded-full animate-bounce" />
               </div>
             ) : (
               <>
                 <BrainCircuit className="w-5 h-5" />
                 BẮT ĐẦU PHÂN TÍCH
               </>
             )}
           </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
         <h3 className="text-lg font-bold text-stone-900 mb-6 font-mono uppercase tracking-widest text-[#141414]">
           BIỂU ĐỒ SO SÁNH THU CHI
         </h3>
         <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={[
                 { 
                   name: filterType === 'today' ? 'Hôm nay' : filterType === 'yesterday' ? 'Hôm qua' : filterType === 'thisMonth' ? 'Tháng này' : filterType === 'lastMonth' ? 'Tháng trước' : 'Tùy chọn', 
                   thu: transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0), 
                   chi: transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0) 
                 },
               ]}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="name" />
                 <YAxis tickFormatter={(v) => `${v/1000000}M`} />
                 <Tooltip formatter={(v: any) => formatCurrency(v)} />
                 <Bar dataKey="thu" fill="#3d2b1f" radius={[4, 4, 0, 0]} name="Thu nhập" />
                 <Bar dataKey="chi" fill="#c4a484" radius={[4, 4, 0, 0]} name="Chi phí" />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Sales Volume Report */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Summary and Core metrics */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-stone-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between h-48 relative overflow-hidden group hover:border-[#c4a485]/40 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <ShoppingBag className="w-48 h-48 -mr-12 -mt-12 text-stone-900" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-450 uppercase tracking-widest mb-1 font-sans">Tổng sản phẩm đã bán</p>
              <h4 className="text-sm font-bold text-stone-700 font-sans">
                {filterType === 'today' && 'Hành trình Hôm nay'}
                {filterType === 'yesterday' && 'Hành trình Hôm qua'}
                {filterType === 'thisMonth' && 'Hành trình Tháng này'}
                {filterType === 'lastMonth' && 'Hành trình Tháng trước'}
                {filterType === 'custom' && `${format(new Date(dateRange.start), 'dd/MM/yyyy')} - ${format(new Date(dateRange.end), 'dd/MM/yyyy')}`}
              </h4>
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-5xl font-black text-stone-900 font-sans tracking-tight">
                {totalSoldQuantity}
              </span>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-2 bg-stone-100 px-2.5 py-1 rounded-lg">món</span>
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-6 rounded-3xl shadow-sm space-y-4 font-sans">
            <h3 className="text-xs font-bold text-stone-450 uppercase tracking-widest flex items-center gap-2 font-mono">
              <Award className="w-5 h-5 text-amber-500 animate-pulse" /> SẢN PHẨM KHÁCH THÍCH NHẤT
            </h3>
            {soldItems.length > 0 ? (
              <div className="bg-amber-50/40 border border-amber-500/10 rounded-2xl p-4 flex items-center gap-4 animate-fade-in hover:shadow-sm transition-all duration-300">
                <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-amber-400 shrink-0 font-extrabold shadow-sm">
                  ★
                </div>
                <div className="min-w-0 font-sans">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">HẠNG #1</p>
                  <p className="text-sm font-black text-stone-900 truncate">{soldItems[0].name}</p>
                  <p className="text-xs text-stone-500 font-semibold mt-0.5">
                    Đã bán <span className="font-extrabold text-stone-900">{soldItems[0].quantity} ly</span> • Thu về <span className="font-semibold text-stone-800">{formatCurrency(soldItems[0].revenue)}</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-semibold text-stone-400 italic">Chưa phát sinh đơn hàng nào</p>
            )}
          </div>
        </div>

        {/* Right Side: Product Leaderboard with Elegant Progress Bars */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-stone-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2 font-sans">
                <BarChart3 className="w-5 h-5 text-stone-400" />
                Số lượng bán theo sản phẩm
              </h3>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest bg-stone-50 border border-stone-100 px-3 py-1 rounded-full">
                {soldItems.length} SẢN PHẨM
              </span>
            </div>

            {soldItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400 space-y-2">
                <ShoppingBag className="w-10 h-10 stroke-[1.5] opacity-40" />
                <p className="text-sm italic font-sans font-medium">Không tìm thấy dữ liệu bán hàng trong kì này</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
                {soldItems.map((item, index) => {
                  const maxQty = soldItems[0]?.quantity || 1;
                  const ratio = Math.round((item.quantity / maxQty) * 100);

                  return (
                    <div key={index} className="space-y-1.5 group font-sans">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-bold text-stone-850 flex items-center gap-2">
                          <span className="text-xs text-stone-400 w-4 font-mono font-bold">
                            {index + 1}.
                          </span>
                          <span className="truncate max-w-[180px] sm:max-w-[280px]">
                            {item.name}
                          </span>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="text-xs text-stone-400 font-semibold">
                            {formatCurrency(item.revenue)} ({item.percentage}%)
                          </span>
                          <span className="font-black text-stone-900 text-sm">
                            {item.quantity} món
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-stone-50 border border-stone-100 h-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${ratio}%` }}
                          transition={{ duration: 0.6, delay: index * 0.05 }}
                          className="bg-stone-900 rounded-full h-full group-hover:bg-[#8c6d58] transition-colors duration-200"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Activity List (Paginated) */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-stone-400" />
            Chi tiết hoạt động gần đây
          </h3>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-stone-100 shadow-sm">
            Trang {page}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50 text-stone-400 text-[10px] uppercase font-bold tracking-widest border-b border-stone-100">
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Hoạt động</th>
                <th className="px-6 py-4 text-right">Giá trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {detailedTxs.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-stone-600">
                    {format(new Date(t.date), 'dd/MM HH:mm')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-stone-900">{t.description || t.category}</p>
                    <p className="text-[10px] text-stone-400 uppercase font-medium">{t.category}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-black">
                    <div className={cn(
                      "flex items-center justify-end gap-1",
                      t.type === 'income' ? "text-emerald-600" : "text-red-500"
                    )}>
                      {t.type === 'income' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                      {formatCurrency(t.amount)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="p-6 border-t border-stone-100 bg-stone-50/30 flex justify-center">
            <button 
              onClick={() => fetchDetailedReport(false)}
              disabled={loadingList}
              className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-widest"
            >
              {loadingList ? 'Đang tải...' : 'Tải thêm dữ liệu chi tiết'}
              {!loadingList && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
