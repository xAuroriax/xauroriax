// chat-widget.js – автономный виджет чата (SSE версия)
(function() {
    if (document.getElementById('auroria-chat-root')) return;
    const root = document.createElement('div');
    root.id = 'auroria-chat-root';
    document.body.appendChild(root);

    root.innerHTML = `
        <style>
        .chat-widget{position:fixed;bottom:20px;right:20px;z-index:10000;font-family:'Share Tech Mono',monospace}
        .chat-toggle{width:60px;height:60px;border-radius:50%;background:#ff7a18;border:none;cursor:pointer;box-shadow:0 0 20px rgba(255,122,24,0.5);display:flex;align-items:center;justify-content:center;transition:transform 0.3s}
        .chat-toggle:hover{transform:scale(1.1)}
        .chat-toggle i{font-size:28px;color:#fff}
        .chat-window{position:absolute;bottom:80px;right:0;width:380px;height:500px;background:rgba(10,10,10,0.95);backdrop-filter:blur(10px);border:1px solid rgba(255,122,24,0.3);border-radius:16px;flex-direction:column;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);opacity:0;visibility:hidden;transform:scale(0.9);transform-origin:bottom right;transition:opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;pointer-events:none}
        .chat-window.open{opacity:1;visibility:visible;transform:scale(1);pointer-events:auto}
        .chat-header{background:rgba(0,0,0,0.8);padding:12px 16px;border-bottom:1px solid rgba(255,122,24,0.3);color:#ff7a18;font-weight:bold;display:flex;justify-content:space-between}
        .chat-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
        .chat-message{display:flex;gap:10px;align-items:flex-start}
        .chat-message img{width:36px;height:36px;border-radius:50%;border:1px solid #ff7a18}
        .chat-message-content{flex:1;background:rgba(255,255,255,0.05);border-radius:12px;padding:8px 12px}
        .chat-message-name{font-weight:bold;color:#ff7a18;font-size:13px;margin-bottom:4px}
        .chat-message-text{color:#e0e0e0;font-size:14px;word-wrap:break-word}
        .chat-message-time{font-size:10px;color:#888;margin-top:4px;text-align:right}
        .chat-input-area{padding:12px;border-top:1px solid rgba(255,122,24,0.2);display:flex;gap:8px}
        .chat-input-area input{flex:1;background:rgba(0,0,0,0.6);border:1px solid rgba(255,122,24,0.3);border-radius:20px;padding:10px 14px;color:#fff;font-family:inherit}
        .chat-input-area button{background:#ff7a18;border:none;border-radius:20px;padding:0 16px;color:#fff;cursor:pointer;font-weight:bold}
        .chat-input-area button:hover{background:#ff9933}
        .chat-login-required{text-align:center;padding:20px;color:#aaa}
        @media (max-width:480px){.chat-window{width:320px;height:450px;right:0;bottom:70px}}
        </style>
        <div class="chat-widget">
            <button class="chat-toggle" id="chatToggleBtn"><i class="fas fa-comment-dots"></i></button>
            <div class="chat-window" id="chatWindow">
                <div class="chat-header"><span>💬 Общий чат (Discord)</span><i class="fas fa-times" style="cursor:pointer" id="chatCloseBtn"></i></div>
                <div class="chat-messages" id="chatMessages"><div class="chat-login-required">Авторизуйтесь через Steam, чтобы писать в чат</div></div>
                <div class="chat-input-area" id="chatInputArea" style="display:none;">
                    <input type="text" id="chatMessageInput" placeholder="Введите сообщение...">
                    <button id="chatSendBtn">➤</button>
                </div>
            </div>
        </div>
    `;

    let currentUser = null;
    let eventSource = null;
    const messagesContainer = document.getElementById('chatMessages');
    const inputArea = document.getElementById('chatInputArea');
    const messageInput = document.getElementById('chatMessageInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const toggleBtn = document.getElementById('chatToggleBtn');
    const closeBtn = document.getElementById('chatCloseBtn');
    const chatWindow = document.getElementById('chatWindow');

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function scrollToBottom() {
        setTimeout(function() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }

    function addMessageToUI(msg, isNew) {
        if (isNew === undefined) isNew = true;
        var div = document.createElement('div');
        div.className = 'chat-message';
        var avatar = msg.avatar || 'favicon.png';
        var nickname = msg.nickname || 'Неизвестный';
        var time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        div.innerHTML = '<img src="' + avatar + '" onerror="this.src=\'favicon.png\'"><div class="chat-message-content"><div class="chat-message-name">' + escapeHtml(nickname) + '</div><div class="chat-message-text">' + escapeHtml(msg.message) + '</div><div class="chat-message-time">' + time + '</div></div>';
        messagesContainer.appendChild(div);
        if (isNew) scrollToBottom();
    }

    async function loadHistory() {
        try {
            var res = await fetch('https://chat-api.xauroriax.ru/history');
            var messages = await res.json();
            messagesContainer.innerHTML = '';
            for (var i = 0; i < messages.length; i++) {
                addMessageToUI(messages[i], false);
            }
            scrollToBottom();
        } catch(e) {
            console.error('loadHistory error:', e);
        }
    }

    function connectSSE() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (!currentUser) return;
        eventSource = new EventSource('https://chat-api.xauroriax.ru/sse?steamId=' + encodeURIComponent(currentUser.id));
        eventSource.onmessage = function(event) {
            try {
                var data = JSON.parse(event.data);
                if (data.type === 'message') {
                    addMessageToUI(data.payload, true);
                }
            } catch(e) {
                console.error('SSE parse error', e);
            }
        };
        eventSource.onerror = function(e) {
            console.warn('SSE error, reconnecting in 5s');
            eventSource.close();
            eventSource = null;
            setTimeout(connectSSE, 5000);
        };
    }

    async function sendMessage() {
        var text = messageInput.value.trim();
        if (!text) return;
        if (!currentUser) {
            alert('Авторизуйтесь через Steam');
            return;
        }
        try {
            var res = await fetch('https://chat-api.xauroriax.ru/send', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({steamId:currentUser.id, nickname:currentUser.name, avatar:currentUser.avatar, message:text})
            });
            if (res.ok) {
                messageInput.value = '';
            } else {
                alert('Ошибка отправки');
            }
        } catch(e) {
            alert('Ошибка соединения');
        }
    }

    function updateAuthUI() {
        var savedUser = JSON.parse(localStorage.getItem('steam_user'));
        if (savedUser && savedUser.id) {
            currentUser = savedUser;
            inputArea.style.display = 'flex';
            loadHistory();
            connectSSE();
        } else {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            currentUser = null;
            inputArea.style.display = 'none';
            messagesContainer.innerHTML = '<div class="chat-login-required">Авторизуйтесь через Steam, чтобы писать в чат</div>';
        }
    }

    toggleBtn.addEventListener('click', function() {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open')) updateAuthUI();
    });
    closeBtn.addEventListener('click', function() {
        chatWindow.classList.remove('open');
    });
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    setTimeout(updateAuthUI, 500);
})();