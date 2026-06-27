const mongoose = require('mongoose');
const CartItem = require('../src/models/CartItem');
require('dotenv').config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    const items = await CartItem.find();
    console.log(`Found ${items.length} cart items:`);
    items.forEach((item, i) => {
      console.log(`Item ${i + 1}: ${item.title}`);
      console.log(`  image: "${item.image}"`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
