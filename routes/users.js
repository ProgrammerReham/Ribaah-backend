const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/search
// @desc    Search users by username
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    // Search users by username (case-insensitive, partial match)
    const users = await User.find({
      username: { $regex: query.trim(), $options: 'i' },
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('username email avatar bio status lastSeen')
    .limit(20);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username email avatar bio status lastSeen');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/friends/list
// @desc    Get user's friends list
// @access  Private
router.get('/friends/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username email avatar bio status lastSeen');

    res.json({
      success: true,
      friends: user.friends
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/status
// @desc    Update user online status
// @access  Private
router.put('/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['online', 'offline', 'away'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be online, offline, or away'
      });
    }

    req.user.status = status;
    req.user.lastSeen = new Date();
    await req.user.save();

    res.json({
      success: true,
      message: 'Status updated successfully',
      status: req.user.status
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

