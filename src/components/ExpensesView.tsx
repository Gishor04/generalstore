import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Trash2, Calendar, DollarSign, Tag, ReceiptText, X, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense } from '../types';

interface ExpensesViewProps {
  token: string | null;
  addToast: (text: string, type: 'success' | 'error' | 'warning') => void;
}

export function ExpensesView({ token, addToast }: ExpensesViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Drawer / Add state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [category, setCategory] = useState('Rent');

  const categories = ['Rent', 'Electricity', 'Water', 'Marketing', 'Maintenance', 'Salaries', 'Insurance', 'Utilities', 'Other'];

  const fetchExpenses = async () => {
    try {
      const response = await fetch('/api/expenses', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Sort expenses by date descending
        setExpenses(data.sort((a: Expense, b: Expense) => b.date.localeCompare(a.date)));
      } else {
        addToast('Failed to load expenses list.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error reading database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !date || !category) {
      addToast('All fields are required.', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          amount: Number(amount),
          date,
          category,
        }),
      });

      if (response.ok) {
        addToast('Operating expense recorded successfully.', 'success');
        setIsDrawerOpen(false);
        // Reset form
        setTitle('');
        setAmount('');
        setDate(new Date().toLocaleDateString('en-CA'));
        setCategory('Rent');
        fetchExpenses();
      } else {
        const errData = await response.json();
        addToast(errData.error || 'Failed to record expense.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('A connection error occurred.', 'error');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;

    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        addToast('Expense record deleted.', 'success');
        fetchExpenses();
      } else {
        addToast('Failed to delete expense.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('A connection error occurred.', 'error');
    }
  };

  // Calculations
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const totalMonthExpenses = expenses
    .filter(e => e.date.startsWith(currentMonthStr))
    .reduce((acc, e) => acc + e.amount, 0);

  const totalAllTimeExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || e.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-500">Retrieving expenses logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/40">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Operating Expenses</h2>
          <p className="text-sm text-slate-500">Record utilities, rent, and overheads to evaluate net store profits.</p>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Log Expense
        </button>
      </div>

      {/* Stats Widget Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Month Overhead */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">This Month's Overhead</span>
            <h3 className="text-2xl font-black text-slate-900">${totalMonthExpenses.toFixed(2)}</h3>
            <p className="text-xs text-slate-400">Fixed & operational costs for current month</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Cumulative Overheads */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Cumulative Expenses</span>
            <h3 className="text-2xl font-black text-slate-900">${totalAllTimeExpenses.toFixed(2)}</h3>
            <p className="text-xs text-slate-400">Total operational outgoings historically logged</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl text-slate-500">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search expenses by keyword, note, or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none transition-all"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 min-w-[180px]">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-all cursor-pointer text-slate-700"
          >
            <option value="all">All Categories</option>
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List Table */}
      <div className="bg-white border border-slate-100 shadow-sm shadow-slate-100/40 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Expense Details</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Invoice Date</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="p-2 bg-slate-50 text-slate-500 rounded-xl">
                        <ReceiptText className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-slate-900">{e.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
                        <Tag className="h-3 w-3" />
                        {e.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {e.date}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-rose-600">-${e.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete record"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    <ReceiptText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm">No expenses logged</p>
                    <p className="text-xs text-slate-400 mt-1">Operational overhead costs are clean.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add sliding Drawer overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-40 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-100 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Log Operating Expense</h3>
                  <p className="text-xs text-slate-500">Track operating bills impacting net profitability.</p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Expense Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Warehouse electricity bill"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amount * ($)</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-all cursor-pointer text-slate-700"
                  >
                    {categories.map((cat, idx) => (
                      <option key={idx} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Bill Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-all text-slate-700 cursor-pointer"
                  />
                </div>

                {/* Submit */}
                <div className="border-t border-slate-100 pt-6 mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shadow-slate-900/10"
                  >
                    Log Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
