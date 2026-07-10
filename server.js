require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./src/config/db.js');

// Initialize Express app
const app = express();

// Connect to Database
connectDB().then(() => {
  const { startStockReservationCron } = require('./src/utils/cron.js');
  startStockReservationCron();
}).catch((err) => {
  console.error('Failed to connect to database or start cron:', err);
});

// Global Environment Variables
const BASE_URL = process.env.BASE_URL || 'p2jmart';

// Initialize API Router
const apiRouter = express.Router();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or server-to-server requests)
    if (!origin) return callback(null, true);

    // Use ALLOWED_ORIGINS from env (comma-separated) or fallback to FRONTEND_URL
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim().replace(/\/$/, ''))
      : [
          process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:5173'
        ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('CORS policy violation: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging Middleware for API calls
const requestLogger = require('./src/middleware/requestLogger.js');
app.use(requestLogger);

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

const UserReview = require('./src/routes/UserReviewRoute.js');
apiRouter.use('/reviews', UserReview);
 
// contact form Routes
const contactUs = require('./src/routes/contactRoutes.js');
apiRouter.use('/contact-us', contactUs );

const salesReportRoutes = require('./src/routes/Salesreportroutes.js');
apiRouter.use('/sales-report', salesReportRoutes);

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

// Combo Pack Routes
const comboRoutes = require('./src/routes/comboRoutes');
apiRouter.use('/combos', comboRoutes);

// Coupon Routes
const couponRoutes = require('./src/routes/couponRoutes');
apiRouter.use('/coupons', couponRoutes);

// Payment Routes
const paymentRoutes = require('./src/routes/paymentRoutes');
apiRouter.use('/payments', paymentRoutes);

// Mount the API Router under both prefixes (default /api and dynamic base URL from env)
app.use('/api', apiRouter);
app.use(`/${BASE_URL}/api`, apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  let statusCode = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Format MongoDB Duplicate Key (E11000) Error Messages
  if (err.code === 11000) {
    statusCode = 400;
    const key = Object.keys(err.keyValue || {})[0];
    if (key === 'email') {
      message = 'A user with this email address already exists.';
    } else if (key === 'googleId') {
      message = 'This Google account is already linked to another user.';
    } else {
      message = `A duplicate value was found for field: ${key}.`;
    }
  }

  res.status(statusCode).json({
    success: false,
    message: message
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