(function(){
  // Only run in browser
  if (typeof window === 'undefined') return;
  var onMessagesPage = false;
  try { onMessagesPage = !!(window.location && /^\/messages(\b|\/|$)/.test(window.location.pathname)); } catch(e) {}

  // Find the chat icon link in the header on this page
  function findChatLink(){
    try {
      var candidates = Array.from(document.querySelectorAll('nav.header-actions a'));
      var link = candidates.find(function(a){ return a && a.getAttribute('href') === '/messages'; });
      return link || null;
    } catch(e) { return null; }
  }

  function ensureBadge(anchor){
    if (!anchor) return null;
    // add a class for positioning without touching templates
    if (!anchor.classList.contains('has-badge')) anchor.classList.add('has-badge');
    var badge = anchor.querySelector('.notif-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'notif-badge';
      badge.textContent = '';
      badge.style.display = 'none';
      anchor.appendChild(badge);
    }
    return badge;
  }

  function setCount(badge, n){
    if (!badge) return;
    var count = Math.max(0, Number(n||0)|0);
    if (count <= 0) {
      badge.style.display = 'none';
      badge.textContent = '';
    } else {
      badge.style.display = 'inline-block';
      badge.textContent = count > 99 ? '99+' : String(count);
    }
  }

  // Persist unread counter per-user
  function storageKey(){
    var uid = (window.__ME__ && window.__ME__.id) ? String(window.__ME__.id) : 'guest';
    return 'chatUnreadCount:'+uid;
  }
  function getStored(){
    try { return Number(localStorage.getItem(storageKey()) || '0') || 0; } catch(e) { return 0; }
  }
  function store(n){
    try { localStorage.setItem(storageKey(), String(Math.max(0, Number(n||0)|0))); } catch(e) {}
  }
  function inc(){ store(getStored()+1); }
  function clear(){ store(0); }

  // Initialize UI
  var chatLink = findChatLink();
  var badge = ensureBadge(chatLink);
  // Hide badge on the messages page
  if (onMessagesPage) {
    try { localStorage.setItem(storageKey(), '0'); } catch(e) {}
    setCount(badge, 0);
  } else {
    setCount(badge, getStored());
  }

  // Reset on click (navigate to /messages)
  if (chatLink) {
    chatLink.addEventListener('click', function(){ clear(); setCount(badge, 0); });
  }

  // Do not auto-clear on /messages; allow badge to reflect unseen messages until a room is opened

  // If no user or Socket.IO not available, stop here (no background connection)
  if (!(window.__ME__ && window.__ME__.id)) return;
  if (typeof io === 'undefined') return;

  // Background socket for notify events (no room join required)
  var sock;
  try {
    sock = io('/messages', { transports: ['websocket', 'polling'] });
  } catch (e) {
    // Socket failed; skip notifications gracefully
    return;
  }

  // On incoming notify, if it's for me and I'm not on /messages, increment badge
  var myId = Number(window.__ME__.id);
  sock.on('notify', function(evt){
    try {
      if (!evt) return;
      var toId = Number(evt.toId);
      var fromId = Number(evt.fromId);
      // Only count if I'm the recipient and not the sender, and I'm not on the messages page
      if (toId && toId === myId && fromId !== myId) {
        if (!onMessagesPage) {
          inc();
          setCount(badge, getStored());
        }
      }
    } catch(e) { /* ignore */ }
  });

  // Optional: when the page gains focus on /messages, clear unread
  // Replace with an explicit event fired by chat UI when a room is opened
  window.addEventListener('chat:roomOpened', function(){
    clear();
    setCount(badge, 0);
  });
})();
