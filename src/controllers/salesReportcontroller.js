const Order = require('../models/Order');

/**
 * Sales Report Controller
 * Powers the admin "Sales Analytics" dashboard:
 *  - Stat cards: Total Orders, Gross Sales, GST Collected, Net Sales,
 *    Cancelled Orders, Cancelled Value, Final Income
 *  - "<Range>'s Sales Report" table
 */

const round2 = (num) => Math.round((num || 0) * 100) / 100;

// Resolve the { start, end } date window for a given range option.
// Matches the dropdown values on the frontend: Today, Weekly, Monthly,
// Yearly, Custom Date Range, Product Wise.
const computeDateRange = (range, from, to) => {
  const now = new Date();
  let start;
  let end;

  switch (range) {
    case 'Weekly':
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;

    case 'Monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'Yearly':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    case 'Custom Date Range':
    case 'Custom':
      start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setHours(0, 0, 0, 0);
      end = to ? new Date(to) : new Date();
      end.setHours(23, 59, 59, 999);
      break;

    case 'Today':
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
  }

  return { start, end };
};

// GET /api/sales-report/admin/summary?range=Today&from=&to=
exports.getSalesReport = async (req, res, next) => {
  try {
    const { range = 'Today', from, to } = req.query;
    const { start, end } = computeDateRange(range, from, to);

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
    })
      .select('orderId shippingAddress paymentMethod status items gst total createdAt')
      .sort({ createdAt: -1 })
      .lean();

    let totalOrders = 0;
    let grossSales = 0;
    let gstCollected = 0;
    let cancelledOrders = 0;
    let cancelledValue = 0;

    const rows = orders.map((order) => {
      totalOrders += 1;
      grossSales += order.total || 0;
      gstCollected += order.gst || 0;

      const isCancelled = order.status === 'Cancelled';
      if (isCancelled) {
        cancelledOrders += 1;
        cancelledValue += order.total || 0;
      }

      const itemCount = (order.items || []).reduce(
        (sum, it) => sum + (it.quantity || 0),
        0
      );

      return {
        id: order.orderId,
        customer: order.shippingAddress ? order.shippingAddress.fullName : 'N/A',
        items: itemCount,
        payment: order.paymentMethod,
        status: order.status,
        gst: round2(order.gst),
        amount: round2(order.total),
        createdAt: order.createdAt,
      };
    });

    const netSales = grossSales - cancelledValue;
    const finalIncome = netSales - gstCollected;

    return res.status(200).json({
      success: true,
      data: {
        range,
        from: start,
        to: end,
        stats: {
          totalOrders,
          grossSales: round2(grossSales),
          gstCollected: round2(gstCollected),
          netSales: round2(netSales),
          cancelledOrders,
          cancelledValue: round2(cancelledValue),
          finalIncome: round2(finalIncome),
        },
        rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/sales-report/admin/product-wise?range=Monthly&from=&to=
// Groups sold items by product for the "Product Wise" dropdown option.
exports.getProductWiseSalesReport = async (req, res, next) => {
  try {
    const { range = 'Monthly', from, to } = req.query;
    const { start, end } = computeDateRange(range, from, to);

    const productRows = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          title: { $first: '$items.title' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        range,
        from: start,
        to: end,
        rows: productRows.map((p) => ({
          productId: p._id,
          title: p.title,
          quantitySold: p.quantitySold,
          revenue: round2(p.revenue),
          orders: p.orders,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};