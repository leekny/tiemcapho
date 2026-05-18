import React, { useState, useEffect } from 'react';
import { 
  getDocs, 
  collection, 
  query, 
  orderBy, 
  limit, 
  where,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { 
  LayoutDashboard, 
  Coffee, 
  Package, 
  ReceiptText, 
  BarChart3, 
  LogOut,
  Plus,
  Search,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { cn, formatCurrency } from './lib/utils';
import { Product, Order, Transaction } from './types';

// Components
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Accounting from './components/Accounting';
import Reports from './components/Reports';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'inventory' | 'accounting' | 'reports'>('dashboard');
  const [user, setUser] = useState(auth.currentUser);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123456');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setLoginError(error.message);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      // Map 'admin' to internal email format for Firebase
      const effectiveEmail = username.includes('@') ? username : `${username}@cafe.com`;
      
      try {
        await signInWithEmailAndPassword(auth, effectiveEmail, password);
      } catch (signInError: any) {
        // If it's the default admin account and doesn't exist, create it once for the user
        if ((signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') && 
            username === 'admin' && password === 'admin123456') {
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          await createUserWithEmailAndPassword(auth, effectiveEmail, password);
        } else {
          throw signInError;
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setLoginError('Tài khoản hoặc mật khẩu không đúng. Vui lòng kiểm tra lại (Tài khoản mặc định: admin / admin123456).');
      } else {
        setLoginError('Lỗi: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-12 rounded-3xl shadow-2xl max-w-md w-full text-center border-t-4 border-stone-800"
        >
          <div className="w-20 h-20 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Coffee className="w-10 h-10 text-stone-800" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">TIỆM CÀ PHƠ</h1>
          <p className="text-stone-500 mb-8 text-sm">Hệ thống quản lý chuyên nghiệp</p>
          
          <form onSubmit={handleAdminLogin} className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Tài khoản</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-200"
                placeholder="Ví dụ: admin"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Mật khẩu</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-200"
                placeholder="******"
              />
            </div>
            {loginError && <p className="text-red-500 text-xs italic">{loginError}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-stone-200 flex items-center justify-center gap-2"
            >
              {isLoading ? 'Đang kiểm tra...' : 'ĐĂNG NHẬP'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-stone-400 font-bold">Hoặc</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 bg-white rounded-full" />
            Tiếp tục với Google
          </button>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'pos', label: 'Bán hàng', icon: Coffee },
    { id: 'inventory', label: 'Thực đơn', icon: Package },
    { id: 'accounting', label: 'Thu chi', icon: ReceiptText },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
  ] as const;

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-stone-900 text-stone-300 flex flex-col transition-all border-r border-stone-800 relative shadow-2xl z-20"
      >
        <div className="p-6 flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center shrink-0">
            <Coffee className="w-6 h-6 text-stone-800" />
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="font-bold text-xl text-white tracking-tight"
            >
              TIỆM CÀ <span className="text-stone-400">PHƠ</span>
            </motion.span>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all group",
                activeTab === tab.id 
                  ? "bg-white text-stone-900 shadow-lg shadow-white/5" 
                  : "hover:bg-stone-800 hover:text-white"
              )}
              title={tab.label}
            >
              <tab.icon className={cn("w-6 h-6 shrink-0", activeTab === tab.id ? "text-stone-800" : "text-stone-500 group-hover:text-stone-300")} />
              {isSidebarOpen && <span className="font-medium">{tab.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-stone-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all text-stone-500"
          >
            <LogOut className="w-6 h-6 shrink-0" />
            {isSidebarOpen && <span className="font-medium">Đăng xuất</span>}
          </button>
        </div>

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 bg-stone-800 border border-stone-700 rounded-full p-1 text-stone-400 hover:text-white shadow-lg"
        >
          {isSidebarOpen ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-stone-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0">
          <h2 className="text-lg font-semibold text-stone-800">
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
               <p className="text-sm font-medium text-stone-900">{user.displayName}</p>
               <p className="text-xs text-stone-500">{user.email}</p>
             </div>
             {user.photoURL ? (
               <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-stone-200" />
             ) : (
               <div className="w-10 h-10 rounded-full border border-stone-200 bg-stone-100 flex items-center justify-center">
                 <span className="text-xs font-bold text-stone-400 capitalize">
                   {user.displayName?.[0] || user.email?.[0] || 'A'}
                 </span>
               </div>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto h-full"
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'pos' && <POS />}
              {activeTab === 'inventory' && <Inventory />}
              {activeTab === 'accounting' && <Accounting />}
              {activeTab === 'reports' && <Reports />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
