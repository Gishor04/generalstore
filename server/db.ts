import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { User, Product, Sale, Expense } from '../src/types';

// Load environment variables
dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');
const EXPENSES_FILE = path.join(DATA_DIR, 'expenses.json');

// MongoDB state
export let isMongoConnected = false;
export let mongoStatusMessage = 'No connection attempted';
export let mongoUriObfuscated = '';
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

// Helper read/write functions for local backup / caching
function readJSONFile<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T[];
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
}

function writeJSONFile<T>(filePath: string, data: T[]) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

// Background MongoDB Initialization and Sync
async function initMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    mongoStatusMessage = 'MONGODB_URI not configured in .env file. Running in Local Storage mode.';
    console.log('MongoDB: MONGODB_URI not found. Falling back to local JSON database files.');
    return;
  }

  // Obfuscate URI for safety display
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '••••••••';
    }
    mongoUriObfuscated = parsed.toString();
  } catch (e) {
    mongoUriObfuscated = 'Configured (Invalid Format)';
  }

  try {
    mongoStatusMessage = 'Connecting to MongoDB...';
    console.log(`MongoDB: Attempting to connect to database...`);
    mongoClient = new MongoClient(uri, { connectTimeoutMS: 5000 });
    await mongoClient.connect();
    
    // Use the database name from connection string or default
    mongoDb = mongoClient.db();
    isMongoConnected = true;
    mongoStatusMessage = 'Connected';
    console.log('MongoDB: Connected successfully!');

    // Synchronize collections
    await syncCollectionsFromMongo();

  } catch (err: any) {
    isMongoConnected = false;
    mongoStatusMessage = `Connection failed: ${err.message || err}`;
    console.error('MongoDB connection error:', err);
    console.log('MongoDB: Falling back to local JSON storage cache.');
  }
}

// Helper to load collection from MongoDB or seed MongoDB from Local JSON
async function syncCollection(name: string, filePath: string) {
  if (!mongoDb) return;
  try {
    const col = mongoDb.collection(name);
    const count = await col.countDocuments();
    const localData = readJSONFile<any>(filePath);

    if (count === 0 && localData.length > 0) {
      console.log(`MongoDB: Seeding empty MongoDB "${name}" collection with ${localData.length} local records...`);
      // Strip any accidental _id from local cache just in case
      const cleaned = localData.map(({ _id, ...rest }: any) => rest);
      await col.insertMany(cleaned);
    } else if (count > 0) {
      console.log(`MongoDB: Loading ${count} records from MongoDB "${name}" collection to local cache...`);
      const remoteData = await col.find({}).toArray();
      // Map remote documents, stripping MongoDB's internal _id but preserving custom id fields
      const cleaned = remoteData.map(({ _id, ...rest }: any) => rest);
      writeJSONFile(filePath, cleaned);
    }
  } catch (err) {
    console.error(`MongoDB: Error syncing collection "${name}":`, err);
  }
}

async function syncCollectionsFromMongo() {
  await syncCollection('users', USERS_FILE);
  await syncCollection('products', PRODUCTS_FILE);
  await syncCollection('sales', SALES_FILE);
  await syncCollection('expenses', EXPENSES_FILE);
  console.log('MongoDB: Two-way synchronization complete.');
}

// Async Background update to MongoDB
async function syncToMongo(collectionName: string, data: any[]) {
  if (!isMongoConnected || !mongoDb) return;
  try {
    const col = mongoDb.collection(collectionName);
    await col.deleteMany({});
    if (data.length > 0) {
      // Strip out MongoDB _id if it slipped in, to avoid insert duplicate key errors
      const cleaned = data.map(({ _id, ...rest }: any) => rest);
      await col.insertMany(cleaned);
    }
  } catch (err) {
    console.error(`MongoDB: Error saving to collection "${collectionName}":`, err);
  }
}

// Ensure database directory and files exist
export function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const defaultFiles = [
    { filePath: USERS_FILE, defaultContent: [] },
    { filePath: PRODUCTS_FILE, defaultContent: [] },
    { filePath: SALES_FILE, defaultContent: [] },
    { filePath: EXPENSES_FILE, defaultContent: [] },
  ];

  for (const file of defaultFiles) {
    if (!fs.existsSync(file.filePath)) {
      fs.writeFileSync(file.filePath, JSON.stringify(file.defaultContent, null, 2), 'utf-8');
    }
  }

  // Seed default owner if no users exist
  const users = getUsers();
  let ownerId = 'usr_owner';
  if (users.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('password123', salt);
    const hashedPin = bcrypt.hashSync('0814', salt);

    const defaultOwner: User = {
      id: ownerId,
      username: 'owner@example.com',
      name: 'John StoreOwner',
      email: 'owner@example.com',
      role: 'owner',
      storeName: 'My General Store',
      pin: hashedPin,
    };

    // Save default owner
    users.push({
      ...defaultOwner,
      password: hashedPassword, // Added password to raw DB record
    } as any);

    saveUsers(users);
    console.log('----------------------------------------------------');
    console.log('Database seeded with default Store Owner:');
    console.log('  Username/Email: owner@example.com');
    console.log('  Password:       password123');
    console.log('  Default PIN:    0814');
    console.log('----------------------------------------------------');
  } else {
    const owner = users.find(u => u.role === 'owner');
    if (owner) {
      ownerId = owner.id;
    }
  }

  // Seed default products if none exist
  const products = getProducts();
  if (products.length === 0) {
    const sampleProducts: Product[] = [
      {
        id: 'prod_milk',
        name: 'Fresh Whole Milk',
        category: 'Dairy',
        price: 3.49,
        costPrice: 2.10,
        quantity: 45,
        unit: 'litre',
        lowStockThreshold: 10,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_eggs',
        name: 'Brown Grade A Eggs',
        category: 'Dairy',
        price: 4.99,
        costPrice: 3.00,
        quantity: 30,
        unit: 'pcs',
        lowStockThreshold: 12,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_bread',
        name: 'Artisan Sourdough Bread',
        category: 'Bakery',
        price: 5.50,
        costPrice: 3.20,
        quantity: 15,
        unit: 'pcs',
        lowStockThreshold: 8,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_apples',
        name: 'Organic Honeycrisp Apples',
        category: 'Produce',
        price: 2.99,
        costPrice: 1.40,
        quantity: 80,
        unit: 'kg',
        lowStockThreshold: 15,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_bananas',
        name: 'Fresh Cavendish Bananas',
        category: 'Produce',
        price: 1.89,
        costPrice: 0.80,
        quantity: 120,
        unit: 'kg',
        lowStockThreshold: 20,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_cheese',
        name: 'Aged Cheddar Cheese',
        category: 'Dairy',
        price: 6.99,
        costPrice: 4.10,
        quantity: 24,
        unit: 'pcs',
        lowStockThreshold: 6,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1618164435735-413d3b066c9a?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_coffee',
        name: 'Premium Coffee Beans',
        category: 'Beverages',
        price: 14.99,
        costPrice: 8.50,
        quantity: 18,
        unit: 'pcs',
        lowStockThreshold: 5,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_rice',
        name: 'Jasmine Fragrant Rice',
        category: 'Pantry',
        price: 12.50,
        costPrice: 7.20,
        quantity: 40,
        unit: 'pcs',
        lowStockThreshold: 10,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_oliveoil',
        name: 'Cold Pressed Olive Oil',
        category: 'Pantry',
        price: 16.99,
        costPrice: 9.80,
        quantity: 20,
        unit: 'pcs',
        lowStockThreshold: 8,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&auto=format&fit=crop&q=60'
      },
      {
        id: 'prod_soap',
        name: 'Eco-Friendly Hand Soap',
        category: 'Household',
        price: 3.99,
        costPrice: 2.10,
        quantity: 35,
        unit: 'pcs',
        lowStockThreshold: 10,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=200&auto=format&fit=crop&q=60'
      }
    ];

    saveProducts(sampleProducts);
    console.log(`MongoDB/Local: Seeded ${sampleProducts.length} sample products.`);
  }

  // Seed default sales if none exist
  const sales = getSales();
  const currentProducts = getProducts();
  if (sales.length === 0 && currentProducts.length > 0) {
    const sampleSales: Sale[] = [];
    const now = new Date();
    
    // Generate daily sales for the last 30 days
    let invoiceCount = 1001;
    for (let i = 29; i >= 0; i--) {
      const saleDate = new Date();
      saleDate.setDate(now.getDate() - i);
      const dateStr = saleDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // 2 to 4 sales per day
      const salesPerDay = Math.floor(Math.random() * 3) + 2;
      for (let s = 0; s < salesPerDay; s++) {
        // Pick 1 to 3 random products
        const numItems = Math.floor(Math.random() * 3) + 1;
        const saleProducts: any[] = [];
        let totalAmount = 0;
        let totalCost = 0;

        // Shuffle currentProducts copy to pick random ones
        const shuffled = [...currentProducts].sort(() => 0.5 - Math.random());
        const picked = shuffled.slice(0, numItems);

        for (const prod of picked) {
          const qty = Math.floor(Math.random() * 3) + 1; // 1 to 3 units
          const amount = prod.price * qty;
          const cost = prod.costPrice * qty;
          
          saleProducts.push({
            productId: prod.id,
            name: prod.name,
            quantitySold: qty,
            priceAtSale: prod.price,
            costAtSale: prod.costPrice
          });
          
          totalAmount += amount;
          totalCost += cost;
        }

        const saleTimestamp = new Date(saleDate);
        // Vary hour/minute of sale
        saleTimestamp.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

        sampleSales.push({
          id: 'sale_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
          products: saleProducts,
          totalAmount: Number(totalAmount.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2)),
          date: dateStr,
          timestamp: saleTimestamp.toISOString(),
          soldBy: ownerId,
          soldByName: 'John StoreOwner',
          invoiceNumber: `INV-${invoiceCount++}`
        });
      }
    }

    saveSales(sampleSales);
    console.log(`MongoDB/Local: Seeded ${sampleSales.length} historical sales for analytics.`);
  }

  // Seed default expenses if none exist
  const expenses = getExpenses();
  if (expenses.length === 0) {
    const sampleExpenses: Expense[] = [];
    const now = new Date();
    
    // Generate expenses for the last 30 days
    const expenseTitles = [
      { cat: 'Rent', title: 'Store Monthly Rent', amount: 850.00 },
      { cat: 'Utilities', title: 'Electricity & Water Bill', amount: 120.50 },
      { cat: 'Utilities', title: 'High-Speed Internet subscription', amount: 49.99 },
      { cat: 'Marketing', title: 'Local Flyer Distribution & Ads', amount: 80.00 },
      { cat: 'Maintenance', title: 'A/C Filter Replacement & Cleaning', amount: 65.00 },
      { cat: 'Inventory', title: 'Bulk Packing Material Purchase', amount: 110.00 }
    ];

    for (let i = 25; i >= 0; i -= 5) {
      const expDate = new Date();
      expDate.setDate(now.getDate() - i);
      const dateStr = expDate.toISOString().split('T')[0];

      // Pick a random template
      const template = expenseTitles[Math.floor(Math.random() * expenseTitles.length)];
      // Add slight random noise to amount
      const finalAmount = Number((template.amount * (0.9 + Math.random() * 0.2)).toFixed(2));

      sampleExpenses.push({
        id: 'exp_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
        title: template.title,
        amount: finalAmount,
        date: dateStr,
        category: template.cat,
        createdAt: expDate.toISOString()
      });
    }

    saveExpenses(sampleExpenses);
    console.log(`MongoDB/Local: Seeded ${sampleExpenses.length} sample expenses for cashflow.`);
  }

  // Start MongoDB background connection
  initMongoDB();
}

// Users Collections
export function getUsers(): (User & { password?: string })[] {
  return readJSONFile<(User & { password?: string })>(USERS_FILE);
}

export function saveUsers(users: (User & { password?: string })[]) {
  writeJSONFile(USERS_FILE, users);
  syncToMongo('users', users).catch(err => console.error('Users async mongo sync failed', err));
}

// Products Collections
export function getProducts(): Product[] {
  return readJSONFile<Product>(PRODUCTS_FILE);
}

export function saveProducts(products: Product[]) {
  writeJSONFile(PRODUCTS_FILE, products);
  syncToMongo('products', products).catch(err => console.error('Products async mongo sync failed', err));
}

// Sales Collections
export function getSales(): Sale[] {
  return readJSONFile<Sale>(SALES_FILE);
}

export function saveSales(sales: Sale[]) {
  writeJSONFile(SALES_FILE, sales);
  syncToMongo('sales', sales).catch(err => console.error('Sales async mongo sync failed', err));
}

// Expenses Collections
export function getExpenses(): Expense[] {
  return readJSONFile<Expense>(EXPENSES_FILE);
}

export function saveExpenses(expenses: Expense[]) {
  writeJSONFile(EXPENSES_FILE, expenses);
  syncToMongo('expenses', expenses).catch(err => console.error('Expenses async mongo sync failed', err));
}
