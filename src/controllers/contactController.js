const { sendEmail } = require('../utils/emailHelper');

exports.handleContactForm = async (req, res, next) => {
  try {
    // Extracted all 5 fields coming from your React frontend state map
    const { name, email, phone, subject, message } = req.body;

    // Enhanced Validation Check
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, phone, subject, message) are required.'
      });
    }

    const emailSubject = `New Contact Enquiry: ${subject}`;

    // Plain-text fallback for email clients that don't render HTML
    const emailTextBody = `
You have received a new message from your website contact form:

--------------------------------------------------
Sender Details
--------------------------------------------------
Name:    ${name}
Email:   ${email}
Phone:   ${phone}

--------------------------------------------------
Message Content
--------------------------------------------------
Subject: ${subject}

${message}
--------------------------------------------------
    `;

    // Attractive HTML version of the same notification
    const emailHtmlBody = `
     <div style="background:#eef2f7; padding: 32px 16px; font-family: 'Segoe UI', Arial, sans-serif;">
        <div style="max-width: 580px; margin: 0 auto; background:#ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(15,40,80,0.08); border: 1px solid #e2e8f0;">
 
          <!-- Header bar -->
          <div style="background:#0f3a66; padding: 22px 32px;">
            <table style="width:100%;">
              <tr>
                <td style="color:#ffffff; font-size: 18px; font-weight: 700; letter-spacing: 0.3px;">P2J Mart</td>
                <td style="text-align:right; color:#9fc1e0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Contact Form</td>
              </tr>
            </table>
          </div>
 
          <!-- Title strip -->
          <div style="background:#156cb4; padding: 16px 32px;">
            <h1 style="margin:0; color:#ffffff; font-size: 17px; font-weight: 600;">New Customer Enquiry Received</h1>
          </div>
 
          <!-- Subject highlight -->
          <div style="padding: 24px 32px 0;">
            <span style="display:inline-block; background:#e8f1fb; color:#0f3a66; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 4px; border: 1px solid #bcdcfa; text-transform: uppercase; letter-spacing: 0.5px;">
              ${subject}
            </span>
          </div>
 
          <!-- Sender details -->
          <div style="padding: 20px 32px 4px;">
            <table style="width:100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e8edf3; color:#64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; width: 90px; vertical-align: top;">Name</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e8edf3; color:#0f2540; font-size: 14px; font-weight: 600;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e8edf3; color:#64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; vertical-align: top;">Email</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e8edf3; color:#0f2540; font-size: 14px;">
                  <a href="mailto:${email}" style="color:#156cb4; text-decoration:none; font-weight: 600;">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e8edf3; color:#64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; vertical-align: top;">Phone</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e8edf3; color:#0f2540; font-size: 14px;">
                  <a href="tel:${phone}" style="color:#156cb4; text-decoration:none; font-weight: 600;">${phone}</a>
                </td>
              </tr>
            </table>
          </div>
 
          <!-- Message -->
          <div style="padding: 12px 32px 28px;">
            <p style="margin: 16px 0 8px; color:#64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Message</p>
            <div style="background:#f5f8fb; border: 1px solid #e2e8f0; border-left: 3px solid #156cb4; border-radius: 6px; padding: 16px 18px; color:#1e2a3a; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
          </div>
 
          <!-- CTA -->
          <div style="padding: 0 32px 32px;">
            <a href="mailto:${email}" style="display:inline-block; background:#156cb4; color:#ffffff; text-decoration:none; font-size: 14px; font-weight: 700; padding: 12px 26px; border-radius: 6px;">
              Reply to ${name}
            </a>
          </div>
 
          <!-- Footer -->
          <div style="background:#f5f8fb; padding: 18px 32px; border-top: 1px solid #e2e8f0;">
            <p style="margin:0; color:#64748b; font-size: 11px;">This message was sent from the contact form on your P2J Mart website. Please do not reply directly to this notification — use the button above to respond to the customer.</p>
          </div>
 
        </div>
      </div>
    `;

    // Sends notification direct to your inbox (HTML with plain-text fallback)
    await sendEmail(process.env.EMAIL_FROM_EMAIL, emailSubject, emailTextBody, emailHtmlBody);

    return res.status(200).json({
      success: true,
      message: 'Your enquiry has been sent successfully!'
    });
  } catch (err) {
    next(err);
  }
};