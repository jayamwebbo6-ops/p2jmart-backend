const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// Changing this to '/' means it will map exactly to the base path prefix
router.post('/', contactController.handleContactForm);

module.exports = router;