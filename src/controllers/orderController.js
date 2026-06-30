const Order = require('../models/Order');
const CartItem = require('../models/CartItem');
const { saveBase64Image, getImageUrl } = require('../utils/imageHelper');
const { sendEmail } = require('../utils/emailHelper'); // Update path to your mail utility
const User = require('../models/User'); // Update to your exact user model path
const { getOrderConfirmationTemplate } = require('../utils/emailTemplate');

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

// Helper to format order response and resolve customImage URLs to public domain
const formatOrderResponse = (order) => {
  if (!order) return null;
  const isLean = !order.toObject;
  const orderObj = isLean ? order : order.toObject();

  if (orderObj.items && Array.isArray(orderObj.items)) {
    orderObj.items = orderObj.items.map(item => {
      const formattedItem = { ...item };
      if (formattedItem.selectedOptions) {
        formattedItem.selectedOptions = { ...formattedItem.selectedOptions };
        if (formattedItem.selectedOptions.customImage) {
          formattedItem.selectedOptions.customImage = getImageUrl(formattedItem.selectedOptions.customImage);
        }
        if (formattedItem.selectedOptions.customization && typeof formattedItem.selectedOptions.customization === 'object') {
          formattedItem.selectedOptions.customization = {
            ...formattedItem.selectedOptions.customization,
            image: formattedItem.selectedOptions.customization.image
              ? getImageUrl(formattedItem.selectedOptions.customization.image)
              : ''
          };
        }
      }
      return formattedItem;
    });
  }

  return orderObj;
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
      gst = 0,
      shippingFee,
      total,
      isDirectPurchase = false
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for order' });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.streetAddress) {
      return res.status(400).json({ success: false, message: 'Invalid shipping address details' });
    }

    // Generate unique order ID
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const orderId = `ORD-${Date.now().toString().slice(-4)}-${randomNum}`;

    // Normalize items
    const normalizedItems = items.map((item) => {
      const selectedOptions = { ...item.selectedOptions };
      if (selectedOptions.customImage) {
        selectedOptions.customImage = saveBase64Image(selectedOptions.customImage, 'customization', 'custom-img');
      }
      if (selectedOptions.customization && typeof selectedOptions.customization === 'object') {
        selectedOptions.customization = { ...selectedOptions.customization };
        if (selectedOptions.customization.image) {
          selectedOptions.customization.image = saveBase64Image(selectedOptions.customization.image, 'customization', 'custom-img');
        }
      }

      return {
        productId: item.productId || item.id || item._id,
        title: item.title || item.name,
        price: Number(item.price),
        quantity: Number(item.quantity || item.qty || 1),
        image: item.image || (item.images && item.images[0]) || '',
        selectedOptions,
        isComboProduct: Boolean(item.isComboProduct),
        includedProducts: item.includedProducts || [],
        weight: Number(item.weight || 0)
      };
    });

    const newOrder = await Order.create({
      user: req.user._id,
      orderId,
      items: normalizedItems,
      shippingAddress,
      paymentMethod,
      paymentStatus,
      subtotal: Number(subtotal),
      gst: Number(gst),
      shippingFee: Number(shippingFee),
      total: Number(total),
      status: 'Processing',
      statusColor: getStatusColor('Processing'),
      statusDate: new Date(),
      placedDate: new Date()
    });

    // Clear user cart if not direct buy
    if (!isDirectPurchase) {
      await CartItem.deleteMany({ user: req.user._id });
    }

    // ==========================================
    // BACKEND EMAIL TRIGGER INTEGRATION
    // ==========================================
   try {
  // 1. Fetch user data safely from your existing DB reference
  const user = await User.findById(req.user._id);
  
  if (user && user.email) {
    const subject = `p2jmart Order Invoice - ${orderId}`;
    
    // 2. Generate template string passing user context and order payload data
    const htmlBody = getOrderConfirmationTemplate(user, newOrder);
    
    // 3. FIX: Wrapped arguments inside an object configuration matches helper structure
    sendEmail({
      to: user.email,
      subject: subject,
      html: htmlBody
    })
      .then(() => console.log(`Confirmation email sent successfully to: ${user.email}`))
      .catch((mailErr) => console.error('Nodemailer pipeline background failure:', mailErr));
  }
} catch (emailTriggerError) {
  // We log the error but don't crash the request, ensuring users don't see a checkout error if email fails
  console.error('Failed to resolve email profile details during database hook:', emailTriggerError);
}
    // ==========================================

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: formatOrderResponse(newOrder)
    });
  } catch (err) {
    next(err);
  }
};

// Retrieve all orders for logged-in user
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      data: orders.map(formatOrderResponse)
    });
  } catch (err) {
    next(err);
  }
};

// Get single order details
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or unauthorized'
      });
    }
    return res.status(200).json({
      success: true,
      data: formatOrderResponse(order)
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
      data: formatOrderResponse(order)
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
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: orders.map(formatOrderResponse)
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

    if (status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Admin is not authorized to cancel orders'
      });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify status of a cancelled order'
      });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify status of a delivered order'
      });
    }

    const statusOrderMap = { 'Pending': 0, 'Processing': 1, 'Shipped': 2, 'Delivered': 3 };
    if (statusOrderMap[status] < statusOrderMap[order.status]) {
      return res.status(400).json({
        success: false,
        message: `Cannot revert status from ${order.status} to ${status}`
      });
    }

    if (status === 'Shipped') {
      const { trackingId, trackingLink } = req.body;
      if (!trackingId || !trackingId.trim() || !trackingLink || !trackingLink.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Tracking ID and Tracking Link are required to ship the order'
        });
      }
      order.trackingId = trackingId.trim();
      order.trackingLink = trackingLink.trim();
    }

    order.status = status;
    order.statusColor = getStatusColor(status);
    order.statusDate = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};
