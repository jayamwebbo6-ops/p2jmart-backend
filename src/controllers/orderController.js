const Order = require('../models/Order');
const CartItem = require('../models/CartItem');

// Helper to map status to colors
const getStatusColor = (status) => {
  switch (status) {
    case 'Pending':
      return 'text-amber-600 bg-amber-50';
    case 'Processing':
      return 'text-yellow-600 bg-yellow-50';
    case 'Shipped':
      return 'text-blue-600 bg-blue-50';
    case 'Delivered':
      return 'text-green-600 bg-green-50';
    case 'Cancelled':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

// Create a new order
exports.createOrder = async (req, res, next) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      paymentStatus = 'paid',
      subtotal,
      shippingFee,
      total,
      isDirectPurchase = false
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items provided for order'
      });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.streetAddress) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shipping address details'
      });
    }

    // Generate unique order ID
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const orderId = `ORD-${Date.now().toString().slice(-4)}-${randomNum}`;

    // Normalize items
    const normalizedItems = items.map((item) => ({
      productId: item.productId || item.id || item._id,
      title: item.title || item.name,
      price: Number(item.price),
      quantity: Number(item.quantity || item.qty || 1),
      image: item.image || (item.images && item.images[0]) || '',
      selectedOptions: item.selectedOptions || {},
      isComboProduct: Boolean(item.isComboProduct),
      includedProducts: item.includedProducts || [],
      weight: Number(item.weight || 0)
    }));

    const newOrder = await Order.create({
      user: req.user._id,
      orderId,
      items: normalizedItems,
      shippingAddress,
      paymentMethod,
      paymentStatus,
      subtotal: Number(subtotal),
      shippingFee: Number(shippingFee),
      total: Number(total),
      status: 'Processing',
      statusColor: getStatusColor('Processing'),
      statusDate: new Date(),
      placedDate: new Date()
    });

    // CRITICAL REQUIREMENT: Clear the user's cart if this is NOT a Buy Now/Direct Purchase
    if (!isDirectPurchase) {
      await CartItem.deleteMany({ user: req.user._id });
    }

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder
    });
  } catch (err) {
    next(err);
  }
};

// Retrieve all orders for logged-in user
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (err) {
    next(err);
  }
};

// Get single order details
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or unauthorized'
      });
    }
    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
};

// Cancel order
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or unauthorized'
      });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }

    if (order.status === 'Delivered' || order.status === 'Shipped') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order that has been shipped or delivered'
      });
    }

    order.status = 'Cancelled';
    order.statusColor = getStatusColor('Cancelled');
    order.statusDate = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (err) {
    next(err);
  }
};

// --- ADMIN CONTROLLERS ---

// Get all orders (Admin only)
exports.getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (err) {
    next(err);
  }
};

// Update order status (Admin only)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.status = status;
    order.statusColor = getStatusColor(status);
    order.statusDate = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (err) {
    next(err);
  }
};
