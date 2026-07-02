const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Define models mapping
const models = {
  admins: require('./src/models/Admin'),
  users: require('./src/models/User'),
  products: require('./src/models/Product'),
  categories: require('./src/models/Category'),
  subcategories: require('./src/models/Subcategory'),
  attributes: require('./src/models/Attribute'),
  addresses: require('./src/models/Address'),
  cartItems: require('./src/models/CartItem'),
  comboPacks: require('./src/models/ComboPack'),
  gsts: require('./src/models/Gst'),
  homeCMS: require('./src/models/HomeCMS'),
  orders: require('./src/models/Order'),
  shippings: require('./src/models/Shipping'),
  stockReservations: require('./src/models/StockReservation'),
  wishlists: require('./src/models/Wishlist'),
  enquiries: require('./src/models/enquiry'),
  coupons: require('./src/models/Coupon')
};

const BACKUP_DIR = path.join(__dirname, 'backups');

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ Error: MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('🔌 Connected to MongoDB successfully.');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const backup = async () => {
  console.log('🔄 Starting database backup...');
  try {
    ensureBackupDir();
    
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {}
    };

    for (const [key, Model] of Object.entries(models)) {
      backupData.data[key] = await Model.find({}).lean();
    }

    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✅ Backup successfully saved to: ${filepath}`);
    console.log(`📊 Statistics:`);
    for (const [key, docs] of Object.entries(backupData.data)) {
      console.log(`   - ${key}: ${docs.length} documents`);
    }
  } catch (error) {
    console.error('❌ Backup failed:', error);
  }
};

const restore = async (filename) => {
  if (!filename) {
    console.error('❌ Error: Please specify the backup filename or path to restore.');
    console.log('Usage: node dbBackupRestore.js --import <filename_or_path>');
    return;
  }

  let filepath = filename;
  if (!fs.existsSync(filepath)) {
    // Try in backups folder
    filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
      console.error(`❌ Error: Backup file not found at "${filename}" or "${filepath}"`);
      return;
    }
  }

  console.log(`🔄 Reading backup file from: ${filepath}...`);
  try {
    const rawData = fs.readFileSync(filepath, 'utf-8');
    const backupData = JSON.parse(rawData);

    if (!backupData || typeof backupData !== 'object' || !backupData.data) {
      throw new Error('Invalid JSON format or missing data container');
    }

    console.log('⚠️ WARNING: This will overwrite your existing database records! Starting import...');

    for (const [key, Model] of Object.entries(models)) {
      const docs = backupData.data[key];
      if (docs && Array.isArray(docs)) {
        await Model.deleteMany({});
        if (docs.length > 0) {
          await Model.insertMany(docs);
        }
        console.log(`   - Restored ${key}: ${docs.length} documents`);
      } else {
        console.log(`   - Skipped ${key}: No data found in backup`);
      }
    }

    console.log('✅ Database restoration completed successfully!');
  } catch (error) {
    console.error('❌ Restoration failed:', error.message);
  }
};

const run = async () => {
  const args = process.argv.slice(2);
  const command = args[0];

  // Default to backup if no argument is passed
  if (!command || command === '--backup' || command === '-b') {
    await connectDB();
    await backup();
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  } else if (command === '--import' || command === '-i') {
    await connectDB();
    await restore(args[1]);
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  } else if (command === '--help' || command === '-h') {
    console.log(`
Database Backup & Restore Utility
=================================
Usage:
  Backup (Default):
    node dbBackupRestore.js
    node dbBackupRestore.js --backup
    node dbBackupRestore.js -b

  Import / Restore:
    node dbBackupRestore.js --import <filename_or_path>
    node dbBackupRestore.js -i <filename_or_path>

  Note: Backup files are stored in the "./backups" directory.
`);
    process.exit(0);
  } else {
    console.error(`❌ Error: Unknown command "${command}". Run with --help for usage details.`);
    process.exit(1);
  }
};

run();
