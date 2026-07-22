import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, UserPlus, Store, Users, KeyRound, Eye, EyeOff, Database, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsViewProps {
  token: string | null;
  addToast: (text: string, type: 'success' | 'error' | 'warning') => void;
  user: any;
  updateUserContext: (storeName: string, token: string) => void;
}

export function SettingsView({ token, addToast, user, updateUserContext }: SettingsViewProps) {
  // Store Settings state
  const [storeName, setStoreName] = useState(user?.storeName || '');
  const [updatingStore, setUpdatingStore] = useState(false);

  // PIN settings state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [updatingPin, setUpdatingPin] = useState(false);

  // Staff creation state
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [ownerConfirmPin, setOwnerConfirmPin] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Staff list state
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [showPass, setShowPass] = useState(false);

  // MongoDB status state
  const [mongoConnected, setMongoConnected] = useState(false);
  const [mongoStatus, setMongoStatus] = useState('Checking connection...');
  const [mongoUri, setMongoUri] = useState('');
  const [checkingMongo, setCheckingMongo] = useState(true);

  const fetchMongoStatus = async () => {
    setCheckingMongo(true);
    try {
      const response = await fetch('/api/mongodb-status');
      if (response.ok) {
        const data = await response.json();
        setMongoConnected(data.connected);
        setMongoStatus(data.status);
        setMongoUri(data.uri);
      }
    } catch (e) {
      console.error(e);
      setMongoStatus('Error querying status');
    } finally {
      setCheckingMongo(false);
    }
  };

  const fetchStaffList = async () => {
    if (user?.role !== 'owner') return;
    setLoadingStaff(true);
    try {
      const response = await fetch('/api/auth/staff', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStaffList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    fetchStaffList();
    fetchMongoStatus();
  }, []);

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      addToast('Store name cannot be empty.', 'warning');
      return;
    }

    setUpdatingStore(true);
    try {
      const response = await fetch('/api/settings/change-store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ storeName }),
      });

      const data = await response.json();
      if (response.ok) {
        addToast('Store settings updated successfully.', 'success');
        updateUserContext(data.storeName, data.token);
      } else {
        addToast(data.error || 'Failed to update store name.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('A network error occurred.', 'error');
    } finally {
      setUpdatingStore(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin || !newPin || !confirmPin) {
      addToast('Please fill out all PIN fields.', 'warning');
      return;
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      addToast('New PIN must be exactly 4 digits.', 'warning');
      return;
    }

    if (newPin !== confirmPin) {
      addToast('New PIN and confirmation PIN do not match.', 'error');
      return;
    }

    setUpdatingPin(true);
    try {
      const response = await fetch('/api/settings/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      });

      const data = await response.json();
      if (response.ok) {
        addToast('Security PIN modified successfully.', 'success');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        addToast(data.error || 'Failed to change PIN.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('A network error occurred.', 'error');
    } finally {
      setUpdatingPin(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail || !staffUsername || !staffPassword || !ownerConfirmPin) {
      addToast('Please fill out all staff fields.', 'warning');
      return;
    }

    setCreatingStaff(true);
    try {
      const response = await fetch('/api/auth/add-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          username: staffUsername,
          password: staffPassword,
          pin: ownerConfirmPin,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        addToast('Staff cashier account registered successfully.', 'success');
        // Reset form
        setStaffName('');
        setStaffEmail('');
        setStaffUsername('');
        setStaffPassword('');
        setOwnerConfirmPin('');
        fetchStaffList();
      } else {
        addToast(data.error || 'Failed to register staff account.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('A network error occurred.', 'error');
    } finally {
      setCreatingStaff(false);
    }
  };

  const isOwner = user?.role === 'owner';

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/40">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Settings</h2>
        </div>
        <p className="text-sm text-slate-500">Configure core attributes, update security credentials, and register cashiers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Store Profile & PIN Security */}
        <div className="space-y-6 lg:col-span-1">
          {/* Store Profile */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Store className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900">Store Environment</h3>
            </div>

            <form onSubmit={handleUpdateStore} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Registered Store Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  disabled={!isOwner}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-all disabled:opacity-50"
                />
              </div>

              {isOwner && (
                <button
                  type="submit"
                  disabled={updatingStore}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {updatingStore ? 'Saving store info...' : 'Update Store Name'}
                </button>
              )}
            </form>
          </div>

          {/* PIN Lock Management */}
          {isOwner && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Security PIN Authorization</h3>
              </div>

              <form onSubmit={handleUpdatePin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Current PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all text-center tracking-widest"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">New PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={newPin}
                      onChange={e => setNewPin(e.target.value)}
                      placeholder="••••"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all text-center tracking-widest"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Confirm PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value)}
                      placeholder="••••"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all text-center tracking-widest"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updatingPin}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {updatingPin ? 'Updating PIN lock...' : 'Update Security PIN'}
                </button>
              </form>
            </div>
          )}

          {/* MongoDB Connection Status Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Database Engine</h3>
              </div>
              <button
                onClick={fetchMongoStatus}
                disabled={checkingMongo}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
                title="Refresh database connection status"
              >
                <RefreshCw className={`h-4 w-4 ${checkingMongo ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                {checkingMongo ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full uppercase animate-pulse">
                    Checking...
                  </span>
                ) : mongoConnected ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full uppercase">
                    Local Storage
                  </span>
                )}
              </div>

              {mongoConnected ? (
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Connection Cluster</p>
                    <p className="text-xs font-bold text-slate-700 font-mono break-all leading-tight">
                      {mongoUri || 'Cloud Instance'}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    The platform is operating with dual-engine cloud replication. All product inventory, staff accounts, cash register invoices, and monthly store analytics are automatically saved securely on MongoDB.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-800 leading-none">Running in Local File Mode</p>
                      <p className="text-[10px] text-amber-700 leading-normal">
                        No active MONGODB_URI detected in configuration. Changes are safely cached locally.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">How to link MongoDB:</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Add a new variable inside your environment <span className="font-semibold text-slate-800">.env</span> file:
                    </p>
                    <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[9px] select-all overflow-x-auto whitespace-pre leading-normal border border-slate-800 shadow-inner">
                      MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Multi-User Staff Cashiers (Owner only) */}
        <div className="lg:col-span-2 space-y-6">
          {isOwner ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Register Staff form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                  <UserPlus className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900">Add Cashier Staff</h3>
                </div>

                <form onSubmit={handleCreateStaff} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Staff Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Emily Cashier"
                      value={staffName}
                      onChange={e => setStaffName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Staff Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="emily@example.com"
                      value={staffEmail}
                      onChange={e => setStaffEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Login Username</label>
                    <input
                      type="text"
                      required
                      placeholder="emily123"
                      value={staffUsername}
                      onChange={e => setStaffUsername(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Login Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={staffPassword}
                        onChange={e => setStaffPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-4 pr-10 py-2 text-sm font-medium outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Owner Security PIN (to authorize)</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={ownerConfirmPin}
                      onChange={e => setOwnerConfirmPin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all text-center tracking-widest"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creatingStaff}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-2"
                  >
                    {creatingStaff ? 'Adding staff...' : 'Add Cashier Account'}
                  </button>
                </form>
              </div>

              {/* Staff Cashiers directory */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 font-sans">Active Cashier List</h3>
                </div>

                {loadingStaff ? (
                  <div className="text-center py-10">
                    <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <span className="text-xs text-slate-400">Loading cashiers list...</span>
                  </div>
                ) : staffList.length > 0 ? (
                  <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
                    {staffList.map((st) => (
                      <div key={st.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-800 leading-tight">{st.name}</p>
                          <p className="text-xs text-slate-500 font-medium">{st.username} • {st.email}</p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase shrink-0">
                          {st.role}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50/30 rounded-2xl border border-dashed">
                    <Users className="h-8 w-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-500">No staff registered yet</p>
                    <p className="text-[11px] text-slate-400 max-w-[160px] mx-auto mt-0.5">
                      Create limited cashier roles to handle POS transactions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center py-16 space-y-3">
              <ShieldCheck className="h-12 w-10 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-slate-900 text-lg">Staff Role Environment</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                As a staff member of <span className="font-bold text-indigo-600">{user?.storeName}</span>, your permissions are limited.
                You can record active cash sales, checkout customers, and print invoices, but database administration features (inventory additions, settings, growth metrics) are secured.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
