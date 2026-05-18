import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  Timestamp,
  updateDoc,
  doc,
  increment,
  setDoc,
  query,
  where
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, OrderItem } from '../types';
import { Plus, Minus, Trash2, CreditCard, Search, Coffee, Filter, Settings, X, Image as ImageIcon, FileText, Smartphone, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, cn } from '../lib/utils';

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mobileView, setMobileView] = useState<'menu' | 'cart'>('menu');

  // Receipt Settings
  const [showReceiptSettings, setShowReceiptSettings] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState({
    logo: 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
    message: 'Cảm ơn quý khách đã ghé thăm TIỆM CÀ PHƠ! Hẹn gặp lại quý khách.',
    paperSize: '80mm' as '58mm' | '80mm' | 'A4',
    showDate: true,
    showStoreName: true
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

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.price }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updatePrice = (productId: string, newPrice: number) => {
    setCart(prev => prev.map(item => 
      item.productId === productId ? { ...item, price: newPrice } : item
    ));
  };

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !auth.currentUser) return;
    setIsProcessing(true);
    const userId = auth.currentUser.uid;

    try {
      // 1. Create order
      const orderRef = await addDoc(collection(db, 'orders'), {
        items: cart,
        totalAmount: total,
        status: 'completed',
        userId,
        createdAt: new Date().toISOString()
      });

      // 2. Create income transaction
      await addDoc(collection(db, 'transactions'), {
        type: 'income',
        amount: total,
        category: 'Sales',
        description: `Order #${orderRef.id.slice(-5)}`,
        date: new Date().toISOString(),
        relatedObjectId: orderRef.id,
        userId
      });

      // 3. Update accounting summary
      const summaryRef = doc(db, 'metadata', userId);
      await updateDoc(summaryRef, {
        income: increment(total)
      }).catch(async (err) => {
        // If meta doc doesn't exist, create it
        if (err.code === 'not-found') {
          await setDoc(summaryRef, { income: total, expense: 0 });
        }
      });

      setCart([]);
      alert('Thanh toán thành công!');
    } catch (error) {
      console.error(error);
      alert('Thanh toán thất bại.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    (category === 'All' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 h-full relative">
      {/* Menu Area */}
      <div className={cn(
        "flex-1 flex flex-col gap-6",
        mobileView === 'cart' && "hidden lg:flex"
      )}>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-stone-800 transition-colors" />
            <input
              type="text"
              placeholder="Tìm món..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-stone-200 focus:border-stone-400 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {['All', 'Coffee', 'Tea', 'Food'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap border",
                  category === cat 
                    ? "bg-stone-900 text-white border-stone-900 shadow-lg" 
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                )}
              >
                {cat === 'All' ? 'Tất cả' : 
                 cat === 'Coffee' ? 'Cà phê' : 
                 cat === 'Tea' ? 'Trà' : 'Bánh'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-3 xl:grid-cols-4 px-1 gap-2 sm:gap-6 pb-24 lg:pb-8">
           {filteredProducts.map((p) => (
             <motion.button
               key={p.id}
               whileTap={{ scale: 0.98 }}
               onClick={() => {
                 addToCart(p);
               }}
               className={cn(
                 "bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-sm text-left group transition-all hover:shadow-xl hover:border-stone-300 relative overflow-hidden flex lg:flex-col items-center lg:items-stretch gap-3 lg:gap-0"
               )}
             >
               <div className="w-12 h-12 lg:w-full lg:aspect-square bg-stone-100 rounded-lg lg:rounded-xl lg:mb-4 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                 <Coffee className="w-6 h-6 sm:w-10 sm:h-10 text-stone-400" />
               </div>
               <div className="flex-1 min-w-0">
                 <h4 className="font-bold text-stone-900 text-xs sm:text-base mb-0 sm:mb-1 truncate">{p.name}</h4>
                 <p className="text-[10px] sm:text-sm font-medium text-stone-500">{formatCurrency(p.price)}</p>
               </div>
               <div className="flex items-center justify-end shrink-0">
                 <div className="bg-stone-900 text-white p-1.5 rounded-lg opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                   <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                 </div>
               </div>
             </motion.button>
           ))}
        </div>
      </div>

      {/* Mobile Cart Toggle Bar */}
      {cart.length > 0 && mobileView === 'menu' && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="lg:hidden fixed bottom-6 left-6 right-6 z-40"
        >
          <button 
            onClick={() => setMobileView('cart')}
            className="w-full bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between font-bold"
          >
            <div className="flex items-center gap-3">
              <div className="bg-stone-800 px-3 py-1 rounded-lg">{cart.reduce((a, b) => a + b.quantity, 0)} món</div>
              <span>Xem giỏ hàng</span>
            </div>
            <span>{formatCurrency(total)}</span>
          </button>
        </motion.div>
      )}

      {/* Cart Area */}
      <div className={cn(
        "w-full lg:w-[400px] bg-white lg:rounded-3xl border lg:border-stone-200 shadow-xl flex flex-col overflow-hidden lg:sticky lg:top-0 h-full max-h-[calc(100vh-160px)] z-40 fixed inset-0 lg:relative",
        mobileView === 'menu' && "hidden lg:flex"
      )}>
        <div className="p-4 sm:p-6 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between lg:block">
          <button 
            onClick={() => setMobileView('menu')}
            className="lg:hidden p-2 text-stone-600 hover:bg-stone-100 rounded-xl"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex-1 lg:flex lg:items-center lg:justify-between lg:mb-2 text-center lg:text-left">
            <h3 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center justify-center lg:justify-start gap-2">
              <CreditCard className="w-5 h-5 hidden sm:block" /> 
              Giỏ hàng
            </h3>
            <div className="hidden lg:flex items-center gap-2">
              <button 
                onClick={() => setShowReceiptSettings(true)}
                className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition-all"
                title="Cấu hình hóa đơn"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={() => { setCart([]); setMobileView('menu'); }} className="text-stone-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-stone-500 text-sm hidden lg:block">Hóa đơn mẫu #{Math.floor(Math.random()*10000)}</p>

          <div className="lg:hidden flex items-center gap-2">
             <button 
                onClick={() => setShowReceiptSettings(true)}
                className="p-2 text-stone-400 hover:text-stone-800"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { setCart([]); setMobileView('menu'); }}
                className="p-2 text-stone-400 hover:text-red-500"
              >
                <Trash2 className="w-5 h-5" />
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          <AnimatePresence>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 py-20">
                <Coffee className="w-16 h-16 opacity-20" />
                <p className="italic">Chưa có món nào chọn</p>
              </div>
            ) : (
              cart.map((item) => (
                <motion.div
                  key={item.productId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <h5 className="text-[11px] sm:text-sm font-bold text-stone-900 truncate leading-tight">{item.name}</h5>
                    <div className="flex items-center gap-1 group/price">
                      <input 
                        type="number"
                        value={item.price}
                        onChange={(e) => updatePrice(item.productId, Number(e.target.value))}
                        className="w-16 sm:w-20 bg-transparent border-b border-dashed border-stone-200 text-[10px] sm:text-xs text-stone-500 font-bold focus:border-stone-900 outline-none transition-colors"
                      />
                      <span className="text-[10px] text-stone-400">đ</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-xl">
                    <button 
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-50 transition-colors shadow-sm"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-stone-800">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800 transition-colors shadow-lg"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 sm:p-8 border-t border-stone-100 bg-stone-50/50 space-y-4 pb-12 sm:pb-8">
          <div className="space-y-2">
            <div className="flex justify-between text-stone-500 text-sm font-medium">
              <span>Tạm tính</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-xl font-black text-stone-900 pt-2 border-t border-stone-200">
              <span>Tổng cộng</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <button 
            disabled={cart.length === 0 || isProcessing}
            onClick={async () => {
              await handleCheckout();
              setMobileView('menu');
            }}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-stone-200 hover:bg-stone-800 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? 'Đang xử lý...' : 'XÁC NHẬN THANH TOÁN'}
            {!isProcessing && <CreditCard className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>

    {/* Receipt Settings Modal */}
    <AnimatePresence>
      {showReceiptSettings && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]"
          >
            {/* Form Side */}
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-stone-100 rounded-2xl text-stone-800">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">Cấu hình hóa đơn</h3>
                    <p className="text-xs text-stone-500">Tùy chỉnh nội dung in ấn</p>
                  </div>
                </div>
                <button onClick={() => setShowReceiptSettings(false)} className="md:hidden p-2 text-stone-400"><X /></button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Logo Cửa hàng (URL)</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={receiptSettings.logo}
                      onChange={(e) => setReceiptSettings({...receiptSettings, logo: e.target.value})}
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-200 text-sm"
                      placeholder="https://..."
                    />
                    <div className="w-12 h-12 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center overflow-hidden">
                      <img src={receiptSettings.logo} alt="Preview" className="w-8 h-8 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Lời chào / Lời chúc</label>
                  <textarea 
                    value={receiptSettings.message}
                    onChange={(e) => setReceiptSettings({...receiptSettings, message: e.target.value})}
                    rows={3}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-200 text-sm resize-none"
                    placeholder="Cảm ơn quý khách..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Khổ giấy in</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['58mm', '80mm', 'A4'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => setReceiptSettings({...receiptSettings, paperSize: size})}
                        className={cn(
                          "py-3 rounded-xl text-xs font-bold transition-all border",
                          receiptSettings.paperSize === size 
                            ? "bg-stone-900 text-white border-stone-900 shadow-lg" 
                            : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                   <label className="flex items-center gap-3 cursor-pointer">
                     <input 
                        type="checkbox" 
                        checked={receiptSettings.showDate}
                        onChange={(e) => setReceiptSettings({...receiptSettings, showDate: e.target.checked})}
                        className="w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                     />
                     <span className="text-sm font-medium text-stone-700">Hiển thị ngày giờ trên hóa đơn</span>
                   </label>
                   <label className="flex items-center gap-3 cursor-pointer">
                     <input 
                        type="checkbox" 
                        checked={receiptSettings.showStoreName}
                        onChange={(e) => setReceiptSettings({...receiptSettings, showStoreName: e.target.checked})}
                        className="w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                     />
                     <span className="text-sm font-medium text-stone-700">Hiển thị tên cửa hàng</span>
                   </label>
                </div>
              </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => {
                      if (cart.length === 0) {
                        alert('Giỏ hàng trống!');
                        return;
                      }
                      alert('Đã gửi lệnh in bản nháp đến máy in ' + receiptSettings.paperSize);
                    }}
                    className="flex-1 bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl hover:bg-stone-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                  >
                    <Printer className="w-4 h-4" />
                    In bản nháp
                  </button>
                  <button 
                    onClick={() => setShowReceiptSettings(false)}
                    className="flex-[2] bg-stone-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-stone-800 transition-all uppercase tracking-widest"
                  >
                    Hoàn tất
                  </button>
                </div>
            </div>

            {/* Preview Side */}
            <div className="w-full md:w-[300px] bg-stone-100 p-8 flex flex-col items-center border-l border-stone-200">
               <div className="flex items-center gap-2 mb-6 text-stone-400">
                 <FileText className="w-4 h-4" />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Xem trước hóa đơn</span>
               </div>
               
               <div className={cn(
                 "bg-white shadow-xl p-6 flex flex-col items-center text-center transition-all",
                 receiptSettings.paperSize === '58mm' ? "w-[180px]" : receiptSettings.paperSize === '80mm' ? "w-[220px]" : "w-[240px]"
               )}>
                 <div className="w-12 h-12 mb-4">
                   <img src={receiptSettings.logo} alt="Logo" className="w-full h-full object-contain grayscale opacity-70" />
                 </div>
                 {receiptSettings.showStoreName && <h4 className="font-bold text-stone-900 text-sm mb-1 uppercase">TIỆM CÀ PHƠ</h4>}
                 <p className="text-[8px] text-stone-400 mb-4">--- HÓA ĐƠN BÁN LẺ ---</p>
                 
                 <div className="w-full space-y-1 mb-4 text-[9px] text-left">
                   {cart.length === 0 ? (
                     <div className="flex justify-between border-b border-dashed border-stone-200 pb-1">
                       <span className="text-stone-500 italic">Giỏ hàng trống</span>
                       <span className="font-bold">0đ</span>
                     </div>
                   ) : (
                     cart.map((item, idx) => (
                       <div key={idx} className="flex justify-between border-b border-dashed border-stone-100 pb-1">
                         <span className="text-stone-600 truncate max-w-[100px]">{item.name} x{item.quantity}</span>
                         <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                       </div>
                     ))
                   )}
                   <div className="flex justify-between pt-2">
                     <span className="font-bold">TỔNG:</span>
                     <span className="font-bold">{formatCurrency(total)}</span>
                   </div>
                 </div>

                 {receiptSettings.showDate && <p className="text-[7px] text-stone-400 mb-4">{new Date().toLocaleString()}</p>}
                 
                 <p className="text-[9px] text-stone-600 leading-tight italic">
                   "{receiptSettings.message}"
                 </p>
               </div>

               <div className="mt-8 flex items-center gap-2 text-stone-400">
                 <Smartphone className="w-4 h-4" />
                 <span className="text-[8px] font-medium">Bản in mô phỏng chuẩn {receiptSettings.paperSize}</span>
               </div>
               
               <button onClick={() => setShowReceiptSettings(false)} className="hidden md:block absolute top-6 right-6 p-2 text-stone-400 hover:text-stone-900 transition-colors"><X /></button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
