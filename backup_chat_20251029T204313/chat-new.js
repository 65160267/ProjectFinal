(function(){
  const socket = io();
  const me = window.__ME__ || null;
  // simple sanitizer for inserting user-provided text into DOM
  function escapeHtml(str){
    try{ return String(str||'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/\"/g,'&quot;')
        .replace(/'/g,'&#039;');
    }catch(e){ return '' }
  }

  // highlight a conversation in the left pane by otherId (string/number)
  function highlightConv(otherId){
    try{
      const convs = document.querySelectorAll('.conv');
      convs.forEach(c => {
        if (String(c.dataset.otherId) === String(otherId)) c.classList.add('selected'); else c.classList.remove('selected');
      });
      // also update header avatar/name when selecting a conversation
      try{
        const avatarEl = document.getElementById('otherAvatar');
        const nameEl = document.getElementById('otherName');
        const unameEl = document.getElementById('otherUsername');
        if (!otherId) {
          // reset to placeholder
          if (avatarEl) avatarEl.src = '/images/profile-placeholder.svg';
          if (nameEl) nameEl.textContent = 'เลือกการสนทนา';
          if (unameEl) unameEl.textContent = '';
        } else {
          const convEl = document.querySelector('.conv[data-other-id="' + otherId + '"]');
          if (convEl) {
            const img = convEl.querySelector('img');
            const nameNode = convEl.querySelector('.name');
            const lastNode = convEl.querySelector('.last');
            if (img && avatarEl) avatarEl.src = img.src;
            if (nameNode && nameEl) nameEl.textContent = nameNode.textContent.trim();
            if (lastNode && unameEl) unameEl.textContent = lastNode.textContent.trim();
          } else {
            // if left-pane element not present (new conversation), fetch user info from API
            try{ fetchAndApplyUser(otherId); }catch(e){}
          }
        }
      }catch(e){}
    }catch(e){}
  }

  // fetch user info from API and apply to header and left-pane if needed
  async function fetchAndApplyUser(otherId){
    if (!otherId) return null;
    try{
      const res = await fetch('/api/users/' + encodeURIComponent(otherId));
      if (!res.ok) return null;
      const user = await res.json();
      // apply to header
      try{
        const avatarEl = document.getElementById('otherAvatar');
        const nameEl = document.getElementById('otherName');
        const unameEl = document.getElementById('otherUsername');
        if (avatarEl && user.avatar) avatarEl.src = user.avatar;
        if (nameEl) nameEl.textContent = user.full_name || user.username || ('User ' + otherId);
        if (unameEl) unameEl.textContent = user.username || '';
      }catch(e){}
      // also update left-pane image if present
      try{
        const convEl = document.querySelector('.conv[data-other-id="' + otherId + '"]');
        if (convEl){
          const img = convEl.querySelector('img');
          if (img && user.avatar) img.src = user.avatar;
        }
      }catch(e){}
      return user;
    }catch(e){ console.error('fetchAndApplyUser', e); return null; }
  }
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

  async function loadMessages(room){
    try{
      const r = await fetch(`/api/chat/${encodeURIComponent(room)}/messages?limit=500`);
      if (!r.ok) return;
      const msgs = await r.json();
      const cw = document.getElementById('chatWindow'); if (!cw) return;
      cw.innerHTML = '';
      msgs.forEach(m => {
        const isMe = (m.user_id === (me && me.userId));
        const d = document.createElement('div');
        d.className = 'message ' + (isMe ? 'me' : 'other');
        if (isMe) {
          d.innerHTML = `<div style="font-weight:700">${escapeHtml(m.username||'')}</div><div style="margin-top:6px">${escapeHtml(m.message)}</div><div class="muted">${new Date(m.created_at).toLocaleString()}</div>`;
        } else {
          const avatar = m.avatar ? (m.avatar.startsWith('/') ? m.avatar : ('/uploads/' + m.avatar)) : '/images/profile-placeholder.svg';
          d.innerHTML = `<div class="avatar-mini"><img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div><div style="display:flex;flex-direction:column"><div style="font-weight:700">${escapeHtml(m.username||'')}</div><div style="margin-top:6px">${escapeHtml(m.message)}</div><div class="muted">${new Date(m.created_at).toLocaleString()}</div></div>`;
        }
        cw.appendChild(d);
      });
      cw.scrollTop = cw.scrollHeight;
      return msgs;
    } catch (e) { console.error('loadMessages', e); }
  }

  function setRoom(room){
    if (!room) return;
    if (currentRoom === room) return;
    currentRoom = room;
    try{ socket.emit('joinRoom', room); } catch(e){}
    // load messages and then focus composer so user can start typing immediately
    loadMessages(room).then((msgs)=> {
      try{
        const inputEl = document.getElementById('msgInput');
        if (inputEl) inputEl.focus();
        // show composer when a room is opened
        try{ showComposer(); }catch(e){}

        // determine the other user's id from the room name (chat_a_b)
        let otherId = null;
        try{
          const parts = String(room).split('_');
          const a = Number(parts[1]);
          const b = Number(parts[2]);
          if (!isNaN(a) && !isNaN(b)){
            otherId = (me && me.userId === a) ? b : a;
          }
        }catch(e){}

        // try to populate header info from left pane
        try{
          const avatarEl = document.getElementById('otherAvatar');
          const nameEl = document.getElementById('otherName');
          const unameEl = document.getElementById('otherUsername');
          if (otherId != null){
            const convEl = document.querySelector('.conv[data-other-id="' + otherId + '"]');
            if (convEl){
                  const img = convEl.querySelector('img');
                  const nameNode = convEl.querySelector('.name');
                  const usernameText = convEl.querySelector('.last');
                  if (img && avatarEl) avatarEl.src = img.src;
                  if (nameNode && nameEl) nameEl.textContent = nameNode.textContent.trim();
                  if (usernameText && unameEl) unameEl.textContent = usernameText.textContent.trim();
                } else if (msgs && msgs.length){
              // fallback: use the first message from the other user to extract metadata
              const otherMsg = msgs.find(m=> Number(m.user_id) !== (me && me.userId));
              if (otherMsg){
                if (avatarEl) avatarEl.src = otherMsg.avatar ? (otherMsg.avatar.startsWith('/')? otherMsg.avatar : ('/uploads/' + otherMsg.avatar)) : '/images/profile-placeholder.svg';
                if (nameEl) nameEl.textContent = otherMsg.username || ('User ' + (otherId||''));
                if (unameEl) unameEl.textContent = '';
              }
                } else {
                  // as a last resort, fetch user data from API
                  try{ fetchAndApplyUser(otherId).catch(()=>{}); }catch(e){}
                }
            }
          }
        }catch(e){}

      }catch(e){/* ignore */}
    }).catch(()=>{});
    // set a simple header label for fallback
    const header = document.getElementById('chatHeader'); if (header) header.textContent = 'ห้อง: ' + room;
  }

  // attach click handlers on conversation links
  document.addEventListener('click', function(ev){
    const a = ev.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.indexOf('/messages?open=') === 0){
      ev.preventDefault();
      const otherId = href.split('=')[1];
      if (!otherId) return;
      // highlight in left pane and set room
      highlightConv(otherId);
      const room = buildRoomFor(Number(otherId));
      setRoom(room);
      history.replaceState({}, '', '/messages?open=' + encodeURIComponent(otherId));
    }
  });

  // load from query param if present
  (function(){
    const open = getQueryParam('open');
    if (open && me && me.userId){
      const otherId = open;
      // highlight left list if present
      highlightConv(otherId);
      if (me && me.userId){ const room = buildRoomFor(Number(otherId)); setRoom(room); }
    }
  })();

  // respond to back/forward — clear selection when no open param
  window.addEventListener('popstate', ()=>{
    try{ const u = new URL(window.location.href); const open = u.searchParams.get('open'); if (!open) { highlightConv(null); hideComposer(); } }catch(e){}
  });

  // dynamic composer: create/show when a room is opened, hide when none selected
  function createComposerIfMissing(){
    if (document.getElementById('composer')) return document.getElementById('composer');
    try{
      const chatMain = document.querySelector('.chat-main');
      if (!chatMain) return null;
      const composer = document.createElement('div'); composer.className = 'composer'; composer.id = 'composer';
      // left actions (kept minimal)
      const left = document.createElement('div'); left.className = 'left-actions';
      const attachBtn = document.createElement('button'); attachBtn.type = 'button'; attachBtn.className = 'icon-btn'; attachBtn.title = 'แนบ'; attachBtn.textContent = '📎';
      left.appendChild(attachBtn);
      // input
      const input = document.createElement('input'); input.id = 'msgInput'; input.placeholder = 'พิมพ์ข้อความ...';
      // send
      const send = document.createElement('button'); send.id = 'sendBtn'; send.type = 'button'; send.textContent = 'ส่ง';
      composer.appendChild(left);
      composer.appendChild(input);
      composer.appendChild(send);
      // append after chatWindow
      const cw = document.getElementById('chatWindow');
      if (cw && cw.parentNode) {
        // insert composer as a sibling after chatWindow
        cw.parentNode.appendChild(composer);
      } else {
        chatMain.appendChild(composer);
      }

      // send handler
      function doSend(){
        const text = input.value && input.value.trim();
        if (!text || !currentRoom) return;
        const payload = { room: currentRoom, user: (me && me.username) || 'User', userId: me && me.userId, message: text };
        // optimistic UI
        const cwEl = document.getElementById('chatWindow');
        if (cwEl){
          const el = document.createElement('div'); el.className = 'message me'; el.innerHTML = `<div style="font-weight:700">${escapeHtml(payload.user)}</div><div style="margin-top:6px">${escapeHtml(payload.message)}</div><div class="muted">(ส่งแล้ว)</div>`; cwEl.appendChild(el); cwEl.scrollTop = cwEl.scrollHeight;
        }
        try { socket.emit('chatMessage', payload); } catch(e){ console.error('socket emit failed', e); }
        input.value = '';
        input.focus();
      }

      send.addEventListener('click', doSend);
      input.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); doSend(); } });

      return composer;
    }catch(e){ console.error('createComposerIfMissing', e); return null; }
  }

  function showComposer(){
    const c = createComposerIfMissing(); if (!c) return;
    c.style.display = 'flex';
    const input = document.getElementById('msgInput'); if (input) input.focus();
  }

  function hideComposer(){
    const c = document.getElementById('composer'); if (!c) return;
    try{ c.style.display = 'none'; }catch(e){}
  }

  socket.on('chatMessage', function(m){
    try{
      if (!m || !m.room) return;
      if (currentRoom && m.room !== currentRoom) return; // show only current room messages
      const cw = document.getElementById('chatWindow'); if (!cw) return;
      const isMe = (m.userId && me && m.userId === me.userId);
      const el = document.createElement('div'); el.className = 'message ' + (isMe ? 'me' : 'other');
      if (isMe) {
        el.innerHTML = `<div style="font-weight:700">${escapeHtml(m.user||'')}</div><div style="margin-top:6px">${escapeHtml(m.message||'')}</div><div class="muted">${new Date(m.time||m.created_at).toLocaleString()}</div>`;
      } else {
        const avatar = m.avatar ? (m.avatar.startsWith('/') ? m.avatar : ('/uploads/' + m.avatar)) : '/images/profile-placeholder.svg';
        el.innerHTML = `<div class="avatar-mini"><img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div><div style="display:flex;flex-direction:column"><div style="font-weight:700">${escapeHtml(m.user||'')}</div><div style="margin-top:6px">${escapeHtml(m.message||'')}</div><div class="muted">${new Date(m.time||m.created_at).toLocaleString()}</div></div>`;
      }
      cw.appendChild(el); cw.scrollTop = cw.scrollHeight;
    }catch(e){console.error('on chatMessage',e)}
  });

})();
