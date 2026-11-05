/* ============================================================
 * z'star · Three.js 三维场景引擎
 * 太阳系（行星/卫星/矮行星/小行星带/柯伊伯带/哈雷彗星）
 * 深空天体（双星/红超巨星/脉冲星/磁星/黑洞/星云/系外行星系）
 * 地球人造卫星 · 自定义轨道控制器 · 拾取与悬停特效
 * 全部纹理由程序噪声实时生成
 * ============================================================ */
window.ZScene = (function () {
  'use strict';

  var D = window.ZDATA;

  /* ================= 基础工具 ================= */
  function rad(d) { return d * Math.PI / 180; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* 确定性哈希噪声（value noise + fbm） */
  function hash2(x, y, seed) {
    var h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    var c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    var u = smooth(xf), v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, seed, oct) {
    var v = 0, amp = 0.5, f = 1;
    for (var i = 0; i < (oct || 4); i++) {
      v += vnoise(x * f, y * f, seed + i * 97) * amp;
      amp *= 0.5; f *= 2;
    }
    return v;
  }

  function lerpHex(h1, h2, t) {
    var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    var r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    var g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    var bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ================= 纹理工厂 ================= */
  var _texCache = new Map();
  function canvasTex(w, h, fn, cacheKey) {
    if (cacheKey && _texCache.has(cacheKey)) return _texCache.get(cacheKey);
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    fn(c, w, h);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (cacheKey) _texCache.set(cacheKey, t);
    return t;
  }
  function texKey(parts) { return parts.join('|'); }

  /* 通用行星纹理生成器 */
  var _ptexCacheSkip = false;  /* 跳过缓存：用于 applyEffectsToScene 换阶段时 */
  function planetTexture(cfg, W, H) {
    W = W || 512; H = H || 256;
    var kind = cfg.kind, seed = 7 + (cfg.seed || 1) * 131;
    var pal = cfg.palette || cfg.base;
    var pkey = texKey([kind, seed, W, H, pal ? pal.join('+') : '-', cfg.bands || 0, cfg.wobble || 0, cfg.craters || 0, cfg.spot ? 1 : 0]);
    var ckey = _ptexCacheSkip ? null : ('ptex:' + pkey);
    return canvasTex(W, H, function (c) {
      var img = c.createImageData(W, H), d = img.data;
      var pal = cfg.palette || cfg.base;
      function bandColor(t) {
        t = ((t % 1) + 1) % 1;
        var p = t * (pal.length - 1);
        var i = Math.floor(p);
        return lerpHex(pal[i], pal[Math.min(i + 1, pal.length - 1)], p - i);
      }
      function put(x, y, css) {
        var r, g, b;
        if (css[0] === '#') { var n = parseInt(css.slice(1), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
        else { var m = css.match(/(\d+)/g); r = +m[0]; g = +m[1]; b = +m[2]; }
        var i4 = (y * W + x) * 4;
        d[i4] = r; d[i4 + 1] = g; d[i4 + 2] = b; d[i4 + 3] = 255;
      }
      var x, y;
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          var u = x / W, v = y / H;
          var col;
          if (kind === 'bands') {
            var warp = fbm(u * 5, v * 5, seed, 4) - 0.5;
            var bv = v * (cfg.bands || 10) + warp * (cfg.wobble || 0.6);
            col = bandColor(bv / 1.2 + fbm(u * 12, v * 12, seed + 5, 3) * 0.25);
          } else if (kind === 'swirl') {
            var w2 = fbm(u * 4 + Math.sin(v * 6.28) * 0.6, v * 8, seed, 4);
            col = bandColor(w2 * 0.95);
          } else if (kind === 'sun') {
            var gr = fbm(u * 14, v * 14, seed, 4);
            col = lerpHex('#ffdd55', '#ff8819', gr * 0.8);
          } else if (kind === 'earth') {
            var cont = fbm(u * 3.2, v * 3.2, seed, 5);
            var lat = Math.abs(v - 0.5) * 2;
            if (cont > 0.545) {
              var veg = fbm(u * 9, v * 9, seed + 9, 3);
              col = lerpHex('#3e7a3a', lat > 0.62 ? '#c8c8c0' : '#8a7a4a', veg);
              if (lat > 0.72) col = lerpHex(col, '#e8f0f2', (lat - 0.72) * 4);
            } else {
              var dp = clamp((0.545 - cont) * 6, 0, 1);
              col = lerpHex('#2a6db3', '#0b2f63', dp);
              if (lat > 0.82) col = '#e8f0f5';
            }
          } else if (kind === 'mars') {
            var m1 = fbm(u * 5, v * 5, seed, 4);
            col = lerpHex('#c1613b', '#7a3a22', m1);
            if (Math.abs(v - 0.06) < 0.045 || Math.abs(v - 0.94) < 0.045) col = '#e8e0d8';
          } else if (kind === 'rock') {
            var r1 = fbm(u * 6, v * 6, seed, 4);
            col = bandColor(r1 * 0.9);
          } else if (kind === 'ice') {
            var i1 = fbm(u * 5, v * 5, seed, 4);
            col = lerpHex('#eef4f8', '#bcd2e0', i1 * 0.7);
          } else if (kind === 'io') {
            var s1 = fbm(u * 6, v * 6, seed, 4);
            col = lerpHex('#e8d44a', '#c96a22', s1);
          } else if (kind === 'europa') {
            col = lerpHex('#e8e2d8', '#c8b8a8', fbm(u * 7, v * 7, seed, 3) * 0.5);
          } else if (kind === 'neptune') {
            var n1 = fbm(u * 4, v * 6, seed, 4);
            col = lerpHex('#2a52c8', '#3a6ae0', n1);
          } else if (kind === 'pluto') {
            var p1 = fbm(u * 5, v * 5, seed, 4);
            col = lerpHex('#c8a878', '#6a4a32', p1);
          } else {
            col = pal ? bandColor(fbm(u * 5, v * 5, seed, 4)) : '#888';
          }
          put(x, y, col);
        }
      }
      c.putImageData(img, 0, 0);

      /* 陨石坑 */
      if (cfg.craters) {
        for (var k = 0; k < cfg.craters; k++) {
          var cx = Math.random() * W, cy = rand(H * 0.08, H * 0.92);
          var cr = rand(2, 10);
          c.fillStyle = 'rgba(0,0,0,0.25)';
          c.beginPath(); c.arc(cx, cy, cr, 0, 6.29); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.18)';
          c.lineWidth = 1;
          c.beginPath(); c.arc(cx, cy, cr, -2.6, 0.4); c.stroke();
        }
      }
      /* 木星大红斑 */
      if (cfg.spot) {
        var sx = W * 0.71, sy = H * 0.62;
        var grd = c.createRadialGradient(sx, sy, 2, sx, sy, 26);
        grd.addColorStop(0, '#c8482a');
        grd.addColorStop(0.7, '#b0552f');
        grd.addColorStop(1, 'rgba(176,85,47,0)');
        c.fillStyle = grd;
        c.save(); c.translate(sx, sy); c.scale(1.5, 1); c.translate(-sx, -sy);
        c.beginPath(); c.arc(sx, sy, 26, 0, 6.29); c.fill();
        c.restore();
      }
      /* 欧罗巴裂纹 */
      if (kind === 'europa') {
        c.strokeStyle = 'rgba(150,90,60,0.5)';
        for (var e = 0; e < 26; e++) {
          c.lineWidth = rand(0.5, 1.6);
          c.beginPath();
          var ex = Math.random() * W, ey = Math.random() * H;
          c.moveTo(ex, ey);
          c.bezierCurveTo(ex + rand(-60, 60), ey + rand(-30, 30), ex + rand(-90, 90), ey + rand(-40, 40), ex + rand(-140, 140), ey + rand(-50, 50));
          c.stroke();
        }
      }
      /* 木卫一火山斑点 */
      if (kind === 'io') {
        for (var v2 = 0; v2 < 40; v2++) {
          c.fillStyle = Math.random() < 0.5 ? 'rgba(60,30,10,0.6)' : 'rgba(220,80,30,0.5)';
          c.beginPath(); c.arc(Math.random() * W, rand(H * 0.1, H * 0.9), rand(1.5, 4.5), 0, 6.29); c.fill();
        }
      }
      /* 海王星风暴斑 */
      if (kind === 'neptune') {
        var nd = c.createRadialGradient(W * 0.3, H * 0.42, 2, W * 0.3, H * 0.42, 22);
        nd.addColorStop(0, 'rgba(10,20,80,0.85)');
        nd.addColorStop(1, 'rgba(10,20,80,0)');
        c.fillStyle = nd;
        c.beginPath(); c.arc(W * 0.3, H * 0.42, 22, 0, 6.29); c.fill();
      }
      /* 冥王星心形冰原 */
      if (kind === 'pluto') {
        c.fillStyle = 'rgba(240,228,208,0.9)';
        c.beginPath();
        c.ellipse ? c.ellipse(W * 0.62, H * 0.6, 40, 28, 0.3, 0, 6.29)
                  : c.arc(W * 0.62, H * 0.6, 32, 0, 6.29);
        c.fill();
      }
    }, ckey);
  }

  /* 柔光点（粒子贴图，白色可染色） */
  var _dotTex = null;
  function dotTex() {
    if (_dotTex) return _dotTex;
    _dotTex = canvasTex(64, 64, function (c) {
      var g = c.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    return _dotTex;
  }
  /* 光晕（径向渐变） */
  var _glowTex = null;
  function glowTex() {
    if (_glowTex) return _glowTex;
    _glowTex = canvasTex(256, 256, function (c) {
      var g = c.createRadialGradient(128, 128, 0, 128, 128, 126);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.18, 'rgba(255,255,255,0.65)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    });
    return _glowTex;
  }
  /* 薄圆环（光子环 / 脉冲环，白色可染色） */
  var _ringTex = null;
  function ringTex() {
    if (_ringTex) return _ringTex;
    _ringTex = canvasTex(256, 256, function (c) {
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.lineWidth = 5;
      c.shadowColor = 'rgba(255,255,255,0.9)';
      c.shadowBlur = 14;
      c.beginPath(); c.arc(128, 128, 108, 0, 6.29); c.stroke();
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(128, 128, 118, 0, 6.29); c.stroke();
      c.beginPath(); c.arc(128, 128, 98, 0, 6.29); c.stroke();
    });
    return _ringTex;
  }
  /* 不规则星云团块（白色可染色） */
  function blobTex(seed) {
    return canvasTex(256, 256, function (c) {
      c.filter = 'blur(18px)';
      for (var i = 0; i < 7; i++) {
        var a = Math.random() * 6.29, r = rand(20, 70);
        var x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.7;
        var g = c.createRadialGradient(x, y, 0, x, y, rand(30, 62));
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, 64, 0, 6.29); c.fill();
      }
      c.filter = 'none';
    });
  }
  /* 行星环纹理（径向条带） */
  function ringTexture(pale) {
    return canvasTex(512, 512, function (c) {
      var img = c.createImageData(512, 512), d = img.data;
      for (var y = 0; y < 512; y++) {
        for (var x = 0; x < 512; x++) {
          var dx = x - 256, dy = y - 256;
          var r = Math.sqrt(dx * dx + dy * dy) / 256;
          var i4 = (y * 512 + x) * 4;
          if (r < 0.5 || r > 1) { d[i4 + 3] = 0; continue; }
          var t = (r - 0.5) / 0.5;
          var n = vnoise(t * 40, 3.7, 99) * 0.7 + vnoise(t * 90, 8.1, 55) * 0.3;
          var a = 0.15 + n * 0.75;
          /* 卡西尼环缝 */
          if (t > 0.66 && t < 0.73) a *= 0.12;
          if (t > 0.28 && t < 0.33) a *= 0.35;
          if (t < 0.06) a *= t / 0.06;
          var br = 200 + n * 55;
          d[i4] = br; d[i4 + 1] = br * 0.93; d[i4 + 2] = br * 0.78;
          d[i4 + 3] = Math.min(255, a * 255 * (pale ? 0.4 : 1));
        }
      }
      c.putImageData(img, 0, 0);
    });
  }

  /* ================= 场景状态 ================= */
  var renderer, scene, camera;
  var solarGroup, deepGroup, satsGroup, orbitGroup, starPoints, nebulaSprites = [];
  var bodies = {};          // id -> {def, holder, mesh, proxy, glow, label...}
  var deepAnims = [];
  var pickList = [];
  var tracked = [];         // 轨迹天体
  var orbitMats = [];
  var beltA, beltB;
  var theme = D.THEMES[0];
  var quality = D.QUALITY.high, qualityId = 'high';
  var mode = 'solar';
  var simDays = 0, speed = 2, paused = false, tReal = 0;
  var selectedId = null, hoverId = null;
  var trailLen = 120;
  var showOrbits = true, showLabels = true, showBelts = true;
  var satsVisible = false;
  var labelsRoot;
  var cbSelect = null, cbPause = null;
  var isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  var epochMs = new Date('2026-01-01T00:00:00').getTime();
  var halley = null;
  var _extraMoonDefs = [];

  /* ---------- 交互状态 / 效果链 ---------- */
  var EFFECTS = {
    sunTempK: 5500,     // 太阳实际温度（开尔文），0 ~ 100000
    orbitScale: 1.0,    // 轨道缩放 0.4 ~ 2.4
    starAge: 0,         // 太阳衰老阶段 0~4：0主序 1亚巨星 2红巨星 3氦闪 4白矮星
    aging: 0,           // 衰老加速
    sunRadiusScale: 1.0
  };
  var _sunLight = null;
  var _effectsApplied = {};
  var _orbitPlanes = [];
  function applyEffectsToScene() {
    var sun = bodies['sun'];
    if (!sun) return;
    var sunCol = sun.mesh.material.color;
    var T = EFFECTS.sunTempK;

    /* ========== 太阳温度驱动：色温 + 光强 + 颜色 ========== */
    /* 黑体色温近似：低→红橙，中→黄，高→蓝白 */
    var tempRatio = T / 5500;  /* 相对于太阳真实温度 5500K */
    var intensity, colRGB;
    if (T <= 500) {
      /* 几乎熄灭 */
      intensity = 0.05; colRGB = [0x22, 0x11, 0x08];
    } else if (T < 2000) {
      intensity = 0.3 * (T / 2000); colRGB = [0xff, 0x44, 0x10];
    } else if (T < 3500) {
      intensity = 0.7 * (T / 3500); colRGB = [0xff, 0x88, 0x30];
    } else if (T < 5000) {
      intensity = 1.1 * (T / 5000); colRGB = [0xff, 0xc0, 0x70];
    } else if (T < 7000) {
      intensity = 1.5 + (T - 5500) / 2000; colRGB = [0xff, 0xe8, 0xc0];
    } else if (T < 10000) {
      intensity = 1.8 + (T - 7000) / 3000; colRGB = [0xff, 0xf0, 0xe0];
    } else if (T < 20000) {
      intensity = 2.0 + (T - 10000) / 5000; colRGB = [0xa0, 0xd0, 0xff];
    } else if (T < 40000) {
      intensity = 2.5 + Math.log10(T / 20000); colRGB = [0x80, 0xb0, 0xff];
    } else {
      intensity = 3.0; colRGB = [0x90, 0xc0, 0xff];
    }

    /* ========== 太阳衰老阶段覆盖 ========== */
    if (_effectsApplied.starAge !== EFFECTS.starAge) {
      _ptexCacheSkip = true;
      var stage = EFFECTS.starAge;
      if (stage >= 4) {
        sun.mesh.material.map = planetTexture({ kind: 'rock', base: ['#d8e0f0', '#b0c0dc'], craters: 20 }, 256, 128);
        sun.mesh.material.emissive = new THREE.Color('#88a8ff');
        sun.mesh.material.emissiveIntensity = 0.65;
        EFFECTS.sunRadiusScale = 0.35;
      } else if (stage >= 3) {
        sunCol.set(0xffd0a0);
        EFFECTS.sunRadiusScale = 5.2;
      } else if (stage >= 2) {
        sun.mesh.material.map = planetTexture({ kind: 'bands', palette: ['#ff5028', '#ff8a4a', '#ffb060', '#d83020', '#ff9050'], bands: 8, wobble: 1.0 }, 512, 256);
        sunCol.set(0xff5a2a);
        EFFECTS.sunRadiusScale = 4.6;
      } else if (stage >= 1) {
        sun.mesh.material.map = planetTexture({ kind: 'bands', palette: ['#ffcf6a', '#ffa040', '#ffd272'], bands: 6, wobble: 0.6 }, 512, 256);
        sunCol.set(0xffb870);
        EFFECTS.sunRadiusScale = 1.8;
      } else {
        sun.mesh.material.map = planetTexture({ kind: 'sun' }, 512, 256);
        sunCol.set(0xffd460);
        EFFECTS.sunRadiusScale = 1.0;
      }
      sun.mesh.material.needsUpdate = true;
      sun.mesh.scale.setScalar(EFFECTS.sunRadiusScale);
      _effectsApplied.starAge = EFFECTS.starAge;
      _ptexCacheSkip = false;
    }

    /* ========== 应用色温 ========== */
    sunCol.setRGB(colRGB[0] / 255, colRGB[1] / 255, colRGB[2] / 255);
    if (_sunLight) {
      if (EFFECTS.starAge >= 3) {
        _sunLight.intensity = 2.2 * (1 + 0.2 * Math.sin(tReal * 18));
      } else {
        _sunLight.intensity = intensity;
      }
      _sunLight.color.setRGB(colRGB[0] / 255, colRGB[1] / 255, colRGB[2] / 255);
    }
    /* 日冕跟随色温 */
    if (sun.corona1) {
      sun.corona1.material.color.setRGB(colRGB[0] / 255 * 1.2, colRGB[1] / 255, colRGB[2] / 255);
      sun.corona2.material.color.setRGB(colRGB[0] / 255, colRGB[1] / 255 * 0.8, colRGB[2] / 255 * 0.9);
      var p1 = 1 + Math.sin(tReal * 1.1 * Math.max(tempRatio, 0.2)) * 0.05;
      sun.corona1.scale.set(26 * EFFECTS.sunRadiusScale * p1, 26 * EFFECTS.sunRadiusScale * p1, 1);
      sun.corona2.scale.set(46 * EFFECTS.sunRadiusScale * (2 - p1), 46 * EFFECTS.sunRadiusScale * (2 - p1), 1);
    }

    /* ========== 行星特效：冻结 / 灼烧 / 大气变化 ========== */
    if (!_effectsApplied.tempHash) _effectsApplied.tempHash = -1;
    var tempHash = Math.floor(T / 200);
    if (tempHash !== _effectsApplied.tempHash) {
      _effectsApplied.tempHash = tempHash;
      applyPlanetEffects(T);
    }
  }

  /* 行星温度特效：宜居带随 sunTempK 变化 */
  function applyPlanetEffects(T) {
    /* 先清除之前加的特效层 */
    if (scene._fxLayers) {
      scene._fxLayers.forEach(function (m) { m.parent && m.parent.remove(m); m.geometry.dispose && m.geometry.dispose(); m.material.dispose && m.material.dispose(); });
    }
    scene._fxLayers = [];

    function addAtmo(id, color, opacity) {
      var b = bodies[id]; if (!b || !b.glow) return;
      b.glow.material.color.set(new THREE.Color(color));
      b.glow.material.opacity = opacity;
    }

    function freeze(id) {
      var b = bodies[id]; if (!b || !b.mesh) return;
      /* 加一层冰雪半透明壳 */
      var shell = new THREE.Mesh(
        new THREE.SphereGeometry(b.def.radius * 1.03, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xccddee, transparent: true, opacity: 0.6, depthWrite: false })
      );
      b.tiltG.add(shell);
      scene._fxLayers.push(shell);
    }

    function bake(id) {
      var b = bodies[id]; if (!b || !b.mesh) return;
      /* 海洋蒸发 / 地表熔融 */
      var shell = new THREE.Mesh(
        new THREE.SphereGeometry(b.def.radius * 1.02, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xff8040, transparent: true, opacity: 0.45, depthWrite: false })
      );
      b.tiltG.add(shell);
      scene._fxLayers.push(shell);
      /* 加灼热光晕 */
      addAtmo(id, '#ff6030', 0.55);
    }

    function evaporate(id) {
      var b = bodies[id]; if (!b || !b.mesh) return;
      /* 行星几乎消失 */
      b.mesh.scale.setScalar(0.15);
      addAtmo(id, '#ff3020', 0.25);
    }

    if (T <= 500) {
      /* 太阳熄灭：所有行星冻结 */
      ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].forEach(function (id) { freeze(id); });
      ['mercury', 'venus', 'earth', 'mars'].forEach(function (id) { addAtmo(id, '#aabbcc', 0.15); });
    } else if (T <= 2000) {
      /* 极低温：远距行星先冻 */
      freeze('neptune'); freeze('uranus'); freeze('saturn');
      addAtmo('earth', '#b0c8d8', 0.2);
    } else if (T <= 3500) {
      /* 低温红矮星：宜居带在 0.3 AU，火星地球都冻 */
      freeze('mars'); freeze('earth');
      addAtmo('earth', '#b0c8d8', 0.22);
    } else if (T <= 7000) {
      /* 太阳 ~ 主序附近，正常 */
      ['mercury', 'venus', 'earth', 'mars'].forEach(function (id) { addAtmo(id, null, -1); });  /* -1 表示恢复默认 */
    } else if (T <= 15000) {
      /* 高温蓝白：水星烘烤，宜居带外移到火星附近 */
      bake('mercury'); bake('venus');
      addAtmo('earth', '#ffb088', 0.3);
    } else if (T <= 30000) {
      /* 超高温 O 型：水星金星蒸发，地球灼烧 */
      evaporate('mercury'); evaporate('venus');
      bake('earth');
    } else {
      /* 极端高温：内行星全部蒸发 */
      evaporate('mercury'); evaporate('venus'); evaporate('earth'); bake('mars');
    }

    /* 根据 stage 红巨星吞噬 */
    if (EFFECTS.starAge >= 2) {
      evaporate('mercury'); evaporate('venus'); evaporate('earth'); bake('mars');
    }
  }

  /* 相机控制（球坐标 + 阻尼 + 触摸双指缩放） */
  var ctl = {
    target: new THREE.Vector3(0, 0, 0),
    tTarget: new THREE.Vector3(0, 0, 0),
    r: 130, rT: 130,
    theta: 0.6, thetaT: 0.6,
    phi: 1.15, phiT: 1.15,
    min: 9, max: 420
  };

  /* ================= 构建：太阳系 ================= */
  function makeProxy(r, owner) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(r * 1.6, 1.1), 8, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    m.userData.pickId = owner.id;
    return m;
  }

  /* ========== 行星解剖面 ========== */
  var _anatomyState = { id: null, layers: [], wasPhong: {} };
  function showAnatomy(id) {
    hideAnatomy();
    var b = bodies[id];
    if (!b || !b.mesh) return;
    var mesh = b.mesh;
    var r = b.def.radius || 1;
    /* 把外层 mesh 变半透明 */
    mesh.material.transparent = true;
    mesh.material.opacity = 0.28;
    mesh.material.depthWrite = false;
    _anatomyState.wasPhong[id] = mesh.material.emissive ? true : false;
    _anatomyState.id = id;

    var type = id;
    var layers = [];

    if (id === 'sun') {
      layers = [
        { r: r * 0.18, color: 0xfff0a0, label: '核心（摄氏 1500 万度）' },
        { r: r * 0.42, color: 0xffb030, label: '辐射层' },
        { r: r * 0.72, color: 0xff6a10, label: '对流层' },
        { r: r * 1.0,  color: 0xffd060, label: '光球表层（已半透明）' }
      ];
    } else if (id === 'earth') {
      layers = [
        { r: r * 0.15, color: 0xffe0a0, label: '内核（固态铁镍，5000℃）' },
        { r: r * 0.35, color: 0xff9050, label: '外核（液态铁）' },
        { r: r * 0.72, color: 0xb05020, label: '地幔（岩石对流层）' },
        { r: r * 0.96, color: 0x6a9ad8, label: '地壳 + 海洋（已半透明）' }
      ];
    } else if (id === 'mercury' || id === 'venus' || id === 'mars') {
      layers = [
        { r: r * 0.25, color: 0xffc870, label: '铁核' },
        { r: r * 0.6, color: 0x8a5830, label: '硅酸盐地幔' },
        { r: r * 0.92, color: 0x7a7068, label: '岩壳（已半透明）' }
      ];
    } else if (id === 'jupiter') {
      layers = [
        { r: r * 0.12, color: 0xffd090, label: '岩石内核（10 倍地球）' },
        { r: r * 0.42, color: 0xffa040, label: '液态金属氢' },
        { r: r * 0.75, color: 0xffcc70, label: '气态氢氦中层' },
        { r: r * 0.96, color: 0xd8b080, label: '大气云层（已半透明）' }
      ];
    } else if (id === 'saturn') {
      layers = [
        { r: r * 0.12, color: 0xffd0a0, label: '岩石内核' },
        { r: r * 0.45, color: 0xc89050, label: '液态金属氢' },
        { r: r * 0.78, color: 0xe8c088, label: '氢氦大气' },
        { r: r * 0.97, color: 0xf0e0b8, label: '上层云带（已半透明）' }
      ];
    } else if (id === 'uranus' || id === 'neptune') {
      layers = [
        { r: r * 0.15, color: 0xffd090, label: '岩石内核' },
        { r: r * 0.55, color: 0x60c0d0, label: '冰幔（水/甲烷/氨）' },
        { r: r * 0.88, color: 0x3078c0, label: '氢氦大气（已半透明）' }
      ];
    } else {
      /* 矮行星 / 卫星 */
      layers = [
        { r: r * 0.4, color: 0x7a6050, label: '岩核' },
        { r: r * 0.9, color: 0xc8b8a8, label: '冰/岩外壳（已半透明）' }
      ];
    }

    layers.forEach(function (L, i) {
      var geo = new THREE.SphereGeometry(L.r, 28, 20);
      var isOutermost = (i === layers.length - 1);
      if (isOutermost) return;  /* 跳过最外层（只是占位） */
      var mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(L.color),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.BackSide
      });
      var sph = new THREE.Mesh(geo, mat);
      sph.renderOrder = 10 + i;
      b.tiltG.add(sph);
      sph.userData.label = L.label;
      sph.userData.anatomy = true;
      sph.userData.layerIdx = i;
      _anatomyState.layers.push(sph);
    });
  }
  function hideAnatomy() {
    if (!_anatomyState.id) return;
    var b = bodies[_anatomyState.id];
    if (b && b.mesh) {
      b.mesh.material.transparent = false;
      b.mesh.material.opacity = 1;
      b.mesh.material.depthWrite = true;
    }
    _anatomyState.layers.forEach(function (sph) {
      if (b && sph.parent) sph.parent.remove(sph);
      sph.geometry.dispose();
      sph.material.dispose();
    });
    _anatomyState = { id: null, layers: [], wasPhong: {} };
  }

  function makeLabel(id, name, cls) {
    var el = document.createElement('div');
    el.className = 'lbl' + (cls ? ' ' + cls : '');
    el.textContent = name;
    el.addEventListener('click', function (e) { e.stopPropagation(); select(id); });
    el.style.display = 'none';
    labelsRoot.appendChild(el);
    return el;
  }

  function makeTrail(owner, r) {
    var max = 420;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setDrawRange(0, 0);
    var mat = new THREE.PointsMaterial({
      size: Math.max(r * 0.5, 0.3), map: dotTex(), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    owner.trail = { pts: pts, max: max, last: new THREE.Vector3(1e9, 0, 0) };
    updateTrailColors(owner);
    return pts;
  }

  function updateTrailColors(owner) {
    var attr = owner.trail.pts.geometry.getAttribute('color');
    var acc = new THREE.Color(theme.accent);
    var n = attr.count;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      attr.setXYZ(i, acc.r * t * t, acc.g * t * t, acc.b * t * t);
    }
    attr.needsUpdate = true;
  }

  function buildBody(def, parentScene, opts) {
    opts = opts || {};
    var seg = quality.seg;
    var holder = new THREE.Group();        // 位置（公转）
    var tiltG = new THREE.Group();         // 轴倾角
    var mesh;
    var geo = def.scale
      ? new THREE.SphereGeometry(def.radius, seg, Math.round(seg * 0.7))
      : new THREE.SphereGeometry(def.radius, seg, Math.round(seg * 0.75));
    if (opts.unlit) {
      mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: planetTexture(def.tex, 512, 256) }));
    } else {
      mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        map: planetTexture(def.tex, opts.small ? 256 : 512, opts.small ? 128 : 256),
        shininess: 6, specular: new THREE.Color(0x222222)
      }));
    }
    if (def.scale) mesh.scale.set(def.scale[0], def.scale[1], def.scale[2]);
    tiltG.add(mesh);
    tiltG.rotation.z = rad(def.tilt || 0);
    holder.add(tiltG);

    var body = {
      def: def, holder: holder, tiltG: tiltG, mesh: mesh,
      rotExtra: 0, spinBoost: 0
    };

    /* 大气光晕 */
    if (def.atmo) {
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(), color: new THREE.Color(def.atmo), transparent: true,
        opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(def.radius * 3.4, def.radius * 3.4, 1);
      holder.add(glow);
      body.glow = glow;
    }
    /* 悬停高亮光晕 */
    var hGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: new THREE.Color('#ffffff'), transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    hGlow.scale.set(def.radius * 4.6, def.radius * 4.6, 1);
    holder.add(hGlow);
    body.hoverGlow = hGlow;

    var proxy = makeProxy(def.radius, def);
    holder.add(proxy);
    body.proxy = proxy;

    if (!opts.noLabel) body.label = makeLabel(def.id, def.name);

    bodies[def.id] = body;
    parentScene.add(holder);
    if (def.orbit !== undefined) {
      parentScene.add(makeTrail(body, def.radius));
      tracked.push(body);
    }
    return body;
  }

  function orbitLine(r, inc, node, moonOf) {
    var n = 128, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.LineBasicMaterial({ color: new THREE.Color(theme.orbit), transparent: true, opacity: moonOf ? 0.3 : 0.38 });
    var line = new THREE.LineLoop(g, mat);
    if (inc) line.rotation.x = rad(inc);
    if (node) line.rotation.y = rad(node);
    orbitMats.push(mat);
    return line;
  }

  function buildSolar() {
    solarGroup = new THREE.Group();
    orbitGroup = new THREE.Group();
    scene.add(solarGroup);
    scene.add(orbitGroup);
    var S = D.SOLAR;

    /* 太阳 */
    var sun = buildBody(S.sun, solarGroup, { unlit: true });
    sun.holder.traverse(function (o) { if (o.material && o.material.map) o.material.map.wrapT = THREE.RepeatWrapping; });
    /* 日冕两层 */
    sun.corona1 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: new THREE.Color('#ffb347'), transparent: true,
      opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sun.corona1.scale.set(26, 26, 1);
    sun.corona2 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: new THREE.Color('#ff6a00'), transparent: true,
      opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sun.corona2.scale.set(46, 46, 1);
    sun.holder.add(sun.corona1); sun.holder.add(sun.corona2);

    /* 太阳光源 */
    _sunLight = new THREE.PointLight(0xfff3e0, 1.55, 0);
    scene.add(_sunLight);

    /* 行星与卫星 */
    S.planets.forEach(function (p) {
      var plane = new THREE.Group();
      plane.rotation.x = rad(p.inc || 0);
      plane.rotation.y = rand(0, 6.28);
      solarGroup.add(plane);
      _orbitPlanes.push(plane);
      plane.add(orbitLine(p.orbit, 0, 0));

      var body = buildBody(p, plane, { small: p.radius < 0.8 });
      body.plane = plane;
      body.nodeRot = plane.rotation.y;

      /* 行星环 */
      if (p.rings) {
        var rtex = ringTexture(p.rings.faint);
        var rgeo = new THREE.RingGeometry(p.rings.inner, p.rings.outer, 96, 1);
        var rmat = new THREE.MeshBasicMaterial({
          map: rtex, transparent: true, side: THREE.DoubleSide,
          depthWrite: false, opacity: p.rings.faint ? 0.5 : 0.96
        });
        var rmesh = new THREE.Mesh(rgeo, rmat);
        rmesh.rotation.x = Math.PI / 2;
        body.tiltG.add(rmesh);
      }

      /* 卫星 */
      (p.moons || []).forEach(function (m) {
        var mp = new THREE.Group();
        mp.rotation.x = rad(rand(-6, 6));
        body.holder.add(mp);
        mp.add(orbitLine(m.dist, 0, 0, true));
        var mb = buildBody(m, mp, { small: true, noLabel: false });
        mb.moonPlane = mp;
        mb.parent = body;
      });
      /* 额外卫星：收集后延迟构建，避免首帧超时 */
      if (D.EXTRA_MOONS && D.EXTRA_MOONS[p.id]) {
        D.EXTRA_MOONS[p.id].forEach(function (ex) {
          var r2 = ex.name.indexOf('恩克拉多斯') >= 0 ? 0.16
                 : ex.name.indexOf('土星') >= 0 && ex.en && ex.en.indexOf('Titan') >= 0 ? 0.4
                 : ex.en && ex.en.indexOf('Triton') >= 0 ? 0.36
                 : ex.en && ex.en.indexOf('Charon') >= 0 ? 0.24
                 : ex.dist > 3 ? 0.12 : 0.08;
          var isIce = ex.en && /Enceladus|Tethys|Rhea|Titania|Oberon|Ariel|Umbriel|Miranda|Triton/.test(ex.en);
          var def = {
            id: ex.id, name: ex.name, en: ex.en, type: '卫星',
            radius: r2, dist: ex.dist, period: ex.period || 1,
            spin: 1, tilt: 0, phase: Math.random() * 360, inc: rand(-6, 6),
            tex: { kind: isIce ? 'ice' : 'rock', base: isIce ? ['#d6e0ea', '#a8b4c4'] : ['#8a8078', '#554e48'], craters: 40 },
            data: { '直径': '见数据', '公转': Math.abs(ex.period).toFixed(2) + ' 天' },
            desc: ex.desc
          };
          _extraMoonDefs.push({ parentId: p.id, def: def });
        });
      }
    });

    /* 矮行星 */
    S.dwarfs.forEach(function (p) {
      var plane = new THREE.Group();
      plane.rotation.x = rad(p.inc || 0);
      plane.rotation.y = rand(0, 6.28);
      solarGroup.add(plane);
      _orbitPlanes.push(plane);
      plane.add(orbitLine(p.orbit, 0, 0));
      var body = buildBody(p, plane, { small: true });
      body.plane = plane;
      body.nodeRot = plane.rotation.y;
      (p.moons || []).forEach(function (m) {
        var mp = new THREE.Group();
        body.holder.add(mp);
        mp.add(orbitLine(m.dist, 0, 0, true));
        var mb = buildBody(m, mp, { small: true });
        mb.moonPlane = mp;
        mb.parent = body;
      });
    });

    /* 哈雷彗星 */
    buildHalley();

    /* 小行星带 & 柯伊伯带 */
    beltA = makeBelt(33, 39.5, quality.belt, 0.85, 0xbfa88f);
    beltB = makeBelt(96, 127, quality.kuiper, 3.6, 0x9fb4c8, 0.55);
    beltA.name = 'beltA'; beltB.name = 'beltB';
    scene.add(beltA); scene.add(beltB);

    buildSatellites();
    refreshPickList();
  }

  /* 延迟构建：全部额外卫星（避免首帧超时） */
  function buildExtraMoons() {
    if (_extraMoonDefs.length === 0) return;
    /* 分批追加，让浏览器在批次间保持渲染 */
    var idx = 0;
    function chunk() {
      var end = Math.min(idx + 5, _extraMoonDefs.length);
      for (; idx < end; idx++) {
        var it = _extraMoonDefs[idx];
        var parent = bodies[it.parentId];
        if (!parent) continue;
        var mp2 = new THREE.Group();
        mp2.rotation.x = rad(it.def.inc);
        parent.holder.add(mp2);
        mp2.add(orbitLine(it.def.dist, 0, 0, true));
        var mb2 = buildBody(it.def, mp2, { small: true });
        mb2.moonPlane = mp2;
        mb2.parent = parent;
      }
      if (idx < _extraMoonDefs.length) setTimeout(chunk, 16);
      else refreshPickList();
    }
    chunk();
  }

  function makeBelt(r0, r1, count, ySpread, color, op) {
    var pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    var c = new THREE.Color(color);
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = rand(r0, r1);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = rand(-ySpread, ySpread) * 0.4;
      pos[i * 3 + 2] = Math.sin(a) * r;
      var b = rand(0.5, 1);
      col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({
      size: 0.55, map: dotTex(), vertexColors: true, transparent: true,
      opacity: op || 0.9, depthWrite: false, sizeAttenuation: true
    });
    return new THREE.Points(g, m);
  }

  function buildHalley() {
    var H = D.SOLAR.halley;
    var q = H.peri, Q = H.apo;
    var a = (q + Q) / 2, e = (Q - q) / (Q + q);
    var plane = new THREE.Group();
    plane.rotation.x = rad(H.inc);
    plane.rotation.y = rad(70);
    solarGroup.add(plane);
    _orbitPlanes.push(plane);
    plane.add(orbitEllipse(a, e));

    var holder = new THREE.Group();
    plane.add(holder);
    var coma = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: new THREE.Color('#bfe8ff'), transparent: true,
      opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    holder.add(coma);
    var core = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshPhongMaterial({ map: planetTexture({ kind: 'rock', base: ['#8a8a8a', '#555'], craters: 12 }, 128, 64) })
    );
    holder.add(core);
    var proxy = makeProxy(1.2, H);
    holder.add(proxy);

    /* 彗尾粒子 */
    var tn = 90;
    var tgeo = new THREE.BufferGeometry();
    tgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tn * 3), 3));
    var tcol = new Float32Array(tn * 3);
    var cc = new THREE.Color('#9fd8ff');
    for (var i = 0; i < tn; i++) {
      var t = i / (tn - 1);
      tcol[i * 3] = cc.r * (1 - t); tcol[i * 3 + 1] = cc.g * (1 - t); tcol[i * 3 + 2] = cc.b * (1 - t);
    }
    tgeo.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
    var tail = new THREE.Points(tgeo, new THREE.PointsMaterial({
      size: 1.1, map: dotTex(), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    }));
    tail.frustumCulled = false;
    solarGroup.add(tail);

    var jp = [];   // 每粒子抖动
    for (var j = 0; j < tn; j++) jp.push([rand(-1, 1), rand(-1, 1), rand(-0.4, 0.4)]);

    halley = {
      def: H, holder: holder, coma: coma, core: core, proxy: proxy,
      tail: tail, tailN: tn, jit: jp, theta: rand(1.5, 2.5),
      a: a, e: e, plane: plane,
      label: makeLabel('halley', H.name)
    };
    bodies['halley'] = { def: H, holder: holder, mesh: core, proxy: proxy, label: halley.label, isComet: true };
  }

  function orbitEllipse(a, e) {
    var n = 80, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var th = i / n * Math.PI * 2;
      var r = a * (1 - e * e) / (1 + e * Math.cos(th));
      pos[i * 3] = Math.cos(th) * r;
      pos[i * 3 + 2] = Math.sin(th) * r;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.LineBasicMaterial({ color: new THREE.Color(theme.orbit), transparent: true, opacity: 0.3 });
    orbitMats.push(mat);
    return new THREE.LineLoop(g, mat);
  }

  /* ================= 构建：地球人造卫星 ================= */
  function panel(w, h, color) {
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.02, h),
      new THREE.MeshPhongMaterial({ color: color || 0xd9a441, emissive: 0x6a4a10, shininess: 30 })
    );
    return m;
  }
  function buildSatellites() {
    /* 地球人造卫星已移除（用户觉得太丑） */
    return;
  }

  /* ================= 构建：深空天体 ================= */
  function starCore(r, color, emissiveI) {
    var grp = new THREE.Group();
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 22),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })
    );
    grp.add(mesh);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: new THREE.Color(color), transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(r * 4.6, r * 4.6, 1);
    grp.add(glow);
    var corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: new THREE.Color(color), transparent: true,
      opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    corona.scale.set(r * 8, r * 8, 1);
    grp.add(corona);
    grp.userData = { mesh: mesh, glow: glow, corona: corona, r: r };
    return grp;
  }

  function blackholeCore(r, hotColor) {
    var grp = new THREE.Group();
    var sph = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    grp.add(sph);
    /* 吸积盘（XY 平面内自旋，再倾斜） */
    var diskHolder = new THREE.Group();
    diskHolder.rotation.x = Math.PI / 2 - 0.32;
    var dTex = canvasTex(512, 512, function (c) {
      var img = c.createImageData(512, 512), d = img.data;
      for (var y = 0; y < 512; y++) for (var x = 0; x < 512; x++) {
        var dx = x - 256, dy = y - 256;
        var rr = Math.sqrt(dx * dx + dy * dy) / 256;
        var i4 = (y * 512 + x) * 4;
        if (rr < 0.28 || rr > 1) { d[i4 + 3] = 0; continue; }
        var t = (rr - 0.28) / 0.72;
        var ang = Math.atan2(dy, dx) / 6.283 + 0.5;
        var sw = vnoise(ang * 6 + t * 9, t * 14, 21) * 0.6 + 0.4;
        var col = new THREE.Color(hotColor);
        var heat = (1 - t) * sw;
        d[i4] = 255; d[i4 + 1] = 120 + heat * 135; d[i4 + 2] = 60 + heat * 195;
        d[i4 + 3] = Math.min(255, (0.75 * (1 - t * 0.55) * sw) * 255 * (t < 0.06 ? t / 0.06 : 1));
      }
      c.putImageData(img, 0, 0);
    });
    var disk = new THREE.Mesh(new THREE.RingGeometry(r * 1.35, r * 3.4, 96, 1),
      new THREE.MeshBasicMaterial({ map: dTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    diskHolder.add(disk);
    grp.add(diskHolder);
    /* 光子环（始终面向相机） */
    var photon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ringTex(), color: new THREE.Color('#ffd9a0'), transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    photon.scale.set(r * 2.85, r * 2.85, 1);
    grp.add(photon);
    grp.userData = { disk: disk, photon: photon, r: r };
    return grp;
  }

  function jetStream(len, color, count) {
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);
    var c = new THREE.Color(color);
    for (var i = 0; i < count; i++) {
      var b = rand(0.3, 1);
      col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var pts = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.5, map: dotTex(), vertexColors: true, transparent: true,
      opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    pts.frustumCulled = false;
    pts.userData = { len: len, count: count, seed: [] };
    for (var k = 0; k < count; k++) pts.userData.seed.push([rand(-1, 1), rand(0.4, 1.4), rand(0, 1)]);
    return pts;
  }

  function updateJet(pts, t, dir) {
    var attr = pts.geometry.getAttribute('position');
    var L = pts.userData.len, n = pts.userData.count, sd = pts.userData.seed;
    for (var i = 0; i < n; i++) {
      var prog = ((t * 0.28 + sd[i][2]) % 1);
      var y = prog * L * dir;
      var spread = 0.14 + prog * 2.2;
      attr.setXYZ(i, sd[i][0] * spread, y, sd[i][1] * spread * 0.6);
    }
    attr.needsUpdate = true;
  }

  function pulsarBeams(color, len) {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color), transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    var coneGeo = new THREE.ConeGeometry(1.15, len, 24, 1, true);
    coneGeo.translate(0, -len / 2, 0);
    var c1 = new THREE.Mesh(coneGeo, mat); g.add(c1);
    var c2 = new THREE.Mesh(coneGeo, mat); c2.rotation.x = Math.PI; g.add(c2);
    g.rotation.z = 0.45;
    return g;
  }

  function pulseRings(color, speed, n) {
    var arr = [];
    for (var i = 0; i < (n || 3); i++) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTex(), color: new THREE.Color(color), transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      s.userData.off = i / (n || 3);
      s.userData.speed = speed;
      arr.push(s);
    }
    return arr;
  }

  function animPulseRings(rings, t, base) {
    rings.forEach(function (s) {
      var p = (t * s.userData.speed + s.userData.off) % 1;
      var sc = base * (1 + p * 7);
      s.scale.set(sc, sc, 1);
      s.material.opacity = (1 - p) * 0.5;
    });
  }

  function nebulaCluster(colors, radius, count, vertical) {
    var g = new THREE.Group();
    for (var i = 0; i < count; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: blobTex(i), color: new THREE.Color(colors[i % colors.length]),
        transparent: true, opacity: rand(0.14, 0.3),
        blending: THREE.AdditiveBlending, depthWrite: false, rotation: rand(0, 6.28)
      }));
      var sc = rand(radius * 0.7, radius * 1.7);
      sp.scale.set(sc, sc * (vertical ? rand(1.4, 2.2) : rand(0.8, 1.2)), 1);
      if (vertical) {
        sp.position.set(rand(-radius * 0.35, radius * 0.35), rand(-radius * 0.8, radius * 0.8), rand(-radius * 0.2, radius * 0.2));
      } else {
        sp.position.set(rand(-radius, radius) * 0.7, rand(-radius, radius) * 0.55, rand(-radius, radius) * 0.4);
      }
      g.add(sp);
    }
    return g;
  }

  function buildDeep() {
    deepGroup = new THREE.Group();
    scene.add(deepGroup);
    var list = D.DEEP;
    var golden = Math.PI * (3 - Math.sqrt(5));

    list.forEach(function (def, i) {
      var holder = new THREE.Group();
      var ang = i * golden + 0.4;
      var dist = 62 + (i % 3) * 44;
      holder.position.set(Math.cos(ang) * dist, Math.sin(i * 2.3) * 26, Math.sin(ang) * dist);
      deepGroup.add(holder);

      var body = { def: def, holder: holder, deep: true };
      var proxyR = def.radius;

      if (def.build === 'binary') {
        var A = starCore(def.radius * 0.9, '#cfe0ff');
        var B = starCore(def.radius * 0.34, '#f2f6ff');
        var arm = new THREE.Group();
        B.position.set(def.radius * 1.9, 0, 0);
        arm.add(A); arm.add(B);
        holder.add(arm);
        body.mesh = A; body.sub = arm;
        proxyR = def.radius * 1.2;
        deepAnims.push(function (t) { arm.rotation.y = t * 0.55; });
      } else if (def.build === 'star') {
        var s1 = starCore(def.radius, def.color || '#fff2d8');
        holder.add(s1); body.mesh = s1;
        deepAnims.push(function (t) {
          var p = 1 + Math.sin(t * 0.7) * 0.05;
          s1.userData.corona.scale.set(s1.userData.r * 8 * p, s1.userData.r * 8 * p, 1);
        });
      } else if (def.build === 'pulsate') {
        var s2 = starCore(def.radius, def.color || '#ff5c33');
        holder.add(s2); body.mesh = s2;
        deepAnims.push(function (t) {
          var p = 1 + Math.sin(t * 0.55 + i) * 0.07;
          s2.scale.set(p, p, p);
          var cp = 1 + Math.sin(t * 0.55 + i) * 0.18;
          s2.userData.corona.scale.set(s2.userData.r * 9 * cp, s2.userData.r * 9 * cp, 1);
        });
      } else if (def.build === 'wind') {
        var s3 = starCore(def.radius, def.color || '#9dc4ff');
        holder.add(s3); body.mesh = s3;
        var winds = [];
        for (var w = 0; w < 5; w++) {
          var wsp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex(), color: new THREE.Color(def.color || '#9dc4ff'), transparent: true,
            opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
          }));
          wsp.userData.off = w / 5;
          holder.add(wsp); winds.push(wsp);
        }
        deepAnims.push(function (t) {
          winds.forEach(function (ws) {
            var p = (t * 0.22 + ws.userData.off) % 1;
            var a = p * 6.28 + w;
            var rr = def.radius * (1.3 + p * 3.4);
            ws.position.set(Math.cos(a) * rr, Math.sin(a * 1.3) * rr * 0.4, Math.sin(a) * rr);
            ws.scale.set(rr * 0.9, rr * 0.9, 1);
            ws.material.opacity = Math.sin(p * Math.PI) * 0.35;
          });
        });
      } else if (def.build === 'disk') {
        var s4 = starCore(def.radius, def.color || '#cfe4ff');
        holder.add(s4); body.mesh = s4;
        var deb = new THREE.Mesh(new THREE.RingGeometry(def.radius * 1.9, def.radius * 3.1, 80, 1),
          new THREE.MeshBasicMaterial({ color: 0x8fb6e8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        deb.rotation.x = Math.PI / 2 - 0.35;
        holder.add(deb);
        deepAnims.push(function (t) { deb.rotation.z = t * 0.1; });
      } else if (def.build === 'triple') {
        var mA = starCore(def.radius, def.color || '#ffeec8');
        holder.add(mA); body.mesh = mA;
        var arms = new THREE.Group(); holder.add(arms);
        var comps = [];
        var nComp = def.id === 'polaris' ? 2 : 3;
        for (var tc = 0; tc < nComp; tc++) {
          var dist2 = def.radius * (2.1 + tc * 1.15);
          if (def.id === 'alphacen' && tc === 2) dist2 = def.radius * 5.5;
          var cc = def.id === 'alphacen' && tc === 2 ? starCore(def.radius * 0.3, '#ff7a5c') : starCore(def.radius * 0.45, '#ffe0b0');
          cc.position.set(dist2, 0, 0);
          arms.add(cc); comps.push({ g: cc, d: dist2, sp: 0.5 - tc * 0.12, ph: tc * 2.1 });
        }
        deepAnims.push(function (t) {
          arms.rotation.y = t * 0.12;
          comps.forEach(function (cp) {
            var a = t * cp.sp + cp.ph;
            cp.g.position.set(Math.cos(a) * cp.d, Math.sin(a) * cp.d * 0.12, Math.sin(a) * cp.d);
          });
        });
      } else if (def.build === 'pulsar') {
        var core = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 16, 12),
          new THREE.MeshBasicMaterial({ color: 0xeef6ff }));
        holder.add(core); body.mesh = core;
        var cg = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex(), color: new THREE.Color('#9fd0ff'), transparent: true,
          opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        cg.scale.set(def.radius * 7, def.radius * 7, 1);
        holder.add(cg);
        var beams = pulsarBeams('#7fc8ff', def.radius * 22);
        holder.add(beams);
        var rings = pulseRings('#9fd8ff', def.id === 'crab' ? 0.7 : 0.5, 3);
        rings.forEach(function (r) { holder.add(r); });
        if (def.id === 'crab') {
          var neb = nebulaCluster(['#3ecf8e', '#4dd0ff', '#8f6fff'], def.radius * 9, 7, false);
          holder.add(neb);
        }
        deepAnims.push(function (t) {
          beams.rotation.y = t * (def.id === 'crab' ? 3.2 : 2.2);
          animPulseRings(rings, t, def.radius * 1.4);
          core.material.color.setScalar(def.id === 'crab'
            ? 0.75 + 0.25 * Math.pow(Math.sin(t * 6.283), 20)
            : 0.7 + 0.3 * Math.pow(Math.sin(t * 4.7), 40));
        });
      } else if (def.build === 'magnetar') {
        var mcore = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 16, 12),
          new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
        holder.add(mcore); body.mesh = mcore;
        var mg = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex(), color: new THREE.Color('#c8dcff'), transparent: true,
          opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        mg.scale.set(def.radius * 8, def.radius * 8, 1);
        holder.add(mg);
        /* 磁力线 */
        var fieldG = new THREE.Group();
        for (var fl = 0; fl < 4; fl++) {
          var curve = new THREE.EllipseCurve(0, 0, def.radius * (1.9 + fl * 0.8), def.radius * (2.8 + fl * 1.1), 0, 6.29);
          var pts = curve.getPoints(64);
          var fg = new THREE.BufferGeometry().setFromPoints(pts);
          var flMat = new THREE.LineBasicMaterial({ color: 0x8f9fff, transparent: true, opacity: 0.4 });
          var line = new THREE.LineLoop(fg, flMat);
          line.rotation.x = fl * 0.5;
          fieldG.add(line);
        }
        holder.add(fieldG);
        var flash = 0;
        deepAnims.push(function (t, dt) {
          fieldG.rotation.y = t * 0.4;
          if (Math.random() < 0.012) flash = 1;
          flash = Math.max(0, flash - dt * 2.2);
          var fs = def.radius * 8 * (1 + flash * 1.6);
          mg.scale.set(fs, fs, 1);
          mg.material.opacity = 0.9 + flash;
        });
      } else if (def.build === 'blackhole') {
        var bh = blackholeCore(def.radius, def.id === 'm87' ? '#ffc46a' : '#ff9a4a');
        holder.add(bh); body.mesh = bh;
        proxyR = def.radius * 1.6;
        var extra = [];
        if (def.stars) {
          for (var st = 0; st < 3; st++) {
            var osp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
              new THREE.MeshBasicMaterial({ color: 0xffe8c0 }));
            holder.add(osp);
            extra.push({ m: osp, d: def.radius * (3.6 + st * 1.5), sp: 0.5 + st * 0.22, e: 0.3 + st * 0.15, ph: st * 2 });
          }
        }
        var jets = null, jets2 = null;
        if (def.jet) {
          jets = jetStream(def.radius * 11, '#7fd8ff', 240);
          jets2 = jetStream(def.radius * 11, '#7fd8ff', 240);
          holder.add(jets); holder.add(jets2);
        }
        deepAnims.push(function (t, dt) {
          bh.userData.disk.rotation.z += dt * 1.4;
          extra.forEach(function (o) {
            var a = t * o.sp + o.ph;
            var r = o.d * (1 - o.e * Math.cos(a * 0.7));
            o.m.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.1, Math.sin(a) * r);
          });
          if (jets) updateJet(jets, t, 1);
          if (jets2) updateJet(jets2, t, -1);
        });
      } else if (def.build === 'nebula') {
        var isPillars = def.id === 'pillars';
        var neb = nebulaCluster(
          isPillars ? ['#8fb3ff', '#ffb37a', '#7ae0c8', '#c8b3ff'] : ['#ff6f91', '#6fb7ff', '#b48fff', '#ffd0a0'],
          def.radius, isPillars ? 8 : 9, isPillars);
        holder.add(neb); body.mesh = neb;
        /* 新生恒星 */
        for (var ys = 0; ys < 7; ys++) {
          var ysp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex(), color: new THREE.Color('#eaf2ff'), transparent: true,
            opacity: rand(0.5, 0.95), blending: THREE.AdditiveBlending, depthWrite: false
          }));
          var ysc = rand(1.2, 2.6);
          ysp.scale.set(ysc, ysc, 1);
          ysp.position.set(rand(-3, 3), isPillars ? rand(-4, 4) : rand(-2.5, 2.5), rand(-2, 2));
          ysp.userData.tw = rand(1, 3);
          ysp.userData.ph = rand(0, 6.28);
          holder.add(ysp);
          (function (sp) {
            deepAnims.push(function (t) {
              sp.material.opacity = 0.55 + 0.4 * Math.sin(t * sp.userData.tw + sp.userData.ph);
            });
          })(ysp);
        }
        proxyR = def.radius * 1.3;
        deepAnims.push(function (t) { neb.rotation.y = t * 0.05; });
      } else if (def.build === 'system') {
        var dwarf = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 24, 18),
          new THREE.MeshBasicMaterial({ color: 0xff8a5c }));
        holder.add(dwarf); body.mesh = dwarf;
        var dg = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex(), color: new THREE.Color('#ff8a5c'), transparent: true,
          opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        dg.scale.set(def.radius * 5, def.radius * 5, 1);
        holder.add(dg);
        /* 宜居带 */
        var hz = new THREE.Mesh(new THREE.RingGeometry(4.0, 5.4, 64),
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
        hz.rotation.x = Math.PI / 2;
        holder.add(hz);
        var planets = [];
        var pcolors = [0xb8a89a, 0xc8b8a8, 0x6a9ad8, 0x7ac86a, 0xd8c8a0, 0x9ab8d8, 0xd8a888];
        for (var tp = 0; tp < 7; tp++) {
          var porb = 2.1 + tp * 0.85;
          var pm = new THREE.Mesh(new THREE.SphereGeometry(rand(0.13, 0.26), 12, 10),
            new THREE.MeshPhongMaterial({ color: pcolors[tp], shininess: 8 }));
          holder.add(pm);
          holder.add(orbitLine(porb, 0, 0, true));
          planets.push({ m: pm, d: porb, per: 6 + tp * 9 });
        }
        deepAnims.push(function () {
          planets.forEach(function (p) {
            var a = simDays / p.per * Math.PI * 2;
            p.m.position.set(Math.cos(a) * p.d, 0, Math.sin(a) * p.d);
          });
        });
      }

      var proxy = makeProxy(proxyR, def);
      holder.add(proxy);
      body.proxy = proxy;
      body.label = makeLabel(def.id, def.name);
      bodies[def.id] = body;
    });
  }

  /* ================= 深空星野 / 星云背景 ================= */
  function buildStarfield() {
    var n = quality.stars;
    var pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    var c1 = new THREE.Color('#ffffff'), c2 = new THREE.Color('#a8c8ff'), c3 = new THREE.Color('#ffd9a8');
    for (var i = 0; i < n; i++) {
      var R = rand(380, 760);
      var th = Math.random() * Math.PI * 2, ph = Math.acos(rand(-1, 1));
      pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = R * Math.cos(ph);
      pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
      var cc = Math.random() < 0.72 ? c1 : (Math.random() < 0.5 ? c2 : c3);
      var b = rand(0.4, 1);
      col[i * 3] = cc.r * b; col[i * 3 + 1] = cc.g * b; col[i * 3 + 2] = cc.b * b;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    starPoints = new THREE.Points(g, new THREE.PointsMaterial({
      size: 1.7, map: dotTex(), vertexColors: true, transparent: true,
      opacity: 0.95, depthWrite: false, sizeAttenuation: true
    }));
    starPoints.frustumCulled = false;
    scene.add(starPoints);
  }

  function buildNebulae() {
    nebulaSprites.forEach(function (s) { scene.remove(s); });
    nebulaSprites = [];
    var count = quality.nebula;
    for (var i = 0; i < count; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: blobTex(i + 3), color: new THREE.Color(theme.nebula[i % theme.nebula.length]),
        transparent: true, opacity: rand(0.1, 0.22),
        blending: THREE.AdditiveBlending, depthWrite: false, rotation: rand(0, 6.28)
      }));
      var R = rand(320, 560);
      var th = Math.random() * Math.PI * 2, ph = Math.acos(rand(-0.7, 0.7));
      sp.position.set(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) * 0.6, R * Math.sin(ph) * Math.sin(th));
      var sc = rand(140, 320);
      sp.scale.set(sc, sc * rand(0.6, 1.1), 1);
      scene.add(sp);
      nebulaSprites.push(sp);
    }
  }

  /* ================= 拾取 / 悬停 ================= */
  var ray = null, ndc = new THREE.Vector2(-2, -2), ndcDirty = false;

  function refreshPickList() {
    pickList = [];
    Object.keys(bodies).forEach(function (id) {
      var b = bodies[id];
      if (!b.proxy) return;
      if (b.isSat && !satsVisible) return;
      if (mode === 'solar' && b.deep) return;
      if (mode === 'deep' && !b.deep) return;
      pickList.push(b.proxy);
    });
  }

  function doPick() {
    if (!ray) ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickList, false);
    return hits.length ? bodies[hits[0].object.userData.pickId] : null;
  }

  function select(id) {
    if (!bodies[id]) return;
    selectedId = id;
    var b = bodies[id];
    ctl.tTarget.copy(b.holder.getWorldPosition(new THREE.Vector3()));
    ctl.rT = clamp((b.def.radius || 0.5) * 6 + 1.5, 3.2, 90);
    ctl.min = Math.max((b.def.radius || 0.5) * 2.6, 1.6);
    if (cbSelect) cbSelect(id);
  }

  function deselect() {
    if (!selectedId) return;
    selectedId = null;
    ctl.tTarget.set(0, 0, 0);
    ctl.rT = mode === 'solar' ? 130 : 210;
    ctl.min = 9;
    hideAnatomy();  /* 关闭选中时自动清理解剖面 */
    if (cbSelect) cbSelect(null);
  }

  /* ================= 交互（指针 / 触摸 / 滚轮） ================= */
  var pointers = {}, pinchDist = 0, downPos = null, downTime = 0, dragging = false;
  var canvasEl;

  function bindEvents() {
    canvasEl = renderer.domElement;
    canvasEl.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length === 2) {
        var ps = Object.keys(pointers).map(function (k) { return pointers[k]; });
        pinchDist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      }
      downPos = { x: e.clientX, y: e.clientY };
      downTime = performance.now();
      dragging = true;
      canvasEl.setPointerCapture(e.pointerId);
    });
    canvasEl.addEventListener('pointermove', function (e) {
      var r = canvasEl.getBoundingClientRect();
      ndc.x = (e.clientX - r.left) / r.width * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ndcDirty = true;
      if (!pointers[e.pointerId]) return;
      var p = pointers[e.pointerId];
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;

      if (Object.keys(pointers).length === 2) {
        var ps = Object.keys(pointers).map(function (k) { return pointers[k]; });
        var d2 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        if (pinchDist > 0) ctl.rT = clamp(ctl.rT * (pinchDist / d2), ctl.min, ctl.max);
        pinchDist = d2;
        return;
      }
      if (dragging) {
        ctl.thetaT -= dx * 0.005;
        ctl.phiT = clamp(ctl.phiT - dy * 0.005, 0.06, Math.PI - 0.06);
      }
      /* 悬停天体跟随鼠标转动 */
      if (hoverId && bodies[hoverId] && bodies[hoverId].mesh) {
        var b = bodies[hoverId];
        b.rotExtra += dx * 0.012;
        b.spinBoost = 1;
      }
    });
    function up(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length === 0) dragging = false;
      /* 点击判定 */
      if (downPos && performance.now() - downTime < 350 &&
          Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 7) {
        var hit = doPick();
        if (hit) { select(hit.def.id); ZAudio.sfx.select(); }
        else if (selectedId) deselect();
      }
      downPos = null;
    }
    canvasEl.addEventListener('pointerup', up);
    canvasEl.addEventListener('pointercancel', function (e) { delete pointers[e.pointerId]; dragging = false; });
    canvasEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      ctl.rT = clamp(ctl.rT * Math.exp(e.deltaY * 0.0011), ctl.min, ctl.max);
    }, { passive: false });
    canvasEl.addEventListener('dblclick', function () { deselect(); });
  }

  /* ================= 标签投影 ================= */
  var _v = new THREE.Vector3();
  function updateLabels() {
    if (!showLabels) return;
    var w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    var camDist;
    Object.keys(bodies).forEach(function (id) {
      var b = bodies[id];
      if (!b.label) return;
      var show = false;
      if (b.isSat) show = satsVisible;
      else if (b.deep) show = (mode === 'deep');
      else if (b.isComet) show = (mode === 'solar');
      else if (b.moonPlane) {
        /* 卫星标签：相机足够靠近其母行星时显示 */
        if (mode === 'solar' && b.parent) {
          var pp = b.parent.holder.getWorldPosition(_v);
          camDist = camera.position.distanceTo(pp);
          show = camDist < (b.parent.def.radius || 1) * 34;
        }
      } else show = (mode === 'solar');

      if (!show) { b.label.style.display = 'none'; return; }
      b.holder.getWorldPosition(_v);
      _v.y += (b.def.radius || 1) * 1.4;
      _v.project(camera);
      if (_v.z > 1 || _v.x < -1.15 || _v.x > 1.15 || _v.y < -1.15 || _v.y > 1.15) {
        b.label.style.display = 'none'; return;
      }
      b.label.style.display = 'block';
      b.label.style.transform = 'translate(' + ((_v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-_v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    });
  }

  /* ================= 主循环 ================= */
  var frameTimes = [], lowFpsStrikes = 0, lastFpsCheck = 0;
  var running = false, lastT = 0;

  function applyOrbitAngles() {
    /* 太阳自转 */
    var sun = bodies['sun'];
    if (sun) sun.mesh.rotation.y = simDays / sun.def.spin * 6.2832 + sun.rotExtra;

    D.SOLAR.planets.forEach(function (p) {
      var b = bodies[p.id];
      if (!b) return;
      var a = rad(p.phase || 0) + simDays / p.period * 6.2832;
      b.holder.position.set(Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit);
      b.mesh.rotation.y = simDays / p.spin * 6.2832 + b.rotExtra;
      (p.moons || []).forEach(function (m) {
        var mb = bodies[m.id];
        if (!mb) return;
        var ma = simDays / m.period * 6.2832 + m.dist;
        mb.holder.position.set(Math.cos(ma) * m.dist, 0, Math.sin(ma) * m.dist);
        mb.mesh.rotation.y = simDays / (m.period * 0.3) * 6.2832;
      });
      /* 额外卫星 */
      if (D.EXTRA_MOONS && D.EXTRA_MOONS[p.id]) {
        D.EXTRA_MOONS[p.id].forEach(function (ex) {
          var mb = bodies[ex.id];
          if (!mb || !mb.def) return;
          var ma = simDays / mb.def.period * 6.2832 + ex.dist;
          mb.holder.position.set(Math.cos(ma) * mb.def.dist, 0, Math.sin(ma) * mb.def.dist);
        });
      }
    });
    D.SOLAR.dwarfs.forEach(function (p) {
      var b = bodies[p.id];
      if (!b) return;
      var a = rad(p.phase || 0) + simDays / p.period * 6.2832;
      b.holder.position.set(Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit);
      b.mesh.rotation.y = simDays / p.spin * 6.2832 + b.rotExtra;
      (p.moons || []).forEach(function (m) {
        var mb = bodies[m.id];
        if (!mb) return;
        var ma = simDays / m.period * 6.2832 + m.dist;
        mb.holder.position.set(Math.cos(ma) * m.dist, 0, Math.sin(ma) * m.dist);
      });
      if (D.EXTRA_MOONS && D.EXTRA_MOONS[p.id]) {
        D.EXTRA_MOONS[p.id].forEach(function (ex) {
          var mb = bodies[ex.id];
          if (!mb || !mb.def) return;
          var ma = simDays / mb.def.period * 6.2832 + ex.dist;
          mb.holder.position.set(Math.cos(ma) * mb.def.dist, 0, Math.sin(ma) * mb.def.dist);
        });
      }
    });

    /* 哈雷彗星（开普勒面积律近似） */
    if (halley) {
      var T = halley.def.periodDays;
      var K = 6.2832 * halley.a * halley.a * Math.sqrt(1 - halley.e * halley.e) / T;
      var r = halley.a * (1 - halley.e * halley.e) / (1 + halley.e * Math.cos(halley.theta));
      halley.theta += (K / (r * r)) * speed * _dt * (paused ? 0 : 1);
      if (halley.theta > 6.2832) halley.theta -= 6.2832;
      r = halley.a * (1 - halley.e * halley.e) / (1 + halley.e * Math.cos(halley.theta));
      halley.holder.position.set(Math.cos(halley.theta) * r, 0, Math.sin(halley.theta) * r);
      halley.core.rotation.y += 0.02;
      /* 彗尾背向太阳 */
      var attr = halley.tail.geometry.getAttribute('position');
      var wp = halley.holder.getWorldPosition(new THREE.Vector3());
      var dir = wp.clone().normalize();
      var perp1 = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      var perp2 = new THREE.Vector3().crossVectors(dir, perp1);
      var tailLen = clamp(16 / Math.max(r / 12, 1), 3, 18);
      for (var i = 0; i < halley.tailN; i++) {
        var t = i / (halley.tailN - 1);
        var j = halley.jit[i];
        attr.setXYZ(i,
          wp.x + dir.x * t * tailLen + perp1.x * j[0] * t * 2.4 + perp2.x * j[2] * t * 1.2,
          wp.y + dir.y * t * tailLen + j[1] * t * 1.6,
          wp.z + dir.z * t * tailLen + perp1.z * j[0] * t * 2.4 + perp2.z * j[2] * t * 1.2);
      }
      attr.needsUpdate = true;
      var cs = clamp(2.6 - r / 50, 0.7, 2.6);
      halley.coma.scale.set(cs, cs, 1);
    }

    /* 小行星带缓慢旋转 */
    if (beltA) beltA.rotation.y = simDays / 1700 * 6.2832;
    if (beltB) beltB.rotation.y = simDays / 90000 * 6.2832;
  }

  function updateSatellites() {
    if (!satsVisible) return;
    D.SATELLITES.forEach(function (s) {
      var b = bodies['sat_' + s.id];
      if (!b) return;
      var a = tReal * (0.5 - b.satIdx * 0.055) + b.satIdx * 1.9;
      var d = s.dist;
      b.holder.position.set(Math.cos(a) * d, Math.sin(a * 0.6) * 0.22, Math.sin(a) * d);
      b.holder.rotation.y = a + 1.57;
    });
  }

  function pushTrails() {
    tracked.forEach(function (b) {
      if (b.trail.pts.geometry.drawRange.count === 0 && mode !== 'solar') return;
      var p = b.holder.getWorldPosition(new THREE.Vector3());
      if (p.distanceTo(b.trail.last) < 0.06) return;
      b.trail.last.copy(p);
      var attr = b.trail.pts.geometry.getAttribute('position');
      var arr = attr.array;
      if (b.trail.count === undefined) b.trail.count = 0;
      if (b.trail.count < b.trail.max) {
        b.trail.count++;
      }
      arr.copyWithin(0, 3);
      var i3 = (b.trail.count - 1) * 3;
      arr[i3] = p.x; arr[i3 + 1] = p.y; arr[i3 + 2] = p.z;
      attr.needsUpdate = true;
      var n = Math.min(b.trail.count, trailLen);
      b.trail.pts.geometry.setDrawRange(b.trail.count > trailLen ? b.trail.count - trailLen : 0, n);
    });
  }

  var _dt = 0.016;
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    var dt = clamp((now - lastT) / 1000, 0.001, 0.05);
    lastT = now;
    _dt = dt;
    tReal += dt;
    if (!paused) simDays += speed * dt;

    applyOrbitAngles();
    updateSatellites();
    deepAnims.forEach(function (f) { f(tReal, dt); });
    pushTrails();

    /* 交互效果链：轨道缩放、太阳状态、小行星带跟随 */
    var sc = EFFECTS.orbitScale;
    for (var i = 0; i < _orbitPlanes.length; i++) _orbitPlanes[i].scale.setScalar(sc);
    if (beltA) beltA.scale.setScalar(sc);
    if (beltB) beltB.scale.setScalar(sc);
    /* 衰老 slider 直接映射到 stage，一键预览最终结局 */
    var aging = EFFECTS.aging;
    var targetStage;
    if (aging >= 100) targetStage = 4;       /* 白矮星 */
    else if (aging >= 70) targetStage = 3;  /* 氦闪 */
    else if (aging >= 50) targetStage = 2;  /* 红巨星 */
    else if (aging >= 20) targetStage = 1;  /* 亚巨星 */
    else targetStage = 0;
    if (targetStage !== EFFECTS.starAge) {
      EFFECTS.starAge = targetStage;
    }
    applyEffectsToScene();

    /* 悬停检测 */
    if (ndcDirty) {
      ndcDirty = false;
      var hit = doPick();
      var nid = hit ? hit.def.id : null;
      if (nid !== hoverId) {
        if (hoverId && bodies[hoverId]) {
          var ob = bodies[hoverId];
          if (ob.hoverGlow) ob.hoverGlow.material.opacity = 0;
        }
        hoverId = nid;
        if (hoverId && bodies[hoverId] && bodies[hoverId].hoverGlow) {
          bodies[hoverId].hoverGlow.material.opacity = 0.4;
        }
        canvasEl.style.cursor = hoverId ? 'pointer' : 'grab';
        if (hoverId && cbHover) cbHover(hoverId);
      }
    }
    /* 悬停光晕呼吸 */
    if (hoverId && bodies[hoverId] && bodies[hoverId].hoverGlow) {
      var hg = bodies[hoverId].hoverGlow;
      hg.material.opacity = 0.28 + 0.14 * Math.sin(tReal * 5);
    }

    /* 太阳日冕呼吸 */
    var sun = bodies['sun'];
    if (sun && sun.corona1) {
      var p1 = 1 + Math.sin(tReal * 1.1) * 0.05;
      sun.corona1.scale.set(26 * p1, 26 * p1, 1);
      sun.corona2.scale.set(46 * (2 - p1), 46 * (2 - p1), 1);
    }

    starPoints.rotation.y += dt * 0.0045;
    var camL = scene.userData.camLight;
    if (camL) camL.position.copy(camera.position);

    /* 每帧把选中天体的 worldPosition 写入 tTarget，让相机持续跟随 */
    if (selectedId && bodies[selectedId]) {
      var sp = bodies[selectedId].holder.getWorldPosition(new THREE.Vector3());
      ctl.tTarget.copy(sp);
    }

    /* 相机阻尼 */
    ctl.target.lerp(ctl.tTarget, 1 - Math.exp(-6 * dt));
    ctl.r += (ctl.rT - ctl.r) * (1 - Math.exp(-6 * dt));
    ctl.theta += (ctl.thetaT - ctl.theta) * (1 - Math.exp(-8 * dt));
    ctl.phi += (ctl.phiT - ctl.phi) * (1 - Math.exp(-8 * dt));
    camera.position.set(
      ctl.target.x + ctl.r * Math.sin(ctl.phi) * Math.cos(ctl.theta),
      ctl.target.y + ctl.r * Math.cos(ctl.phi),
      ctl.target.z + ctl.r * Math.sin(ctl.phi) * Math.sin(ctl.theta)
    );
    camera.lookAt(ctl.target);

    updateLabels();
    renderer.render(scene, camera);

    /* 性能守护 */
    frameTimes.push(dt);
    if (frameTimes.length > 50) frameTimes.shift();
    if (now - lastFpsCheck > 2500 && frameTimes.length >= 50) {
      lastFpsCheck = now;
      var avg = frameTimes.reduce(function (a, b) { return a + b; }, 0) / frameTimes.length;
      if (avg > 0.042) {
        lowFpsStrikes++;
        if (lowFpsStrikes >= 2) {
          lowFpsStrikes = 0;
          if (qualityId === 'high') setQuality('mid');
          else if (qualityId === 'mid') setQuality('low');
          else if (cbPause) { running = false; cbPause(); }
        }
      } else lowFpsStrikes = Math.max(0, lowFpsStrikes - 1);
    }
  }

  var cbHover = null;

  /* ================= 对外 API ================= */
  function init(canvas, labelsEl, opts) {
    opts = opts || {};
    labelsRoot = labelsEl;
    cbSelect = opts.onSelect || null;
    cbPause = opts.onPause || null;
    cbHover = opts.onHover || null;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
    qualityId = isMobile ? 'mid' : 'high';
    quality = D.QUALITY[qualityId];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2200);
    camera.position.set(0, 60, 150);

    scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
    var camLight = new THREE.PointLight(0xffffff, 0.35, 0);
    scene.add(camLight);
    camLight.position.set(0, 0, 0);
    scene.userData.camLight = camLight;

    buildStarfield();
    buildNebulae();
    buildSolar();
    buildDeep();

    /* 延迟构建额外卫星（等场景 ready 后，分批追加不阻塞首帧） */
    setTimeout(function () { buildExtraMoons(); }, 120);

    bindEvents();
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; }
      else if (ZScene._active) { startLoop(); }
    });
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function setMode(m) {
    mode = m;
    solarGroup.visible = (m === 'solar');
    orbitGroup.visible = (m === 'solar' && showOrbits);
    beltA.visible = beltB.visible = (m === 'solar' && showBelts);
    deepGroup.visible = (m === 'deep');
    if (m === 'deep' && selectedId && !bodies[selectedId].deep) deselect();
    if (m === 'solar' && selectedId && bodies[selectedId].deep) deselect();
    ctl.tTarget.set(0, 0, 0);
    ctl.target.set(0, 0, 0);
    ctl.r = ctl.rT = (m === 'solar' ? 130 : 215);
    ctl.min = 9;
    tracked.forEach(function (b) {
      b.trail.count = 0;
      b.trail.pts.geometry.setDrawRange(0, 0);
    });
    refreshPickList();
  }

  function setTheme(th) {
    theme = th;
    orbitMats.forEach(function (m) { m.color.set(th.orbit); });
    nebulaSprites.forEach(function (s, i) { s.material.color.set(th.nebula[i % th.nebula.length]); });
    tracked.forEach(updateTrailColors);
  }

  function setQuality(qid) {
    if (qid === qualityId && renderer) return;
    qualityId = qid;
    quality = D.QUALITY[qid];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
    /* 重建星野与星云 */
    if (starPoints) { scene.remove(starPoints); starPoints.geometry.dispose(); }
    buildStarfield();
    buildNebulae();
  }

  function setTrailLen(n) {
    trailLen = n;
    if (n === 0) tracked.forEach(function (b) { b.trail.pts.geometry.setDrawRange(0, 0); b.trail.count = 0; });
  }

  function setShowOrbits(b) {
    showOrbits = b;
    orbitGroup.visible = (mode === 'solar' && b);
  }
  function setShowBelts(b) {
    showBelts = b;
    if (beltA) beltA.visible = (mode === 'solar' && b);
    if (beltB) beltB.visible = (mode === 'solar' && b);
  }
  function setShowLabels(b) {
    showLabels = b;
    if (!b) {
      Object.keys(bodies).forEach(function (id) {
        if (bodies[id].label) bodies[id].label.style.display = 'none';
      });
    }
  }
  function showSatellites(v) {
    satsVisible = v;
    satsGroup.visible = v;
    refreshPickList();
    if (v) {
      var eb = bodies['earth'];
      select('earth');
      ctl.rT = clamp(ctl.rT * 0.42, 3, 8);
    } else if (selectedId && bodies[selectedId].isSat) {
      deselect();
    }
  }

  return {
    init: init,
    startLoop: startLoop,
    setMode: setMode,
    select: select,
    deselect: deselect,
    setTheme: setTheme,
    setQuality: setQuality,
    setSpeed: function (v) { speed = v; },
    setPaused: function (p) { paused = p; },
    resetTime: function () { simDays = 0; },
    setTrailLen: setTrailLen,
    setShowOrbits: setShowOrbits,
    setShowLabels: setShowLabels,
    setShowBelts: setShowBelts,
    showSatellites: showSatellites,
    isSatVisible: function () { return satsVisible; },
    setEffect: function (k, v) { EFFECTS[k] = v; if (k === 'starAge') _effectsApplied.starAge = null; applyEffectsToScene(); },
    getEffect: function (k) { return EFFECTS[k]; },
    listEffects: function () { return JSON.parse(JSON.stringify(EFFECTS)); },
    showAnatomy: showAnatomy,
    hideAnatomy: hideAnatomy,
    getAnatomyId: function () { return _anatomyState.id; },
    getMode: function () { return mode; },
    getSelected: function () { return selectedId; },
    getSimDays: function () { return simDays; },
    getSimDate: function () {
      var d = new Date(epochMs + simDays * 86400000);
      return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
    },
    isMobile: isMobile,
    _active: false,
    setActive: function (v) {
      this._active = v;
      if (v) startLoop();
      else running = false;
    }
  };
})();
