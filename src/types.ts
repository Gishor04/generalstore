/**
 * Shared Type Definitions for General Store Management Web Application
 */

export type UserRole = 'owner';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  storeName: string;
  pin: string; // Hashed PIN for owner
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number; // Selling price
  costPrice: number; // For profit calculation
  quantity: number; // Current stock level
  unit: string; // kg, pcs, litre, etc.
  lowStockThreshold: number; // Warning when quantity falls below this
  createdAt: string; // ISO date string
  image?: string; // Optional base64-encoded image or image URL
}

export interface SaleProduct {
  productId: string;
  name: string;
  quantitySold: number;
  priceAtSale: number;
  costAtSale: number;
}

export interface Sale {
  id: string;
  products: SaleProduct[];
  totalAmount: number;
  totalCost: number;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  soldBy: string; // User ID
  soldByName: string; // User's name
  invoiceNumber: string; // e.g., INV-0001
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  createdAt: string; // ISO string
}

// Auth State
export interface AuthState {
  token: string | null;
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
    role: UserRole;
    storeName: string;
  } | null;
}

// Toast Notification State
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning';
  text: string;
}
