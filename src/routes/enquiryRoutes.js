const express = require('express');
const router = express.Router();
const {
  createEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateReadStatus,
  deleteEnquiry,
  deleteMultipleEnquiries,
  getEnquiryStats
} = require('../controllers/enquiryController');
const { protectAdmin } = require('../middleware/auth');

router.post('/', createEnquiry);

router.get('/', protectAdmin, getAllEnquiries);

router.get('/stats/overview', protectAdmin, getEnquiryStats);

router.get('/:id', protectAdmin, getEnquiryById);

router.patch('/:id/read', protectAdmin, updateReadStatus);

router.delete('/:id', protectAdmin, deleteEnquiry);

router.post('/delete-multiple', protectAdmin, deleteMultipleEnquiries);

module.exports = router;