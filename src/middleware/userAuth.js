const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protectUser = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token && req.headers.cookie) {
    try {
      const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
        const [key, val] = c.trim().split('=');
        acc[key] = val;
        return acc;
      }, {});
      token = cookies['p2jmart_token'];
    } catch (e) {
      // Ignore
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this resource'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_p2jmart');
    const user = await User.findById(decoded.id);


    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: token invalid or expired'
    });
  }
};
