import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Order } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  BarChart3, 
  BrainCircuit, 
  Calendar, 
  ChevronRight,
  TrendingUp,
  PieChart as PieChartIcon
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
import { motion } from 'framer-motion';

export default function Reports() {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const txs = snapshot.docs.map(doc => doc.data() as Transaction);
      setTransactions(txs);
      
      // Group by category for PieChart
      const categories: Record<string, number> = {};
      txs.forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + (t.type === 'expense' ? t.amount : 0);
      });
      
      setData(Object.entries(categories).map(([name, value]) => ({ name, value })));
    });
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
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Báo cáo chi tiết</h1>
        <p className="text-stone-500">Phân tích sâu về doanh thu, chi phí và hiệu quả kinh doanh.</p>
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
                 { name: 'Tháng này', thu: 45000000, chi: 12000000 },
                 { name: 'Tháng trước', thu: 38000000, chi: 15000000 }
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
    </div>
  );
}
