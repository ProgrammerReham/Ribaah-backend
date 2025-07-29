const express = require('express');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/friends/request
// @desc    Send friend request
// @access  Private
router.post('/request', auth, async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    const senderId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required'
      });
    }

    if (senderId.toString() === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a friend request to yourself'
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check existing relation
    const existingRelation = await FriendRequest.checkExistingRelation(senderId, recipientId);
    if (existingRelation.type !== 'none') {
      return res.status(400).json({
        success: false,
        message: existingRelation.message
      });
    }

    // Create friend request
    const friendRequest = new FriendRequest({
      sender: senderId,
      recipient: recipientId,
      message: message || ''
    });

    await friendRequest.save();

    // Populate sender info for response
    await friendRequest.populate('sender', 'username avatar');

    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      friendRequest
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/friends/requests/received
// @desc    Get received friend requests
// @access  Private
router.get('/requests/received', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      recipient: req.user._id,
      status: 'pending'
    })
    .populate('sender', 'username avatar bio')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Get received requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/friends/requests/sent
// @desc    Get sent friend requests
// @access  Private
router.get('/requests/sent', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      sender: req.user._id,
      status: 'pending'
    })
    .populate('recipient', 'username avatar bio')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/friends/request/:id/accept
// @desc    Accept friend request
// @access  Private
router.put('/request/:id/accept', auth, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user._id;

    // Find the friend request
    const friendRequest = await FriendRequest.findOne({
      _id: requestId,
      recipient: userId,
      status: 'pending'
    });

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Update friend request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Add each user to the other's friends list
    await User.findByIdAndUpdate(userId, {
      $addToSet: { friends: friendRequest.sender }
    });

    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: userId }
    });

    // Populate sender info for response
    await friendRequest.populate('sender', 'username avatar bio');

    res.json({
      success: true,
      message: 'Friend request accepted',
      friendRequest
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/friends/request/:id/reject
// @desc    Reject friend request
// @access  Private
router.put('/request/:id/reject', auth, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user._id;

    // Find and update the friend request
    const friendRequest = await FriendRequest.findOneAndUpdate(
      {
        _id: requestId,
        recipient: userId,
        status: 'pending'
      },
      { status: 'rejected' },
      { new: true }
    ).populate('sender', 'username avatar bio');

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    res.json({
      success: true,
      message: 'Friend request rejected',
      friendRequest
    });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/friends/:friendId
// @desc    Remove friend
// @access  Private
router.delete('/:friendId', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const friendId = req.params.friendId;

    // Check if they are actually friends
    const user = await User.findById(userId);
    if (!user.friends.includes(friendId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not friends with this user'
      });
    }

    // Remove from both users' friends lists
    await User.findByIdAndUpdate(userId, {
      $pull: { friends: friendId }
    });

    await User.findByIdAndUpdate(friendId, {
      $pull: { friends: userId }
    });

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

