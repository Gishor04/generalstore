import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, ClipboardList, CheckCircle, User, Calendar, Receipt, ChevronRight, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Sale } from '../types';

interface SalesViewProps {
  token: string | null;
  addToast: (text: string, type: 'success' | 'error' | 'warning') => void;
  storeName: string;
}

interface CartItem {
  product: Product;
  quantitySold: number;
}

export function SalesView({ token, addToast, storeName }: SalesViewProps) {
  const [activeTab, setActiveTab] = useState<'checkout' | 'history'>('checkout');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // History State
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Receipt Modal State
  const [currentReceipt, setCurrentReceipt] = useState<Sale | null>(null);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        const uniqueCats = Array.from(new Set(data.map((p: Product) => p.category))) as string[];
        setCategories(uniqueCats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/sales', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Sort history by most recent
        setSalesHistory(data.sort((a: Sale, b: Sale) => b.timestamp.localeCompare(a.timestamp)));
      }
    } catch (err) {
      console.error(err);
      addToast('Error loading transaction records.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      addToast(`${product.name} is out of stock!`, 'warning');
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantitySold;
      if (currentQty >= product.quantity) {
        addToast(`Cannot add more. Only ${product.quantity} ${product.unit} available.`, 'warning');
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantitySold += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { product, quantitySold: 1 }]);
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    const itemIndex = cart.findIndex(item => item.product.id === productId);
    if (itemIndex === -1) return;

    const item = cart[itemIndex];
    const newQty = item.quantitySold + delta;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > item.product.quantity) {
      addToast(`Cannot exceed available stock of ${item.product.quantity} ${item.product.unit}.`, 'warning');
      return;
    }

    const updatedCart = [...cart];
    updatedCart[itemIndex].quantitySold = newQty;
    setCart(updatedCart);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Submit Sale Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const payload = {
      items: cart.map(item => ({
        productId: item.product.id,
        quantitySold: item.quantitySold,
      })),
    };

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const saleResult = await response.json();
        addToast('Checkout complete! Invoice recorded.', 'success');
        setCart([]);
        setCurrentReceipt(saleResult); // Launch print receipt modal
        fetchProducts(); // Refresh stock levels in POS catalog
      } else {
        const errData = await response.json();
        addToast(errData.error || 'Failed to complete transaction.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection error completing checkout.', 'error');
    }
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantitySold), 0);

  // Filter Catalog Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Filter Historical Invoices
  const filteredHistory = salesHistory.filter(s => {
    return s.invoiceNumber.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
      s.soldByName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
      s.products.some(p => p.name.toLowerCase().includes(historySearchQuery.toLowerCase()));
  });

  const triggerReceiptPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('Print pop-up blocked. Please check your browser permissions.', 'warning');
      return;
    }

    // Compose receipt HTML
    const itemsHtml = currentReceipt?.products.map(p => `
      <tr style="border-bottom: 1px dashed #eaeaea;">
        <td style="padding: 6px 0; font-size: 12px;">${p.name}</td>
        <td style="padding: 6px 0; font-size: 12px; text-align: center;">${p.quantitySold}</td>
        <td style="padding: 6px 0; font-size: 12px; text-align: right;">$${p.priceAtSale.toFixed(2)}</td>
        <td style="padding: 6px 0; font-size: 12px; text-align: right;">$${(p.priceAtSale * p.quantitySold).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
      <head>
        <title>Receipt - ${currentReceipt?.invoiceNumber}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 20px; color: #111; }
          .center { text-align: center; }
          .title { font-weight: bold; font-size: 16px; margin-bottom: 4px; text-transform: uppercase; }
          .subtitle { font-size: 11px; color: #555; margin-bottom: 15px; }
          .divider { border-top: 1px dashed #444; margin: 10px 0; }
          .meta-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; }
          .total-section { font-size: 13px; font-weight: bold; margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .footer { font-size: 11px; text-align: center; margin-top: 25px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">${storeName}</div>
          <div class="subtitle">Official Invoice Receipt</div>
        </div>
        <div class="meta-row">
          <span>Date:</span>
          <span>${new Date(currentReceipt?.timestamp || '').toLocaleString()}</span>
        </div>
        <div class="meta-row">
          <span>Invoice No:</span>
          <span>${currentReceipt?.invoiceNumber}</span>
        </div>

        <div class="divider"></div>
        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #444; font-weight: bold; font-size: 11px;">
              <th style="text-align: left; padding-bottom: 4px;">Item</th>
              <th style="text-align: center; padding-bottom: 4px;">Qty</th>
              <th style="text-align: right; padding-bottom: 4px;">Price</th>
              <th style="text-align: right; padding-bottom: 4px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="total-section">
          <div class="total-row">
            <span>SUBTOTAL</span>
            <span>$${currentReceipt?.totalAmount.toFixed(2)}</span>
          </div>
          <div class="total-row" style="font-size: 14px; border-top: 1px solid #111; padding-top: 4px; margin-top: 4px;">
            <span>TOTAL PAID</span>
            <span>$${currentReceipt?.totalAmount.toFixed(2)}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="footer">
          <p>Thank you for your purchase!</p>
          <p style="font-size: 9px; color: #777;">Powered by General Store Manager</p>
        </div>
        <script>
          window.print();
          window.close();
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/40">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('checkout')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'checkout'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Cash Register
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Invoice Records
          </button>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block text-right">REGISTER ENVIRONMENT</span>
          <span className="text-sm font-bold text-slate-700 block text-right">{storeName}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'checkout' ? (
          <motion.div
            key="checkout"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
          >
            {/* Left Column: Product Selection POS Catalog */}
            <div className="lg:col-span-2 space-y-4">
              {/* Product Search & Category Panel */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/40 space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search catalog by name or category..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none transition-all"
                  />
                </div>

                {/* Horizontal Category Slider */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg shrink-0 border transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    All Items
                  </button>
                  {categories.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg shrink-0 border transition-all ${
                        selectedCategory === cat
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Catalog */}
              {loadingProducts ? (
                <div className="text-center py-20 bg-white border rounded-2xl">
                  <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span className="text-sm text-slate-400 font-semibold">Updating catalog register...</span>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.quantity <= 0;
                    const isLowStock = p.quantity <= p.lowStockThreshold;

                    return (
                      <motion.button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        disabled={isOutOfStock}
                        className={`bg-white text-left p-4 rounded-2xl border flex flex-col justify-between h-44 hover:shadow-md transition-all active:scale-95 border-slate-100 hover:border-indigo-100 group relative ${
                          isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50/50' : ''
                        }`}
                      >
                        <div className="flex gap-3 items-start w-full">
                          {p.image && (
                            <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-slate-100 shadow-sm bg-slate-50">
                              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight pr-1">
                              {p.name}
                            </p>
                            <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">
                              {p.category}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between w-full mt-auto">
                          <p className="font-black text-slate-950 text-base">${p.price.toFixed(2)}</p>
                          <span className={`text-[10px] font-semibold ${isOutOfStock ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-slate-400'}`}>
                            {isOutOfStock ? 'OUT OF STOCK' : `${p.quantity} ${p.unit} left`}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-white border rounded-2xl p-6">
                  <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-500 text-sm">No items matching criteria</p>
                </div>
              )}
            </div>

            {/* Right Column: Running Cart Summary */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col h-[calc(100vh-230px)] sticky top-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Current Order</h3>
                <span className="ml-auto text-xs bg-indigo-50 font-bold text-indigo-600 px-2.5 py-0.5 rounded-full">
                  {cart.length} items
                </span>
              </div>

              {/* Cart List Scrollable */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50 pr-1 no-scrollbar">
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <div key={item.product.id} className="py-3 flex items-center justify-between gap-3 first:pt-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.product.image && (
                          <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                            <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-bold text-slate-800 truncate leading-tight">{item.product.name}</p>
                          <p className="text-xs text-slate-400 font-semibold">${item.product.price.toFixed(2)} / {item.product.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl p-0.5">
                        <button
                          onClick={() => updateCartQty(item.product.id, -1)}
                          className="p-1 hover:bg-white text-slate-500 rounded-lg transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-extrabold text-slate-800">
                          {item.quantitySold}
                        </span>
                        <button
                          onClick={() => updateCartQty(item.product.id, 1)}
                          className="p-1 hover:bg-white text-slate-500 rounded-lg transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">${(item.product.price * item.quantitySold).toFixed(2)}</p>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-xs text-rose-500 font-bold hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                    <div className="p-3 bg-slate-50 rounded-2xl mb-3">
                      <ShoppingCart className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="font-semibold text-sm">Cart is empty</p>
                    <p className="text-xs text-slate-400 max-w-[160px] mt-1">
                      Click catalog products on the left to begin checking out.
                    </p>
                  </div>
                )}
              </div>

              {/* Total Summary Footer */}
              <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-sm text-slate-500 uppercase tracking-wider">Total Amount</span>
                  <span className="text-xl font-black text-slate-950">${cartTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-slate-900/10 active:scale-95"
                >
                  Confirm Purchase & Print
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Invoice Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search historical records by invoice or product..."
                value={historySearchQuery}
                onChange={e => setHistorySearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none transition-all"
              />
            </div>

            {/* Invoices List */}
            {loadingHistory ? (
              <div className="text-center py-20 bg-white border rounded-2xl shadow-sm">
                <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <span className="text-sm text-slate-400 font-semibold">Retrieving records archive...</span>
              </div>
            ) : filteredHistory.length > 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm shadow-slate-100/40">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-slate-500">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Invoice No</th>
                        <th className="px-6 py-4">Transaction Date</th>

                        <th className="px-6 py-4">Items Summary</th>
                        <th className="px-6 py-4 text-right">Invoice Amount</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistory.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">{s.invoiceNumber}</td>
                          <td className="px-6 py-4 text-slate-600">
                            {new Date(s.timestamp).toLocaleDateString()} at{' '}
                            {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-xs text-slate-500 font-medium max-w-[220px] truncate">
                              {s.products.map(p => `${p.name} (x${p.quantitySold})`).join(', ')}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">${s.totalAmount.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setCurrentReceipt(s)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white border rounded-2xl p-6 shadow-sm">
                <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-500 text-sm">No transaction records found</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Printable Receipt Modal */}
      <AnimatePresence>
        {currentReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCurrentReceipt(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden z-10 text-slate-800 font-mono text-sm leading-relaxed"
            >
              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-slate-200 pb-4 mb-4">
                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight uppercase">{storeName}</h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">STORE TRANSACTION INVOICE</p>
              </div>

              {/* Receipt Meta */}
              <div className="space-y-1 text-xs text-slate-500 border-b border-dashed border-slate-200 pb-3 mb-3">
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(currentReceipt.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>INVOICE NO:</span>
                  <span className="font-semibold text-slate-700">{currentReceipt.invoiceNumber}</span>
                </div>

              </div>

              {/* Items Table */}
              <div className="space-y-2 border-b border-dashed border-slate-200 pb-3 mb-3 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                {currentReceipt.products.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <span className="font-semibold text-slate-700 block truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {p.quantitySold} x ${p.priceAtSale.toFixed(2)}
                      </span>
                    </div>
                    <span className="font-bold text-slate-700 shrink-0 self-end">
                      ${(p.priceAtSale * p.quantitySold).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Receipt Total */}
              <div className="space-y-1.5 mb-6">
                <div className="flex justify-between text-xs text-slate-500 font-bold">
                  <span>SUBTOTAL</span>
                  <span>${currentReceipt.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-slate-900 pt-2 text-slate-900">
                  <span>TOTAL PAID</span>
                  <span>${currentReceipt.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Printable Modal Footer Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentReceipt(null)}
                  className="flex-1 font-sans border border-slate-200 hover:bg-slate-50 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={triggerReceiptPrint}
                  className="flex-1 font-sans bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-md"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
