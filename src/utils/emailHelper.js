const nodemailer = require('nodemailer');

// Added 'text' as a fallback parameter or automatically extracted
exports.sendEmail = async (args, second, third, fourth) => {
  let to, subject, text = "", html = "", attachments = [];

  if (args && typeof args === 'object' && !Array.isArray(args)) {
    // Object destructuring style: sendEmail({ to, subject, text, html, attachments })
    to = args.to;
    subject = args.subject;
    text = args.text || "";
    html = args.html || "";
    attachments = args.attachments || [];
  } else {
    // Positional arguments style: sendEmail(to, subject, text, html)
    to = args;
    subject = second;
    text = third || "";
    html = fourth || "";
  }

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