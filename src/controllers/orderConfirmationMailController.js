const User = require('../models/User'); // Adjust path to your User schema
const { sendEmail } = require('../utils/emailHelper'); // Adjust path to your nodemailer utility

exports.sendOrderConfirmation = async (req, res) => {
  try {
    // 1. Fetch user data using req.user.id (provided by your auth middleware)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { orderId, totalAmount, items } = req.body;

    // 2. Draft email body contents
    const subject = `Order Confirmed! Code: ${orderId || 'N/A'}`;
    const text = `Hi ${user.name},\n\nYour payment was successful and your order has been placed.\nOrder ID: ${orderId}\nTotal: ${totalAmount}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #333;">
        <h2 style="color: #10b981; margin-bottom: 4px;">Payment Successful! 🎉</h2>
        <p style="font-size: 16px; margin-top: 0;">Thank you for your purchase, <strong>${user.name}</strong>.</p>
        
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Order ID:</strong> ${orderId || 'N/A'}</p>
          <p style="margin: 0 0 8px 0;"><strong>Total Paid:</strong> ${totalAmount || 'N/A'}</p>
          ${items ? `<p style="margin: 0;"><strong>Items:</strong> ${items.join(', ')}</p>` : ''}
        </div>

        <p style="font-size: 12px; color: #64748b;">This is an automated confirmation for your transaction with p2jmart.</p>
      </div>
    `;

    // 3. Send email to user's registered address (e.g., jayamweb.designer2@gmail.com)
    await sendEmail(user.email, subject, text, html);

    return res.status(200).json({
      success: true,
      message: 'Order confirmation email dispatched successfully.'
    });

  } catch (error) {
    console.error('Error in order confirmation controller:', error);
    return res.status(500).json({ success: false, message: 'Internal server error processing email.' });
  }
};