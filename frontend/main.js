const chat = document.getElementById('chat');
const input = document.getElementById('input');
const send = document.getElementById('send');
const uploadForm = document.getElementById('uploadForm');
const slipInput = document.getElementById('slip');

const state = {
  context: window.__context || {},
  typingEl: null
};

function addBubble(text, role) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function setTyping(on) {
  if (on) {
    if (!state.typingEl) {
      state.typingEl = document.createElement('div');
      state.typingEl.className = 'typing';
      state.typingEl.textContent = 'AI is typing...';
      chat.appendChild(state.typingEl);
      chat.scrollTop = chat.scrollHeight;
    }
  } else if (state.typingEl) {
    chat.removeChild(state.typingEl);
    state.typingEl = null;
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  addBubble(text, 'user');
  input.value = '';
  setTyping(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, context: state.context })
    });
    const data = await res.json();
    state.context = data.context || state.context;
    setTyping(false);
    const bubble = document.createElement('div');
    bubble.className = 'bubble ai';
    // decision tag styling
    if (data.underwritingDecision) {
      const d = data.underwritingDecision.decision;
      if (d === 'approved') bubble.classList.add('approved');
      if (d === 'pending') bubble.classList.add('pending');
      if (d === 'rejected') bubble.classList.add('rejected');
    }
    bubble.textContent = data.message || '...';
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;

    // Show upload when pending
    if (data.underwritingDecision && data.underwritingDecision.decision === 'pending') {
      uploadForm.style.display = 'block';
    } else {
      uploadForm.style.display = 'none';
    }

    if (data.sanctionLetterLink) {
      const a = document.createElement('a');
      a.href = data.sanctionLetterLink;
      a.target = '_blank';
      a.textContent = 'Download Sanction Letter';
      a.className = 'cta';
      const wrap = document.createElement('div');
      wrap.className = 'bubble ai';
      wrap.appendChild(a);
      chat.appendChild(wrap);
      chat.scrollTop = chat.scrollHeight;
    }

    // Show orchestration logs (collapsed small text)
    if (Array.isArray(data.logs) && data.logs.length) {
      const logDiv = document.createElement('div');
      logDiv.className = 'bubble ai';
      logDiv.style.background = '#f1f3f5';
      logDiv.style.color = '#333';
      logDiv.style.fontSize = '12px';
      logDiv.textContent = `Logs: ${data.logs.join(' › ')}`;
      chat.appendChild(logDiv);
      chat.scrollTop = chat.scrollHeight;
    }
  } catch (e) {
    setTyping(false);
    addBubble('Error contacting server.', 'ai');
  }
}

send.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

// Greeting
addBubble('Hi! I am your AI Loan Assistant. How can I help you today?', 'ai');

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!slipInput.files.length) return;
  const form = new FormData();
  form.append('slip', slipInput.files[0]);
  try {
    const res = await fetch('/api/upload-slip', { method: 'POST', body: form });
    const data = await res.json();
    addBubble('Slip received. Proceeding to finalize your application...', 'ai');
    // After upload, simulate approval by re-sending last context to trigger sanction letter if within 2x limit
    const res2 = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'uploaded slip', context: state.context })
    });
    const data2 = await res2.json();
    state.context = data2.context || state.context;
    addBubble(data2.message || '...', 'ai');
    if (data2.sanctionLetterLink) {
      const a = document.createElement('a');
      a.href = data2.sanctionLetterLink;
      a.target = '_blank';
      a.textContent = 'Download Sanction Letter';
      a.className = 'cta';
      const wrap = document.createElement('div');
      wrap.className = 'bubble ai';
      wrap.appendChild(a);
      chat.appendChild(wrap);
      chat.scrollTop = chat.scrollHeight;
    }
  } catch (err) {
    addBubble('Upload failed. Please try again.', 'ai');
  } finally {
    uploadForm.reset();
    uploadForm.style.display = 'none';
  }
});


