const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

exports.protectAdmin = async (req, res, next) => {
  let token;
  
  // 1. Check for Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // 2. Fallback: Parse token from cookies manually
  if (!token && req.headers.cookie) {
    try {
      const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
        const [key, val] = c.trim().split('=');
        acc[key] = val;
        return acc;
      }, {});
      token = cookies['p2jmart_admin_token'];
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_p2jmart');
    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found'
      });
    }
    
    req.user = admin;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: token invalid or expired'
    });
  }
};
