const express = require('express');
const router = express.Router();
const {
  createEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateReadStatus,
  deleteEnquiry,
  deleteMultipleEnquiries,
  getEnquiryStats,
  replyEnquiry
} = require('../controllers/enquiryController');
const { protectAdmin } = require('../middleware/auth');

router.post('/', createEnquiry);

router.get('/', protectAdmin, getAllEnquiries);

router.get('/stats/overview', protectAdmin, getEnquiryStats);

router.get('/:id', protectAdmin, getEnquiryById);

router.patch('/:id/read', protectAdmin, updateReadStatus);

router.delete('/:id', protectAdmin, deleteEnquiry);

router.post('/delete-multiple', protectAdmin, deleteMultipleEnquiries);

router.post('/:id/reply', protectAdmin, replyEnquiry);

module.exports = router;