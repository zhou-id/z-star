/* ============================================================
 * z'star · UI 主逻辑
 * 着陆页 → 探索模式切换、信息面板、设置、主题、音效、
 * 鼠标粒子特效、性能守护提示
 * ============================================================ */
(function () {
  'use strict';

  var D = window.ZDATA;
  var $ = function (id) { return document.getElementById(id); };

  var settings = {
    theme: 'nebula', music: true, musicVol: 0.55, sfx: true,
    quality: 'auto', trail: 120, orbits: true, labels: true, belts: true
  };
  var inExplore = false, sceneReady = false;
  var registry = {};   // id -> {name,en,type,data,desc,actions}

  /* ================= 工具 ================= */
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }
  function saveSettings() {
    try { localStorage.setItem('zstar-settings', JSON.stringify(settings)); } catch (e) { }
  }
  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem('zstar-settings') || '{}');
      for (var k in s) if (k in settings) settings[k] = s[k];
    } catch (e) { }
  }
  function themeById(id) {
    for (var i = 0; i < D.THEMES.length; i++) if (D.THEMES[i].id === id) return D.THEMES[i];
    return D.THEMES[0];
  }

  /* ================= 主题 ================= */
  function applyTheme(id) {
    var th = themeById(id);
    settings.theme = th.id;
    var r = document.documentElement.style;
    r.setProperty('--c1', th.c1);
    r.setProperty('--c2', th.c2);
    r.setProperty('--c3', th.c3);
    r.setProperty('--accent', th.accent);
    r.setProperty('--body-bg', th.bodyBg);
    document.querySelectorAll('.theme-swatch').forEach(function (b) {
      b.classList.toggle('on', b.dataset.id === th.id);
    });
    ZBackground.setTheme(th);
    if (sceneReady) ZScene.setTheme(th);
    saveSettings();
  }

  /* ================= 天体注册表（供信息面板） ================= */
  function buildRegistry() {
    registry = {};
    var S = D.SOLAR;
    registry[S.sun.id] = { name: S.sun.name, en: S.sun.en, type: S.sun.type, data: S.sun.data, desc: S.sun.desc };
    S.planets.forEach(function (p) {
      registry[p.id] = { name: p.name, en: p.en, type: p.type, data: p.data, desc: p.desc };
      if (p.id === 'earth') registry[p.id].satToggle = true;
      (p.moons || []).forEach(function (m) {
        registry[m.id] = { name: m.name, en: m.en, type: m.type, data: m.data, desc: m.desc, parent: p.name };
      });
    });
    S.dwarfs.forEach(function (p) {
      registry[p.id] = { name: p.name, en: p.en, type: p.type, data: p.data, desc: p.desc };
      (p.moons || []).forEach(function (m) {
        registry[m.id] = { name: m.name, en: m.en, type: m.type, data: m.data, desc: m.desc, parent: p.name };
      });
    });
    registry[S.halley.id] = { name: S.halley.name, en: S.halley.en, type: S.halley.type, data: S.halley.data, desc: S.halley.desc };
    /* 全部额外卫星 */
    Object.keys(D.EXTRA_MOONS || {}).forEach(function (pid) {
      (D.EXTRA_MOONS[pid] || []).forEach(function (m) {
        registry[m.id] = { name: m.name, en: m.en, type: '卫星', data: { '轨道半径': (m.dist || 0).toFixed(2) + '（艺术化）', '公转周期': (m.period || 0).toFixed(2) + ' 天' }, desc: m.desc || '', parent: pid };
      });
    });
    D.SATELLITES.forEach(function (s) {
      registry['sat_' + s.id] = {
        name: s.name, en: s.en, type: '人造卫星', data: s.data, desc: s.desc,
        back: { id: 'earth', label: '返回地球' }
      };
    });
    D.DEEP.forEach(function (o) {
      registry[o.id] = { name: o.name, en: o.en, type: o.type || '深空天体', data: o.data, desc: o.desc };
    });
  }

  /* ================= 信息面板 ================= */
  function fillInfo(id) {
    var info = registry[id];
    var panel = $('infoPanel');
    if (!info) { panel.classList.remove('open'); return; }
    $('infoName').textContent = info.name;
    $('infoEn').textContent = info.en || '';
    $('infoType').textContent = info.type || '';
    var grid = $('infoData');
    grid.innerHTML = '';
    for (var k in info.data) {
      var row = document.createElement('div');
      row.className = 'data-row';
      row.innerHTML = '<span class="dk"></span><span class="dv"></span>';
      row.children[0].textContent = k;
      row.children[1].textContent = info.data[k];
      grid.appendChild(row);
    }
    $('infoDesc').textContent = info.desc || '';
    var actions = $('infoActions');
    actions.innerHTML = '';
    function addBtn(label, fn, primary) {
      var b = document.createElement('button');
      b.className = 'btn small' + (primary ? ' primary' : '');
      b.textContent = label;
      b.addEventListener('click', function () { ZAudio.sfx.click(); fn(); });
      actions.appendChild(b);
    }
    if (info.satToggle) {
      var on = sceneReady && ZScene.isSatVisible();
      addBtn(on ? '隐藏人造卫星' : '查看人造卫星', function () {
        var next = !ZScene.isSatVisible();
        ZScene.showSatellites(next);
        fillInfo(id);
        toast(next ? '已进入地球轨道 · 6 种人造卫星模型' : '已隐藏人造卫星');
      }, true);
    }
    /* 内部解剖按钮：toggle 逻辑 */
    var canAnatomy = sceneReady && ZScene.showAnatomy && !info.parent && !info.back
                     && id !== 'halley' && id !== 'sun';
    if (canAnatomy) {
      var currentlyOpen = ZScene.getAnatomyId && ZScene.getAnatomyId() === id;
      addBtn(currentlyOpen ? '✕ 关闭解剖' : '🔬 内部解剖', function () {
        if (ZScene.getAnatomyId && ZScene.getAnatomyId() === id) {
          ZScene.hideAnatomy();
          toast('解剖面已关闭');
        } else {
          ZScene.showAnatomy(id);
          toast('解剖面已开启 · 再次点击关闭');
        }
        fillInfo(id);  /* 刷新按钮文本 */
      }, currentlyOpen);
    }
    if (info.parent) addBtn('聚焦 ' + info.parent, function () { ZScene.select(info.parent); });
    if (info.back) addBtn(info.back.label, function () { ZScene.select(info.back.id); });
    panel.classList.add('open');
  }

  /* ================= 快速选择 Chips ================= */
  var _deepCat = 'all';
  function buildChips() {
    var bar = $('chipBar');
    bar.innerHTML = '';
    var list = [];
    if (ZScene.getMode() === 'solar') {
      list = [
        { id: 'sun', name: '太阳' },
        { id: 'mercury', name: '水星' }, { id: 'venus', name: '金星' },
        { id: 'earth', name: '地球' }, { id: 'mars', name: '火星' },
        { id: 'jupiter', name: '木星' }, { id: 'saturn', name: '土星' },
        { id: 'uranus', name: '天王星' }, { id: 'neptune', name: '海王星' },
        { id: 'pluto', name: '冥王星' }, { id: 'ceres', name: '谷神星' },
        { id: 'eris', name: '阋神星' }, { id: 'makemake', name: '鸟神星' },
        { id: 'haumea', name: '妊神星' }, { id: 'halley', name: '哈雷彗星' }
      ];
      $('deepCatBar').classList.add('hidden');
    } else {
      $('deepCatBar').classList.remove('hidden');
      var filtered = D.DEEP;
      if (_deepCat !== 'all' && D.DEEP_CATS[_deepCat]) {
        var set = {}; D.DEEP_CATS[_deepCat].forEach(function (id) { set[id] = 1; });
        filtered = D.DEEP.filter(function (o) { return set[o.id]; });
      }
      list = filtered.map(function (o) { return { id: o.id, name: o.name }; });
    }
    list.forEach(function (it) {
      var c = document.createElement('button');
      c.className = 'chip';
      c.textContent = it.name;
      c.dataset.id = it.id;
      c.addEventListener('click', function () { ZAudio.sfx.select(); ZScene.select(it.id); });
      bar.appendChild(c);
    });
    markChip();
  }
  function buildDeepCatBar() {
    var bar = $('deepCatBar');
    bar.innerHTML = '';
    var b0 = document.createElement('button');
    b0.className = 'cat-btn' + (_deepCat === 'all' ? ' on' : '');
    b0.textContent = '全部'; b0.dataset.cat = 'all'; bar.appendChild(b0);
    Object.keys(D.DEEP_CATS).forEach(function (cat) {
      var b = document.createElement('button');
      b.className = 'cat-btn' + (_deepCat === cat ? ' on' : '');
      b.textContent = cat; b.dataset.cat = cat; bar.appendChild(b);
    });
    bar.querySelectorAll('.cat-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _deepCat = btn.dataset.cat;
        bar.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.toggle('on', b === btn); });
        buildChips(); ZAudio.sfx.click();
      });
    });
  }
  function markChip() {
    var sel = sceneReady ? ZScene.getSelected() : null;
    document.querySelectorAll('.chip').forEach(function (c) {
      c.classList.toggle('on', c.dataset.id === sel);
    });
  }

  /* ================= 鼠标粒子特效层 ================= */
  var fxParts = [], fxRunning = false;
  function fxSpawn(x, y, burst) {
    var n = burst ? 26 : 2;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, sp = burst ? rand2(0.6, 3.2) : rand2(0.15, 0.7);
      fxParts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (burst ? 0.4 : 0.15),
        life: 1, decay: burst ? 0.022 : 0.02,
        size: burst ? rand2(1.2, 3) : rand2(0.6, 1.8),
        col: Math.random() < 0.5 ? getComputedStyle(document.documentElement).getPropertyValue('--c3').trim() : '#ffffff'
      });
    }
    if (fxParts.length > 260) fxParts.splice(0, fxParts.length - 260);
  }
  function rand2(a, b) { return a + Math.random() * (b - a); }
  function fxLoop() {
    if (!fxRunning) return;
    requestAnimationFrame(fxLoop);
    var cv = $('fx2d');
    var c = cv.getContext('2d');
    if (cv.width !== window.innerWidth * (window.devicePixelRatio > 1.5 ? 1.5 : 1)) {
      var dp = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = window.innerWidth * dp; cv.height = window.innerHeight * dp;
      cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
      cv.getContext('2d').setTransform(dp, 0, 0, dp, 0, 0);
    }
    c.clearRect(0, 0, window.innerWidth, window.innerHeight);
    c.globalCompositeOperation = 'lighter';
    for (var i = fxParts.length - 1; i >= 0; i--) {
      var p = fxParts[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= p.decay;
      if (p.life <= 0) { fxParts.splice(i, 1); continue; }
      c.globalAlpha = p.life * 0.8;
      c.fillStyle = p.col;
      c.beginPath();
      c.arc(p.x, p.y, p.size * p.life + 0.3, 0, 6.28);
      c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
  function bindFx() {
    var target = $('scene3d');
    target.addEventListener('pointermove', function (e) {
      if (!inExplore) return;
      if (Math.random() < 0.75) fxSpawn(e.clientX, e.clientY, false);
    }, { passive: true });
  }

  /* ================= 探索模式进入 / 退出 ================= */
  function enterExplore() {
    if (!sceneReady) {
      $('loading').classList.add('show');
      /* 让加载层先绘制，再执行较重的纹理生成 */
      setTimeout(function () {
        try {
          ZScene.init($('scene3d'), $('labels'), {
            onSelect: function (id) { fillInfo(id); markChip(); },
            onHover: function (id) { /* 悬停由场景处理 */ },
            onPause: function () { $('pauseOverlay').classList.add('show'); }
          });
          ZScene.setQuality(settings.quality === 'auto' ? (ZScene.isMobile ? 'mid' : 'high') : settings.quality);
          ZScene.setMode('solar');
          ZScene.setTrailLen(settings.trail);
          ZScene.setShowOrbits(settings.orbits);
          ZScene.setShowLabels(settings.labels);
          ZScene.setShowBelts(settings.belts);
          ZScene.setSpeed(speedFromSlider());
          sceneReady = true;
        } catch (err) {
          $('loading').classList.remove('show');
          toast('3D 引擎初始化失败：' + err.message);
          return;
        }
        $('loading').classList.remove('show');
        startExploreUI();
      }, 60);
      return;
    }
    startExploreUI();
  }

  function startExploreUI() {
    inExplore = true;
    ZBackground.stop();
    $('landing').classList.add('gone');
    $('hud').classList.remove('hidden');
    $('scene3d').classList.add('active');
    $('labels').classList.add('active');
    buildChips();
    ZScene.setActive(true);
    if (settings.music) ZAudio.start();
    setTimeout(function () {
      toast('拖动旋转视角 · 滚轮 / 双指缩放 · 点击天体查看详情', 4200);
    }, 700);
  }

  function exitExplore() {
    inExplore = false;
    ZScene.setActive(false);
    ZScene.deselect();
    $('hud').classList.add('hidden');
    $('infoPanel').classList.remove('open');
    $('settingsPanel').classList.remove('open');
    $('landing').classList.remove('gone');
    $('scene3d').classList.remove('active');
    $('labels').classList.remove('active');
    ZBackground.start();
  }

  /* ================= 时间控制 ================= */
  function speedFromSlider() {
    var v = parseFloat($('speedSlider').value);
    return 0.1 * Math.pow(10, v / 25);
  }
  function speedText(sp) {
    if (sp < 1) return (sp * 24).toFixed(1) + ' 小时 / 秒';
    if (sp < 60) return sp.toFixed(1) + ' 天 / 秒';
    return (sp / 365.25).toFixed(2) + ' 年 / 秒';
  }
  function bindTimeControls() {
    $('btnPlay').addEventListener('click', function () {
      var p = $('btnPlay').classList.toggle('paused');
      ZScene.setPaused(p);
      $('btnPlay').textContent = p ? '▶' : '⏸';
      ZAudio.sfx.click();
    });
    $('speedSlider').addEventListener('input', function () {
      var sp = speedFromSlider();
      ZScene.setSpeed(sp);
      $('speedLabel').textContent = speedText(sp);
    });
    $('btnResetTime').addEventListener('click', function () {
      ZScene.resetTime();
      toast('时间已重置');
      ZAudio.sfx.click();
    });
    setInterval(function () {
      if (sceneReady && inExplore) $('simDate').textContent = ZScene.getSimDate();
    }, 400);
  }

  /* ================= 模式切换 ================= */
  function switchMode(m) {
    if (!sceneReady) return;
    if (ZScene.getMode() === m) return;
    var fade = $('fadeOverlay');
    fade.classList.add('show');
    ZAudio.sfx.whoosh();
    setTimeout(function () {
      ZScene.deselect();
      ZScene.setMode(m);
      document.querySelectorAll('.mode-btn').forEach(function (b) {
        b.classList.toggle('on', b.dataset.mode === m);
      });
      buildChips(); buildDeepCatBar();
      $('infoPanel').classList.remove('open');
      setTimeout(function () { fade.classList.remove('show'); }, 120);
    }, 420);
  }

  /* ================= 行星交互中心 ================= */
  function bindInteract() {
    $('btnInteractHud').addEventListener('click', function () {
      $('interactPanel').classList.toggle('open'); ZAudio.sfx.click();
    });
    $('btnCloseInteract').addEventListener('click', function () {
      $('interactPanel').classList.remove('open'); ZAudio.sfx.click();
    });
    /* 太阳温度（开尔文） */
    var prevTemp = -1;
    $('sunTempSlider').addEventListener('input', function (e) {
      var v = parseFloat(e.target.value);
      var label;
      if (v <= 500) label = Math.round(v) + ' K · 太阳熄灭！';
      else if (v < 2000) label = Math.round(v) + ' K · 红矮星';
      else if (v < 3500) label = Math.round(v) + ' K · 橙矮星';
      else if (v < 5000) label = Math.round(v) + ' K · 黄矮星（偏冷）';
      else if (v < 6500) label = Math.round(v) + ' K · G2V 主序';
      else if (v < 10000) label = Math.round(v) + ' K · F/A 蓝白';
      else if (v < 25000) label = Math.round(v / 1000) + ',' + (v % 1000 < 100 ? '0' : '') + Math.round(v % 1000) + ' K · B 型星';
      else label = (v / 1000).toFixed(1) + ' ×10³ K · O 型星';
      $('sunTempLabel').textContent = label;
      if (sceneReady) {
        ZScene.setEffect('sunTempK', v);
        if (v !== prevTemp) {
          prevTemp = v; ZAudio.sfx.whoosh();
          if (v <= 500) toast('☀ 太阳熄灭！所有行星瞬间冻结');
          else if (v <= 2000) toast('🌡 红矮星：远距行星先冻，宜居带内移');
          else if (v <= 3500) toast('🔥 橙矮星：火星地球都冻成雪球');
          else if (v >= 30000) toast('💥 O 型星！水星金星被烤蒸发，地球灼热');
          else if (v >= 15000) toast('🔥 高温蓝白：水星金星开始烘烤蒸发');
        }
      }
    });
    /* 轨道缩放 */
    $('orbitSlider').addEventListener('input', function (e) {
      var v = parseFloat(e.target.value) / 100;
      $('orbitLabel').textContent = '× ' + v.toFixed(2);
      if (sceneReady) {
        ZScene.setEffect('orbitScale', v);
        if (v > 1.6) toast('轨道大幅外移 → 行星间距增大');
        else if (v < 0.6) toast('轨道紧缩 → 行星互相引力干扰加剧');
      }
    });
    /* 衰老加速（直接映射到阶段） */
    $('agingSlider').addEventListener('input', function (e) {
      var v = parseFloat(e.target.value);
      $('agingLabel').textContent = 'stage ' + (v >= 100 ? '4 白矮星' : v >= 70 ? '3 氦闪' : v >= 50 ? '2 红巨星' : v >= 20 ? '1 亚巨星' : '0 主序');
      if (sceneReady) {
        ZScene.setEffect('aging', v);
        if (v > 0) ZAudio.sfx.whoosh();
        if (v >= 100) toast('💀 白矮星！太阳坍缩成地球大小的致密残骸');
        else if (v >= 70) toast('💥 氦闪！太阳瞬间爆发吞噬内行星');
        else if (v >= 50) toast('🔴 红巨星！水星金星地球已被吞噬');
        updateStageHint();
      }
    });
    /* 重置 */
    $('btnResetEffects').addEventListener('click', function () {
      $('sunTempSlider').value = 5500;
      $('sunTempLabel').textContent = '5,500 K（主序）';
      $('orbitSlider').value = 100; $('orbitLabel').textContent = '× 1.00';
      $('agingSlider').value = 0; $('agingLabel').textContent = 'stage 0 主序';
      prevTemp = -1;
      if (sceneReady) {
        ZScene.setEffect('sunTempK', 5500);
        ZScene.setEffect('orbitScale', 1);
        ZScene.setEffect('aging', 0);
        ZScene.setEffect('starAge', 0);
        ZScene.resetTime();
      }
      updateStageHint();
      toast('全部效果已重置'); ZAudio.sfx.select();
    });
    updateStageHint();
  }
  function updateStageHint() {
    var stages = ['主序星', '亚巨星', '红巨星', '氦闪！', '白矮星'];
    var s = sceneReady ? ZScene.getEffect('starAge') : 0;
    $('stageHint').textContent = '当前阶段：' + stages[Math.min(s, 4)] + (s >= 2 ? '（吞噬水星/金星/地球中）' : '');
  }

  /* ================= 设置面板 ================= */
  function bindSettings() {
    $('btnSettings').addEventListener('click', function () { $('settingsPanel').classList.toggle('open'); ZAudio.sfx.click(); });
    $('btnSettingsHud').addEventListener('click', function () { $('settingsPanel').classList.toggle('open'); ZAudio.sfx.click(); });
    $('btnCloseSettings').addEventListener('click', function () { $('settingsPanel').classList.remove('open'); });

    /* 音乐 */
    $('musicToggle').checked = settings.music;
    $('musicVol').value = settings.musicVol * 100;
    $('musicToggle').addEventListener('change', function (e) {
      settings.music = e.target.checked;
      if (settings.music) ZAudio.start(); else ZAudio.stop();
      saveSettings();
      ZAudio.sfx.click();
    });
    $('musicVol').addEventListener('input', function (e) {
      settings.musicVol = e.target.value / 100;
      ZAudio.setVolume(settings.musicVol);
      saveSettings();
    });
    /* 音效 */
    $('sfxToggle').checked = settings.sfx;
    $('sfxToggle').addEventListener('change', function (e) {
      settings.sfx = e.target.checked;
      ZAudio.setSfx(settings.sfx);
      saveSettings();
    });
    /* 主题 */
    var sw = $('themeSwatches');
    sw.innerHTML = '';
    D.THEMES.forEach(function (th) {
      var b = document.createElement('button');
      b.className = 'theme-swatch' + (th.id === settings.theme ? ' on' : '');
      b.dataset.id = th.id;
      b.title = th.name;
      b.style.background = 'linear-gradient(135deg,' + th.c1 + ',' + th.c2 + ' 55%,' + th.c3 + ')';
      b.addEventListener('click', function () {
        applyTheme(th.id);
        ZAudio.sfx.click();
        toast('已切换主题：' + th.name);
      });
      sw.appendChild(b);
    });
    /* 画质 */
    var qSeg = $('qualitySeg');
    qSeg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.q === settings.quality);
      b.addEventListener('click', function () {
        settings.quality = b.dataset.q;
        qSeg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        var q = settings.quality === 'auto' ? (ZScene.isMobile ? 'mid' : 'high') : settings.quality;
        if (sceneReady) ZScene.setQuality(q);
        saveSettings();
        ZAudio.sfx.click();
        toast('画质：' + b.textContent);
      });
    });
    /* 轨迹长度 */
    $('trailSlider').value = settings.trail;
    $('trailLabel').textContent = settings.trail === 0 ? '关闭' : settings.trail + ' 帧';
    $('trailSlider').addEventListener('input', function (e) {
      settings.trail = parseInt(e.target.value, 10);
      $('trailLabel').textContent = settings.trail === 0 ? '关闭' : settings.trail + ' 帧';
      if (sceneReady) ZScene.setTrailLen(settings.trail);
      saveSettings();
    });
    /* 显示开关 */
    bindSwitch('orbitToggle', settings.orbits, function (v) { settings.orbits = v; if (sceneReady) ZScene.setShowOrbits(v); });
    bindSwitch('labelToggle', settings.labels, function (v) { settings.labels = v; if (sceneReady) ZScene.setShowLabels(v); });
    bindSwitch('beltToggle', settings.belts, function (v) { settings.belts = v; if (sceneReady) ZScene.setShowBelts(v); });
  }
  function bindSwitch(id, val, fn) {
    var el = $(id);
    el.checked = val;
    el.addEventListener('change', function (e) { fn(e.target.checked); saveSettings(); ZAudio.sfx.click(); });
  }

  /* ================= 模态框 ================= */
  function bindModals() {
    $('btnAbout').addEventListener('click', function () { openModal('aboutModal'); });
    $('btnAboutHud').addEventListener('click', function () { openModal('aboutModal'); });
    $('btnDisclaimer').addEventListener('click', function () { openModal('disclaimerModal'); });
    $('btnDisclaimerHud').addEventListener('click', function () { openModal('disclaimerModal'); });
    document.querySelectorAll('.modal-close').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('.modal-mask').classList.remove('show'); });
    });
    document.querySelectorAll('.modal-mask').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('show'); });
    });

    var ab = D.ABOUT;
    $('aboutIntro').textContent = ab.intro;
    var ul = $('aboutFeatures');
    ul.innerHTML = '';
    ab.features.forEach(function (f) {
      var li = document.createElement('li'); li.textContent = f; ul.appendChild(li);
    });
    $('aboutAuthor').textContent = ab.author;
    $('aboutStack').textContent = ab.stack;
    var dl = $('disclaimerList');
    dl.innerHTML = '';
    D.DISCLAIMER.forEach(function (s) {
      var li = document.createElement('li'); li.textContent = s; dl.appendChild(li);
    });
  }
  function openModal(id) {
    $(id).classList.add('show');
    ZAudio.sfx.click();
  }

  /* ================= HUD 按钮 ================= */
  function bindHud() {
    $('btnStart').addEventListener('click', function () {
      ZAudio.sfx.whoosh();
      if (settings.music) ZAudio.start();
      enterExplore();
    });
    $('btnHome').addEventListener('click', function () {
      ZAudio.sfx.whoosh();
      exitExplore();
    });
    $('btnSolar').addEventListener('click', function () { switchMode('solar'); });
    $('btnDeep').addEventListener('click', function () { switchMode('deep'); });
    $('btnMusicHud').addEventListener('click', function () {
      settings.music = !settings.music;
      $('musicToggle').checked = settings.music;
      if (settings.music) ZAudio.start(); else ZAudio.stop();
      saveSettings();
      $('btnMusicHud').classList.toggle('off', !settings.music);
      ZAudio.sfx.click();
    });
    $('btnInfoClose').addEventListener('click', function () {
      $('infoPanel').classList.remove('open');
      ZScene.deselect();
    });
    $('btnResume').addEventListener('click', function () {
      $('pauseOverlay').classList.remove('show');
      ZScene.setActive(true);
    });
    document.addEventListener('keydown', function (e) {
      if (!inExplore) return;
      if (e.code === 'Space') {
        e.preventDefault();
        $('btnPlay').click();
      } else if (e.code === 'Escape') {
        if ($('settingsPanel').classList.contains('open')) $('settingsPanel').classList.remove('open');
        else { $('infoPanel').classList.remove('open'); ZScene.deselect(); }
      }
    });
  }

  /* ================= 启动 ================= */
  function boot() {
    loadSettings();
    applyTheme(settings.theme);
    ZBackground.init();
    ZBackground.start();
    ZAudio.setVolume(settings.musicVol);
    ZAudio.setSfx(settings.sfx);
    buildRegistry();
    bindModals();
    bindSettings();
    bindInteract();
    bindHud();
    bindTimeControls();
    bindFx();
    fxRunning = true;
    fxLoop();
    buildDeepCatBar();
    $('speedLabel').textContent = speedText(speedFromSlider());

    /* Three.js 加载兜底 */
    function checkTHREE(retries) {
      if (window.THREE) return;
      if (retries <= 0) { toast('Three.js 渲染库加载失败，请检查网络后刷新'); return; }
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/three@0.128.0/build/three.min.js';
      s.onerror = function () { setTimeout(function () { checkTHREE(0); }, 100); };
      document.head.appendChild(s);
    }
    if (!window.THREE) {
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/three@0.128.0/build/three.min.js';
      s.onload = function () { };
      s.onerror = function () { toast('渲染库加载失败，请检查网络'); };
      document.head.appendChild(s);
      setTimeout(function () { checkTHREE(0); }, 4000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
