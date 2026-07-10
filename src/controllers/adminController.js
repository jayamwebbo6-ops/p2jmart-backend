const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { saveBase64Image, getImageUrl, deleteImageFile } = require('../utils/imageHelper');
const crypto = require('crypto');
const { getForgotPasswordTemplate } = require('../utils/emailTemplate');
const { sendEmail } = require('../utils/emailHelper');

// Admin Login
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username/email and password'
      });
    }

    // Try to find the admin by email or username
    const admin = await Admin.findOne({
      $or: [
        { email: username.toLowerCase() },
        { username: username }
      ]
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET || 'jwt_secret_p2jmart',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      data: {
        username: admin.username,
        email: admin.email,
        photo: getImageUrl(admin.photo),
        role: admin.role
      }
    });
  } catch (err) {
    next(err);
  }
};



exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'No admin found with that email' });
    }

    // Cooldown verification (1 minute)
    if (admin.lastOtpSentAt && (Date.now() - new Date(admin.lastOtpSentAt).getTime() < 60000)) {
      const secondsLeft = Math.ceil((60000 - (Date.now() - new Date(admin.lastOtpSentAt).getTime())) / 1000);
      return res.status(429).json({ 
        success: false, 
        message: `Please wait ${secondsLeft} seconds before requesting a new OTP.` 
      });
    }

    // 1. Generate 6 digit numeric code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Save code details directly to the database document
    admin.resetOtp = otp;
    admin.resetOtpExpire = Date.now() + 1 * 60 * 1000; // 1 Minute window
    admin.lastOtpSentAt = new Date();
    await admin.save();

    // 3. Compile the structural HTML layout using the reusable function
    const htmlBody = getForgotPasswordTemplate(otp);

    // 4. Send email using your core transporter configuration
    await sendEmail({
      to: admin.email,
      subject: 'Admin Portal - Password Reset OTP',
      text: `Your password reset OTP is: ${otp}. It is valid for 1 minute.`,
      html: htmlBody
    });

    return res.status(200).json({ 
      success: true, 
      message: 'OTP sent safely to your administration email.' 
    });

  } catch (err) {
    // Clean up DB values if failure points occur post-generation
    next(err);
  }
};



exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Find admin by email, match OTP, and check if OTP has not expired
    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
      resetOtp: otp.trim(),
      resetOtpExpire: { $gt: Date.now() } 
    });

    if (!admin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP code.' 
      });
    }

    // Set the new password 
    // (Ensure your schema hashes this pre-save, or hash it here manually using bcrypt)
    admin.password = newPassword;

    // Clear OTP fields so they can't be reused
    admin.resetOtp = undefined;
    admin.resetOtpExpire = undefined;
    
    await admin.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Password reset successfully!' 
    });

  } catch (err) {
    console.error("🔴 Reset Password Controller Error:", err);
    next(err);
  }
};


// Get profile
exports.getProfile = async (req, res, next) => {
  try {
    let admin = await Admin.findOne();
    if (!admin) {
      // Seed default admin if none exists
      admin = await Admin.create({
        username: 'admin',
        email: 'admin@p2jmart.com',
        password: 'admin@123',
        photo: '',
        role: 'Administrator'
      });
    }
    
    // Return admin without password
    const adminData = {
      username: admin.username,
      email: admin.email,
      photo: getImageUrl(admin.photo),
      role: admin.role
    };
    
    return res.status(200).json({
      success: true,
      data: adminData
    });
  } catch (err) {
    next(err);
  }
};





// Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email, photo, currentPassword, newPassword } = req.body;
    
    let admin = await Admin.findOne();
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found'
      });
    }
    
    // If updating password
    if (currentPassword && newPassword) {
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect current password'
        });
      }
      admin.password = newPassword;
    }
    
    // Update other fields
    if (username) admin.username = username;
    if (email) admin.email = email;
    if (photo !== undefined) {
      if (photo && photo.startsWith('data:image')) {
        if (admin.photo && !admin.photo.startsWith('http')) {
          deleteImageFile(admin.photo);
        }
        admin.photo = saveBase64Image(photo, 'avathar', 'avatar');
      } else if (!photo) {
        if (admin.photo && !admin.photo.startsWith('http')) {
          deleteImageFile(admin.photo);
        }
        admin.photo = '';
      }
    }
    
    await admin.save();
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        username: admin.username,
        email: admin.email,
        photo: getImageUrl(admin.photo),
        role: admin.role
      }
    });
  } catch (err) {
    next(err);
  }
};



// Import your Admin model here if not already imported at the top of the file
// const Admin = require('../models/Admin'); 

exports.getAdminEmailPublic = async (req, res) => {
  try {
    // Find the single administrator record and strictly return only the email field
    const admin = await Admin.findOne({ role: "Administrator" }).select('email');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "No administrator record found in the database."
      });
    }

    return res.status(200).json({
      success: true,
      email: admin.email
    });
  } catch (error) {
    console.error("Error inside getAdminEmailPublic:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server database configuration sync error."
    });
  }
};