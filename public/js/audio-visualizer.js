/**
 * public/js/audio-visualizer.js
 * Real-time audio visualizer using the Web Audio API.
 * Renders a circular frequency-spectrum waveform on the #visualizerCanvas
 * that reacts live to microphone input and to the AI's TTS voice output.
 */

'use strict';

class AudioVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas to draw on.
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.animFrameId = null;
    this.micStream = null;
    this.active = false;
    this.idlePhase = 0;        // Phase counter for the idle animation
    this.ttsActive = false;    // True while TTS is speaking

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._drawIdle();
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  _resize() {
    this.canvas.width  = this.canvas.offsetWidth  || window.innerWidth;
    this.canvas.height = this.canvas.offsetHeight || window.innerHeight;
  }

  _ensureAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  // ─── Microphone Input ────────────────────────────────────────────────────

  async startMic() {
    this._ensureAudioContext();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

    if (this.micStream) return; // already running

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      const source = this.audioCtx.createMediaStreamSource(stream);
      source.connect(this.analyser);
      this.active = true;
      this._drawActive();
    } catch (err) {
      console.warn('[AudioVisualizer] Mic access denied:', err.message);
    }
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.active = false;
    cancelAnimationFrame(this.animFrameId);
    this._drawIdle();
  }

  // ─── TTS Audio Source ────────────────────────────────────────────────────

  /**
   * Connect a MediaStream (from TTS or audio element) to the analyser.
   * @param {HTMLAudioElement} audioEl
   */
  connectAudioElement(audioEl) {
    this._ensureAudioContext();
    if (!this._ttsSource) {
      this._ttsSource = this.audioCtx.createMediaElementSource(audioEl);
      this._ttsSource.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    this.ttsActive = true;
    this.active = true;
    this._drawActive();
  }

  onTtsStopped() {
    this.ttsActive = false;
    if (!this.micStream) {
      this.active = false;
      cancelAnimationFrame(this.animFrameId);
      this._drawIdle();
    }
  }

  // ─── Draw — Idle ──────────────────────────────────────────────────────────

  _drawIdle() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) * 0.38;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const time = performance.now() * 0.001;

    // Soft breathing ring
    const breathe = 0.5 + 0.5 * Math.sin(time * 0.8);
    const alpha = 0.06 + breathe * 0.08;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle idle bars
    const bars = 64;
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const wave = 3 + 3 * Math.sin(time * 1.5 + i * 0.4);
      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + wave);
      const y2 = cy + Math.sin(angle) * (radius + wave);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 + breathe * 0.08})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    this.animFrameId = requestAnimationFrame(() => this._drawIdle());
  }

  // ─── Draw — Active (Mic / TTS) ────────────────────────────────────────────

  _drawActive() {
    const { ctx, canvas, analyser, dataArray } = this;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) * 0.38;

    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bars = dataArray.length;
    const barColor = this.ttsActive ? '0, 80, 255' : '0, 240, 255';

    // Centre glow
    const avgVolume = dataArray.reduce((a, b) => a + b, 0) / bars;
    const glowRadius = radius * (0.7 + (avgVolume / 255) * 0.6);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    gradient.addColorStop(0, `rgba(${barColor}, ${0.04 + (avgVolume / 255) * 0.06})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Frequency bars radiating outward
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const barHeight = (dataArray[i] / 255) * radius * 0.9;

      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + barHeight);
      const y2 = cy + Math.sin(angle) * (radius + barHeight);

      const alpha = 0.25 + (dataArray[i] / 255) * 0.75;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(${barColor}, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Base ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${barColor}, 0.2)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    this.animFrameId = requestAnimationFrame(() => {
      if (this.active) this._drawActive();
    });
  }

  destroy() {
    cancelAnimationFrame(this.animFrameId);
    this.stopMic();
    if (this.audioCtx) this.audioCtx.close();
  }
}

window.AudioVisualizer = AudioVisualizer;
