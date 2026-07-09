const Order = require('../models/Order');
const StockReservation = require('../models/StockReservation');
const Product = require('../models/Product');
const ComboPack = require('../models/ComboPack');
const CartItem = require('../models/CartItem');
const User = require('../models/User');
const ccavenueConfig = require('../config/ccavenueConfig');
const ccavenueCrypto = require('../utils/ccavenueCrypto');
const logger = require('../utils/logger');
const { saveBase64Image, getRelativeImagePath, getImageUrl } = require('../utils/imageHelper');
const { getOrderConfirmationTemplate } = require('../utils/emailTemplate');
const { sendEmail } = require('../utils/emailHelper');
const { validateAndDeductStock } = require('./orderController');
const queryString = require('querystring');

const getStatusColor = (status) => {
  switch (status) {
    case 'Pending': return 'text-yellow-600 bg-yellow-50';
    case 'Processing': return 'text-blue-600 bg-blue-50';
    case 'Shipped': return 'text-purple-600 bg-purple-50';
    case 'Delivered': return 'text-green-600 bg-green-50';
    case 'Cancelled': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

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

/**
 * Initiate payment request and save order in pending state
 */
exports.createPayment = async (req, res, next) => {
  try {
    const {
      items,
      shippingAddress,
      subtotal,
      gst = 0,
      shippingFee,
      total,
      isDirectPurchase = false,
      couponCode = null,
      couponDiscount = 0
    } = req.body;

    logger.checkout.info('CCAvenue Payment initiation started', {
      userId: req.user._id,
      itemCount: items?.length,
      total
    });

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
        image: getRelativeImagePath(item.image || (item.images && item.images[0]) || ''),
        selectedOptions,
        isComboProduct: Boolean(item.isComboProduct),
        includedProducts: item.includedProducts || [],
        weight: Number(item.weight || 0),
        returnPolicy
      };
    }));

    // Stock deduction & reservation
    let reservationItems = [];
    try {
      reservationItems = await validateAndDeductStock(normalizedItems);
    } catch (stockError) {
      logger.checkout.error('CCAvenue order rejected – stock validation failed', { userId: req.user._id, reason: stockError.message });
      return res.status(400).json({ success: false, message: stockError.message });
    }

    const initialStatus = 'Pending';

    const newOrder = await Order.create({
      user: req.user._id,
      orderId,
      items: normalizedItems,
      shippingAddress,
      paymentMethod: 'CCAvenue',
      paymentStatus: 'pending',
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
      status: 'unpaid',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      processed: false
    });

    // Clear user cart if not direct buy
    if (!isDirectPurchase) {
      await CartItem.deleteMany({ user: req.user._id });
    }

    // Build CCAvenue query parameter string
    const requestParams = [
      `merchant_id=${ccavenueConfig.merchantId}`,
      `order_id=${newOrder.orderId}`,
      `amount=${newOrder.total.toFixed(2)}`,
      `currency=INR`,
      `redirect_url=${encodeURIComponent(ccavenueConfig.redirectUrl)}`,
      `cancel_url=${encodeURIComponent(ccavenueConfig.cancelUrl)}`,
      `language=EN`,
      `billing_name=${encodeURIComponent(newOrder.shippingAddress.fullName)}`,
      `billing_address=${encodeURIComponent(newOrder.shippingAddress.streetAddress)}`,
      `billing_city=${encodeURIComponent(newOrder.shippingAddress.city)}`,
      `billing_state=${encodeURIComponent(newOrder.shippingAddress.state)}`,
      `billing_zip=${encodeURIComponent(newOrder.shippingAddress.pincode)}`,
      `billing_country=India`,
      `billing_tel=${encodeURIComponent(newOrder.shippingAddress.phoneNumber)}`,
      `billing_email=${encodeURIComponent(req.user.email)}`
    ].join('&');

    // Encrypt the request parameters string using Working Key
    const encRequest = ccavenueCrypto.encrypt(requestParams, ccavenueConfig.workingKey);

    const responseData = {
      success: true,
      paymentUrl: ccavenueConfig.paymentUrl,
      encRequest,
      accessCode: ccavenueConfig.accessCode,
      orderId: newOrder._id
    };

    responseData.simulationUrl = `${process.env.BACKEND_URL || 'http://localhost:5000/api'}/payments/simulate-response?orderId=${newOrder.orderId}&status=Success`;
    responseData.simulationFailureUrl = `${process.env.BACKEND_URL || 'http://localhost:5000/api'}/payments/simulate-response?orderId=${newOrder.orderId}&status=Failure`;

    return res.status(201).json(responseData);
  } catch (err) {
    logger.checkout.error('Unhandled error in CCAvenue createPayment', { userId: req.user?._id, error: err.message });
    next(err);
  }
};

/**
 * Handle CCAvenue payment response
 */
exports.paymentResponse = async (req, res, next) => {
  try {
    const { encResp } = req.body;
    if (!encResp) {
      logger.order.error('CCAvenue Response empty - missing encResp');
      return res.status(400).send('Invalid payment response');
    }

    // Decrypt the CCAvenue response
    const decryptedText = ccavenueCrypto.decrypt(encResp, ccavenueConfig.workingKey);
    const responseObj = queryString.parse(decryptedText);

    const orderId = responseObj.order_id;
    const orderStatus = responseObj.order_status;
    const trackingId = responseObj.tracking_id;
    const bankRefNo = responseObj.bank_ref_no;

    logger.order.info('Decrypted CCAvenue Payment Response', { orderId, orderStatus, trackingId });

    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      logger.order.error(`CCAvenue Order not found for code: ${orderId}`);
      return res.status(404).send('Order not found');
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

    if (orderStatus === 'Success') {
      // Payment Successful
      order.paymentStatus = 'paid';
      order.status = 'Processing';
      order.statusColor = getStatusColor('Processing');
      order.ccavenueTrackingId = trackingId;
      order.bankRefNo = bankRefNo || '';
      order.paymentResponse = responseObj;
      order.transactionDate = new Date();
      await order.save();

      // Set Stock Reservation as paid & processed
      await StockReservation.findOneAndUpdate(
        { orderId: order._id },
        { processed: true, status: 'paid' }
      );

      // Trigger Email Confirmation
      try {
        const user = await User.findById(order.user);
        if (user && user.email) {
          const subject = `p2jmart Order Invoice - ${orderId}`;
          const htmlBody = getOrderConfirmationTemplate(user, order);
          sendEmail({
            to: user.email,
            subject: subject,
            html: htmlBody
          }).catch(mailErr => console.error('Nodemailer backend failure:', mailErr));
        }
      } catch (emailTriggerError) {
        console.error('Failed to trigger email notification:', emailTriggerError);
      }

      logger.order.info(`Order ${orderId} successfully paid via CCAvenue`);
      return res.redirect(`${frontendUrl}/checkout?orderId=${order._id}`);
    } else {
      // Payment Failed / Cancelled / Aborted
      order.paymentStatus = 'failed';
      order.status = 'Cancelled';
      order.statusColor = getStatusColor('Cancelled');
      order.ccavenueTrackingId = trackingId || '';
      order.bankRefNo = bankRefNo || '';
      order.paymentResponse = responseObj;
      await order.save();

      // Restock items immediately
      const reservation = await StockReservation.findOne({ orderId: order._id, processed: false });
      if (reservation) {
        for (const item of reservation.items) {
          const product = await Product.findById(item.productId);
          if (product) {
            const variant = product.variants.find(v => v.id === item.variantId || v._id?.toString() === item.variantId);
            if (variant) {
              variant.stock += item.quantity;
              product.markModified('variants');
              await product.save();
              logger.stock.info(`Restocked product variant due to failed CCAvenue payment`, { product: product.title, variantId: item.variantId, quantity: item.quantity });
            }
          }
        }
        reservation.processed = true;
        reservation.status = 'unpaid';
        await reservation.save();
      }

      logger.order.warn(`Order ${orderId} payment failed/cancelled via CCAvenue. Status: ${orderStatus}`);
      return res.redirect(`${frontendUrl}/checkout?orderId=${order._id}`);
    }
  } catch (err) {
    logger.order.error('Critical error in paymentResponse handling:', err);
    next(err);
  }
};

/**
 * Retrieve status of payment by Order database ID
 */
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.status(200).json({
      success: true,
      paymentStatus: order.paymentStatus,
      status: order.status,
      order: formatOrderResponse(order)
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Simulate CCAvenue Payment Gateway redirect callback locally in development mode
 */
exports.simulateResponse = async (req, res, next) => {
  try {
    const { orderId, status = 'Success' } = req.query;
    if (!orderId) {
      return res.status(400).send('Missing orderId query parameter');
    }

    logger.order.info(`Simulating local payment response for orderId: ${orderId}, status: ${status}`);

    // Construct raw mock text
    const mockResponseText = [
      `order_id=${orderId}`,
      `order_status=${status}`,
      `tracking_id=MOCK-TRK-${Date.now()}`,
      `bank_ref_no=MOCK-BANK-${Date.now()}`,
      `payment_mode=Mock+UPI`,
      `card_name=Mock+Card`
    ].join('&');

    // Encrypt it with working_key
    const encResp = ccavenueCrypto.encrypt(mockResponseText, ccavenueConfig.workingKey);

    // Call the webhook handler directly
    req.body = { encResp };
    return exports.paymentResponse(req, res, next);
  } catch (err) {
    next(err);
  }
};
