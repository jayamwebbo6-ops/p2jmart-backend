const { sendEmail } = require('../utils/emailHelper');
const { getContactFormTemplate } = require('../utils/emailTemplate'); // Imported template engine
const Enquiry = require('../models/enquiry');

exports.handleContactForm = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Enhanced Validation Check
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, phone, subject, message) are required.'
      });
    }

    const emailSubject = `New Contact Enquiry: ${subject}`;

    // Plain-text fallback for basic email clients
    const emailTextBody = `
You have received a new website message:
Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}
Message: ${message}
    `;

    // 1. Generate the modular HTML using our shared styling framework
    const emailHtmlBody = getContactFormTemplate({ name, email, phone, subject, message });

    // 2. Save enquiry to database so it appears in the admin dashboard
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    await Enquiry.create({
      name,
      email,
      phone,
      subject,
      message,
      ipAddress,
      userAgent
    });

    // 3. Transmit the email notification directly to your platform admin address
    await sendEmail(process.env.EMAIL_FROM_EMAIL, emailSubject, emailTextBody, emailHtmlBody);

    return res.status(200).json({
      success: true,
      message: 'Your enquiry has been sent successfully!'
    });
  } catch (err) {
    next(err);
  }
};