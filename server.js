const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/riibah', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/messages', require('./routes/messages'));

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // User joins with their ID
  socket.on('join', (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;
    
    // Notify friends that user is online
    socket.broadcast.emit('user_online', userId);
    console.log(`👤 User ${userId} is now online`);
  });

  // Handle sending messages
  socket.on('send_message', (data) => {
    const { recipientId, message, senderId } = data;
    const recipientSocketId = connectedUsers.get(recipientId);
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_message', {
        senderId,
        message,
        timestamp: new Date()
      });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { recipientId, isTyping } = data;
    const recipientSocketId = connectedUsers.get(recipientId);
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', {
        userId: socket.userId,
        isTyping
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      // Notify friends that user is offline
      socket.broadcast.emit('user_offline', socket.userId);
      console.log(`👤 User ${socket.userId} is now offline`);
    }
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'RiiZaa server is running! 🚀' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RiiZaa server running on port ${PORT}`);
});

