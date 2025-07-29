const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    maxlength: 200,
    default: ''
  }
}, {
  timestamps: true
});

// Prevent duplicate friend requests
friendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });

// Static method to check if users are already friends or have pending request
friendRequestSchema.statics.checkExistingRelation = async function(senderId, recipientId) {
  const User = mongoose.model('User');
  
  // Check if they are already friends
  const sender = await User.findById(senderId);
  if (sender.friends.includes(recipientId)) {
    return { type: 'friends', message: 'You are already friends with this user' };
  }
  
  // Check for existing friend request
  const existingRequest = await this.findOne({
    $or: [
      { sender: senderId, recipient: recipientId },
      { sender: recipientId, recipient: senderId }
    ],
    status: 'pending'
  });
  
  if (existingRequest) {
    if (existingRequest.sender.toString() === senderId) {
      return { type: 'sent', message: 'Friend request already sent' };
    } else {
      return { type: 'received', message: 'You have a pending friend request from this user' };
    }
  }
  
  return { type: 'none', message: 'No existing relation' };
};

module.exports = mongoose.model('FriendRequest', friendRequestSchema);

