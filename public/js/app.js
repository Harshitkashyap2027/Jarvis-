/**
 * public/js/app.js
 * Project A.E.T.H.E.R. — Frontend Application
 *
 * Handles:
 *  - Socket.io connection to the backend
 *  - Web Speech API (STT + TTS)
 *  - Audio visualizer lifecycle
 *  - Real-time telemetry rendering
 *  - Command log management
 *  - System alerts
 *  - UI state machine
 */

'use strict';

(function () {
  // ═══ State ════════════════════════════════════════════════════════════════
  const state = {
    connected: false,
    listening: false,
    processing: false,
    speechSupported: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
  };

  // ═══ DOM References ════════════════════════════════════════════════════════
  const $ = (id) => document.getElementById(id);

  const els = {
    connectionDot:   $('connectionDot'),
    connectionLabel: $('connectionLabel'),
    headerTime:      $('headerTime'),
    footerPlatform:  $('footerPlatform'),
    footerDate:      $('footerDate'),
    orb:             $('orb'),
    voiceLabel:      $('voiceLabel'),
    transcriptBox:   $('transcriptBox'),
    transcriptText:  $('transcriptText'),
    micBtn:          $('micBtn'),
    textInputBtn:    $('textInputBtn'),
    textInputRow:    $('textInputRow'),
    textInput:       $('textInput'),
    sendTextBtn:     $('sendTextBtn'),
    logList:         $('logList'),
    // Metrics
    cpuCard:   $('cpuCard'),
    cpuUsage:  $('cpuUsage'),
    cpuBar:    $('cpuBar'),
    cpuTemp:   $('cpuTemp'),
    ramCard:   $('ramCard'),
    ramUsage:  $('ramUsage'),
    ramBar:    $('ramBar'),
    ramDetail: $('ramDetail'),
    gpuCard:   $('gpuCard'),
    gpuUsage:  $('gpuUsage'),
    gpuBar:    $('gpuBar'),
    gpuTemp:   $('gpuTemp'),
    netRx:     $('netRx'),
    netTx:     $('netTx'),
    diskInfo:  $('diskInfo'),
    // Alert
    alertOverlay: $('alertOverlay'),
    alertBox:     $('alertBox'),
    alertLevel:   $('alertLevel'),
    alertMessage: $('alertMessage'),
    alertDismiss: $('alertDismiss'),
  };

  // ═══ Socket.io ════════════════════════════════════════════════════════════
  const socket = io();

  socket.on('connect', () => {
    state.connected = true;
    els.connectionDot.classList.add('connected');
    els.connectionLabel.textContent = 'ONLINE';
    addLog({ type: 'system', transcript: 'Connected to A.E.T.H.E.R.', response: 'All systems nominal.' });
  });

  socket.on('disconnect', () => {
    state.connected = false;
    els.connectionDot.classList.remove('connected');
    els.connectionLabel.textContent = 'OFFLINE';
    setOrbState('idle');
    setVoiceLabel('OFFLINE', 'error');
  });

  socket.on('ready', (data) => {
    speak(data.message);
    setVoiceLabel('STAND BY', '');
    if (data.platform) {
      const p = data.platform;
      els.footerPlatform.textContent = `${p.hostname || 'LOCAL'} · ${(p.platform || '').toUpperCase()}`;
    }
  });

  socket.on('command_result', (data) => {
    setOrbState('idle');
    setVoiceLabel('STAND BY', '');
    els.transcriptBox.classList.remove('active');
    visualizer.stopMic();

    addLog({
      type: data.success ? 'success' : 'error',
      transcript: data.transcript || 'Direct Command',
      response: data.response || data.error || '',
    });

    if (data.response) speak(data.response);
  });

  socket.on('telemetry', (data) => updateTelemetry(data));

  socket.on('alert', (data) => showAlert(data.level, data.message));

  // ═══ Audio Visualizer ════════════════════════════════════════════════════
  const visualizerCanvas = document.getElementById('visualizerCanvas');
  const visualizer = new AudioVisualizer(visualizerCanvas);

  // ═══ Particle Canvas ═════════════════════════════════════════════════════
  initParticles();

  // ═══ Speech Recognition (STT) ════════════════════════════════════════════
  let recognition = null;

  if (state.speechSupported) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      state.listening = true;
      setOrbState('listening');
      setVoiceLabel('LISTENING…', 'listening');
      els.transcriptText.textContent = '…';
      els.transcriptBox.classList.add('active');
      els.micBtn.classList.add('active');
      visualizer.startMic();
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text;
        else interim += text;
      }
      els.transcriptText.textContent = final || interim;
    };

    recognition.onerror = (event) => {
      console.warn('[STT] Error:', event.error);
      stopListening();
      setVoiceLabel('STT ERROR', 'error');
    };

    recognition.onend = () => {
      const finalText = els.transcriptText.textContent.trim();
      stopListening();
      if (finalText && finalText !== '…') {
        sendVoiceInput(finalText);
      }
    };
  } else {
    els.micBtn.title = 'Speech recognition not supported in this browser.';
    els.micBtn.style.opacity = '0.4';
    els.micBtn.style.cursor = 'not-allowed';
  }

  function startListening() {
    if (!state.speechSupported || state.listening || state.processing) return;
    try { recognition.start(); }
    catch (e) { console.warn('[STT] Could not start:', e.message); }
  }

  function stopListening() {
    state.listening = false;
    els.micBtn.classList.remove('active');
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
  }

  // ═══ Speech Synthesis (TTS) ══════════════════════════════════════════════
  let ttsQueue = [];
  let ttsSpeaking = false;

  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    ttsQueue.push(text);
    if (!ttsSpeaking) drainTtsQueue();
  }

  function drainTtsQueue() {
    if (!ttsQueue.length) { ttsSpeaking = false; return; }
    ttsSpeaking = true;
    const text = ttsQueue.shift();
    const utterance = new SpeechSynthesisUtterance(text);

    // Prefer a deep/robotic voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) =>
      /google uk english male|david|mark|daniel/i.test(v.name)
    );
    if (preferred) utterance.voice = preferred;

    utterance.rate = 0.92;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    utterance.onend = () => drainTtsQueue();
    utterance.onerror = () => drainTtsQueue();

    window.speechSynthesis.speak(utterance);
  }

  // Reload voices asynchronously (Chrome lazy-loads them)
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices(); // Trigger cache
    };
  }

  // ═══ Send Commands ════════════════════════════════════════════════════════
  function sendVoiceInput(transcript) {
    if (!transcript) return;
    state.processing = true;
    setOrbState('processing');
    setVoiceLabel('PROCESSING…', 'processing');
    els.transcriptText.textContent = transcript;
    socket.emit('voice_input', { transcript });
  }

  function sendTextCommand(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    els.textInput.value = '';
    sendVoiceInput(trimmed);
  }

  // ═══ UI State Helpers ════════════════════════════════════════════════════

  function setOrbState(stateKey) {
    els.orb.classList.remove('listening', 'processing');
    if (stateKey !== 'idle') els.orb.classList.add(stateKey);
    state.listening   = stateKey === 'listening';
    state.processing  = stateKey === 'processing';
  }

  function setVoiceLabel(text, cssClass = '') {
    els.voiceLabel.textContent = text;
    els.voiceLabel.className = 'voice-label' + (cssClass ? ` ${cssClass}` : '');
  }

  // ═══ Event Listeners ════════════════════════════════════════════════════

  els.micBtn.addEventListener('click', () => {
    if (!state.speechSupported) {
      speak('Speech recognition is not supported in this browser.');
      return;
    }
    if (state.listening) {
      stopListening();
      setOrbState('idle');
      setVoiceLabel('STAND BY', '');
    } else {
      startListening();
    }
  });

  els.textInputBtn.addEventListener('click', () => {
    els.textInputRow.classList.toggle('visible');
    if (els.textInputRow.classList.contains('visible')) {
      els.textInput.focus();
    }
  });

  els.sendTextBtn.addEventListener('click', () => sendTextCommand(els.textInput.value));

  els.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendTextCommand(els.textInput.value);
  });

  els.orb.addEventListener('click', () => {
    if (!state.listening && !state.processing) startListening();
  });

  els.alertDismiss.addEventListener('click', () => {
    els.alertOverlay.classList.remove('visible');
  });

  // ═══ Command Log ═════════════════════════════════════════════════════════

  function addLog(entry) {
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const item = document.createElement('div');
    item.className = `log-entry ${entry.type || ''}`;
    item.innerHTML = `
      <div class="log-entry__time">${now}</div>
      <div class="log-entry__transcript">${escapeHtml(entry.transcript)}</div>
      <div class="log-entry__response ${entry.type === 'error' ? 'error' : ''}">${escapeHtml(entry.response)}</div>
    `;
    els.logList.prepend(item);

    // Limit log to 50 entries
    while (els.logList.children.length > 50) {
      els.logList.removeChild(els.logList.lastChild);
    }
  }

  // ═══ Telemetry Rendering ══════════════════════════════════════════════════

  function updateTelemetry(data) {
    if (!data || !data.available) return;

    // CPU
    if (data.cpu) {
      const usage = data.cpu.usagePercent ?? 0;
      els.cpuUsage.textContent = `${usage} %`;
      els.cpuBar.style.width = `${usage}%`;
      els.cpuTemp.textContent = data.cpu.temperature !== null
        ? `TEMP: ${data.cpu.temperature} °C`
        : 'TEMP: N/A';
      setCardState(els.cpuCard, usage);
    }

    // RAM
    if (data.memory) {
      const usage = data.memory.usagePercent ?? 0;
      els.ramUsage.textContent = `${usage} %`;
      els.ramBar.style.width = `${usage}%`;
      els.ramDetail.textContent =
        `${data.memory.usedGB} GB / ${data.memory.totalGB} GB`;
      setCardState(els.ramCard, usage);
    }

    // GPU
    if (data.gpu && data.gpu.length > 0) {
      const gpu = data.gpu[0];
      const gpuUsage = gpu.usagePercent ?? 0;
      els.gpuUsage.textContent = gpuUsage > 0 ? `${gpuUsage} %` : `${gpu.model || 'GPU'}`;
      els.gpuBar.style.width = `${gpuUsage}%`;
      els.gpuTemp.textContent = gpu.temperatureC !== null
        ? `TEMP: ${gpu.temperatureC} °C`
        : 'TEMP: N/A';
      setCardState(els.gpuCard, gpuUsage);
    }

    // Network
    if (data.network && data.network.length > 0) {
      const net = data.network[0];
      els.netRx.textContent = `↓ ${net.rxMBps} MB/s`;
      els.netTx.textContent = `↑ ${net.txMBps} MB/s`;
    }

    // Disk
    if (data.disk && data.disk.length > 0) {
      const primary = data.disk.find((d) => d.mount === '/' || d.mount === 'C:\\') || data.disk[0];
      els.diskInfo.textContent = `${primary.usedGB} / ${primary.totalGB} GB  (${primary.usagePercent}%)`;
    }
  }

  function setCardState(card, percent) {
    card.classList.remove('warn', 'critical');
    if (percent >= 90) card.classList.add('critical');
    else if (percent >= 75) card.classList.add('warn');
  }

  // ═══ Alerts ═══════════════════════════════════════════════════════════════

  function showAlert(level, message) {
    els.alertLevel.textContent = level.toUpperCase();
    els.alertLevel.className = level === 'critical' ? 'alert-box__level critical' : 'alert-box__level';
    els.alertMessage.textContent = message;
    els.alertOverlay.classList.add('visible');
    speak(message);
  }

  // ═══ Clock ══════════════════════════════════════════════════════════════

  function updateClock() {
    const now = new Date();
    els.headerTime.textContent = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    els.footerDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).toUpperCase();
  }

  setInterval(updateClock, 1000);
  updateClock();

  // ═══ Particle Background ════════════════════════════════════════════════

  function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', () => { resize(); spawnParticles(); });
    resize();

    function spawnParticles() {
      const count = Math.floor((canvas.width * canvas.height) / 14000);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.3,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.4 + 0.05,
      }));
    }
    spawnParticles();

    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(drawParticles);
    }
    drawParticles();
  }

  // ═══ Utilities ═══════════════════════════════════════════════════════════

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
