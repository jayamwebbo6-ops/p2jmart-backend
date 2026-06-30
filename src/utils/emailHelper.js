const nodemailer = require('nodemailer');

// Added 'text' as a fallback parameter or automatically extracted
exports.sendEmail = async ({ to, subject, text = "", html = "", attachments = [] }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true', 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
    to,
    subject,
    text: text, 
    html: html || (text ? `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${text}</pre>` : undefined),
    attachments 
  });
};