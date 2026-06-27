require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./src/config/db.js');

// Initialize Express app
const app = express();

// Connect to Database
connectDB();

// Global Environment Variables
const BASE_URL = process.env.BASE_URL || 'p2jmart';

// Initialize API Router
const apiRouter = express.Router();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Folders for Uploads
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(`/${BASE_URL}/api/uploads`, express.static(path.join(__dirname, 'uploads')));

// HTTP Request Logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Basic health check route
apiRouter.use('/test', (req, res) => {
  res.json({ message: 'P2J Mart API is running...' });
});

// Admin Routes
const adminRoutes = require('./src/routes/adminRoutes');
apiRouter.use('/admin', adminRoutes);

// User Routes
const userRoutes = require('./src/routes/userRoutes');
apiRouter.use('/user', userRoutes);

// Address Routes
const addressRoutes = require('./src/routes/addressRoutes');
apiRouter.use('/addresses', addressRoutes);

// Attribute Routes
const attributeRoutes = require('./src/routes/attributeRoutes');
apiRouter.use('/attributes', attributeRoutes);

// Category & Subcategory Routes
const categoryRoutes = require('./src/routes/categoryRoutes');
apiRouter.use('/categories', categoryRoutes);

// Product Routes
const productRoutes = require('./src/routes/productRoutes');
apiRouter.use('/products', productRoutes);

// Cart Routes
const cartRoutes = require('./src/routes/cartRoutes');
apiRouter.use('/cart', cartRoutes);

// Home CMS Routes
const homeCMSRoutes = require('./src/routes/homeCMSRoutes');
apiRouter.use('/home-cms', homeCMSRoutes);

// GST Routes
const gstRoutes = require('./src/routes/gstRoutes.js');
apiRouter.use('/gst', gstRoutes);

// Shipping Routes
const shippingRoutes = require('./src/routes/shippingRoutes.js');
apiRouter.use('/shipping', shippingRoutes);

const enqueiresRoutes = require('./src/routes/enquiryRoutes.js');
apiRouter.use('/enquiries', enqueiresRoutes);

// Order Routes
const orderRoutes = require('./src/routes/orderRoutes');
apiRouter.use('/orders', orderRoutes);

const wishlistRoutes = require('./src/routes/wishlistRoutes');
apiRouter.use('/wishlist', wishlistRoutes);

// Mount the API Router under both prefixes (default /api and dynamic base URL from env)
// const BASE_URL = process.env.BASE_URL || 'p2jmart';
app.use('/api', apiRouter);
// app.use(`/${BASE_URL}/api`, apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});