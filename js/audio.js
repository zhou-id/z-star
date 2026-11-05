/* ============================================================
 * z'star · 深邃空灵的生成式环境音乐引擎（Web Audio API）
 * 无任何采样素材，全部实时合成：低频持续音 + 缓慢和声垫
 * + 星尘闪烁音 + 混响。另有 UI 交互音效。
 * ============================================================ */
window.ZAudio = (function () {
  'use strict';

  var ctx = null;
  var master = null, wetGain = null, dryGain = null, convolver = null;
  var musicBus = null, sfxBus = null;
  var running = false;
  var musicVolume = 0.55, sfxOn = true;
  var timers = [];
  var chordIdx = 0;

  /* 五声调式音阶（A 羽调式），空灵的基础 */
  var SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
  /* 缓慢循环的和弦进行（小九和弦家族，深邃感） */
  var CHORDS = [
    [110.00, 130.81, 164.81, 196.00, 246.94],   // Am9
    [87.31, 130.81, 174.61, 220.00, 261.63],    // Fmaj9
    [98.00, 146.83, 196.00, 246.94, 293.66],    // Gadd9
    [110.00, 164.81, 196.00, 246.94, 329.63],   // Am add11
    [73.42, 98.00, 146.83, 196.00, 246.94],     // Bbmaj9（深空忧郁）
    [92.50, 123.47, 164.81, 207.65, 246.94],    // Eadd9（外星异域）
    [82.41, 110.00, 146.83, 185.00, 220.00],    // Ebmaj7（冷星云）
    [87.31, 116.54, 146.83, 174.61, 220.00],    // Fm7b5（黑洞边缘）
    [65.41, 82.41, 98.00, 130.81, 164.81],      // Cmin11（极深空）
    [146.83, 196.00, 246.94, 293.66, 392.00]    // Gadd9 高八度（璀璨银河）
  ];

  function makeReverbIR(c) {
    /* 程序生成长混响脉冲响应：3.8 秒指数衰减立体声噪声 */
    var len = Math.floor(c.sampleRate * 3.8);
    var buf = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (1 - t * 0.2);
      }
    }
    return buf;
  }

  function ensureCtx() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);

    convolver = ctx.createConvolver();
    convolver.buffer = makeReverbIR(ctx);
    wetGain = ctx.createGain(); wetGain.gain.value = 0.5;
    dryGain = ctx.createGain(); dryGain.gain.value = 0.75;
    convolver.connect(wetGain); wetGain.connect(master);
    dryGain.connect(master);

    musicBus = ctx.createGain(); musicBus.gain.value = 1;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
    musicBus.connect(dryGain); musicBus.connect(convolver);
    sfxBus.connect(dryGain); sfxBus.connect(convolver);

    buildDrone();
    buildShimmer();
    return true;
  }

  /* ---------- 底层低频持续音（深邃） ---------- */
  function buildDrone() {
    var freqs = [55, 82.41, 110.3];
    freqs.forEach(function (f, i) {
      var osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.value = f;

      /* 缓慢失谐漂移 */
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.03 + i * 0.017;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.6 + i * 0.4;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      var g = ctx.createGain();
      g.gain.value = i === 0 ? 0.10 : 0.045;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      var flfo = ctx.createOscillator();
      flfo.frequency.value = 0.02 + i * 0.011;
      var flfoG = ctx.createGain();
      flfoG.gain.value = 90;
      flfo.connect(flfoG); flfoG.connect(lp.frequency);

      osc.connect(g); g.connect(lp); lp.connect(musicBus);
      osc.start(); lfo.start(); flfo.start();
    });
  }

  /* ---------- 星尘噪声微光层 ---------- */
  function buildShimmer() {
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 14;
    var g = ctx.createGain(); g.gain.value = 0.006;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.023;
    var lg = ctx.createGain(); lg.gain.value = 0.004;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(bp); bp.connect(g); g.connect(musicBus);
    src.start(); lfo.start();
  }

  /* ---------- 和声垫：每 16~22 秒淡入新和弦 ---------- */
  function playPadChord() {
    if (!running) return;
    var chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    var now = ctx.currentTime;
    chord.forEach(function (f, i) {
      [0, 1].forEach(function (pan) {
        var osc = ctx.createOscillator();
        osc.type = i < 2 ? 'sine' : 'triangle';
        osc.frequency.value = f * (1 + (Math.random() - 0.5) * 0.002);
        osc.detune.value = (Math.random() - 0.5) * 7;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.028, now + 6 + i * 0.8);
        g.gain.linearRampToValueAtTime(0.0001, now + 19 + i);
        var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (p) { p.pan.value = pan ? 0.5 : -0.5; osc.connect(g); g.connect(p); p.connect(musicBus); }
        else { osc.connect(g); g.connect(musicBus); }
        osc.start(now); osc.stop(now + 21 + i);
      });
    });
    timers.push(setTimeout(playPadChord, (16 + Math.random() * 6) * 1000));
  }

  /* ---------- 空灵闪烁音（随机五声音阶 + 回声） ---------- */
  function playSparkle() {
    if (!running) return;
    var now = ctx.currentTime;
    var n = 1 + Math.floor(Math.random() * 3);
    for (var k = 0; k < n; k++) {
      var f = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() < 0.3 ? 2 : 1);
      var t0 = now + k * (0.4 + Math.random() * 1.4);
      var osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.04, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
      osc.connect(g); g.connect(musicBus);
      osc.start(t0); osc.stop(t0 + 2.4);
    }
    timers.push(setTimeout(playSparkle, (3.5 + Math.random() * 6) * 1000));
  }

  /* ---------- 脉冲星高频脉冲（深空天体特有） ---------- */
  function playPulse() {
    if (!running) return;
    var now = ctx.currentTime;
    var base = 1400 + Math.random() * 3200;
    var osc = ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = base;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.04, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = base; bp.Q.value = 8;
    osc.connect(bp); bp.connect(g); g.connect(musicBus);
    osc.start(now); osc.stop(now + 0.1);
    /* 加第二谐波 */
    var o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = base * 2;
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.exponentialRampToValueAtTime(0.018, now + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    o2.connect(g2); g2.connect(musicBus);
    o2.start(now); o2.stop(now + 0.06);
    timers.push(setTimeout(playPulse, (4 + Math.random() * 14) * 1000));
  }

  /* ---------- 黑洞低频 drone（深不见底的隆隆声） ---------- */
  function playDeepDrone() {
    if (!running) return;
    var now = ctx.currentTime;
    var f = 48.75 + Math.random() * 12;  /* ~ C1 - C#1 之间 */
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = f;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    var lfog = ctx.createGain(); lfog.gain.value = 1.2;
    lfo.connect(lfog); lfog.connect(osc.frequency);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 4;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.032, now + 8);
    g.gain.linearRampToValueAtTime(0.0001, now + 26);
    osc.connect(lp); lp.connect(g); g.connect(musicBus);
    osc.start(now); lfo.start(now);
    osc.stop(now + 27); lfo.stop(now + 27);
    timers.push(setTimeout(playDeepDrone, (18 + Math.random() * 24) * 1000));
  }

  /* ---------- 对外接口 ---------- */
  function start() {
    if (!ensureCtx()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    if (running) return true;
    running = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(musicVolume, ctx.currentTime + 2.5);
    playPadChord();
    timers.push(setTimeout(playSparkle, 1800));
    timers.push(setTimeout(playPulse, 6500));
    timers.push(setTimeout(playDeepDrone, 12000));
    return true;
  }

  function stop() {
    if (!ctx || !running) return;
    running = false;
    timers.forEach(clearTimeout); timers = [];
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 1.2);
  }

  function setVolume(v) {
    musicVolume = v;
    if (ctx && running) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.4);
    }
  }

  /* ---------- UI 音效 ---------- */
  function blip(freq, dur, type, vol) {
    if (!ctx || !sfxOn) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  var sfx = {
    click: function () { blip(620, 0.1, 'sine', 0.1); },
    select: function () { blip(523.25, 0.14, 'sine', 0.09); setTimeout(function () { blip(783.99, 0.2, 'sine', 0.08); }, 90); },
    whoosh: function () {
      if (!ctx || !sfxOn) return;
      var t = ctx.currentTime;
      var len = ctx.sampleRate * 0.7;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      src.connect(bp); bp.connect(g); g.connect(sfxBus);
      src.start(t);
    }
  };

  function setSfx(on) { sfxOn = on; }

  return {
    start: start, stop: stop, setVolume: setVolume, setSfx: setSfx,
    sfx: sfx, isRunning: function () { return running; }
  };
})();
