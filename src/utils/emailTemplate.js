/**
 * Generates a clean HTML confirmation template for orders
 * @param {Object} user - The user document from MongoDB
 * @param {Object} order - The created order document from MongoDB
 */
exports.getOrderConfirmationTemplate = (user, order) => {
  // Map out items list into clean HTML rows
  const itemsListHtml = order.items.map(item => `
    <tr style="border-bottom: 1px solid #edf2f7;">
      <td style="padding: 12px 0; font-size: 14px; color: #2d3748; text-align: left;">
        <strong>${item.title}</strong>
        ${item.isComboProduct ? '<br/><span style="font-size: 11px; color: #059669; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">✨ Combo Bundle</span>' : ''}
      </td>
      <td style="padding: 12px 0; font-size: 14px; color: #4a5568; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 0; font-size: 14px; color: #2d3748; text-align: right;">₹${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #333; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
        <h1 style="color: #10b981; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">p2jmart</h1>
        <h2 style="color: #1e293b; margin: 0 0 4px 0; font-size: 20px;">Order Confirmed! 🎉</h2>
        <p style="font-size: 15px; color: #64748b; margin: 0;">Thank you for your purchase, <strong>${user.name}</strong>.</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #edf2f7; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-size: 14px; color: #64748b;"><strong>Order ID:</strong></td>
            <td style="padding: 4px 0; font-size: 14px; color: #0f172a; text-align: right; font-family: monospace; font-weight: 600;">${order.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 14px; color: #64748b;"><strong>Payment Method:</strong></td>
            <td style="padding: 4px 0; font-size: 14px; color: #0f172a; text-align: right; text-transform: uppercase;">${order.paymentMethod}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 14px; color: #64748b;"><strong>Status:</strong></td>
            <td style="padding: 4px 0; font-size: 14px; color: #2563eb; text-align: right; font-weight: 700;">${order.status}</td>
          </tr>
        </table>
      </div>

      <h3 style="font-size: 16px; color: #1e293b; margin: 0 0 12px 0; font-weight: 600;">Items Purchased</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="border-bottom: 2px solid #edf2f7;">
            <th style="padding-bottom: 8px; font-size: 13px; color: #94a3b8; text-align: left; font-weight: 600;">Description</th>
            <th style="padding-bottom: 8px; font-size: 13px; color: #94a3b8; text-align: center; font-weight: 600; width: 60px;">Qty</th>
            <th style="padding-bottom: 8px; font-size: 13px; color: #94a3b8; text-align: right; font-weight: 600; width: 90px;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsListHtml}
        </tbody>
      </table>

      <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #edf2f7;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Subtotal:</td>
            <td style="padding: 4px 0; color: #1e293b; text-align: right; font-weight: 500;">₹${order.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">GST:</td>
            <td style="padding: 4px 0; color: #1e293b; text-align: right; font-weight: 500;">₹${order.gst.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom: 1px dashed #e2e8f0;">
            <td style="padding: 4px 0; color: #64748b; padding-bottom: 10px;">Shipping Fee:</td>
            <td style="padding: 4px 0; color: #1e293b; text-align: right; font-weight: 500; padding-bottom: 10px;">
              ${order.shippingFee === 0 ? '<span style="color: #16a34a; font-weight: 600;">FREE</span>' : `₹${order.shippingFee.toFixed(2)}`}
            </td>
          </tr>
          <tr>
            <td style="padding-top: 12px; font-size: 16px; font-weight: 700; color: #1e293b;">Total Paid:</td>
            <td style="padding-top: 12px; font-size: 18px; font-weight: 700; color: #10b981; text-align: right;">₹${order.total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; font-size: 14px; margin-bottom: 24px; background-color: #ffffff;">
        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Destination</h4>
        <p style="margin: 0 0 4px 0; font-weight: 600; color: #0f172a; text-transform: capitalize;">${order.shippingAddress.fullName}</p>
        <p style="margin: 0 0 2px 0; color: #475569; line-height: 1.4;">${order.shippingAddress.streetAddress}${order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''}</p>
        <p style="margin: 0 0 8px 0; color: #475569;">${order.shippingAddress.city}, ${order.shippingAddress.state} - <strong>${order.shippingAddress.pincode}</strong></p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">📞 Phone: <span style="color: #1e293b; font-weight: 500;">${order.shippingAddress.phoneNumber}</span></p>
      </div>

      <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 8px;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 0;">This is an automated transaction invoice issued by p2jmart.</p>
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">If you have questions, please reach out to our customer support desk.</p>
      </div>

    </div>
  `;
};

/**
 * Generates an administrative template for incoming contact form enquiries
 * @param {Object} data - Form metadata context mapping { name, email, phone, subject, message }
 */
exports.getContactFormTemplate = (data) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #333; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
        <h1 style="color: #10b981; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">p2jmart</h1>
        <h2 style="color: #1e293b; margin: 0 0 4px 0; font-size: 20px;">New Contact Enquiry Received ✉️</h2>
        <p style="font-size: 15px; color: #64748b; margin: 0;">A customer has reached out via the website contact portal.</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #edf2f7; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-size: 14px; color: #64748b;"><strong>Enquiry Subject:</strong></td>
            <td style="padding: 4px 0; font-size: 14px; color: #0f172a; text-align: right; font-weight: 600;">${data.subject}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 14px; color: #64748b;"><strong>Received Date:</strong></td>
            <td style="padding: 4px 0; font-size: 14px; color: #0f172a; text-align: right;">${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
          </tr>
        </table>
      </div>

      <h3 style="font-size: 16px; color: #1e293b; margin: 0 0 12px 0; font-weight: 600;">Sender Information</h3>
      <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #edf2f7;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 8px 0; color: #64748b;">Full Name:</td>
            <td style="padding: 8px 0; color: #1e293b; text-align: right; font-weight: 600; text-transform: capitalize;">${data.name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 8px 0; color: #64748b;">Email Address:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">
              <a href="mailto:${data.email}" style="color: #10b981; text-decoration: none;">${data.email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Phone Line:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">
              <a href="tel:${data.phone}" style="color: #2563eb; text-decoration: none;">${data.phone}</a>
            </td>
          </tr>
        </table>
      </div>

      <div style="border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; font-size: 14px; margin-bottom: 24px; background-color: #ffffff;">
        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Customer Message</h4>
        <div style="color: #475569; line-height: 1.6; white-space: pre-wrap; background-color: #fafafa; padding: 12px; border-radius: 8px; border-left: 4px solid #10b981;">${data.message}</div>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="mailto:${data.email}?subject=Re: ${data.subject}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
          Quick Reply to Client
        </a>
      </div>

      <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 8px;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 0;">This transmission was dispatched by the automated system hook on p2jmart.</p>
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Please use the quick reply system to converse with the client directly.</p>
      </div>

    </div>
  `;
};


exports.getCancellationTemplate = (order) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #333; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
        <h1 style="color: #ef4444; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">p2jmart</h1>
        <h2 style="color: #1e293b; margin: 0 0 4px 0; font-size: 20px;">Order Cancellation Confirmed </h2>
        <p style="font-size: 15px; color: #64748b; margin: 0;">Your cancellation request has been reviewed and approved.</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #edf2f7; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-size: 14px; color: #64748b;"><strong>Order Reference ID:</strong></td>
            <td style="padding: 4px 0; font-size: 14px; color: #0f172a; text-align: right; font-weight: 600;">#${order.orderId || order._id}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 14px; color: #64748b;"><strong>Total Amount:</strong></td>
            <td style="padding: 4px 0; font-size: 14px; color: #0f172a; text-align: right; font-weight: 600; color: #ef4444;">₹${order.total}</td>
          </tr>
        </table>
      </div>

      <div style="border: 1px solid #fca5a5; padding: 16px; border-radius: 12px; font-size: 15px; margin-bottom: 24px; background-color: #fef2f2;">
        <h4 style="margin: 0 0 6px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Important Notice Regarding Refund</h4>
        <p style="color: #b91c1c; margin: 0; line-height: 1.5;">Within 2 to 3 working days your order's payment will be refunded to you.</p>
      </div>

      <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 8px;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 0;">Thank you for your patience. If you have any further questions, please reply directly to this mail.</p>
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">© ${new Date().getFullYear()} p2jmart. All rights reserved.</p>
      </div>

    </div>
  `;
};


/**
 * Generates an HTML confirmation template for forgot password OTP verifications
 * @param {String} otp - The 6-digit random numeric verification token
 */
exports.getForgotPasswordTemplate = (otp) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #333; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
        <h1 style="color: #10b981; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">p2jmart</h1>
        <h2 style="color: #1e293b; margin: 0 0 4px 0; font-size: 20px;">Password Reset Request 🔑</h2>
        <p style="font-size: 15px; color: #64748b; margin: 0;">Security Verification Code</p>
      </div>

      <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; font-size: 14px; margin-bottom: 24px; background-color: #ffffff; line-height: 1.6;">
        <p style="margin: 0 0 12px 0; color: #475569;">We received a request to reset the password for your Admin Portal account.</p>
        <p style="margin: 0 0 20px 0; color: #475569;">Use the following One-Time Password (OTP) to proceed. This code is valid for <strong>1 minute</strong>:</p>
        
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 16px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #10b981; margin: 16px 0; border-radius: 8px; font-family: monospace;">
          ${otp}
        </div>
      </div>

      <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 8px;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 0;">If you did not request a password change, please ignore this email or change your security credentials immediately.</p>
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">This transmission was dispatched by the automated security hook on p2jmart.</p>
      </div>

    </div>
  `;
};

/**
 * Generates an HTML confirmation template for user login OTP verification
 * @param {String} otp - The 6-digit random numeric verification token
 */
exports.getUserLoginOTPTemplate = (otp) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #333; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
        <h1 style="color: #003147; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">P2J Mart</h1>
        <h2 style="color: #1e293b; margin: 0 0 4px 0; font-size: 20px;">Verification Code 🔑</h2>
        <p style="font-size: 15px; color: #64748b; margin: 0;">Your One-Time Password for secure login</p>
      </div>

      <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; font-size: 14px; margin-bottom: 24px; background-color: #ffffff; line-height: 1.6;">
        <p style="margin: 0 0 12px 0; color: #475569;">Hello,</p>
        <p style="margin: 0 0 12px 0; color: #475569;">To complete your sign-in, please use the 6-digit verification code below. This code is valid for exactly <strong>1 minute</strong> and is active for one-time use:</p>
        
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 16px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #003147; margin: 20px 0; border-radius: 12px; font-family: monospace;">
          ${otp}
        </div>

        <p style="margin: 20px 0 0 0; color: #ef4444; font-size: 12px; font-weight: 600; text-align: center;">
          ⚠️ For security reasons, do not share this code with anyone.
        </p>
      </div>

      <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 8px;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 0;">If you did not request this code, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">This transmission was dispatched by the automated security hook on P2J Mart.</p>
      </div>

    </div>
  `;
};