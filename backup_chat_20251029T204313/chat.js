document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const chatWindow = document.getElementById('chatWindow');
  const chatUser = document.getElementById('chatUser');
  const chatMsg = document.getElementById('chatMsg');
  const chatSend = document.getElementById('chatSend');

  if (!window.room) return;
  socket.emit('joinRoom', window.room);

  socket.on('chatMessage', (data) => {
    const div = document.createElement('div');
    div.textContent = `[${new Date(data.time).toLocaleTimeString()}] ${data.user}: ${data.message}`;
    chatWindow.appendChild(div);
  });

  chatSend.addEventListener('click', () => {
    const user = chatUser.value || 'Anonymous';
    const message = chatMsg.value;
    if (!message) return;
    socket.emit('chatMessage', { room: window.room, user, message });
    chatMsg.value = '';
  });
});
