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
  FileText
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
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Reports() {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Date Range State
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()).toISOString(),
    end: endOfMonth(new Date()).toISOString()
  });

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
        body: JSON.stringify({ reportData: transactions })
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
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-stone-200 shadow-sm">
           <Calendar className="w-4 h-4 text-stone-400 ml-2" />
           <select 
             className="bg-transparent border-none text-sm font-bold text-stone-700 outline-none pr-4"
             onChange={(e) => {
               const val = e.target.value;
               const now = new Date();
               if (val === 'thisMonth') {
                 setDateRange({ start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() });
               } else if (val === 'lastMonth') {
                 const lm = subMonths(now, 1);
                 setDateRange({ start: startOfMonth(lm).toISOString(), end: endOfMonth(lm).toISOString() });
               }
             }}
           >
             <option value="thisMonth">Tháng này</option>
             <option value="lastMonth">Tháng trước</option>
           </select>
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
                 { name: 'Tháng này', thu: transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0), chi: transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0) },
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
