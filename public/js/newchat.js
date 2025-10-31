/* Clean chat client for namespace /messages
   - Supports: clicking left conversation -> join room
   - Auto-join via ?open=<userId>
   - Emits: 'join', 'getHistory', 'send'
*/
(function (){
  'use strict';

  function qs(name){ const p = new URLSearchParams(window.location.search); return p.get(name); }
  function el(id){ return document.getElementById(id); }
  function escapeHtml(s){ if (s === undefined || s === null) return ''; return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  const socket = io('/messages');
  const messagesEl = el('messages');
  const msgInput = el('msgInput');
  const sendBtn = el('sendBtn');
  const convList = document.getElementById('conversations');

  let currentRoom = null;

  function scrollBottom(){ if (!messagesEl) return; messagesEl.scrollTop = messagesEl.scrollHeight; }

  function renderMessage(m, mine){
    if (!messagesEl) return;
    const wrap = document.createElement('div');
    wrap.className = 'message' + (mine ? ' sent' : '');

    const avatar = document.createElement('img');
    avatar.className = 'message-avatar';
    const avatarSrc = (m.user && m.user.avatar) || '/images/profile-placeholder.svg';
    avatar.src = avatarSrc;
    avatar.alt = 'avatar';

    const content = document.createElement('div');
    content.className = 'message-content';
    
    const sender = document.createElement('div');
    sender.className = 'message-sender';
    const who = (m.user && (m.user.username || m.user.name)) || (m.user || 'User');
    sender.textContent = who;

    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = m.text || m.message || '';

    const time = document.createElement('div');
    time.className = 'message-time';
    const t = m.time ? new Date(m.time) : new Date();
    time.textContent = t.toLocaleString('th-TH', { hour:'2-digit', minute:'2-digit' });

    content.appendChild(sender);
    content.appendChild(text);
    content.appendChild(time);

    wrap.appendChild(avatar);
    wrap.appendChild(content);
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  // socket event handlers
  socket.on('connect', () => console.debug('connected to /messages'));
  socket.on('history', (msgs) => {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    (msgs || []).forEach(m => renderMessage(m, Boolean(m.user && (m.user.id === (window.me && window.me.userId)))));
  });
  socket.on('message', (m) => {
    renderMessage(m, Boolean(m.user && (m.user.id === (window.me && window.me.userId))));
  });

  function joinRoomForUser(otherId, otherName, avatarUrl){
    const meId = window.me && window.me.userId;
    if (!meId) { window.location.href = '/auth/login'; return; }
    const a = Math.min(Number(meId), Number(otherId));
    const b = Math.max(Number(meId), Number(otherId));
    const room = 'chat_' + a + '_' + b;
    currentRoom = room;
    socket.emit('join', room);
    socket.emit('getHistory', room);
    // update panel header if available
  const panelName = document.querySelector('.panel-name');
  const panelUsername = document.querySelector('.panel-username');
  const panelAvatar = document.querySelector('.panel-avatar');
    if (panelName) panelName.textContent = otherName || ('User ' + otherId);
    if (panelUsername) panelUsername.textContent = '@' + (otherName || otherId);
    if (panelAvatar){
      // prefer provided avatarUrl; else try to read from the corresponding conv item
      let src = avatarUrl;
      try {
        if (!src){
          const liForAvatar = document.querySelector('.conv-item[data-user-id="' + otherId + '"]');
          const convImg = liForAvatar && liForAvatar.querySelector('.conv-avatar');
          src = convImg && convImg.getAttribute('src');
        }
      } catch(e){ /* ignore */ }
      const fallback = panelAvatar.getAttribute('data-default') || '/images/profile-placeholder.svg';
      panelAvatar.src = src || fallback;
    }
    // mark selected conversation in list
    try {
      const prev = document.querySelector('.conv-item.active'); if (prev) prev.classList.remove('active');
      const li = document.querySelector('.conv-item[data-user-id="' + otherId + '"]');
      if (li) { li.classList.add('active'); li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    } catch (e){/* ignore */}
    // clear panel status
    const statusEl = document.getElementById('panelStatus'); if (statusEl) statusEl.textContent = '';
    // focus composer
    if (msgInput) setTimeout(()=> msgInput.focus(), 160);
  }

  // click handler for conversation items
  if (convList){
    convList.addEventListener('click', (ev) =>{
      const li = ev.target.closest('.conv-item');
      if (!li) return;
      const otherId = li.getAttribute('data-user-id');
      const otherName = li.getAttribute('data-username') || (li.querySelector('.conv-name') && li.querySelector('.conv-name').textContent) || otherId;
      const avatarUrl = (li.querySelector('.conv-avatar') && li.querySelector('.conv-avatar').getAttribute('src')) || '';
      joinRoomForUser(otherId, otherName, avatarUrl);
    });
  }

  // search/filter conversations (simple client-side filter)
  const convSearch = document.getElementById('convSearch');
  if (convSearch){
    convSearch.addEventListener('input', (e) => {
      const q = (e.target.value || '').toLowerCase().trim();
      const items = document.querySelectorAll('.conv-item');
      items.forEach(it => {
        const name = (it.getAttribute('data-username') || (it.querySelector('.conv-name') && it.querySelector('.conv-name').textContent) || '').toLowerCase();
        const snippet = (it.querySelector('.conv-snippet') && it.querySelector('.conv-snippet').textContent || '').toLowerCase();
        const show = !q || name.indexOf(q) !== -1 || snippet.indexOf(q) !== -1;
        it.style.display = show ? '' : 'none';
      });
    });
  }

  // send message
  function sendMessage(){
    const text = (msgInput && msgInput.value || '').trim();
    if (!text || !currentRoom) return;
    const payload = { room: currentRoom, user: { id: window.me && window.me.userId, username: window.me && window.me.username, avatar: window.me && window.me.avatar }, text };
    socket.emit('send', payload);
    msgInput.value = '';
  }

  // typing indicator: emit typing events (debounced) and show when other user typing
  let typingTimeout = null;
  function notifyTyping(){
    if (!currentRoom) return;
    socket.emit('typing', { room: currentRoom, userId: window.me && window.me.userId });
  }
  if (msgInput){
    msgInput.addEventListener('input', () => {
      // send typing notify
      notifyTyping();
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        const statusEl = document.getElementById('panelStatus'); if (statusEl) statusEl.textContent = '';
      }, 1500);
    });
  }

  socket.on('typing', (info) => {
    if (!info || !info.room || info.room !== currentRoom) return;
    const statusEl = document.getElementById('panelStatus');
    if (statusEl) statusEl.textContent = 'กำลังพิมพ์...';
    // clear after short delay
    setTimeout(()=>{ if (statusEl) statusEl.textContent = ''; }, 1600);
  });

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (msgInput) msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  // auto-join if ?open=<userId>
  const openUser = qs('open');
  if (openUser){
    const meId = (window.me && window.me.userId) || null;
    if (!meId) { window.location.href = '/auth/login'; }
    else {
      // try to find avatar/name from the list if present
      let name, avatar = '';
      try {
        const li = document.querySelector('.conv-item[data-user-id="' + openUser + '"]');
        if (li){
          name = li.getAttribute('data-username') || (li.querySelector('.conv-name') && li.querySelector('.conv-name').textContent);
          const img = li.querySelector('.conv-avatar');
          avatar = img && img.getAttribute('src');
        }
      } catch(e){ /* ignore */ }
      joinRoomForUser(openUser, name, avatar);
    }
  }

})();
