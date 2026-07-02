const Order = require('../models/Order');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const ComboPack = require('../models/ComboPack');
const StockReservation = require('../models/StockReservation');
const { saveBase64Image, getImageUrl } = require('../utils/imageHelper');
const { sendEmail } = require('../utils/emailHelper'); // Update path to your mail utility
const User = require('../models/User'); // Update to your exact user model path
const { getOrderConfirmationTemplate } = require('../utils/emailTemplate');

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

const validateAndDeductStock = async (items) => {
  const productCache = {}; // maps productId string -> Product mongoose document instance
  const reservationItems = []; // stores { productId, variantId, quantity, title }

  // Helper function to fetch product from cache or database
  const getProductDoc = async (id) => {
    if (!id) return null;
    const idStr = id.toString();
    if (productCache[idStr]) {
      return productCache[idStr];
    }
    const doc = await Product.findById(id);
    if (doc) {
      productCache[idStr] = doc;
    }
    return doc;
  };

  for (const item of items) {
    const quantity = Number(item.quantity) || 1;
    
    if (item.isComboProduct) {
      // 1. Combo Product
      // Check if it's a pre-defined ComboPack
      let combo = null;
      if (item.productId && /^[0-9a-fA-F]{24}$/.test(item.productId)) {
        combo = await ComboPack.findById(item.productId);
      }
      if (combo && combo.selectedVariants && combo.selectedVariants.length > 0) {
        for (const sv of combo.selectedVariants) {
          const prod = await getProductDoc(sv.productId);
          if (!prod) continue;
          
          const variant = prod.variants.find(v => v.id === sv.variantId || v._id?.toString() === sv.variantId);
          if (!variant) continue;
          
          const neededQty = quantity; // Each combo contains 1 of each product
          if (variant.stock < neededQty) {
            throw new Error(`Item '${prod.title}' inside Combo Pack is out of stock. Available: ${variant.stock}`);
          }
          
          variant.stock -= neededQty;
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
          const prod = await getProductDoc(subId);
          if (!prod) continue;
          
          // Custom combo subItem might not specify variantId, default to first variant
          const variant = prod.variants && prod.variants.length > 0 ? prod.variants[0] : null;
          if (!variant) continue;
          
          const neededQty = quantity;
          if (variant.stock < neededQty) {
            throw new Error(`Item '${prod.title}' inside custom pack is out of stock. Available: ${variant.stock}`);
          }
          
          variant.stock -= neededQty;
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
      const prod = await getProductDoc(item.productId);
      if (!prod) {
        throw new Error(`Product not found for ID: ${item.productId}`);
      }
      
      const variant = findMatchingVariant(prod, item.selectedOptions);
      if (!variant) {
        throw new Error(`No available variant found for product: ${prod.title}`);
      }
      
      if (variant.stock < quantity) {
        throw new Error(`Product '${prod.title}' is out of stock or has insufficient quantity. Available: ${variant.stock}`);
      }
      
      variant.stock -= quantity;
      reservationItems.push({
        productId: prod._id,
        variantId: variant.id || variant._id?.toString(),
        quantity,
        title: prod.title
      });
    }
  }

  // Save all modified products in cache
  for (const prodId of Object.keys(productCache)) {
    const prodDoc = productCache[prodId];
    if (prodDoc.isModified('variants')) {
      prodDoc.markModified('variants');
      await prodDoc.save();
    }
  }

  return reservationItems;
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
    const normalizedItems = await Promise.all(items.map(async (item) => {
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
        image: item.image || (item.images && item.images[0]) || '',
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
    } catch (stockError) {
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

    const allowedTransitions = {
      'Pending': ['Pending', 'Processing'],
      'Processing': ['Processing', 'Shipped'],
      'Shipped': ['Shipped', 'Delivered'],
      'Delivered': ['Delivered'],
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
    order.statusColor = getStatusColor(status);
    order.statusDate = new Date();
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }
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
      if (item.isComboProduct) {
        let combo = null;
        if (item.productId && /^[0-9a-fA-F]{24}$/.test(item.productId)) {
          combo = await ComboPack.findById(item.productId);
        }
        if (combo && combo.selectedVariants && combo.selectedVariants.length > 0) {
          for (const sv of combo.selectedVariants) {
            const prod = await Product.findById(sv.productId);
            if (prod) {
              const variant = prod.variants.find(v => v.id === sv.variantId || v._id?.toString() === sv.variantId);
              if (variant) {
                variant.stock += item.quantity;
                prod.markModified('variants');
                await prod.save();
              }
            }
          }
        } else {
          for (const subItem of (item.includedProducts || [])) {
            const subId = subItem.productId || subItem.id || subItem._id;
            const prod = await Product.findById(subId);
            if (prod && prod.variants && prod.variants.length > 0) {
              prod.variants[0].stock += item.quantity;
              prod.markModified('variants');
              await prod.save();
            }
          }
        }
      } else {
        const prod = await Product.findById(item.productId);
        if (prod) {
          const variant = findMatchingVariant(prod, item.selectedOptions);
          if (variant) {
            variant.stock += item.quantity;
            prod.markModified('variants');
            await prod.save();
          }
        }
      }
    } catch (stockErr) {
      console.error('Failed to restock returned product:', stockErr);
    }

    await order.save();
    return res.status(200).json({
      success: true,
      message: 'Refund issued and stock updated successfully',
      data: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};

exports.validateAndDeductStock = validateAndDeductStock;
