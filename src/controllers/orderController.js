const Order = require('../models/Order');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const ComboPack = require('../models/ComboPack');
const StockReservation = require('../models/StockReservation');
const { saveBase64Image, saveBase64ImageAsync, getImageUrl, getRelativeImagePath } = require('../utils/imageHelper');
const { sendEmail } = require('../utils/emailHelper');
const User = require('../models/User');
const { getOrderConfirmationTemplate, getCancellationTemplate } = require('../utils/emailTemplate');
const logger = require('../utils/logger');

// Helper to atomically deduct stock for a specific variant in a product
const attemptAtomicDeduction = async (productId, variant, quantity) => {
  const query = {
    _id: productId,
    variants: {
      $elemMatch: {
        stock: { $gte: quantity }
      }
    }
  };

  if (variant._id) {
    query.variants.$elemMatch._id = variant._id;
  } else if (variant.id) {
    query.variants.$elemMatch.id = variant.id;
  } else {
    throw new Error('Variant identification is missing.');
  }

  const update = {
    $inc: { "variants.$[elem].stock": -quantity }
  };

  const arrayFilters = [];
  if (variant._id) {
    arrayFilters.push({ "elem._id": variant._id });
  } else {
    arrayFilters.push({ "elem.id": variant.id });
  }

  const updatedProduct = await Product.findOneAndUpdate(
    query,
    update,
    {
      arrayFilters,
      new: true
    }
  );

  return updatedProduct;
};

// Helper to find matching variant based on selectedOptions
const findMatchingVariant = (product, selectedOptions = {}) => {
  if (!product.variants || product.variants.length === 0) return null;

  // If no options are selected, default to the first variant
  if (Object.keys(selectedOptions).length === 0) {
    return product.variants[0];
  }

  const normStr = (s) => String(s || '').split('|')[0].trim().toLowerCase();

  for (const variant of product.variants) {
    const attrs = variant.attributes || {};
    let match = true;

    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'color' || key === 'size') {
        const selectedVal = selectedOptions[key];
        if (selectedVal && selectedVal !== 'Default' && selectedVal !== 'default' && normStr(selectedVal) !== normStr(val)) {
          match = false;
          break;
        }
      }
    }

    if (match) return variant;
  }

  return product.variants[0];
};



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

// Helper to format order response and resolve customImage and returnPhoto URLs to public domain
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
      if (formattedItem.returnPhoto) {
        if (formattedItem.returnPhoto.includes(',')) {
          formattedItem.returnPhoto = formattedItem.returnPhoto.split(',').map(img => getImageUrl(img)).join(',');
        } else {
          formattedItem.returnPhoto = getImageUrl(formattedItem.returnPhoto);
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
      isDirectPurchase = false,
      couponCode = null,
      couponDiscount = 0
    } = req.body;

    logger.checkout.info('Order creation initiated', {
      userId: req.user._id,
      itemCount: items?.length,
      paymentMethod,
      paymentStatus,
      isDirectPurchase,
      total,
      couponCode: couponCode || 'none'
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      logger.checkout.warn('Order rejected – no items provided', { userId: req.user._id });
      return res.status(400).json({ success: false, message: 'No items provided for order' });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.streetAddress) {
      logger.checkout.warn('Order rejected – invalid shipping address', { userId: req.user._id });
      return res.status(400).json({ success: false, message: 'Invalid shipping address details' });
    }

    // Generate unique order ID
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const orderId = `ORD-${Date.now().toString().slice(-4)}-${randomNum}`;

    // Normalize items
    const normalizedItems = await Promise.all(items.map(async (item) => {
      const selectedOptions = { ...item.selectedOptions };
      if (selectedOptions.customImage) {
        selectedOptions.customImage = await saveBase64ImageAsync(selectedOptions.customImage, 'customization', 'custom-img');
      }
      if (selectedOptions.customization && typeof selectedOptions.customization === 'object') {
        selectedOptions.customization = { ...selectedOptions.customization };
        if (selectedOptions.customization.image) {
          selectedOptions.customization.image = await saveBase64ImageAsync(selectedOptions.customization.image, 'customization', 'custom-img');
        }
      }

      let returnPolicy = 'No Return Policy';
      try {
        const prodId = item.productId || item.id || item._id;
        if (item.isComboProduct) {
          const dbCombo = await ComboPack.findById(prodId);
          if (dbCombo && dbCombo.returnPolicy) {
            returnPolicy = dbCombo.returnPolicy;
          }
        } else {
          const dbProd = await Product.findById(prodId);
          if (dbProd && dbProd.returnPolicy) {
            returnPolicy = dbProd.returnPolicy;
          }
        }
      } catch (err) {
        console.error('Error fetching product return policy:', err);
      }

      return {
        productId: item.productId || item.id || item._id,
        title: item.title || item.name,
        price: Number(item.price),
        quantity: Number(item.quantity || item.qty || 1),
        image: getRelativeImagePath(item.image || (item.images && item.images[0]) || ''),
        selectedOptions,
        isComboProduct: Boolean(item.isComboProduct),
        includedProducts: item.includedProducts || [],
        weight: Number(item.weight || 0),
        returnPolicy
      };
    }));

    // Validate and deduct stock, returning the locked items mapping
    let reservationItems = [];
    try {
      reservationItems = await validateAndDeductStock(normalizedItems);
      logger.stock.info('Stock validation & deduction completed', { orderId: 'pending', itemsReserved: reservationItems.length });
    } catch (stockError) {
      logger.checkout.error('Order rejected – stock validation failed', { userId: req.user._id, reason: stockError.message });
      return res.status(400).json({ success: false, message: stockError.message });
    }

    const initialStatus = paymentStatus === 'paid' ? 'Processing' : 'Pending';

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
      couponCode,
      couponDiscount: Number(couponDiscount),
      total: Number(total),
      status: initialStatus,
      statusColor: getStatusColor(initialStatus),
      statusDate: new Date(),
      placedDate: new Date()
    });

    // Create Stock Reservation record
    await StockReservation.create({
      orderId: newOrder._id,
      items: reservationItems,
      status: paymentStatus,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      processed: false
    });

    logger.stock.info('Stock reservation created', {
      orderId: newOrder.orderId,
      mongoId: newOrder._id,
      itemCount: reservationItems.length,
      expiresInMinutes: 15
    });
    logger.order.info('Order created successfully', {
      orderId: newOrder.orderId,
      userId: req.user._id,
      paymentMethod,
      paymentStatus,
      subtotal,
      total,
      couponCode: couponCode || 'none',
      couponDiscount,
      isDirectPurchase,
      itemCount: normalizedItems.length
    });
    logger.checkout.info('Checkout flow completed', { orderId: newOrder.orderId, userId: req.user._id, total });

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
        const subject = `p2jmart Order Confirmation - ${orderId}`;

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
    logger.checkout.error('Unhandled error in createOrder', { userId: req.user?._id, error: err.message, stack: err.stack?.slice(0, 300) });
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

// Cancel order (User requests cancellation)
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason for cancellation is required'
      });
    }

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

    if (order.status === 'Cancellation Requested') {
      return res.status(400).json({
        success: false,
        message: 'Cancellation request is already pending admin review'
      });
    }

    if (order.status === 'Delivered' || order.status === 'Shipped') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order that has been shipped or delivered'
      });
    }

    order.status = 'Cancellation Requested';
    order.cancellationReason = reason.trim();
    order.statusColor = getStatusColor('Cancellation Requested') || 'text-orange-600 bg-orange-50';
    order.statusDate = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Cancellation request submitted successfully',
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

// Get all return requests (Admin only)
exports.getAdminReturnRequests = async (req, res, next) => {
  try {
    const orders = await Order.find({
      'items.returnStatus': { $ne: 'None' }
    })
      .populate('user', 'name email phone')
      .sort({ updatedAt: -1 })
      .lean();

    const returnRequests = [];
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.returnStatus && item.returnStatus !== 'None') {
          returnRequests.push({
            orderId: order._id,
            orderCode: order.orderId,
            itemId: item._id,
            productName: item.title,
            image: item.image,
            quantity: item.quantity,
            price: item.price,
            userName: order.user?.name || order.shippingAddress?.fullName || 'Guest',
            mobileNo: order.shippingAddress?.phone || order.user?.phone || '',
            address: `${order.shippingAddress?.streetAddress}, ${order.shippingAddress?.city}, ${order.shippingAddress?.state} - ${order.shippingAddress?.postalCode}`,
            returnStatus: item.returnStatus,
            returnReason: item.returnReason,
            returnPhoto: item.returnPhoto ? (item.returnPhoto.includes(',') ? item.returnPhoto.split(',').map(img => getImageUrl(img)).join(',') : getImageUrl(item.returnPhoto)) : '',
            returnRequestDate: item.returnRequestDate,
            parcelReceived: item.parcelReceived,
            refundStatus: item.refundStatus
          });
        }
      });
    });

    return res.status(200).json({
      success: true,
      data: returnRequests
    });
  } catch (err) {
    next(err);
  }
};

// Update order status (Admin only - handles approval and emails)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancellation Requested', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const order = await Order.findById(req.params.id).populate('user');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
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

    const allowedTransitions = {
      'Pending': ['Pending', 'Processing', 'Cancelled'],
      'Processing': ['Processing', 'Shipped', 'Cancelled'],
      'Shipped': ['Shipped', 'Delivered'],
      'Delivered': ['Delivered'],
      'Cancellation Requested': ['Cancellation Requested', 'Cancelled'],
      'Cancelled': ['Cancelled']
    };

    if (!allowedTransitions[order.status] || !allowedTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition order status directly from ${order.status} to ${status}`
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
    order.statusColor = getStatusColor(status) || (status === 'Cancelled' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50');
    order.statusDate = new Date();
    
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }
    
    await order.save();

    // If admin approves the cancellation, trigger email helper
    if (status === 'Cancelled' && order.user && order.user.email) {
      try {
        const htmlContent = getCancellationTemplate(order);
        await sendEmail({
          to: order.user.email,
          subject: `Order Cancelled Confirmation - P2J Mart`,
          html: htmlContent
        });
      } catch (emailErr) {
        logger.error(`Failed to send cancellation email for order ${order._id}: ${emailErr.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};

// Request return for a specific order item
exports.requestItemReturn = async (req, res, next) => {
  try {
    const { returnReason, returnPhoto } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    const item = order.items.find(i => i._id.toString() === req.params.itemId || i.productId?.toString() === req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (item.returnStatus !== 'None') {
      return res.status(400).json({ success: false, message: 'Return already requested or processed for this item' });
    }

    if (!item.returnPolicy || item.returnPolicy === 'No Return Policy' || item.returnPolicy === 'Select Return Days') {
      return res.status(400).json({ success: false, message: 'This item is not eligible for returns' });
    }

    const match = item.returnPolicy.match(/^(\d+)\s+day/i);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid return policy configuration' });
    }
    const returnWindowDays = parseInt(match[1], 10);
    const deliveredTime = order.deliveredAt || order.statusDate || order.updatedAt;
    const elapsedDays = (Date.now() - new Date(deliveredTime).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsedDays > returnWindowDays) {
      return res.status(400).json({ success: false, message: `Return window of ${returnWindowDays} days has expired` });
    }

    let photoPaths = [];
    if (returnPhoto) {
      if (Array.isArray(returnPhoto)) {
        photoPaths = returnPhoto.map(photo => saveBase64Image(photo, 'returns', 'return-proof'));
      } else if (typeof returnPhoto === 'string' && returnPhoto.includes(',')) {
        if (returnPhoto.startsWith('data:image')) {
          photoPaths = [saveBase64Image(returnPhoto, 'returns', 'return-proof')];
        } else {
          photoPaths = returnPhoto.split(',').map(photo => saveBase64Image(photo, 'returns', 'return-proof'));
        }
      } else {
        photoPaths = [saveBase64Image(returnPhoto, 'returns', 'return-proof')];
      }
    }

    item.returnStatus = 'Return Requested';
    item.returnReason = returnReason || '';
    item.returnPhoto = photoPaths.filter(Boolean).join(',');
    item.returnRequestDate = new Date();
    item.refundStatus = 'Pending';

    await order.save();
    return res.status(200).json({
      success: true,
      message: 'Return request submitted successfully',
      data: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};


// Admin: Get all cancellation requests
// Replace your getAdminCancellationRequests in orderController.js with this:
exports.getAdminCancellationRequests = async (req, res, next) => {
  try {
    const orders = await Order.find({
      status: { $in: ['Cancellation Requested', 'Cancelled', 'Cancellation Rejected'] }
    })
    .populate('user', 'name email phone')
    .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      data: orders // Send raw orders so the frontend can map them safely
    });
  } catch (err) {
    next(err);
  }
};


exports.reviewCancellationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Evaluates to 'Cancelled' or 'Cancellation Rejected'

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order details not found.' });
    }

    // Verify the order is actively waiting for an action
    if (order.status !== 'Cancellation Requested') {
      return res.status(400).json({ success: false, message: 'No active cancellation request on this order.' });
    }

    if (status === 'Cancelled') {
      order.status = 'Cancelled';
      
      // OPTIONAL: If you track stock levels, restore item stock allocations here
      // order.items.forEach(item => { ... });
    } else {
      // Rejection branch: Revert the status back to an acceptable operational state
      // Adjust 'Processing' if your default active status tracking is named differently (e.g., 'Placed')
      order.status = 'Processing'; 
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Cancellation successfully updated to status: ${order.status}`,
      data: order
    });
  } catch (err) {
    next(err);
  }
};

// Admin: Review return request (approve/reject)
exports.adminReviewReturn = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve or reject' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.find(i => i._id.toString() === req.params.itemId || i.productId?.toString() === req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (item.returnStatus !== 'Return Requested') {
      return res.status(400).json({ success: false, message: 'No active return request for this item' });
    }

    if (action === 'approve') {
      item.returnStatus = 'Return Approved';
    } else {
      item.returnStatus = 'Return Rejected';
      item.refundStatus = 'None';
    }

    await order.save();
    return res.status(200).json({
      success: true,
      message: `Return request ${action}ed successfully`,
      data: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};

// Admin: Mark returned item parcel as received
exports.adminReceiveParcel = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.find(i => i._id.toString() === req.params.itemId || i.productId?.toString() === req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (item.returnStatus !== 'Return Approved') {
      return res.status(400).json({ success: false, message: 'Return must be approved before marking parcel as received' });
    }

    item.parcelReceived = true;
    await order.save();
    return res.status(200).json({
      success: true,
      message: 'Parcel marked as received successfully',
      data: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};

// Admin: Settle refund and restore stock
exports.adminRefundItem = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.find(i => i._id.toString() === req.params.itemId || i.productId?.toString() === req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (!item.parcelReceived) {
      return res.status(400).json({ success: false, message: 'Parcel must be received before issuing refund' });
    }

    if (item.returnStatus === 'Returned & Refunded') {
      return res.status(400).json({ success: false, message: 'Refund already issued' });
    }

    item.returnStatus = 'Returned & Refunded';
    item.refundStatus = 'Refunded';

    // Restore stock
    try {
      const quantityToRestore = Number(item.quantity) || 1;

      if (item.isComboProduct) {
        let combo = null;
        if (item.productId && /^[0-9a-fA-F]{24}$/.test(item.productId)) {
          combo = await ComboPack.findById(item.productId);
        }
        if (combo && combo.selectedVariants && combo.selectedVariants.length > 0) {
          // Restore stock for mapped static combo components
          for (const sv of combo.selectedVariants) {
            await Product.updateOne(
              { _id: sv.productId },
              { $inc: { "variants.$[elem].stock": quantityToRestore } },
              { arrayFilters: [{ $or: [{ "elem.id": sv.variantId }, { "elem._id": sv.variantId }] }] }
            );
            logger.stock.info(`Refund stock restoration complete for combo component`, { productId: sv.productId, variantId: sv.variantId, quantity: quantityToRestore });
          }
        } else {
          // Fallback logic for dynamic/custom combo packs
          const included = item.includedProducts || [];
          for (const subItem of included) {
            const subId = subItem.productId || subItem.id || subItem._id;
            const prod = await Product.findById(subId);
            if (!prod || !prod.variants || prod.variants.length === 0) continue;
            
            const variantId = prod.variants[0]._id || prod.variants[0].id;
            await Product.updateOne(
              { _id: prod._id },
              { $inc: { "variants.$[elem].stock": quantityToRestore } },
              { arrayFilters: [{ $or: [{ "elem.id": variantId }, { "elem._id": variantId }] }] }
            );
            logger.stock.info(`Refund stock restoration complete for custom combo component`, { productId: prod._id, quantity: quantityToRestore });
          }
        }
      } else {
        // Standard Product Stock Restoration
        const prod = await Product.findById(item.productId);
        if (prod) {
          const variant = findMatchingVariant(prod, item.selectedOptions);
          if (variant) {
            const variantId = variant._id || variant.id;
            await Product.updateOne(
              { _id: prod._id },
              { $inc: { "variants.$[elem].stock": quantityToRestore } },
              { arrayFilters: [{ $or: [{ "elem.id": variantId }, { "elem._id": variantId }] }] }
            );
            logger.stock.info(`Refund stock restoration complete for standard product`, { productId: prod._id, variantId, quantity: quantityToRestore });
          }
        }
      }
    } catch (stockRestoreErr) {
      logger.stock.error(`Non-blocking fallback warning: Failed to restock items automatically during refund settlement`, { error: stockRestoreErr.message });
    }

    await order.save();
    return res.status(200).json({
      success: true,
      message: 'Refund settled and stock updated successfully',
      data: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};


exports.validateAndDeductStock = async (items) => {
  const reservationItems = []; // stores { productId, variantId, quantity, title }
  const successfullyDeducted = []; // tracks { productId, variant, quantity } for compensating transaction (rollback)

  try {
    for (const item of items) {
      const quantity = Number(item.quantity) || 1;

      if (item.isComboProduct) {
        // 1. Combo Product
        let combo = null;
        if (item.productId && /^[0-9a-fA-F]{24}$/.test(item.productId)) {
          combo = await ComboPack.findById(item.productId);
        }
        if (combo && combo.selectedVariants && combo.selectedVariants.length > 0) {
          for (const sv of combo.selectedVariants) {
            const prod = await Product.findById(sv.productId);
            if (!prod) {
              throw new Error(`Product not found for combo component: ${sv.productId}`);
            }
            if (prod.isActive === false) {
              throw new Error(`Combo component '${prod.title}' is currently inactive.`);
            }

            const variant = prod.variants.find(v => v.id === sv.variantId || v._id?.toString() === sv.variantId);
            if (!variant) {
              throw new Error(`Variant not found for combo component in product: ${prod.title}`);
            }

            const neededQty = quantity;
            const updated = await attemptAtomicDeduction(prod._id, variant, neededQty);
            if (!updated) {
              logger.stock.error(`Combo component out of stock during concurrent check`, { product: prod.title, variantId: sv.variantId, needed: neededQty });
              throw new Error(`Item '${prod.title}' inside Combo Pack is out of stock.`);
            }

            successfullyDeducted.push({
              productId: prod._id,
              variant,
              quantity: neededQty
            });

            logger.stock.info(`Stock deducted atomically for combo component`, { product: prod.title, variantId: sv.variantId, deducted: neededQty });
            reservationItems.push({
              productId: prod._id,
              variantId: variant.id || variant._id?.toString(),
              quantity: neededQty,
              title: `${prod.title} (Combo Component)`
            });
          }
        } else {
          // Fallback for custom / dynamic combo packs
          const included = item.includedProducts || [];
          for (const subItem of included) {
            const subId = subItem.productId || subItem.id || subItem._id;
            const prod = await Product.findById(subId);
            if (!prod) continue;
            if (prod.isActive === false) {
              throw new Error(`Custom combo component '${prod.title}' is currently inactive.`);
            }

            const variant = prod.variants && prod.variants.length > 0 ? prod.variants[0] : null;
            if (!variant) continue;

            const neededQty = quantity;
            const updated = await attemptAtomicDeduction(prod._id, variant, neededQty);
            if (!updated) {
              logger.stock.error(`Custom combo component out of stock during concurrent check`, { product: prod.title, needed: neededQty });
              throw new Error(`Item '${prod.title}' inside custom pack is out of stock.`);
            }

            successfullyDeducted.push({
              productId: prod._id,
              variant,
              quantity: neededQty
            });

            logger.stock.info(`Stock deducted atomically for custom combo component`, { product: prod.title, deducted: neededQty });
            reservationItems.push({
              productId: prod._id,
              variantId: variant.id || variant._id?.toString(),
              quantity: neededQty,
              title: `${prod.title} (Custom Component)`
            });
          }
        }
      } else {
        // 2. Standard Product
        const prod = await Product.findById(item.productId);
        if (!prod) {
          logger.stock.error(`Product not found during stock validation`, { productId: item.productId });
          throw new Error(`Product not found for ID: ${item.productId}`);
        }
        if (prod.isActive === false) {
          logger.stock.error(`Product is inactive during stock validation`, { productId: item.productId, title: prod.title });
          throw new Error(`Product '${prod.title}' is currently inactive and cannot be purchased.`);
        }

        const variant = findMatchingVariant(prod, item.selectedOptions);
        if (!variant) {
          logger.stock.error(`No matching variant found`, { product: prod.title, selectedOptions: item.selectedOptions });
          throw new Error(`No available variant found for product: ${prod.title}`);
        }

        const updated = await attemptAtomicDeduction(prod._id, variant, quantity);
        if (!updated) {
          logger.stock.error(`Insufficient stock for product during concurrent check`, { product: prod.title, needed: quantity });
          throw new Error(`Product '${prod.title}' is out of stock or has insufficient quantity.`);
        }

        successfullyDeducted.push({
          productId: prod._id,
          variant,
          quantity
        });

        logger.stock.info(`Stock deducted atomically for standard product`, { product: prod.title, variantId: variant.id, deducted: quantity });
        reservationItems.push({
          productId: prod._id,
          variantId: variant.id || variant._id?.toString(),
          quantity,
          title: prod.title
        });
      }
    }

    return reservationItems;
  } catch (error) {
    // Compensating Transaction: Roll back all successfully deducted stock so far
    logger.stock.warn(`Error during stock allocation – triggering rollback for ${successfullyDeducted.length} items. Reason: ${error.message}`);
    for (const roll of successfullyDeducted) {
      try {
        const update = {
          $inc: { "variants.$[elem].stock": roll.quantity }
        };
        const arrayFilters = [];
        if (roll.variant._id) {
          arrayFilters.push({ "elem._id": roll.variant._id });
        } else {
          arrayFilters.push({ "elem.id": roll.variant.id });
        }

        await Product.updateOne(
          { _id: roll.productId },
          update,
          { arrayFilters }
        );
        logger.stock.info(`Rollback complete for product: ${roll.productId}, variant: ${roll.variant.id || roll.variant._id}`);
      } catch (rollbackErr) {
        logger.stock.error(`Critical: Failed to roll back stock for product ${roll.productId}, variant ${roll.variant.id || roll.variant._id}`, { error: rollbackErr.message });
      }
    }
    throw error;
  }
};