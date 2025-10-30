const io = require('socket.io-client');

const SERVER = 'http://localhost:3000';

async function runTest() {
  const userA = { id: 1001, name: 'Alice' };
  const userB = { id: 2002, name: 'Bob' };
  const a = Math.min(userA.id, userB.id);
  const b = Math.max(userA.id, userB.id);
  const room = `chat_${a}_${b}`;

  const socketA = io(SERVER, { transports: ['websocket'] });
  const socketB = io(SERVER, { transports: ['websocket'] });

  socketA.on('connect', () => {
    console.log('A connected', socketA.id);
    socketA.emit('registerUser', userA.id);
    // join room as sender
    socketA.emit('joinRoom', room);
  });

  socketB.on('connect', () => {
    console.log('B connected', socketB.id);
    socketB.emit('registerUser', userB.id);
    // do NOT join room to simulate recipient on other page
  });

  socketA.on('chatMessage', (data) => {
    console.log('A received chatMessage:', data);
  });
  socketB.on('chatMessage', (data) => {
    console.log('B received chatMessage:', data);
  });

  socketA.on('newMessage', (data) => {
    console.log('A received newMessage:', data);
  });
  socketB.on('newMessage', (data) => {
    console.log('B received newMessage (notification):', data);
  });

  // wait a bit then have A send a message
  setTimeout(() => {
    const msg = 'Hello Bob! This is a test message from Alice.';
    console.log('A sending message to room', room);
    socketA.emit('chatMessage', { room, user: userA.name, userId: userA.id, message: msg });
  }, 800);

  // wait longer then close
  setTimeout(() => {
    console.log('Test complete, closing sockets.');
    socketA.close();
    socketB.close();
    process.exit(0);
  }, 3000);
}

runTest().catch(err => { console.error(err); process.exit(1); });
