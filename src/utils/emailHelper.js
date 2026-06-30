const nodemailer = require('nodemailer');

// Added 'attachments = []' as the 5th parameter with a default empty array fallback
exports.sendEmail = async (to, subject, text, html, attachments = []) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // Converts "false" string to boolean false
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html: html || `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${text}</pre>`,
    attachments 
  });
};