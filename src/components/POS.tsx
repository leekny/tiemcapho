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
  where,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, OrderItem } from '../types';
import { Plus, Minus, Trash2, CreditCard, Search, Coffee, Filter, Settings, X, Image as ImageIcon, FileText, Smartphone, Printer, Save, Eye, FolderOpen } from 'lucide-react';
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

  // Direct Product Creation State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductFormData, setNewProductFormData] = useState({
    name: '',
    price: 0,
    priceM: 0,
    priceL: 0,
    category: 'Coffee' as 'Coffee' | 'Tea' | 'Food'
  });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProductForSize, setSelectedProductForSize] = useState<Product | null>(null);

  // Draft / Invoice Preview states
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [isSavingDraftModalOpen, setIsSavingDraftModalOpen] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !auth.currentUser) return;
    setIsSavingDraft(true);
    try {
      await addDoc(collection(db, 'drafts'), {
        items: cart,
        totalAmount: total,
        note: draftNote.trim() || `Bản nháp #${Math.floor(Math.random() * 1000)}`,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setDraftNote('');
      setIsSavingDraftModalOpen(false);
      alert('Đã lưu bản nháp thành công!');
    } catch (error: any) {
      console.error(error);
      alert('Không thể lưu bản nháp: ' + error.message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleLoadDraft = (draft: any) => {
    setCart(draft.items || []);
    setIsDraftsModalOpen(false);
    setMobileView('cart');
  };

  const handleDeleteDraft = async (draftId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm('Bạn có chắc là muốn xóa bản nháp này không?')) return;
    try {
      await deleteDoc(doc(db, 'drafts', draftId));
    } catch (error: any) {
      console.error(error);
      alert('Không thể xóa bản nháp: ' + error.message);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductFormData.name.trim() || newProductFormData.price < 0 || !auth.currentUser) return;
    setIsAddingProduct(true);
    try {
      await addDoc(collection(db, 'products'), {
        name: newProductFormData.name.trim(),
        price: Number(newProductFormData.price),
        priceM: newProductFormData.priceM || null,
        priceL: newProductFormData.priceL || null,
        category: newProductFormData.category,
        userId: auth.currentUser.uid,
        updatedAt: new Date().toISOString(),
        currentStock: 9999,
        minStock: 0,
        unit: 'ly'
      });
      setNewProductFormData({ name: '', price: 0, priceM: 0, priceL: 0, category: 'Coffee' });
      setIsAddModalOpen(false);
    } catch (error: any) {
      console.error(error);
      alert('Không thể thêm món mới: ' + error.message);
    } finally {
      setIsAddingProduct(false);
    }
  };

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

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'drafts'),
      where('userId', '==', user.uid)
    );

    return onSnapshot(q, (snapshot) => {
      setDrafts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const addToCart = (product: Product, selectedSize?: 'M' | 'L') => {
    const finalPrice = selectedSize === 'M' ? (product.priceM || product.price) : selectedSize === 'L' ? (product.priceL || product.price) : product.price;
    const finalName = selectedSize ? `${product.name} (Size ${selectedSize})` : product.name;
    const cartItemId = selectedSize ? `${product.id}-${selectedSize}` : product.id;

    setCart(prev => {
      const existing = prev.find(item => item.productId === cartItemId && item.size === selectedSize);
      if (existing) {
        return prev.map(item => 
          (item.productId === cartItemId && item.size === selectedSize) ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId: cartItemId, name: finalName, quantity: 1, price: finalPrice, size: selectedSize }];
    });
  };

  const updateQuantity = (productId: string, size: 'M' | 'L' | undefined, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId && item.size === size) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updatePrice = (productId: string, size: 'M' | 'L' | undefined, newPrice: number) => {
    setCart(prev => prev.map(item => 
      (item.productId === productId && item.size === size) ? { ...item, price: newPrice } : item
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
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-stone-800 transition-colors" />
            <input
              type="text"
              placeholder="Tìm món..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-stone-200 focus:border-stone-400 transition-all shadow-sm"
            />
          </div>
          <div className="flex justify-between items-center gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <div className="flex gap-2">
              {['All', 'Coffee', 'Tea', 'Food'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-4 sm:px-6 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap border text-sm",
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

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-1.5 transition-all shadow-lg shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> THÊM MÓN
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-3 xl:grid-cols-4 px-1 gap-2 sm:gap-6 pb-24 lg:pb-8">
           {filteredProducts.map((p) => (
             <motion.button
               key={p.id}
               whileTap={{ scale: 0.98 }}
               onClick={() => {
                 if (p.priceM || p.priceL) {
                   setSelectedProductForSize(p);
                 } else {
                   addToCart(p);
                 }
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
                 <p className="text-[10px] sm:text-sm font-medium text-stone-500">Giá thường: {formatCurrency(p.price)}</p>
                 {(p.priceM || p.priceL) && (
                   <div className="flex gap-1.5 mt-1 sm:mt-1.5 flex-wrap">
                     {p.priceM ? (
                       <span className="text-[9px] sm:text-[10px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">
                         Size M: {formatCurrency(p.priceM)}
                       </span>
                     ) : null}
                     {p.priceL ? (
                       <span className="text-[9px] sm:text-[10px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">
                         Size L: {formatCurrency(p.priceL)}
                       </span>
                     ) : null}
                   </div>
                 )}
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
                onClick={() => setIsDraftsModalOpen(true)}
                className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all relative cursor-pointer"
                title="Bản nháp đã lưu"
              >
                <FolderOpen className="w-5 h-5" />
                {drafts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
                    {drafts.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setShowReceiptSettings(true)}
                className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition-all cursor-pointer"
                title="Cấu hình hóa đơn"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={() => { setCart([]); setMobileView('menu'); }} className="text-stone-400 hover:text-red-500 transition-colors cursor-pointer">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-stone-500 text-sm hidden lg:block">Hóa đơn mẫu #{Math.floor(Math.random()*10000)}</p>

          <div className="lg:hidden flex items-center gap-2">
             <button 
                onClick={() => setIsDraftsModalOpen(true)}
                className="p-2 text-stone-400 hover:text-amber-600 relative cursor-pointer"
                title="Bản nháp đã lưu"
              >
                <FolderOpen className="w-5 h-5" />
                {drafts.length > 0 && (
                  <span className="absolute top-1 right-1 bg-amber-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
                    {drafts.length}
                  </span>
                )}
              </button>
             <button 
                onClick={() => setShowReceiptSettings(true)}
                className="p-2 text-stone-400 hover:text-stone-800 cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { setCart([]); setMobileView('menu'); }}
                className="p-2 text-stone-400 hover:text-red-500 cursor-pointer"
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
                  key={`${item.productId}-${item.size || 'default'}`}
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
                        onChange={(e) => updatePrice(item.productId, item.size, Number(e.target.value))}
                        className="w-16 sm:w-20 bg-transparent border-b border-dashed border-stone-200 text-[10px] sm:text-xs text-stone-500 font-bold focus:border-stone-900 outline-none transition-colors"
                      />
                      <span className="text-[10px] text-stone-400">đ</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-xl">
                    <button 
                      onClick={() => updateQuantity(item.productId, item.size, -1)}
                      className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-50 transition-colors shadow-sm"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-stone-800">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, item.size, 1)}
                      className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800 transition-colors shadow-lg"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
             {isAddModalOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-left"
            >
              {/* Header */}
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div>
                  <h3 className="text-lg font-bold text-stone-950">Thêm món mới</h3>
                  <p className="text-xs text-stone-500">Tạo món ăn hoặc thức uống mới vào danh mục bán</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 px-1.5 hover:bg-stone-200 text-stone-500 hover:text-stone-900 rounded-lg transition-colors font-bold text-sm flex items-center gap-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateProduct}>
                <div className="p-6 space-y-4">
                  {/* Name field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block">Tên món</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Cà phê muối, Trà sủi bọt..."
                      value={newProductFormData.name}
                      onChange={(e) => setNewProductFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-stone-200"
                    />
                  </div>

                  {/* Price fields */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block">Giá bán *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="Ví dụ: 25000"
                        value={newProductFormData.price || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setNewProductFormData(prev => ({ ...prev, price: val }));
                        }}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-stone-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block">Giá Size M</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Tùy chọn"
                        value={newProductFormData.priceM || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setNewProductFormData(prev => ({ ...prev, priceM: val }));
                        }}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-stone-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block">Giá Size L</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Tùy chọn"
                        value={newProductFormData.priceL || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setNewProductFormData(prev => ({ ...prev, priceL: val }));
                        }}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-stone-200"
                      />
                    </div>
                  </div>

                  {/* Category select */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block">Danh mục</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'Coffee', label: 'Cà phê' },
                        { key: 'Tea', label: 'Trà' },
                        { key: 'Food', label: 'Bánh/Món ăn' }
                      ].map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setNewProductFormData(prev => ({ ...prev, category: cat.key as any }))}
                          className={cn(
                            "py-2.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                            newProductFormData.category === cat.key
                              ? "bg-stone-950 text-white border-stone-950 shadow-md"
                              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 bg-white border border-stone-200 text-stone-600 font-bold py-3 rounded-xl hover:bg-stone-100 transition-all text-sm h-11 flex items-center justify-center cursor-pointer"
                  >
                    HUỶ
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingProduct}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all text-sm h-11 flex items-center justify-center cursor-pointer"
                  >
                    {isAddingProduct ? 'ĐANG LƯU...' : 'THÊM MÓN'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
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

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={cart.length === 0 || isProcessing}
              onClick={() => setIsSavingDraftModalOpen(true)}
              className="flex-1 border border-stone-200 hover:border-amber-500 hover:bg-amber-50 text-stone-700 hover:text-amber-700 font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              LƯU NHÁP
            </button>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setIsInvoicePreviewOpen(true)}
              className="flex-1 border border-stone-200 hover:border-stone-900 hover:bg-stone-50 text-stone-700 hover:text-stone-900 font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              XEM TRƯỚC H.ĐƠN
            </button>
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

      {/* Saving Draft Name/Note Modal */}
      {isSavingDraftModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-left"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-stone-950 font-sans">Lưu bản nháp</h3>
                <p className="text-xs text-stone-500 font-sans">Đặt tên bản nháp để mở lại sau này</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSavingDraftModalOpen(false)}
                className="p-1 hover:bg-stone-200 text-stone-500 hover:text-stone-950 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-stone-600" />
              </button>
            </div>
            
            <form onSubmit={handleSaveDraft}>
              <div className="p-6 space-y-4 font-sans">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block">Tên / Ghi chú bản nháp</label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    placeholder="Ví dụ: Bàn 5, Đơn mang về anh Nam..."
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-stone-200 text-stone-800"
                  />
                </div>
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsSavingDraftModalOpen(false)}
                  className="flex-1 bg-white border border-stone-200 text-stone-600 font-bold py-3 rounded-xl hover:bg-stone-100 transition-all text-sm h-11 flex items-center justify-center cursor-pointer"
                >
                  HUỶ
                </button>
                <button
                  type="submit"
                  disabled={isSavingDraft || !draftNote.trim()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all text-sm h-11 flex items-center justify-center cursor-pointer"
                >
                  {isSavingDraft ? 'ĐANG LƯU...' : 'LƯU BẢN NHÁP'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* List drafts Modal */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-left flex flex-col max-h-[85vh]"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-lg font-bold text-stone-950 font-sans">Danh sách Bản nháp</h3>
                <p className="text-xs text-stone-500 font-sans">Chọn bản nháp để tải lại vào giỏ hàng</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                className="p-1 hover:bg-stone-200 text-stone-500 hover:text-stone-950 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-stone-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {drafts.length === 0 ? (
                <div className="text-center py-12 text-stone-400 space-y-3">
                  <FolderOpen className="w-12 h-12 mx-auto opacity-30" />
                  <p className="font-sans italic text-sm">Chưa có bản nháp nào được lưu</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {drafts.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => handleLoadDraft(d)}
                      className="border border-stone-200 hover:border-amber-400 rounded-2xl p-4 transition-all hover:shadow-md cursor-pointer flex justify-between items-center group hover:bg-amber-50/25"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="font-bold text-stone-900 font-sans flex items-center gap-2 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                          {d.note}
                        </div>
                        <div className="text-xs text-stone-500 font-sans">
                          {d.items?.length || 0} món • {formatCurrency(d.totalAmount)}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {d.createdAt ? new Date(d.createdAt).toLocaleString('vi-VN') : 'Không rõ ngày'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteDraft(d.id, e)}
                        className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Xóa bản nháp"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                className="bg-stone-950 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-stone-800 transition-all text-sm cursor-pointer"
              >
                ĐÓNG
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {isInvoicePreviewOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-stone-100 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 items-center border border-stone-200"
          >
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-stone-500 font-sans uppercase tracking-[0.1em]">XEM TRƯỚC HÓA ĐƠN</span>
              <button
                onClick={() => setIsInvoicePreviewOpen(false)} 
                className="p-1.5 hover:bg-stone-200 text-stone-500 hover:text-stone-950 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-stone-600" />
              </button>
            </div>

            {/* Actual receipt sheet paper simulation */}
            <div className="bg-white text-stone-800 p-6 shadow-md border border-stone-200 rounded-lg w-full flex flex-col items-center relative overflow-hidden font-sans text-center max-h-[65vh] overflow-y-auto">
              <div className="w-12 h-12 mt-4 mb-3">
                <img src={receiptSettings.logo} alt="Store Logo" className="w-full h-full object-contain grayscale opacity-70 animate-pulse" />
              </div>

              {receiptSettings.showStoreName && (
                <h4 className="font-extrabold text-stone-900 text-base mb-1 tracking-wide uppercase">TIỆM CÀ PHƠ</h4>
              )}
              <p className="text-[10px] text-stone-400 font-medium mb-3">--- HÓA ĐƠN BÁN LẺ MẪU ---</p>

              {/* Receipt metadata */}
              <div className="w-full border-b border-dashed border-stone-200 pb-2 mb-3 text-[10px] text-left space-y-0.5 text-stone-500 font-sans">
                <div className="flex justify-between font-medium">
                  <span>Mã số đơn:</span>
                  <span className="font-bold text-stone-800">#TMP-{Math.floor(1000 + Math.random()*9000)}</span>
                </div>
                {receiptSettings.showDate && (
                  <div className="flex justify-between">
                    <span>Thời gian:</span>
                    <span className="text-stone-800">{new Date().toLocaleString('vi-VN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Thu ngân:</span>
                  <span className="text-stone-800">{auth.currentUser?.email?.split('@')[0] || 'Nhân viên'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="w-full mb-3 text-[11px] text-left">
                <div className="flex justify-between font-bold border-b border-stone-200 pb-1.5 mb-1.5 text-stone-600">
                  <span>Tên món</span>
                  <span>Tổng tiền</span>
                </div>
                <div className="space-y-1.5 font-sans">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-dashed border-stone-100 pb-1.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-stone-900">{item.name}</span>
                        <span className="text-[9px] text-stone-400 font-medium">{formatCurrency(item.price)} x {item.quantity}</span>
                      </div>
                      <span className="font-black text-stone-900 text-[11px] self-end">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing section */}
              <div className="w-full border-t border-stone-200 pt-2 mb-4 space-y-1 text-xs text-left">
                <div className="flex justify-between text-stone-500">
                  <span>Tạm tính:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between font-black text-stone-900 border-t border-dashed border-stone-200 pt-1.5 text-sm">
                  <span>TỔNG CỘNG:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Custom Store message from configuration */}
              <p className="text-[10px] text-stone-500 leading-relaxed italic max-w-[90%] mb-4">
                "{receiptSettings.message}"
              </p>

              {/* Realistic fake barcode / barcode strip */}
              <div className="flex flex-col items-center space-y-1 mb-2 opacity-60">
                <div className="h-6 w-32 bg-stone-900 flex space-x-[1px] px-1 justify-between overflow-hidden">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="h-full bg-white animate-pulse" style={{ width: `${(i % 3 === 0 ? 2 : i % 5 === 0 ? 4 : 1)}px` }} />
                  ))}
                </div>
                <span className="text-[7px] text-stone-400 font-mono tracking-[0.2em]">{Math.floor(10000000 + Math.random()*90000000)}</span>
              </div>
            </div>

            {/* Print and complete buttons for preview */}
            <div className="w-full flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  alert('Tiến trình in hóa đơn mô phỏng thành công!');
                  setIsInvoicePreviewOpen(false);
                }}
                className="flex-1 bg-white border border-stone-200 text-stone-700 font-bold py-3 rounded-2xl hover:bg-stone-50 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4 text-stone-500" />
                MÁY IN
              </button>
              <button
                type="button"
                onClick={() => setIsInvoicePreviewOpen(false)}
                className="flex-[1.5] bg-stone-950 hover:bg-stone-850 text-white font-bold py-3 rounded-2xl transition-all text-xs cursor-pointer shadow-md"
              >
                ĐÓNG
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Size Selection Modal */}
      {selectedProductForSize && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-left border border-stone-100 z-50"
          >
            {/* Header */}
            <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-950">Chọn kích cỡ (Size)</h3>
                <p className="text-xs text-stone-500 mt-1">{selectedProductForSize.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductForSize(null)}
                className="p-1 px-1.5 hover:bg-stone-100 text-stone-400 hover:text-stone-900 rounded-lg transition-colors font-bold text-sm flex items-center gap-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sizes List */}
            <div className="p-6 space-y-3">
              {/* Size Regular option */}
              <button
                type="button"
                onClick={() => {
                  addToCart(selectedProductForSize);
                  setSelectedProductForSize(null);
                }}
                className="w-full p-4 rounded-2xl border border-stone-200 hover:border-stone-900 hover:bg-stone-50 flex items-center justify-between group transition-all text-left cursor-pointer"
              >
                <div>
                  <span className="font-bold text-stone-900 text-sm block">Giá thường (Mặc định)</span>
                  <span className="text-xs text-stone-500">Cỡ tiêu chuẩn</span>
                </div>
                <span className="font-bold text-stone-900 text-base group-hover:scale-105 transition-transform">
                  {formatCurrency(selectedProductForSize.price)}
                </span>
              </button>

              {/* Size M Option */}
              {selectedProductForSize.priceM ? (
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedProductForSize, 'M');
                    setSelectedProductForSize(null);
                  }}
                  className="w-full p-4 rounded-2xl border border-stone-200 hover:border-stone-900 hover:bg-stone-50 flex items-center justify-between group transition-all text-left cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-[#8c6d58] text-sm block">Size M</span>
                    <span className="text-xs text-stone-500">Kích thước vừa</span>
                  </div>
                  <span className="font-bold text-stone-900 text-base group-hover:scale-105 transition-transform">
                    {formatCurrency(selectedProductForSize.priceM)}
                  </span>
                </button>
              ) : null}

              {/* Size L Option */}
              {selectedProductForSize.priceL ? (
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedProductForSize, 'L');
                    setSelectedProductForSize(null);
                  }}
                  className="w-full p-4 rounded-2xl border border-stone-200 hover:border-stone-900 hover:bg-stone-50 flex items-center justify-between group transition-all text-left cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-emerald-700 text-sm block">Size L</span>
                    <span className="text-xs text-stone-500">Kích thước lớn</span>
                  </div>
                  <span className="font-bold text-stone-900 text-base group-hover:scale-105 transition-transform">
                    {formatCurrency(selectedProductForSize.priceL)}
                  </span>
                </button>
              ) : null}
            </div>

            {/* Cancel Button */}
            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedProductForSize(null)}
                className="w-full bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold py-2.5 rounded-xl transition-all text-sm cursor-pointer shadow-sm text-center"
              >
                HỦY BỎ
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
