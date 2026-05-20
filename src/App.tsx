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
  X,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  onAuthStateChanged, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { cn, formatCurrency } from './lib/utils';
import { Product, Order, Transaction } from './types';

// Components
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Accounting from './components/Accounting';
import Reports from './components/Reports';
import Account from './components/Account';
import SuperAdmin from './components/SuperAdmin';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'inventory' | 'accounting' | 'reports' | 'account' | 'system'>('pos');
  const [user, setUser] = useState(auth.currentUser);
  
  const isSuperAdmin = user?.email === 'leekny12@gmail.com';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123456');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setActiveTab('pos');
      }
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
    setResetSuccess(false);
    try {
      const effectiveEmail = username.includes('@') ? username : `${username}@cafe.com`;
      
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, effectiveEmail);
        setResetSuccess(true);
      } else if (isRegistering) {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        await createUserWithEmailAndPassword(auth, effectiveEmail, password);
      } else {
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
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setLoginError('Tài khoản hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.');
      } else if (error.code === 'auth/email-already-in-use') {
        setLoginError('Tài khoản này đã tồn tại. Vui lòng đăng nhập.');
      } else if (error.code === 'auth/weak-password') {
        setLoginError('Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.');
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
          className="bg-white p-6 sm:p-12 rounded-3xl shadow-2xl max-w-md w-full text-center border-t-4 border-stone-800"
        >
          <div className="w-20 h-20 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Coffee className="w-10 h-10 text-stone-800" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2 uppercase tracking-tight">CÀ PHƠ POS</h1>
          <p className="text-stone-500 mb-8 text-sm">
            {isForgotPassword ? 'Khôi phục mật khẩu' : isRegistering ? 'Hệ thống quản lý cửa hàng mới' : 'Hệ thống quản lý chuyên nghiệp'}
          </p>
          
          <form onSubmit={handleAdminLogin} className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                {isRegistering || isForgotPassword ? 'Email / Tên tài khoản' : 'Tài khoản'}
              </label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-200 text-sm"
                placeholder={isRegistering || isForgotPassword ? "nhap@email.com" : "Ví dụ: admin"}
                required
              />
            </div>
            
            {!isForgotPassword && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-stone-400 uppercase">Mật khẩu</label>
                  {!isRegistering && (
                    <button 
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[10px] font-bold text-stone-400 hover:text-stone-900 uppercase"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-200 text-sm"
                  placeholder="******"
                  required
                  minLength={6}
                />
              </div>
            )}

            {loginError && <p className="text-red-500 text-[10px] italic font-medium">{loginError}</p>}
            {resetSuccess && <p className="text-emerald-600 text-[10px] font-bold italic">Yêu cầu đã gửi! Vui lòng kiểm tra email của bạn.</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-stone-200 flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
            >
              {isLoading ? 'Đang xử lý...' : (isForgotPassword ? 'GỬI YÊU CẦU' : isRegistering ? 'ĐĂNG KÝ NGAY' : 'ĐĂNG NHẬP')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <button 
            onClick={() => {
              if (isForgotPassword) {
                setIsForgotPassword(false);
              } else {
                setIsRegistering(!isRegistering);
              }
              setLoginError('');
              setResetSuccess(false);
            }}
            className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-widest mb-6"
          >
            {isForgotPassword ? 'Tiếp tục đăng nhập' : (isRegistering ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký cửa hàng')}
          </button>

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
    { id: 'account', label: 'Tài khoản', icon: UserIcon },
    ...(isSuperAdmin ? [{ id: 'system', label: 'Hệ thống', icon: ShieldCheck }] : []),
  ] as const;

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[25] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: isMobileMenuOpen ? 0 : (window.innerWidth < 1024 ? -280 : 0)
        }}
        className={cn(
          "bg-stone-900 text-stone-300 flex flex-col transition-all border-r border-stone-800 absolute lg:relative h-full z-30 shadow-2xl",
          !isMobileMenuOpen && "hidden lg:flex"
        )}
      >
        <div className="p-6 flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
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
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-stone-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all group",
                activeTab === tab.id 
                  ? "bg-stone-800 text-white shadow-lg active-tab-glow" 
                  : "hover:bg-stone-800 hover:text-white"
              )}
              title={tab.label}
            >
              <tab.icon className={cn("w-6 h-6 shrink-0", activeTab === tab.id ? "text-stone-200" : "text-stone-500 group-hover:text-stone-300")} />
              <span className={cn("font-medium transition-opacity", !isSidebarOpen && "lg:hidden")}>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-stone-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all text-stone-500"
          >
            <LogOut className="w-6 h-6 shrink-0" />
            <span className={cn("font-medium", !isSidebarOpen && "lg:hidden")}>Đăng xuất</span>
          </button>
        </div>

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 bg-stone-800 border border-stone-700 rounded-full p-1 text-stone-400 hover:text-white shadow-lg hidden lg:block"
        >
          {isSidebarOpen ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-stone-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-stone-600 hover:bg-stone-100 rounded-xl"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold text-stone-900">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
               <p className="text-sm font-bold text-stone-900 truncate max-w-[120px]">{user.displayName || 'Nhân viên'}</p>
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.1 }}
              className="max-w-7xl mx-auto h-full"
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'pos' && <POS />}
              {activeTab === 'inventory' && <Inventory />}
              {activeTab === 'accounting' && <Accounting />}
              {activeTab === 'reports' && <Reports />}
              {activeTab === 'account' && <Account />}
              {activeTab === 'system' && isSuperAdmin && <SuperAdmin />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
