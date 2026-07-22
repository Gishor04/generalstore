import React, { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight, DollarSign, Calendar, RefreshCw, BarChart3, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface DashboardViewProps {
  token: string | null;
  addToast: (text: string, type: 'success' | 'error' | 'warning') => void;
}

export function DashboardView({ token, addToast }: DashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/dashboard?month=${selectedMonth}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        addToast('Failed to load dashboard metrics.', 'error');
      }
    } catch (error) {
      console.error(error);
      addToast('Error communicating with database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedMonth]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-500">Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  const today = stats?.today || { revenue: 0, transactions: 0, profit: 0, topProduct: 'None' };
  const summary = stats?.summary || { thisMonthRevenue: 0, thisMonthProfit: 0, thisMonthExpenses: 0, growthRate: 0, totalProducts: 0, lowStockCount: 0 };
  const dailyData = stats?.charts?.dailyData || [];
  const topProducts = stats?.topProducts || [];

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/40">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Analytics Dashboard</h2>
          <p className="text-sm text-slate-500">Overview of store performance, stock levels, and daily sales tracking.</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-slate-700 cursor-pointer font-semibold"
            />
          </div>
          <button
            onClick={fetchDashboardStats}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 active:bg-slate-100 transition-colors"
            title="Refresh dashboard stats"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Today's Revenue</span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900">${today.revenue.toFixed(2)}</h3>
            <p className="text-xs text-slate-400 font-medium">
              From <span className="font-semibold text-slate-600">{today.transactions}</span> invoices today
            </p>
          </div>
        </motion.div>

        {/* Monthly Revenue & Growth */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">This Month Sales</span>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900">${summary.thisMonthRevenue.toFixed(2)}</h3>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {summary.growthRate >= 0 ? (
                <span className="text-emerald-600 flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  +{summary.growthRate.toFixed(1)}%
                </span>
              ) : (
                <span className="text-rose-500 flex items-center">
                  <ArrowDownRight className="h-3 w-3 mr-0.5" />
                  {summary.growthRate.toFixed(1)}%
                </span>
              )}
              <span className="text-slate-400">vs. previous month</span>
            </div>
          </div>
        </motion.div>

        {/* Operating Profits (Net) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">This Month Profits</span>
            <div className="p-2.5 bg-sky-50 rounded-xl text-sky-600">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900">
              ${(summary.thisMonthProfit - summary.thisMonthExpenses).toFixed(2)}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Expenses: <span className="font-semibold text-rose-500">${summary.thisMonthExpenses.toFixed(2)}</span>
            </p>
          </div>
        </motion.div>

        {/* Stock Alert */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Low Stock Warning</span>
            <div className={`p-2.5 rounded-xl ${summary.lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className={`text-2xl font-black ${summary.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {summary.lowStockCount} items
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Out of <span className="font-semibold text-slate-600">{summary.totalProducts}</span> total catalog items
            </p>
          </div>
        </motion.div>
      </div>

      {/* Main Graph & Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Graph */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-950 text-base">Monthly Revenue Trend</h3>
            <p className="text-xs text-slate-400">Daily sales performance and operating profits across the selected month.</p>
          </div>
          <div className="h-72 w-full mt-auto">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    labelFormatter={(day) => `Day ${day} of Month`}
                  />
                  <Area type="monotone" dataKey="sales" name="Sales ($)" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="profit" name="Net Profit ($)" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No graph data available for this month.
              </div>
            )}
          </div>
        </div>

        {/* Top Products Overall Widget */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-slate-950 text-base">Top-Selling Products</h3>
              <p className="text-xs text-slate-400">Highest volume performers this month.</p>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            {topProducts.length > 0 ? (
              topProducts.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div className="space-y-1 max-w-[160px] sm:max-w-xs">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                    <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {p.category || 'General'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{p.quantity} sold</p>
                    <p className="text-xs text-emerald-600 font-semibold">+${p.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl">
                <ShoppingBag className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-500">No items sold yet</p>
                <p className="text-xs text-slate-400 max-w-[180px] mt-1">
                  Wait for transactions to load or begin logging checkout sales.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
