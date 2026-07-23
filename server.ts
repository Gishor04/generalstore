import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { initDB, getDb, isMongoConnected, mongoStatusMessage, mongoUriObfuscated } from './server/db';
import { User, Product, Sale, Expense } from './src/types';


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
    role: 'owner';
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

// ==================== AUTH ROUTES ====================

// Register Owner
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, username, password, storeName, pin } = req.body;
    const finalPin = pin || '0814';

    if (!name || !email || !username || !password || !storeName) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const db = getDb();
    const existingUser = await db.collection('users').findOne({
      $or: [{ username }, { email }]
    });

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
      role: 'owner' as const,
      storeName,
      pin: hashedPin,
      password: hashedPassword,
    };

    await db.collection('users').insertOne(newUser);

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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const db = getDb();
    const user = await db.collection('users').findOne({
      $or: [{ username }, { email: username }]
    }) as any;

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
app.post('/api/auth/verify-pin', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      res.status(400).json({ error: 'PIN is required' });
      return;
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ id: req.user!.id }) as any;
    if (!user || !user.pin) {
      res.json({ valid: false });
      return;
    }

    const isValid = bcrypt.compareSync(pin, user.pin);
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Verify PIN error:', error);
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
app.get('/api/products', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const products = await db.collection('products').find({}, { projection: { _id: 0 } }).toArray();
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Product (Requires Auth + PIN)
app.post('/api/products', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pin = req.headers['x-security-pin'] as string;
    if (!pin) {
      res.status(400).json({ error: 'Security PIN is required in x-security-pin header' });
      return;
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ id: req.user!.id }) as any;
    if (!user || !user.pin || !bcrypt.compareSync(pin, user.pin)) {
      res.status(403).json({ error: 'Invalid security PIN' });
      return;
    }

    const { name, category, price, costPrice, quantity, unit, lowStockThreshold, image } = req.body;

    if (!name || !category || price === undefined || quantity === undefined || !unit) {
      res.status(400).json({ error: 'Missing required product fields' });
      return;
    }

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

    await db.collection('products').insertOne({ ...newProduct });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edit Product (Requires Auth + PIN)
app.put('/api/products/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pin = req.headers['x-security-pin'] as string;
    if (!pin) {
      res.status(400).json({ error: 'Security PIN is required in x-security-pin header' });
      return;
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ id: req.user!.id }) as any;
    if (!user || !user.pin || !bcrypt.compareSync(pin, user.pin)) {
      res.status(403).json({ error: 'Invalid security PIN' });
      return;
    }

    const { id } = req.params;
    const existing = await db.collection('products').findOne({ id }, { projection: { _id: 0 } }) as any;

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const { name, category, price, costPrice, quantity, unit, lowStockThreshold, image } = req.body;

    const updatedProduct: Product = {
      ...existing,
      name: name ?? existing.name,
      category: category ?? existing.category,
      price: price !== undefined ? Number(price) : existing.price,
      costPrice: costPrice !== undefined ? Number(costPrice) : existing.costPrice,
      quantity: quantity !== undefined ? Number(quantity) : existing.quantity,
      unit: unit ?? existing.unit,
      lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : existing.lowStockThreshold,
      image: image !== undefined ? image : existing.image,
    };

    await db.collection('products').updateOne({ id }, { $set: updatedProduct });
    res.json(updatedProduct);
  } catch (error) {
    console.error('Edit product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Product (Requires Auth + PIN)
app.delete('/api/products/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pin = req.headers['x-security-pin'] as string;
    if (!pin) {
      res.status(400).json({ error: 'Security PIN is required in x-security-pin header' });
      return;
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ id: req.user!.id }) as any;
    if (!user || !user.pin || !bcrypt.compareSync(pin, user.pin)) {
      res.status(403).json({ error: 'Invalid security PIN' });
      return;
    }

    const { id } = req.params;
    const result = await db.collection('products').deleteOne({ id });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SALES ROUTES ====================

// Get All Sales
app.get('/api/sales', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const sales = await db.collection('sales').find({}, { projection: { _id: 0 } }).toArray();
    res.json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record Sale
app.post('/api/sales', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    const db = getDb();

    const saleProducts = [];
    let totalAmount = 0;
    let totalCost = 0;

    // Validate and deduct stock
    for (const item of items) {
      const product = await db.collection('products').findOne({ id: item.productId }, { projection: { _id: 0 } }) as any;
      if (!product) {
        res.status(404).json({ error: `Product with ID ${item.productId} not found` });
        return;
      }

      if (product.quantity < item.quantitySold) {
        res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.quantity} ${product.unit}` });
        return;
      }

      totalAmount += product.price * item.quantitySold;
      totalCost += product.costPrice * item.quantitySold;

      saleProducts.push({
        productId: product.id,
        name: product.name,
        quantitySold: item.quantitySold,
        priceAtSale: product.price,
        costAtSale: product.costPrice,
      });

      // Deduct stock directly in MongoDB
      await db.collection('products').updateOne(
        { id: item.productId },
        { $inc: { quantity: -item.quantitySold } }
      );
    }

    // Generate invoice number
    const saleCount = await db.collection('sales').countDocuments();
    const invoiceNumber = `INV-${saleCount + 1001}`;

    const now = new Date();
    const localDate = now.toLocaleDateString('en-CA');

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

    await db.collection('sales').insertOne({ ...newSale });
    res.status(201).json(newSale);
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== EXPENSE ROUTES ====================

// Get All Expenses
app.get('/api/expenses', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const expenses = await db.collection('expenses').find({}, { projection: { _id: 0 } }).toArray();
    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Expense
app.post('/api/expenses', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, amount, date, category } = req.body;

    if (!title || amount === undefined || !date || !category) {
      res.status(400).json({ error: 'Missing required expense fields' });
      return;
    }

    const newExpense: Expense = {
      id: 'exp_' + Date.now().toString(),
      title,
      amount: Number(amount),
      date,
      category,
      createdAt: new Date().toISOString(),
    };

    const db = getDb();
    await db.collection('expenses').insertOne({ ...newExpense });
    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Expense
app.delete('/api/expenses/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = await db.collection('expenses').deleteOne({ id });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SETTINGS ROUTES ====================

// Change PIN (Owner only)
app.post('/api/settings/change-pin', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const db = getDb();
    const user = await db.collection('users').findOne({ id: req.user!.id }) as any;

    if (!user || !user.pin) {
      res.status(404).json({ error: 'Owner account not found' });
      return;
    }

    if (!bcrypt.compareSync(currentPin, user.pin)) {
      res.status(400).json({ error: 'Incorrect current PIN' });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const newHashedPin = bcrypt.hashSync(newPin, salt);
    await db.collection('users').updateOne({ id: req.user!.id }, { $set: { pin: newHashedPin } });

    res.json({ message: 'Security PIN changed successfully' });
  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Store Name (Owner only)
app.post('/api/settings/change-store', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const db = getDb();
    const oldStoreName = req.user!.storeName;
    await db.collection('users').updateMany({ storeName: oldStoreName }, { $set: { storeName } });

    const token = jwt.sign(
      { id: req.user!.id, username: req.user!.username, name: req.user!.name, role: req.user!.role, storeName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ message: 'Store name updated successfully', token, storeName });
  } catch (error) {
    console.error('Change store name error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== REPORT & DASHBOARD ROUTES ====================

app.get('/api/reports/dashboard', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const products = await db.collection('products').find({}, { projection: { _id: 0 } }).toArray() as any[];
    const storeUsers = await db.collection('users').find({ storeName: req.user!.storeName }, { projection: { _id: 0 } }).toArray() as any[];
    const storeUserIds = storeUsers.map(u => u.id);

    const allSales = await db.collection('sales').find({ soldBy: { $in: storeUserIds } }, { projection: { _id: 0 } }).toArray() as any[];
    const allExpenses = await db.collection('expenses').find({}, { projection: { _id: 0 } }).toArray() as any[];

    const todayStr = new Date().toLocaleDateString('en-CA');
    const todaySales = allSales.filter(s => s.date === todayStr);
    const todayRevenue = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const todayTransactions = todaySales.length;
    const todayCost = todaySales.reduce((acc, s) => acc + s.totalCost, 0);
    const todayProfit = todayRevenue - todayCost;

    const todayProductQuantities: Record<string, { name: string; qty: number }> = {};
    todaySales.forEach(s => {
      s.products.forEach((p: any) => {
        if (!todayProductQuantities[p.productId]) todayProductQuantities[p.productId] = { name: p.name, qty: 0 };
        todayProductQuantities[p.productId].qty += p.quantitySold;
      });
    });

    let todayTopProduct = 'None';
    let maxTodayQty = 0;
    Object.values(todayProductQuantities).forEach(v => {
      if (v.qty > maxTodayQty) { maxTodayQty = v.qty; todayTopProduct = v.name; }
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth();
    const formatMonthStr = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;
    const currentMonthStr = formatMonthStr(currentYear, currentMonthNum);
    const prevMonthDate = new Date(currentYear, currentMonthNum - 1, 1);
    const prevMonthStr = formatMonthStr(prevMonthDate.getFullYear(), prevMonthDate.getMonth());

    const thisMonthSales = allSales.filter(s => s.date.startsWith(currentMonthStr));
    const lastMonthSales = allSales.filter(s => s.date.startsWith(prevMonthStr));

    const thisMonthRevenue = thisMonthSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const thisMonthCost = thisMonthSales.reduce((acc, s) => acc + s.totalCost, 0);
    const thisMonthProfit = thisMonthRevenue - thisMonthCost;
    const lastMonthRevenue = lastMonthSales.reduce((acc, s) => acc + s.totalAmount, 0);

    let growthRate = 0;
    if (lastMonthRevenue > 0) growthRate = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    else if (thisMonthRevenue > 0) growthRate = 100;

    const lowStockCount = products.filter(p => p.quantity <= p.lowStockThreshold).length;
    const thisMonthExpenses = allExpenses.filter(e => e.date.startsWith(currentMonthStr));
    const totalMonthExpenses = thisMonthExpenses.reduce((acc, e) => acc + e.amount, 0);

    const targetMonth = (req.query.month as string) || currentMonthStr;
    const targetMonthSales = allSales.filter(s => s.date.startsWith(targetMonth));
    const targetMonthExpenses = allExpenses.filter(e => e.date.startsWith(targetMonth));

    const daysInMonth = new Date(Number(targetMonth.split('-')[0]), Number(targetMonth.split('-')[1]), 0).getDate();
    const dailyData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${targetMonth}-${String(day).padStart(2, '0')}`;
      const daySales = targetMonthSales.filter(s => s.date === dayStr);
      const dayExpenses = targetMonthExpenses.filter(e => e.date === dayStr);
      const rev = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      const cost = daySales.reduce((acc, s) => acc + s.totalCost, 0);
      const exp = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
      dailyData.push({ day, date: dayStr, sales: rev, profit: rev - cost - exp, expenses: exp });
    }

    const productSalesMap: Record<string, any> = {};
    thisMonthSales.forEach(s => {
      s.products.forEach((p: any) => {
        if (!productSalesMap[p.productId]) productSalesMap[p.productId] = { name: p.name, category: '', quantity: 0, revenue: 0, profit: 0 };
        productSalesMap[p.productId].quantity += p.quantitySold;
        productSalesMap[p.productId].revenue += p.priceAtSale * p.quantitySold;
        productSalesMap[p.productId].profit += (p.priceAtSale - p.costAtSale) * p.quantitySold;
      });
    });
    Object.keys(productSalesMap).forEach(id => {
      const match = products.find(p => p.id === id);
      if (match) productSalesMap[id].category = match.category;
    });
    const topSellingProducts = Object.values(productSalesMap).sort((a: any, b: any) => b.quantity - a.quantity).slice(0, 5);

    res.json({
      today: { revenue: todayRevenue, transactions: todayTransactions, profit: todayProfit, topProduct: todayTopProduct },
      summary: { thisMonthRevenue, thisMonthProfit, thisMonthExpenses: totalMonthExpenses, growthRate, totalProducts: products.length, lowStockCount },
      charts: { month: targetMonth, dailyData },
      topProducts: topSellingProducts,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CSV Export route
app.get('/api/reports/export-csv', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { month } = req.query;
    if (!month) { res.status(400).send('Month (YYYY-MM) is required'); return; }

    const db = getDb();
    const storeUsers = await db.collection('users').find({ storeName: req.user!.storeName }, { projection: { _id: 0 } }).toArray() as any[];
    const storeUserIds = storeUsers.map(u => u.id);
    const sales = await db.collection('sales').find(
      { soldBy: { $in: storeUserIds }, date: { $regex: `^${month}` } },
      { projection: { _id: 0 } }
    ).toArray() as any[];

    let csv = 'Invoice Number,Date,Timestamp,Sold By,Product Name,Quantity Sold,Selling Price,Cost Price,Total Revenue,Total Profit\n';
    sales.forEach(sale => {
      sale.products.forEach((p: any) => {
        const itemRevenue = p.priceAtSale * p.quantitySold;
        const itemCost = p.costAtSale * p.quantitySold;
        csv += `"${sale.invoiceNumber}","${sale.date}","${sale.timestamp}","${sale.soldByName}","${p.name}",${p.quantitySold},${p.priceAtSale},${p.costAtSale},${itemRevenue},${itemRevenue - itemCost}\n`;
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

// Printable HTML Report route
app.get('/api/reports/export-pdf', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { month } = req.query;
    if (!month) { res.status(400).send('Month (YYYY-MM) is required'); return; }

    const db = getDb();
    const storeUsers = await db.collection('users').find({ storeName: req.user!.storeName }, { projection: { _id: 0 } }).toArray() as any[];
    const storeUserIds = storeUsers.map(u => u.id);
    const sales = await db.collection('sales').find(
      { soldBy: { $in: storeUserIds }, date: { $regex: `^${month}` } },
      { projection: { _id: 0 } }
    ).toArray() as any[];
    const expenses = await db.collection('expenses').find(
      { date: { $regex: `^${month}` } },
      { projection: { _id: 0 } }
    ).toArray() as any[];

    const totalSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalCost = sales.reduce((acc, s) => acc + s.totalCost, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = totalSales - totalCost - totalExpenses;

    const html = `
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
        @media print { .print-btn-container { display: none; } body { margin: 20px; } }
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
        <div class="stat-card"><div class="stat-label">Total Revenue</div><div class="stat-value">$${totalSales.toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Cost</div><div class="stat-value">$${totalCost.toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Operating Expenses</div><div class="stat-value">$${totalExpenses.toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Net Profit</div><div class="stat-value">$${netProfit.toFixed(2)}</div></div>
      </div>
      <h2>Sales Transaction Records</h2>
      <table>
        <thead><tr><th>Invoice</th><th>Date</th><th>Product Items</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          ${sales.length === 0 ? '<tr><td colspan="6" style="text-align: center;">No transactions found this month</td></tr>' :
            sales.map(s => s.products.map((p: any, idx: number) => `
              <tr>
                <td>${idx === 0 ? `<strong>${s.invoiceNumber}</strong>` : ''}</td>
                <td>${idx === 0 ? s.date : ''}</td>
                <td>${p.name}</td>
                <td class="text-right">${p.quantitySold}</td>
                <td class="text-right">$${p.priceAtSale.toFixed(2)}</td>
                <td class="text-right">$${(p.priceAtSale * p.quantitySold).toFixed(2)}</td>
              </tr>`).join('')).join('')}
        </tbody>
      </table>
      ${expenses.length > 0 ? `
        <h2 style="margin-top: 40px;">Operating Expense Records</h2>
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="text-right">Amount</th></tr></thead>
          <tbody>
            ${expenses.map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>${e.title}</td><td class="text-right">$${e.amount.toFixed(2)}</td></tr>`).join('')}
            <tr class="totals-row"><td colspan="3">Total Operating Expenses</td><td class="text-right">$${totalExpenses.toFixed(2)}</td></tr>
          </tbody>
        </table>` : ''}
      <script>if (window.opener) { window.print(); }</script>
    </body>
    </html>`;

    res.status(200).send(html);
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).send('Error generating PDF report');
  }
});

// ==================== FRONTEND SERVER MOUNT ====================

async function startServer() {
  // Initialize DB for local development
  await initDB();

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

// Only start the full Express server locally, NOT when running inside Netlify or Vercel Serverless Functions
if (!process.env.NETLIFY && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  startServer();
}

export default app;
