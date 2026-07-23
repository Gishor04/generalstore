import bcrypt from 'bcryptjs';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { User, Product } from '../src/types';

// Load environment variables
dotenv.config();

// MongoDB state
export let isMongoConnected = false;
export let mongoStatusMessage = 'No connection attempted';
export let mongoUriObfuscated = '';
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

// Initialize Database Connection
export async function initDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const msg = 'MONGODB_URI environment variable is not configured. Please add it in your Vercel/Netlify dashboard.';
    console.error('CRITICAL ERROR:', msg);
    throw new Error(msg);
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
    
    mongoClient = new MongoClient(uri, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    
    // Use the database name from connection string or default
    mongoDb = mongoClient.db();
    isMongoConnected = true;
    mongoStatusMessage = 'Connected';
    
    console.log('MongoDB connected successfully');
    console.log(`Database name: ${mongoDb.databaseName}`);

    // Seed defaults
    await seedDefaultsIfNeeded();

  } catch (err: any) {
    isMongoConnected = false;
    mongoStatusMessage = `Connection failed: ${err.message || err}`;
    console.error('MongoDB connection error:', err);
    throw new Error(`Failed to connect to MongoDB: ${err.message}`);
  }
}

// Global Db accessor
export function getDb(): Db {
  if (!mongoDb) {
    throw new Error('Database not connected. Check MONGODB_URI environment variable.');
  }
  return mongoDb;
}

// Seed basic defaults if empty
async function seedDefaultsIfNeeded() {
  const db = getDb();
  
  // Seed default owner
  const userCount = await db.collection('users').countDocuments();
  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('password123', salt);
    const hashedPin = bcrypt.hashSync('0814', salt);

    const defaultOwner = {
      id: 'usr_owner',
      username: 'owner@example.com',
      name: 'John StoreOwner',
      email: 'owner@example.com',
      role: 'owner',
      storeName: 'My General Store',
      pin: hashedPin,
      password: hashedPassword,
    };

    await db.collection('users').insertOne(defaultOwner);
    console.log('----------------------------------------------------');
    console.log('MongoDB seeded with default Store Owner:');
    console.log('  Username/Email: owner@example.com');
    console.log('  Password:       password123');
    console.log('  Default PIN:    0814');
    console.log('----------------------------------------------------');
  }

  // Seed sample products
  const productCount = await db.collection('products').countDocuments();
  if (productCount === 0) {
    const sampleProducts = [
      { id: 'prod_milk', name: 'Fresh Whole Milk', category: 'Dairy', price: 3.49, costPrice: 2.10, quantity: 45, unit: 'litre', lowStockThreshold: 10, createdAt: new Date().toISOString(), image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200&auto=format&fit=crop&q=60' },
      { id: 'prod_eggs', name: 'Brown Grade A Eggs', category: 'Dairy', price: 4.99, costPrice: 3.00, quantity: 30, unit: 'pcs', lowStockThreshold: 12, createdAt: new Date().toISOString(), image: 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=200&auto=format&fit=crop&q=60' },
      { id: 'prod_apples', name: 'Organic Honeycrisp Apples', category: 'Produce', price: 2.99, costPrice: 1.40, quantity: 80, unit: 'kg', lowStockThreshold: 15, createdAt: new Date().toISOString(), image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=200&auto=format&fit=crop&q=60' }
    ];
    await db.collection('products').insertMany(sampleProducts);
    console.log(`MongoDB: Seeded ${sampleProducts.length} sample products.`);
  }
}
