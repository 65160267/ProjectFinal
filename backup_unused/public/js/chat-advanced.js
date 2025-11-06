(function(){
  const socket = io();
  const me = window.__ME__ || null;
  if (me && me.userId) {
    try { socket.emit('registerUser', me.userId); } catch(e){}
  }

  function buildRoomFor(otherId){
    const a = Math.min(me.userId, otherId);
    const b = Math.max(me.userId, otherId);
    return `chat_${a}_${b}`;
  }

  function getQueryParam(name){
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  let currentRoom = null;
  let typingTimeout = null;

  async function loadMessages(room){
    try{
      const r = await fetch(`/api/chat/${encodeURIComponent(room)}/messages?limit=500`);
      if (!r.ok) return;
      const msgs = await r.json();
      const cw = document.getElementById('chatWindow'); if (!cw) return;
      cw.innerHTML = '';
      msgs.forEach(m => {
        const d = document.createElement('div');
        d.className = 'message '+(m.user_id === me.userId ? 'me' : 'other');
        d.dataset.msgId = m.id;
        d.innerHTML = `<div style="font-weight:700">${m.username||''}</div><div>${m.message}</div><div style="font-size:12px;color:#666">${new Date(m.created_at).toLocaleString()}</div>`;
        cw.appendChild(d);
      });
      cw.scrollTop = cw.scrollHeight;
    } catch (e) { console.error('loadMessages', e); }
  }

  function setRoom(room){
    if (!room) return;
    if (currentRoom === room) return;
    currentRoom = room;
    try{ socket.emit('joinRoom', room); } catch(e){}
    loadMessages(room);
    const header = document.getElementById('chatHeader'); if (header) header.textContent = 'ห้อง: ' + room;
  }

  // attach click handlers on conversation links
  document.addEventListener('click', function(ev){
    const a = ev.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.indexOf('/messages-advanced?open=') === 0){
      ev.preventDefault();
      const param = href.split('=')[1];
      if (!param) return;
      // param is room in advanced links
      setRoom(param);
      history.replaceState({}, '', '/messages-advanced?open=' + encodeURIComponent(param));
    }
  });

  // load from query param if present
  (function(){
    const open = getQueryParam('open');
    if (open && me && me.userId){
      // open is room already
      setRoom(open);
    }
  })();

  // sending
  const sendBtn = document.getElementById('sendBtn');
  const input = document.getElementById('msgInput');
  if (sendBtn && input) {
    sendBtn.addEventListener('click', function(){
      const text = input.value && input.value.trim();
      if (!text || !currentRoom) return;
      const payload = { room: currentRoom, user: (me && me.username) || 'User', userId: me && me.userId, message: text };
      // optimistic append
      const cw = document.getElementById('chatWindow');
      if (cw){
        const el = document.createElement('div'); el.className = 'message me'; el.dataset.msgId = ''; el.innerHTML = `<div style="font-weight:700">${payload.user}</div><div>${payload.message}</div><div style="font-size:12px;color:#666">(ส่งแล้ว)</div>`; cw.appendChild(el); cw.scrollTop = cw.scrollHeight;
      }
      try { socket.emit('chatMessage', payload); } catch(e) { console.error('socket emit failed', e); }
      input.value = '';
    });
  }

  // typing indicator: send when user types
  if (input){
    input.addEventListener('input', function(){
      if (!currentRoom) return;
      try { socket.emit('typing', { room: currentRoom, userId: me && me.userId, typing: true }); } catch(e){}
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(function(){ try { socket.emit('typing', { room: currentRoom, userId: me && me.userId, typing: false }); } catch(e){} }, 1200);
    });
  }

  // reaction button
  const reactBtn = document.getElementById('reactBtn');
  if (reactBtn){
    reactBtn.addEventListener('click', function(){
      const cw = document.getElementById('chatWindow');
      if (!cw) return;
      // attach a sample reaction to last message
      const last = cw.querySelector('[data-msg-id]:last-child') || cw.lastChild;
      const msgId = last && last.dataset ? last.dataset.msgId : null;
      if (!msgId) return alert('ไม่มีข้อความสำหรับทำปฏิกิริยา');
      try { socket.emit('reaction', { room: currentRoom, messageId: msgId, userId: me && me.userId, reaction: '❤️' }); } catch(e){}
    });
  }

  socket.on('chatMessage', function(m){
    try{
      if (!m || !m.room) return;
      if (currentRoom && m.room !== currentRoom) return;
      const cw = document.getElementById('chatWindow'); if (!cw) return;
      const el = document.createElement('div'); el.className = 'message ' + ((m.userId && me && m.userId === me.userId) ? 'me' : 'other'); el.dataset.msgId = m.id || '';
      el.innerHTML = `<div style="font-weight:700">${m.user}</div><div>${m.message}</div><div style="font-size:12px;color:#666">${new Date(m.time||m.created_at).toLocaleString()}</div>`;
      cw.appendChild(el); cw.scrollTop = cw.scrollHeight;
    }catch(e){console.error('on chatMessage',e)}
  });

  socket.on('typing', function(d){
    try{
      if (!d || !d.room) return;
      if (currentRoom && d.room !== currentRoom) return;
      const status = document.getElementById('statusLine'); if (!status) return;
      if (d.typing) status.textContent = 'ผู้ใช้กำลังพิมพ์...'; else status.textContent = '';
    }catch(e){console.error('on typing',e)}
  });

  socket.on('reaction', function(r){
    try{
      if (!r || !r.room) return;
      if (currentRoom && r.room !== currentRoom) return;
      // show simple toast
      const status = document.getElementById('statusLine'); if (status) status.textContent = `ได้รับปฏิกิริยา ${r.reaction}`;
      setTimeout(()=>{ if (status) status.textContent=''; }, 1800);
    }catch(e){console.error('on reaction',e)}
  });

})();