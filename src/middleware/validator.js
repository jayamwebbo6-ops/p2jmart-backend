const { body, validationResult } = require('express-validator');

// Validation rules for User Profile Updates
exports.validateUserProfile = [
  body('phone')
    .optional({ checkFalsy: true })
    .isNumeric().withMessage('Phone number must contain only digits')
    .isLength({ min: 10, max: 10 }).withMessage('Phone number must be exactly 10 digits'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation rules for Admin Profile Updates
exports.validateAdminProfile = [
  body('username')
    .optional()
    .trim()
    .notEmpty().withMessage('Username cannot be empty'),
  body('email')
    .optional()
    .isEmail().withMessage('Please provide a valid email address'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }
    next();
  }
];
