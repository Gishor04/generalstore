import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, ShoppingCart, ReceiptText, Settings, LogOut, Store, Menu, X, User, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthState, UserRole, ToastMessage } from './types';

// Component imports
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { SalesView } from './components/SalesView';
import { ExpensesView } from './components/ExpensesView';
import { SettingsView } from './components/SettingsView';
// Toast helper inside same file for direct access and reliability
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const token = localStorage.getItem('store_token');
    const userStr = localStorage.getItem('store_user');
    return {
      token: token || null,
      user: userStr ? JSON.parse(userStr) : null,
    };
  });

  const [activeView, setActiveView] = useState<'dashboard' | 'products' | 'sales' | 'expenses' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);

  // Sign In inputs
  const [loginUsername, setLoginUsername] = useState('owner@example.com');
  const [loginPassword, setLoginPassword] = useState('password123');

  // Sign Up inputs
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regPin, setRegPin] = useState('0814');

  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: 'success' | 'error' | 'warning') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setAuthError('Please fill out all credentials.');
      return;
    }

    setSubmittingAuth(true);
    setAuthError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('store_token', data.token);
        localStorage.setItem('store_user', JSON.stringify(data.user));
        setAuthState({
          token: data.token,
          user: data.user,
        });
        addToast(`Welcome back, ${data.user.name}!`, 'success');
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      setAuthError('Connection error occurred.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regUsername || !regPassword || !regStoreName || !regPin) {
      setAuthError('Please fill out all fields.');
      return;
    }

    if (regPin.length !== 4 || !/^\d+$/.test(regPin)) {
      setAuthError('PIN must be exactly 4 digits.');
      return;
    }

    setSubmittingAuth(true);
    setAuthError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          username: regUsername,
          password: regPassword,
          storeName: regStoreName,
          pin: regPin,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('store_token', data.token);
        localStorage.setItem('store_user', JSON.stringify(data.user));
        setAuthState({
          token: data.token,
          user: data.user,
        });
        addToast(`Store registered successfully!`, 'success');
      } else {
        setAuthError(data.error || 'Failed to complete registration.');
      }
    } catch (err) {
      console.error(err);
      setAuthError('Connection error occurred.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('store_token');
    localStorage.removeItem('store_user');
    setAuthState({ token: null, user: null });
    setActiveView('dashboard');
    addToast('Logged out of session.', 'warning');
  };

  const updateStoreNameContext = (storeName: string, token: string) => {
    const updatedUser = { ...authState.user!, storeName };
    localStorage.setItem('store_token', token);
    localStorage.setItem('store_user', JSON.stringify(updatedUser));
    setAuthState({ token, user: updatedUser });
  };

  // Set default state checks
  const isOwner = authState.user?.role === 'owner';

  // Floating notifications render inside same wrapper for clean module structure
  const bgStyles = {
    success: 'bg-white border-emerald-100 text-slate-800 shadow-emerald-50/50 shadow-lg',
    error: 'bg-white border-rose-100 text-slate-800 shadow-rose-50/50 shadow-lg',
    warning: 'bg-white border-amber-100 text-slate-800 shadow-amber-50/50 shadow-lg',
  };

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  };

  // Render auth views if not logged in
  if (!authState.token) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
          <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">General Store Manager</h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Full-suite software tool for products, POS sales, and overhead statistics.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 border border-slate-100 shadow-md shadow-slate-100/40 rounded-3xl sm:px-10">
            {isLoginView ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-2 mb-4">Owner Log In</h2>

                {authError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Username or Email</label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                    <span>Instant Trial Mode</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    The database has been pre-seeded with default credentials. You can click log in instantly to try the app!
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-slate-900/10"
                >
                  {submittingAuth ? 'Verifying session...' : 'Sign In To Store'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginView(false);
                      setAuthError(null);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Register new store instead
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-2 mb-4">Register Store & Owner</h2>

                {authError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Jane Owner"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Store Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Uptown Mart"
                      value={regStoreName}
                      onChange={(e) => setRegStoreName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="owner@store.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Login Username</label>
                    <input
                      type="text"
                      required
                      placeholder="janeowner"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-slate-900/10"
                >
                  {submittingAuth ? 'Registering store...' : 'Complete Registration'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginView(true);
                      setAuthError(null);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Back to Log In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Global Toast render */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 ${bgStyles[toast.type]}`}
              >
                {icons[toast.type]}
                <div className="flex-1 text-sm font-semibold leading-relaxed text-slate-800">{toast.text}</div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-0.5 hover:bg-slate-50 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Render main dashboard frame on login success
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar - Desktop Layout */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 h-screen sticky top-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-2.5">
          <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-600/10">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white truncate max-w-[150px] leading-tight">
              {authState.user?.storeName}
            </h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              STORE MANAGER
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1">
          {/* Dashboard */}
          {isOwner && (
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                activeView === 'dashboard'
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-5 w-5 shrink-0" />
              Dashboard
            </button>
          )}

          {/* Catalog products */}
          <button
            onClick={() => setActiveView('products')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeView === 'products'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Package className="h-5 w-5 shrink-0" />
            Inventory Stock
          </button>

          {/* POS Sales checkout */}
          <button
            onClick={() => setActiveView('sales')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeView === 'sales'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShoppingCart className="h-5 w-5 shrink-0" />
            Cash POS Register
          </button>

          {/* Overhead Expenses */}
          {isOwner && (
            <button
              onClick={() => setActiveView('expenses')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                activeView === 'expenses'
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ReceiptText className="h-5 w-5 shrink-0" />
              Overhead Expenses
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => setActiveView('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeView === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" />
            System Settings
          </button>
        </nav>

        {/* User Profile Banner Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 max-w-[130px]">
            <div className="h-8.5 w-8.5 bg-slate-800 rounded-xl flex items-center justify-center text-slate-300">
              <User className="h-4.5 w-4.5" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white leading-tight truncate">{authState.user?.name}</p>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                {authState.user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all active:scale-95 shrink-0"
            title="Log out of session"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile Sliding Drawer layout */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Sidebar drawer body */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-64 bg-slate-900 text-slate-300 h-full flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8.5 w-8.5 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-600/10">
                    <Store className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h1 className="font-bold text-xs text-white leading-none">{authState.user?.storeName}</h1>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 block">
                      STORE MANAGER
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-1">
                {isOwner && (
                  <button
                    onClick={() => {
                      setActiveView('dashboard');
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                      activeView === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    Dashboard
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveView('products');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    activeView === 'products' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Package className="h-5 w-5" />
                  Inventory Stock
                </button>

                <button
                  onClick={() => {
                    setActiveView('sales');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    activeView === 'sales' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Cash POS Register
                </button>

                {isOwner && (
                  <button
                    onClick={() => {
                      setActiveView('expenses');
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                      activeView === 'expenses' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <ReceiptText className="h-5 w-5" />
                    Overhead Expenses
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveView('settings');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    activeView === 'settings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Settings className="h-5 w-5" />
                  System Settings
                </button>
              </nav>

              <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 max-w-[130px]">
                  <div className="h-8 w-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-300">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white leading-tight truncate">{authState.user?.name}</p>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                      {authState.user?.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Workspace Scrollable Container */}
      <div className="flex-1 flex flex-col overflow-hidden h-screen">
        {/* Upper Header Panel (Mobile menu toggle button here) */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between lg:justify-end shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Quick Header Right stats summary */}
          <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
            <span>Logged in as:</span>
            <span className="text-slate-800 font-bold uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md flex items-center gap-1 border border-slate-100">
              <User className="h-3.5 w-3.5 text-indigo-500" />
              {authState.user?.name} ({authState.user?.role})
            </span>
          </div>
        </header>

        {/* Dynamic View Scrollable Frame */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto pb-12">
          {activeView === 'dashboard' && isOwner && (
            <DashboardView token={authState.token} addToast={addToast} />
          )}
          {activeView === 'products' && (
            <ProductsView token={authState.token} addToast={addToast} userRole={authState.user?.role || 'staff'} />
          )}
          {activeView === 'sales' && (
            <SalesView token={authState.token} addToast={addToast} storeName={authState.user?.storeName || 'My Store'} />
          )}
          {activeView === 'expenses' && isOwner && (
            <ExpensesView token={authState.token} addToast={addToast} />
          )}
          {activeView === 'settings' && (
            <SettingsView
              token={authState.token}
              addToast={addToast}
              user={authState.user}
              updateUserContext={updateStoreNameContext}
            />
          )}

        </main>
      </div>

      {/* Toast Notification popups container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 ${bgStyles[toast.type]}`}
            >
              {icons[toast.type]}
              <div className="flex-1 text-sm font-semibold leading-relaxed text-slate-800">{toast.text}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-0.5 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
