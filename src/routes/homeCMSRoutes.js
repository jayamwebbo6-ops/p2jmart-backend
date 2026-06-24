const express = require('express');
const router = express.Router();
const homeCMSController = require('../controllers/homeCMSController');
const { protectAdmin } = require('../middleware/auth');

router.get('/', homeCMSController.getHomeCMS);
router.post('/', protectAdmin, homeCMSController.updateHomeCMS);

module.exports = router;
