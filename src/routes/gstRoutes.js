const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');

const { protectAdmin } = require('../middleware/auth');



router.post('/create-gst', gstController.createGst);
router.put('/update-gst/:id', protectAdmin, gstController.updateGst);
router.put('/delete-gst/:id', protectAdmin,  gstController.deleteGst);
router.get('/getAll-gst', protectAdmin, gstController.getAllGst);

module.exports = router;