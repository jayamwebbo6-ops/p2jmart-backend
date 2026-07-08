const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Auto-seed default admin
    const Admin = require('../models/Admin');
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      await Admin.create({
        username: 'admin',
        email: 'admin@p2jmart.com',
        password: 'admin@123',
        photo: '',
        role: 'Administrator'
      });
      console.log('Default admin auto-seeded successfully! Username: admin, Password: admin@123');
    }

    // Cleanup duplicate/unused 'admins' collection if it exists
    try {
      const collections = await mongoose.connection.db.listCollections({ name: 'admin' }).toArray();
      if (collections.length > 0) {
        await mongoose.connection.db.dropCollection('admins');
        console.log("Cleaned up duplicate 'admins' collection.");
      }
    } catch (e) {
      // Ignore errors if collection doesn't exist
    }

    // Drop existing non-sparse googleId_1 index on users collection so it can be rebuilt as sparse
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections({ name: 'users' }).toArray();
      if (collections.length > 0) {
        const collection = db.collection('users');
        const indexes = await collection.indexes();
        const hasGoogleIdIndex = indexes.some(idx => idx.name === 'googleId_1');
        
        if (hasGoogleIdIndex) {
          await collection.dropIndex('googleId_1');
          console.log("Successfully dropped old 'googleId_1' index. It will be recreated correctly as sparse.");
        }
      }
    } catch (e) {
      console.warn("Could not drop googleId_1 index:", e.message);
    }
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
