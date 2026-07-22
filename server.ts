import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { initDB, getUsers, saveUsers, getProducts, saveProducts, getSales, saveSales, getExpenses, saveExpenses, isMongoConnected, mongoStatusMessage, mongoUriObfuscated } from './server/db';
import { User, Product, Sale, Expense } from './src/types';

// Initialize DB on startup
initDB();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'general-store-super-secret-key-12345!';

// Middlewares
app.use(express.json());

// Type definition for Express Request with User
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    username: string;
    name: string;
    role: 'owner' | 'staff';
    storeName: string;
  };
}

// Authentication Middleware
function authenticateToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = decoded as any;
    next();
  });
}

// PIN Verification Helper
function verifyPinHelper(userId: string, enteredPin: string): boolean {
  const users = getUsers();
  const currentUser = users.find(u => u.id === userId);
  if (!currentUser) return false;

  // Verify entered PIN against store owner's PIN
  let targetUser = currentUser;
  if (currentUser.role === 'staff') {
    // If staff, verify using the store owner's PIN
    const owner = users.find(u => u.role === 'owner' && u.storeName === currentUser.storeName);
    if (!owner) return false;
    targetUser = owner;
  }

  if (!targetUser.pin) return false;
  return bcrypt.compareSync(enteredPin, targetUser.pin);
}

// ==================== AUTH ROUTES ====================

// Register Owner
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, username, password, storeName, pin } = req.body;
    const finalPin = pin || '0814';

    if (!name || !email || !username || !password || !storeName) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const users = getUsers();
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      res.status(400).json({ error: 'Username or email already exists' });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const hashedPin = bcrypt.hashSync(finalPin, salt);

    const newUser = {
      id: 'usr_' + Date.now().toString(),
      username,
      name,
      email,
      role: 'owner',
      storeName,
      pin: hashedPin,
      password: hashedPassword,
    };

    users.push(newUser as any);
    saveUsers(users);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role, storeName: newUser.storeName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        storeName: newUser.storeName,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const users = getUsers();
    const user = users.find(u => u.username === username || u.email === username);

    if (!user || !user.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, storeName: user.storeName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        storeName: user.storeName,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify PIN
app.post('/api/auth/verify-pin', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      res.status(400).json({ error: 'PIN is required' });
      return;
    }

    const isValid = verifyPinHelper(req.user!.id, pin);
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Staff (Owner only)
app.post('/api/auth/add-staff', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'owner') {
      res.status(403).json({ error: 'Only store owners can add staff accounts' });
      return;
    }

    const { name, email, username, password, pin } = req.body;

    if (!name || !email || !username || !password || !pin) {
      res.status(400).json({ error: 'All fields are required including owner PIN' });
      return;
    }

    // First verify owner's PIN to authorize staff creation
    const isPinValid = verifyPinHelper(req.user!.id, pin);
    if (!isPinValid) {
      res.status(403).json({ error: 'Invalid owner security PIN' });
      return;
    }

    const users = getUsers();
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      res.status(400).json({ error: 'Staff username or email already exists' });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newStaff = {
      id: 'usr_' + Date.now().toString(),
      username,
      name,
      email,
      role: 'staff',
      storeName: req.user!.storeName,
      pin: '', // Staff does not have a unique store PIN
      password: hashedPassword,
    };

    users.push(newStaff as any);
    saveUsers(users);

    res.status(201).json({
      message: 'Staff account created successfully',
      staff: {
        id: newStaff.id,
        username: newStaff.username,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
      },
    });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Staff List (Owner only)
app.get('/api/auth/staff', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'owner') {
      res.status(403).json({ error: 'Unauthorized access' });
      return;
    }

    const users = getUsers();
    const staff = users
      .filter(u => u.role === 'staff' && u.storeName === req.user!.storeName)
      .map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role,
      }));

    res.json(staff);
  } catch (error) {
    console.error('Get staff list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== DATABASE STATUS ROUTE ====================
app.get('/api/mongodb-status', (req, res) => {
  res.json({
    connected: isMongoConnected,
    status: mongoStatusMessage,
    uri: mongoUriObfuscated,
  });
});

// ==================== PRODUCT ROUTES ====================

// Get All Products
app.get('/api/products', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const products = getProducts();
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Product (Requires Auth + PIN)
app.post('/api/products', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const pin = req.headers['x-security-pin'] as string;
    if (!pin) {
      res.status(400).json({ error: 'Security PIN is required in x-security-pin header' });
      return;
    }

    if (!verifyPinHelper(req.user!.id, pin)) {
      res.status(403).json({ error: 'Invalid security PIN' });
      return;
    }

    const { name, category, price, costPrice, quantity, unit, lowStockThreshold, image } = req.body;

    if (!name || !category || price === undefined || quantity === undefined || !unit) {
      res.status(400).json({ error: 'Missing required product fields' });
      return;
    }

    const products = getProducts();
    const newProduct: Product = {
      id: 'prd_' + Date.now().toString(),
      name,
      category,
      price: Number(price),
      costPrice: costPrice !== undefined ? Number(costPrice) : 0,
      quantity: Number(quantity),
      unit,
      lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 10,
      createdAt: new Date().toISOString(),
      image,
    };

    products.push(newProduct);
    saveProducts(products);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edit Product (Requires Auth + PIN)
app.put('/api/products/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const pin = req.headers['x-security-pin'] as string;
    if (!pin) {
      res.status(400).json({ error: 'Security PIN is required in x-security-pin header' });
      return;
    }

    if (!verifyPinHelper(req.user!.id, pin)) {
      res.status(403).json({ error: 'Invalid security PIN' });
      return;
    }

    const { id } = req.params;
    const { name, category, price, costPrice, quantity, unit, lowStockThreshold, image } = req.body;

    const products = getProducts();
    const index = products.findIndex(p => p.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const updatedProduct: Product = {
      ...products[index],
      name: name ?? products[index].name,
      category: category ?? products[index].category,
      price: price !== undefined ? Number(price) : products[index].price,
      costPrice: costPrice !== undefined ? Number(costPrice) : products[index].costPrice,
      quantity: quantity !== undefined ? Number(quantity) : products[index].quantity,
      unit: unit ?? products[index].unit,
      lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : products[index].lowStockThreshold,
      image: image !== undefined ? image : products[index].image,
    };

    products[index] = updatedProduct;
    saveProducts(products);

    res.json(updatedProduct);
  } catch (error) {
    console.error('Edit product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Product (Requires Auth + PIN)
app.delete('/api/products/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const pin = req.headers['x-security-pin'] as string;
    if (!pin) {
      res.status(400).json({ error: 'Security PIN is required in x-security-pin header' });
      return;
    }

    if (!verifyPinHelper(req.user!.id, pin)) {
      res.status(403).json({ error: 'Invalid security PIN' });
      return;
    }

    const { id } = req.params;
    const products = getProducts();
    const filteredProducts = products.filter(p => p.id !== id);

    if (products.length === filteredProducts.length) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    saveProducts(filteredProducts);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SALES ROUTES ====================

// Get All Sales
app.get('/api/sales', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const sales = getSales();
    res.json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record Sale
app.post('/api/sales', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const { items } = req.body; // Array of { productId, quantitySold }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    const products = getProducts();
    const sales = getSales();

    const saleProducts = [];
    let totalAmount = 0;
    let totalCost = 0;

    // Validate and reserve stock
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        res.status(404).json({ error: `Product with ID ${item.productId} not found` });
        return;
      }

      if (product.quantity < item.quantitySold) {
        res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.quantity} ${product.unit}` });
        return;
      }

      const itemAmount = product.price * item.quantitySold;
      const itemCost = product.costPrice * item.quantitySold;

      totalAmount += itemAmount;
      totalCost += itemCost;

      saleProducts.push({
        productId: product.id,
        name: product.name,
        quantitySold: item.quantitySold,
        priceAtSale: product.price,
        costAtSale: product.costPrice,
      });

      // Deduct stock
      product.quantity -= item.quantitySold;
    }

    // Generate Invoice Number
    const invoiceSeq = sales.length + 1001;
    const invoiceNumber = `INV-${invoiceSeq}`;

    // Get today's local date YYYY-MM-DD
    const now = new Date();
    // Format local date YYYY-MM-DD (e.g., using offset logic or simple split)
    const localDate = now.toLocaleDateString('en-CA'); // Outputs YYYY-MM-DD

    const newSale: Sale = {
      id: 'sle_' + Date.now().toString(),
      products: saleProducts,
      totalAmount,
      totalCost,
      date: localDate,
      timestamp: now.toISOString(),
      soldBy: req.user!.id,
      soldByName: req.user!.name,
      invoiceNumber,
    };

    sales.push(newSale);
    saveSales(sales);
    saveProducts(products); // Commit stock changes

    res.status(201).json(newSale);
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== EXPENSE ROUTES ====================

// Get All Expenses
app.get('/api/expenses', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const expenses = getExpenses();
    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Expense
app.post('/api/expenses', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const { title, amount, date, category } = req.body;

    if (!title || amount === undefined || !date || !category) {
      res.status(400).json({ error: 'Missing required expense fields' });
      return;
    }

    const expenses = getExpenses();
    const newExpense: Expense = {
      id: 'exp_' + Date.now().toString(),
      title,
      amount: Number(amount),
      date, // YYYY-MM-DD
      category,
      createdAt: new Date().toISOString(),
    };

    expenses.push(newExpense);
    saveExpenses(expenses);

    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Expense
app.delete('/api/expenses/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const expenses = getExpenses();
    const filteredExpenses = expenses.filter(e => e.id !== id);

    if (expenses.length === filteredExpenses.length) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    saveExpenses(filteredExpenses);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SETTINGS ROUTES ====================

// Change PIN (Owner only)
app.post('/api/settings/change-pin', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'owner') {
      res.status(403).json({ error: 'Only store owners can modify the security PIN' });
      return;
    }

    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      res.status(400).json({ error: 'Current PIN and new PIN are required' });
      return;
    }

    const users = getUsers();
    const ownerIndex = users.findIndex(u => u.id === req.user!.id);

    if (ownerIndex === -1 || !users[ownerIndex].pin) {
      res.status(404).json({ error: 'Owner account not found' });
      return;
    }

    // Verify current PIN
    const isCurrentPinValid = bcrypt.compareSync(currentPin, users[ownerIndex].pin!);
    if (!isCurrentPinValid) {
      res.status(400).json({ error: 'Incorrect current PIN' });
      return;
    }

    // Hash and save new PIN
    const salt = bcrypt.genSaltSync(10);
    users[ownerIndex].pin = bcrypt.hashSync(newPin, salt);
    saveUsers(users);

    res.json({ message: 'Security PIN changed successfully' });
  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Store Name (Owner only)
app.post('/api/settings/change-store', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'owner') {
      res.status(403).json({ error: 'Only store owners can modify store settings' });
      return;
    }

    const { storeName } = req.body;
    if (!storeName) {
      res.status(400).json({ error: 'Store name is required' });
      return;
    }

    const users = getUsers();

    // Update storeName for ALL users in this store (both owner and staff)
    const oldStoreName = req.user!.storeName;
    const updatedUsers = users.map(u => {
      if (u.storeName === oldStoreName) {
        return { ...u, storeName };
      }
      return u;
    });

    saveUsers(updatedUsers);

    // Generate a fresh token with updated store name
    const token = jwt.sign(
      { id: req.user!.id, username: req.user!.username, name: req.user!.name, role: req.user!.role, storeName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Store name updated successfully',
      token,
      storeName,
    });
  } catch (error) {
    console.error('Change store name error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== REPORT & DASHBOARD ROUTES ====================

app.get('/api/reports/dashboard', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const products = getProducts();
    const sales = getSales();
    const expenses = getExpenses();

    // Filter to current store's context (since the app is multi-user per store, and users share the same store environment, we can aggregate)
    // Actually, in a multi-tenant local setup, we support user accounts grouped by storeName.
    // Let's filter sales, products, expenses if needed? Since they are stored in the database,
    // let's assume they all correspond to the current store since it's a dedicated environment for the general store.
    // However, to keep it pristine, we can calculate everything based on the store users' transactions.
    const storeUsers = getUsers().filter(u => u.storeName === req.user!.storeName);
    const storeUserIds = storeUsers.map(u => u.id);

    // Filter sales to transactions made by this store's users
    const storeSales = sales.filter(s => storeUserIds.includes(s.soldBy));

    // Get today's YYYY-MM-DD local
    const todayStr = new Date().toLocaleDateString('en-CA');

    // Filter Today's Sales
    const todaySales = storeSales.filter(s => s.date === todayStr);

    // Today's Stats
    const todayRevenue = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const todayTransactions = todaySales.length;
    const todayCost = todaySales.reduce((acc, s) => acc + s.totalCost, 0);
    const todayProfit = todayRevenue - todayCost;

    // Daily Top Selling Product
    const todayProductQuantities: Record<string, { name: string; qty: number }> = {};
    todaySales.forEach(s => {
      s.products.forEach(p => {
        if (!todayProductQuantities[p.productId]) {
          todayProductQuantities[p.productId] = { name: p.name, qty: 0 };
        }
        todayProductQuantities[p.productId].qty += p.quantitySold;
      });
    });

    let todayTopProduct = 'None';
    let maxTodayQty = 0;
    Object.keys(todayProductQuantities).forEach(id => {
      if (todayProductQuantities[id].qty > maxTodayQty) {
        maxTodayQty = todayProductQuantities[id].qty;
        todayTopProduct = todayProductQuantities[id].name;
      }
    });

    // Current Month & Previous Month Stats
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth(); // 0-11

    const formatMonthStr = (year: number, month: number) => {
      return `${year}-${String(month + 1).padStart(2, '0')}`;
    };

    const currentMonthStr = formatMonthStr(currentYear, currentMonthNum); // YYYY-MM
    const prevMonthDate = new Date(currentYear, currentMonthNum - 1, 1);
    const prevMonthStr = formatMonthStr(prevMonthDate.getFullYear(), prevMonthDate.getMonth()); // YYYY-MM

    // Filter sales for current & prev months
    const thisMonthSales = storeSales.filter(s => s.date.startsWith(currentMonthStr));
    const lastMonthSales = storeSales.filter(s => s.date.startsWith(prevMonthStr));

    const thisMonthRevenue = thisMonthSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const thisMonthCost = thisMonthSales.reduce((acc, s) => acc + s.totalCost, 0);
    const thisMonthProfit = thisMonthRevenue - thisMonthCost;

    const lastMonthRevenue = lastMonthSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const lastMonthCost = lastMonthSales.reduce((acc, s) => acc + s.totalCost, 0);
    const lastMonthProfit = lastMonthRevenue - lastMonthCost;

    // Revenue growth comparison
    let growthRate = 0;
    if (lastMonthRevenue > 0) {
      growthRate = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (thisMonthRevenue > 0) {
      growthRate = 100; // 100% growth if previous was 0
    }

    // Low stock count
    const lowStockThresholdCount = products.filter(p => p.quantity <= p.lowStockThreshold).length;

    // Monthly Expense totals
    const thisMonthExpenses = expenses.filter(e => e.date.startsWith(currentMonthStr));
    const totalMonthExpenses = thisMonthExpenses.reduce((acc, e) => acc + e.amount, 0);

    // Sales Trend (daily breakdown for current selected month)
    // Default to current month, but client can specify via query
    const targetMonth = (req.query.month as string) || currentMonthStr;
    const targetMonthSales = storeSales.filter(s => s.date.startsWith(targetMonth));
    const targetMonthExpenses = expenses.filter(e => e.date.startsWith(targetMonth));

    // Calculate daily breakdown for charts
    const daysInMonth = new Date(Number(targetMonth.split('-')[0]), Number(targetMonth.split('-')[1]), 0).getDate();
    const dailyData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${targetMonth}-${String(day).padStart(2, '0')}`;
      const daySales = targetMonthSales.filter(s => s.date === dayStr);
      const dayExpenses = targetMonthExpenses.filter(e => e.date === dayStr);

      const rev = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      const cost = daySales.reduce((acc, s) => acc + s.totalCost, 0);
      const exp = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
      const profit = rev - cost - exp;

      dailyData.push({
        day: day,
        date: dayStr,
        sales: rev,
        profit: profit,
        expenses: exp,
      });
    }

    // Top selling products overall (this month)
    const productSalesMap: Record<string, { name: string; category: string; quantity: number; revenue: number; profit: number }> = {};
    thisMonthSales.forEach(s => {
      s.products.forEach(p => {
        if (!productSalesMap[p.productId]) {
          productSalesMap[p.productId] = {
            name: p.name,
            category: '',
            quantity: 0,
            revenue: 0,
            profit: 0,
          };
        }
        productSalesMap[p.productId].quantity += p.quantitySold;
        productSalesMap[p.productId].revenue += p.priceAtSale * p.quantitySold;
        productSalesMap[p.productId].profit += (p.priceAtSale - p.costAtSale) * p.quantitySold;
      });
    });

    // Hydrate categories from master product list
    Object.keys(productSalesMap).forEach(id => {
      const match = products.find(p => p.id === id);
      if (match) {
        productSalesMap[id].category = match.category;
      }
    });

    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    res.json({
      today: {
        revenue: todayRevenue,
        transactions: todayTransactions,
        profit: todayProfit,
        topProduct: todayTopProduct,
      },
      summary: {
        thisMonthRevenue,
        thisMonthProfit,
        thisMonthExpenses: totalMonthExpenses,
        growthRate,
        totalProducts: products.length,
        lowStockCount: lowStockThresholdCount,
      },
      charts: {
        month: targetMonth,
        dailyData,
      },
      topProducts: topSellingProducts,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CSV Export route
app.get('/api/reports/export-csv', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      res.status(400).send('Month (YYYY-MM) is required');
      return;
    }

    const storeUsers = getUsers().filter(u => u.storeName === req.user!.storeName);
    const storeUserIds = storeUsers.map(u => u.id);
    const sales = getSales().filter(s => s.date.startsWith(month as string) && storeUserIds.includes(s.soldBy));

    // Construct CSV string manually
    let csv = 'Invoice Number,Date,Timestamp,Sold By,Product Name,Quantity Sold,Selling Price,Cost Price,Total Revenue,Total Profit\n';

    sales.forEach(sale => {
      sale.products.forEach(p => {
        const itemRevenue = p.priceAtSale * p.quantitySold;
        const itemCost = p.costAtSale * p.quantitySold;
        const itemProfit = itemRevenue - itemCost;

        csv += `"${sale.invoiceNumber}","${sale.date}","${sale.timestamp}","${sale.soldByName}","${p.name}",${p.quantitySold},${p.priceAtSale},${p.costAtSale},${itemRevenue},${itemProfit}\n`;
      });
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Sales-Report-${month}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).send('Error generating CSV report');
  }
});

// Printable HTML Report route (Perfect for printing to PDF or saving)
app.get('/api/reports/export-pdf', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      res.status(400).send('Month (YYYY-MM) is required');
      return;
    }

    const storeUsers = getUsers().filter(u => u.storeName === req.user!.storeName);
    const storeUserIds = storeUsers.map(u => u.id);
    const sales = getSales().filter(s => s.date.startsWith(month as string) && storeUserIds.includes(s.soldBy));
    const expenses = getExpenses().filter(e => e.date.startsWith(month as string));

    const totalSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalCost = sales.reduce((acc, s) => acc + s.totalCost, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = totalSales - totalCost - totalExpenses;

    // Create printable HTML
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sales Report - ${month} - ${req.user!.storeName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; margin: 40px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eaeaea; padding-bottom: 20px; margin-bottom: 30px; }
        .store-title { font-size: 24px; font-weight: bold; margin: 0; color: #111; }
        .report-subtitle { font-size: 14px; color: #666; margin: 5px 0 0 0; }
        .meta-info { text-align: right; font-size: 14px; color: #555; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: #f9f9f9; border: 1px solid #eaeaea; padding: 15px; border-radius: 6px; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
        .stat-value { font-size: 18px; font-weight: bold; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
        th { background: #f4f4f4; text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; font-weight: 600; }
        td { padding: 8px 10px; border-bottom: 1px solid #eaeaea; }
        .text-right { text-align: right; }
        .totals-row { font-weight: bold; background: #fafafa; }
        .print-btn-container { margin-bottom: 20px; }
        .print-btn { background: #1a56db; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px; }
        @media print {
          .print-btn-container { display: none; }
          body { margin: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-container">
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      </div>
      <div class="header">
        <div>
          <h1 class="store-title">${req.user!.storeName}</h1>
          <p class="report-subtitle">Monthly Store Performance Report</p>
        </div>
        <div class="meta-info">
          <div><strong>Report Month:</strong> ${month}</div>
          <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value">$${totalSales.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Cost</div>
          <div class="stat-value">$${totalCost.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Operating Expenses</div>
          <div class="stat-value">$${totalExpenses.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Net Profit</div>
          <div class="stat-value">$${netProfit.toFixed(2)}</div>
        </div>
      </div>

      <h2>Sales Transaction Records</h2>
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th>Cashier</th>
            <th>Product Items</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${sales.length === 0 ? '<tr><td colspan="7" style="text-align: center;">No transactions found this month</td></tr>' : 
            sales.map(s => {
              return s.products.map((p, idx) => `
                <tr>
                  <td>${idx === 0 ? `<strong>${s.invoiceNumber}</strong>` : ''}</td>
                  <td>${idx === 0 ? s.date : ''}</td>
                  <td>${idx === 0 ? s.soldByName : ''}</td>
                  <td>${p.name}</td>
                  <td class="text-right">${p.quantitySold}</td>
                  <td class="text-right">$${p.priceAtSale.toFixed(2)}</td>
                  <td class="text-right">$${(p.priceAtSale * p.quantitySold).toFixed(2)}</td>
                </tr>
              `).join('');
            }).join('')
          }
        </tbody>
      </table>

      ${expenses.length > 0 ? `
        <h2 style="margin-top: 40px;">Operating Expense Records</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => `
              <tr>
                <td>${e.date}</td>
                <td>${e.category}</td>
                <td>${e.title}</td>
                <td class="text-right">$${e.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="totals-row">
              <td colspan="3">Total Operating Expenses</td>
              <td class="text-right">$${totalExpenses.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      ` : ''}

      <script>
        // Trigger print immediately on open if running in a pop-up window
        if (window.opener) {
          window.print();
        }
      </script>
    </body>
    </html>
    `;

    res.status(200).send(html);
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).send('Error generating PDF report');
  }
});

// ==================== FRONTEND SERVER MOUNT ====================

async function startServer() {
  // Vite integration for dev server or static build serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StoreManager] Server running on http://localhost:${PORT}`);
  });
}

startServer();
