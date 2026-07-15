const Enquiry = require('../models/enquiry');
const { sendEmail } = require('../utils/emailHelper');

// @desc    Create a new enquiry
// @route   POST /api/enquiries
// @access  Public
exports.createEnquiry = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate input
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Get IP and user agent for tracking
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Create enquiry
    const enquiry = await Enquiry.create({
      name,
      email,
      phone,
      subject,
      message,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      data: enquiry
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating enquiry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all enquiries (Admin)
// @route   GET /api/admin/enquiries
// @access  Private (Admin only)
exports.getAllEnquiries = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', order = 'desc' } = req.query;

    // Build filter
    let filter = {};
    if (search) {
      filter = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort option
    const sortOption = {};
    sortOption[sortBy] = order === 'asc' ? 1 : -1;

    // Fetch enquiries
    const enquiries = await Enquiry.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Enquiry.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: enquiries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching enquiries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single enquiry by ID
// @route   GET /api/admin/enquiries/:id
// @access  Private (Admin only)
exports.getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: enquiry
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid enquiry ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching enquiry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update enquiry read status
// @route   PATCH /api/admin/enquiries/:id/read
// @access  Private (Admin only)
exports.updateReadStatus = async (req, res) => {
  try {
    const { read } = req.body;

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { read },
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Read status updated successfully',
      data: enquiry
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid enquiry ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating read status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete enquiry by ID
// @route   DELETE /api/admin/enquiries/:id
// @access  Private (Admin only)
exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Enquiry deleted successfully',
      data: {}
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid enquiry ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while deleting enquiry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete multiple enquiries
// @route   POST /api/admin/enquiries/delete-multiple
// @access  Private (Admin only)
exports.deleteMultipleEnquiries = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one enquiry ID'
      });
    }

    const result = await Enquiry.deleteMany({
      _id: { $in: ids }
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} enquiry(ies) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while deleting enquiries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get enquiry statistics (Admin)
// @route   GET /api/admin/enquiries/stats/overview
// @access  Private (Admin only)
exports.getEnquiryStats = async (req, res) => {
  try {
    const totalEnquiries = await Enquiry.countDocuments();
    const unreadEnquiries = await Enquiry.countDocuments({ read: false });
    const readEnquiries = await Enquiry.countDocuments({ read: true });

    // Last 7 days stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7DaysCount = await Enquiry.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        totalEnquiries,
        unreadEnquiries,
        readEnquiries,
        last7DaysCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Reply to an enquiry (Admin)
// @route   POST /api/admin/enquiries/:id/reply
// @access  Private (Admin only)
exports.replyEnquiry = async (req, res) => {
  try {
    const { replyMessage } = req.body;
    if (!replyMessage || replyMessage.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reply message'
      });
    }

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    // Send email to customer
    await sendEmail({
      to: enquiry.email,
      subject: `Re: ${enquiry.subject}`,
      text: replyMessage,
      html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #001e3c; margin-top: 0;">P2J Mart Reply</h2>
        <p>Dear <strong>${enquiry.name}</strong>,</p>
        <p>We received your query regarding <strong>"${enquiry.subject}"</strong>. Here is our response:</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #001e3c; padding: 16px; margin: 20px 0; border-radius: 4px; white-space: pre-wrap; color: #1e293b;">
${replyMessage}
        </div>
        <p style="margin-top: 30px; border-t: 1px solid #e2e8f0; padding-top: 15px; font-size: 13px; color: #64748b;">
          Best Regards,<br/>
          <strong>P2J Mart Team</strong>
        </p>
      </div>`
    });

    // Update enquiry database model
    enquiry.replied = true;
    enquiry.replyMessage = replyMessage;
    enquiry.read = true; // Auto mark as read
    await enquiry.save();

    res.status(200).json({
      success: true,
      message: 'Reply email sent successfully',
      data: enquiry
    });
  } catch (error) {
    console.error('Error replying to enquiry:', error);
    res.status(550).json({
      success: false,
      message: 'Failed to send reply email',
      error: error.message
    });
  }
};