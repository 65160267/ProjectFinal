const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const { pool } = require('./db');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

// middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: true,
}));

// simple Socket.IO chat namespace for book rooms
io.on('connection', (socket) => {
  socket.on('joinRoom', (room) => {
    socket.join(room);
  });
  socket.on('chatMessage', ({ room, user, message }) => {
    io.to(room).emit('chatMessage', { user, message, time: new Date() });
  });
});

// routes (will be created)
const indexRoutes = require('./routes/indexRoutes');
const bookRoutes = require('./routes/bookRoutes');
const authRoutes = require('./routes/authRoutes');

app.use('/', indexRoutes);
app.use('/books', bookRoutes);
app.use('/auth', authRoutes);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = { app, server, io };
