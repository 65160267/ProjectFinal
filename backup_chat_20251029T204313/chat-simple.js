(function(){
  const socket = io();
  const me = window.__ME__ || null;
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function buildRoom(a,b){ a = Number(a); b = Number(b); if (isNaN(a)||isNaN(b)) return null; const x = Math.min(a,b); const y = Math.max(a,b); return `chat_${x}_${y}`; }
  let currentRoom = null;
  const chatWindow = document.getElementById('chatWindow');
  const otherIdInput = document.getElementById('otherId');
  const openBtn = document.getElementById('openBtn');
  const sendBtn = document.getElementById('sendBtn');
  const msgInput = document.getElementById('msgInput');
  const otherAvatar = document.getElementById('otherAvatar');
  const otherName = document.getElementById('otherName');
  const otherInfo = document.getElementById('otherInfo');

  function appendMessage(msg, isMe){
    const el = document.createElement('div'); el.className = 'msg ' + (isMe? 'me':'other'); el.innerHTML = escapeHtml(msg);
    chatWindow.appendChild(el); chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  async function loadMessages(room){
    try{
      const r = await fetch('/api/chat/' + encodeURIComponent(room) + '/messages?limit=500');
      if (!r.ok) return [];
      const data = await r.json();
      chatWindow.innerHTML = '';
      data.forEach(m=>{
        const isMe = me && m.user_id && me.userId && Number(m.user_id) === Number(me.userId);
        appendMessage((m.username? (m.username + ': '):'') + m.message, isMe);
      });
      return data;
    }catch(e){ console.error('loadMessages', e); return []; }
  }

  async function setRoomByOther(otherId){
    if (!me || !me.userId) return alert('Please login');
    const room = buildRoom(me.userId, otherId);
    if (!room) return alert('Invalid id');
    currentRoom = room;
    try{ socket.emit('joinRoom', room); }catch(e){}
    const msgs = await loadMessages(room);
    // try fetch user info
    try{
      const res = await fetch('/api/users/' + encodeURIComponent(otherId));
      if (res.ok){ const u = await res.json(); otherAvatar.src = u.avatar || '/images/profile-placeholder.svg'; otherName.textContent = u.full_name || u.username || ('User '+otherId); otherInfo.textContent = u.username || ''; }
    }catch(e){}
    msgInput.focus();
  }

  openBtn.addEventListener('click', function(){ const other = otherIdInput.value && otherIdInput.value.trim(); if (!other) return; setRoomByOther(other); });
  sendBtn.addEventListener('click', function(){ const txt = msgInput.value && msgInput.value.trim(); if (!txt || !currentRoom) return; const payload = { room: currentRoom, user: (me && me.username)||'User', userId: me && me.userId, message: txt }; appendMessage((me && me.username?me.username:'You')+': '+txt, true); try{ socket.emit('chatMessage', payload); }catch(e){}; msgInput.value = ''; msgInput.focus(); });

  socket.on('chatMessage', function(m){ try{ if (!m || !m.room) return; if (currentRoom && m.room !== currentRoom) return; const isMe = me && m.userId && Number(m.userId) === Number(me.userId); appendMessage((m.user? (m.user+': '):'') + m.message, isMe); }catch(e){console.error(e)} });

  // optionally auto-open ?open= param
  (function(){ const params = new URLSearchParams(window.location.search); const open = params.get('open'); if (open && me && me.userId) { otherIdInput.value = open; setRoomByOther(open); } })();
})();
