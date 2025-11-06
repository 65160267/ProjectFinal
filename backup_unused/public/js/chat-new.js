(function(){
  var socket = io();
  var me = window.__ME__ || {};

  function escapeHtml(str){
    try{
      return String(str||'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
    }catch(e){ return ''; }
  }

  function buildRoomFor(otherId){
    var a = Math.min(Number(me.userId||0), Number(otherId||0));
    var b = Math.max(Number(me.userId||0), Number(otherId||0));
    return 'chat_' + a + '_' + b;
  }

  function getQueryParam(name){
    try{ var p = new URLSearchParams(window.location.search); return p.get(name); }
    catch(e){ return null; }
  }

  var currentRoom = null;

  function loadMessages(room){
    if (!room) return Promise.resolve([]);
    return fetch('/api/chat/' + encodeURIComponent(room) + '/messages?limit=500')
      .then(function(r){ if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then(function(msgs){
        var cw = document.getElementById('chatWindow'); if (!cw) return msgs;
        cw.innerHTML = '';
        msgs.forEach(function(m){
          var isMe = (Number(m.user_id) === Number(me.userId));
          var d = document.createElement('div'); d.className = 'message ' + (isMe ? 'me' : 'other');
          if (isMe){
            d.innerHTML = '<div style="font-weight:700">' + escapeHtml(m.username||'') + '</div><div style="margin-top:6px">' + escapeHtml(m.message||'') + '</div><div class="muted">' + new Date(m.created_at).toLocaleString() + '</div>';
          } else {
            var avatar = m.avatar ? (m.avatar.indexOf('/')===0? m.avatar : ('/uploads/' + m.avatar)) : '/images/profile-placeholder.svg';
            d.innerHTML = '<div class="avatar-mini"><img src="' + escapeHtml(avatar) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div><div style="display:flex;flex-direction:column"><div style="font-weight:700">' + escapeHtml(m.username||'') + '</div><div style="margin-top:6px">' + escapeHtml(m.message||'') + '</div><div class="muted">' + new Date(m.created_at).toLocaleString() + '</div></div>';
          }
          cw.appendChild(d);
        });
        cw.scrollTop = cw.scrollHeight;
        return msgs;
      }).catch(function(){ return []; });
  }

  function setRoom(room){
    if (!room) return; if (currentRoom === room) return; currentRoom = room;
    try{ socket.emit('joinRoom', room); }catch(e){}
    loadMessages(room).then(function(){
      var inEl = document.getElementById('msgInput'); if (inEl) inEl.focus();
      var hdr = document.getElementById('chatHeader'); if (hdr) hdr.textContent = 'ห้อง: ' + room;
    });
  }

  function createComposerIfMissing(){
    var ex = document.getElementById('composer'); if (ex) return ex;
    var cm = document.createElement('div'); cm.id='composer'; cm.className='composer';
    var input = document.createElement('input'); input.id='msgInput'; input.placeholder='พิมพ์ข้อความ...';
    var btn = document.createElement('button'); btn.type='button'; btn.id='sendBtn'; btn.textContent='ส่ง';
    cm.appendChild(input); cm.appendChild(btn);
    var cw = document.getElementById('chatWindow');
    if (cw && cw.parentNode) cw.parentNode.appendChild(cm);
    else { var main = document.querySelector('.chat-main'); if (main) main.appendChild(cm); }

    function send(){
      var txt = input.value && input.value.trim();
      if (!txt || !currentRoom) return;
      var payload = { room: currentRoom, user: (me && me.username)||'User', userId: me && me.userId, message: txt };
      var cwEl=document.getElementById('chatWindow');
      if (cwEl){
        var el=document.createElement('div'); el.className='message me';
        el.innerHTML='<div style="font-weight:700">'+escapeHtml(payload.user)+'</div><div style="margin-top:6px">'+escapeHtml(payload.message)+'</div><div class="muted">(ส่งแล้ว)</div>';
        cwEl.appendChild(el); cwEl.scrollTop=cwEl.scrollHeight;
      }
      try{ socket.emit('chatMessage', payload); }catch(e){}
      input.value=''; input.focus();
    }

    btn.addEventListener('click', send);
    input.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); send(); } });
    return cm;
  }

  document.addEventListener('click', function(ev){
    var a = ev.target.closest && ev.target.closest('a'); if (!a) return;
    var href=a.getAttribute('href')||'';
    if (href.indexOf('/messages?open=')===0){
      ev.preventDefault();
      var otherId = href.split('=')[1]; if (!otherId) return;
      setRoom(buildRoomFor(Number(otherId)));
      var c = createComposerIfMissing(); if (c) c.style.display='flex';
      history.replaceState({},'', '/messages?open='+encodeURIComponent(otherId));
    }
  });

  var o = getQueryParam('open');
  if (o && me && me.userId){ setRoom(buildRoomFor(Number(o))); createComposerIfMissing(); }

  socket.on('chatMessage', function(m){
    try{
      if (!m || !m.room) return;
      if (currentRoom && m.room !== currentRoom) return;
      var cw = document.getElementById('chatWindow'); if (!cw) return;
      var isMe = (m.userId && me && Number(m.userId)===Number(me.userId));
      var el=document.createElement('div'); el.className='message '+(isMe?'me':'other');
      if (isMe){
        el.innerHTML = '<div style="font-weight:700">'+escapeHtml(m.user||'')+'</div><div style="margin-top:6px">'+escapeHtml(m.message||'')+'</div><div class="muted">'+new Date((m.time||m.created_at)||Date.now()).toLocaleString()+'</div>';
      } else {
        var avatar = m.avatar ? (m.avatar.indexOf('/')===0? m.avatar : ('/uploads/'+m.avatar)) : '/images/profile-placeholder.svg';
        el.innerHTML = '<div class="avatar-mini"><img src="'+escapeHtml(avatar)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div><div style="display:flex;flex-direction:column"><div style="font-weight:700">'+escapeHtml(m.user||'')+'</div><div style="margin-top:6px">'+escapeHtml(m.message||'')+'</div><div class="muted">'+new Date((m.time||m.created_at)||Date.now()).toLocaleString()+'</div></div>';
      }
      cw.appendChild(el); cw.scrollTop = cw.scrollHeight;
    }catch(e){}
  });

  try{ if (me && me.userId) socket.emit('registerUser', me.userId); }catch(e){}
})();