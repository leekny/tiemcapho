import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { updatePassword, updateEmail } from 'firebase/auth';
import { 
  User, 
  Store, 
  Lock, 
  Mail, 
  ShieldCheck, 
  Save,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Account() {
  const [storeData, setStoreData] = useState({
    storeName: '',
    address: '',
    phone: '',
    ownerName: ''
  });
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    async function loadStoreData() {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const docRef = doc(db, 'metadata', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setStoreData({
            storeName: data.storeName || '',
            address: data.address || '',
            phone: data.phone || '',
            ownerName: data.ownerName || ''
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStoreData();
  }, []);

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const user = auth.currentUser;
      if (!user) return;

      const docRef = doc(db, 'metadata', user.uid);
      await setDoc(docRef, storeData, { merge: true });
      setMessage({ type: 'success', text: 'Cập nhật thông tin cửa hàng thành công!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Lỗi: ' + err.message });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }
    
    setSaveLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, passwordData.newPassword);
        setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
        setPasswordData({ newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Lỗi: ' + err.message + ' (Bạn có thể cần đăng nhập lại trước khi đổi mật khẩu)' });
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-stone-400">Đang tải thông tin...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Quản lý tài khoản</h1>
        <p className="text-stone-500">Cài đặt thông tin cửa hàng và bảo mật tài khoản.</p>
      </div>

      {message.text && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl flex items-center gap-3 font-medium text-sm",
            message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
          )}
        >
          {message.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Store Settings */}
        <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-stone-100 rounded-lg text-stone-600"><Store className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-stone-900">Thông tin cửa hàng</h2>
          </div>
          
          <form onSubmit={handleUpdateStore} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Tên cửa hàng</label>
              <input 
                type="text" 
                value={storeData.storeName}
                onChange={e => setStoreData({...storeData, storeName: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-200 outline-none"
                placeholder="Ví dụ: Cà Phơ Studio"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Chủ sở hữu</label>
              <input 
                type="text" 
                value={storeData.ownerName}
                onChange={e => setStoreData({...storeData, ownerName: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Số điện thoại</label>
              <input 
                type="text" 
                value={storeData.phone}
                onChange={e => setStoreData({...storeData, phone: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Địa chỉ</label>
              <textarea 
                value={storeData.address}
                onChange={e => setStoreData({...storeData, address: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-200 outline-none h-24"
              />
            </div>
            <button 
              disabled={saveLoading}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white font-bold py-3 rounded-xl hover:bg-stone-800 transition-all text-sm"
            >
              <Save className="w-4 h-4" />
              LƯU THÔNG TIN
            </button>
          </form>
        </section>

        {/* Security Settings */}
        <div className="space-y-8">
          <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-stone-100 rounded-lg text-stone-600"><Lock className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-stone-900">Đổi mật khẩu</h2>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Mật khẩu mới</label>
                <input 
                  type="password" 
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-200 outline-none"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Xác nhận mật khẩu</label>
                <input 
                  type="password" 
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-200 outline-none"
                  minLength={6}
                />
              </div>
              <button 
                disabled={saveLoading}
                className="w-full flex items-center justify-center gap-2 bg-stone-100 text-stone-900 font-bold py-3 rounded-xl hover:bg-stone-200 transition-all text-sm underline decoration-stone-300 underline-offset-4"
              >
                CẬP NHẬT MẬT KHẨU
              </button>
            </form>
          </section>

          <section className="bg-stone-900 p-6 rounded-2xl shadow-xl">
             <h3 className="text-white font-bold mb-2">Đăng xuất</h3>
             <p className="text-stone-400 text-xs mb-4">Bạn chắc chắn muốn đăng xuất khỏi phiên làm việc này?</p>
             <button 
               onClick={() => auth.signOut()}
               className="flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest"
             >
               <LogOut className="w-4 h-4" />
               Xác nhận đăng xuất
             </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
