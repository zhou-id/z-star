/* ============================================================
 * z'star · 着陆页动态背景（Canvas 2D）
 * 闪烁星星 + 流星划过 + 主题色星云漂移 + 鼠标视差
 * ============================================================ */
window.ZBackground = (function () {
  'use strict';

  var canvas, ctx2d, W = 0, H = 0, dpr = 1;
  var stars = [], meteors = [], nebulae = [];
  var theme = null, rafId = 0, running = false;
  var mouse = { x: 0.5, y: 0.5 };
  var lastMeteor = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    stars = [];
    var n = Math.floor((W * H) / 4200);
    n = Math.max(90, Math.min(320, n));
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rand(0.4, 1.9), tw: rand(0.5, 2.4), ph: Math.random() * Math.PI * 2,
        depth: rand(0.2, 1), tint: Math.random()
      });
    }
    nebulae = [];
    for (var k = 0; k < 4; k++) {
      nebulae.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rand(180, 380), vx: rand(-3, 3), vy: rand(-2, 2),
        ci: k % (theme ? theme.nebula.length : 4), a: rand(0.05, 0.1)
      });
    }
  }

  function starColor(tint, alpha) {
    if (tint < 0.62) return 'rgba(255,255,255,' + alpha + ')';
    if (tint < 0.8) return 'rgba(180,205,255,' + alpha + ')';
    return 'rgba(255,214,170,' + alpha + ')';
  }

  function spawnMeteor(now) {
    var fromTop = Math.random() < 0.6;
    var x = fromTop ? rand(W * 0.15, W * 1.05) : rand(-60, W * 0.5);
    var y = fromTop ? -40 : rand(-40, H * 0.3);
    var ang = rand(Math.PI * 0.62, Math.PI * 0.8);
    var sp = rand(9, 16);
    meteors.push({
      x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      len: rand(90, 220), life: 1, decay: rand(0.004, 0.009),
      hue: Math.random() < 0.5 ? null : theme ? theme.c3 : '#7afaff'
    });
    lastMeteor = now;
  }

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    var t = now * 0.001;

    ctx2d.clearRect(0, 0, W, H);

    /* 星云漂移 */
    ctx2d.globalCompositeOperation = 'lighter';
    for (var i = 0; i < nebulae.length; i++) {
      var nb = nebulae[i];
      nb.x += nb.vx * 0.016; nb.y += nb.vy * 0.016;
      if (nb.x < -nb.r) nb.x = W + nb.r; if (nb.x > W + nb.r) nb.x = -nb.r;
      if (nb.y < -nb.r) nb.y = H + nb.r; if (nb.y > H + nb.r) nb.y = -nb.r;
      var g = ctx2d.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r);
      var col = theme ? theme.nebula[nb.ci] : '#7b2ff7';
      g.addColorStop(0, hexA(col, nb.a));
      g.addColorStop(1, hexA(col, 0));
      ctx2d.fillStyle = g;
      ctx2d.fillRect(nb.x - nb.r, nb.y - nb.r, nb.r * 2, nb.r * 2);
    }

    /* 星星闪烁（带鼠标视差） */
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var a = 0.35 + 0.65 * Math.abs(Math.sin(t * st.tw + st.ph));
      var px = st.x + (mouse.x - 0.5) * 18 * st.depth;
      var py = st.y + (mouse.y - 0.5) * 12 * st.depth;
      ctx2d.fillStyle = starColor(st.tint, a * (0.5 + st.depth * 0.5));
      ctx2d.beginPath();
      ctx2d.arc(px, py, st.r, 0, Math.PI * 2);
      ctx2d.fill();
      if (st.r > 1.5 && a > 0.9) {
        ctx2d.strokeStyle = starColor(st.tint, 0.5);
        ctx2d.lineWidth = 0.7;
        ctx2d.beginPath();
        ctx2d.moveTo(px - st.r * 3, py); ctx2d.lineTo(px + st.r * 3, py);
        ctx2d.moveTo(px, py - st.r * 3); ctx2d.lineTo(px, py + st.r * 3);
        ctx2d.stroke();
      }
    }

    /* 流星 */
    if (now - lastMeteor > rand(1200, 3600)) spawnMeteor(now);
    for (var m = meteors.length - 1; m >= 0; m--) {
      var mt = meteors[m];
      mt.x += mt.vx; mt.y += mt.vy; mt.life -= mt.decay;
      if (mt.life <= 0 || mt.x < -300 || mt.y > H + 300) { meteors.splice(m, 1); continue; }
      var nx = mt.vx / Math.hypot(mt.vx, mt.vy), ny = mt.vy / Math.hypot(mt.vx, mt.vy);
      var tx = mt.x - nx * mt.len, ty = mt.y - ny * mt.len;
      var grad = ctx2d.createLinearGradient(mt.x, mt.y, tx, ty);
      var head = mt.hue ? mt.hue : '#ffffff';
      grad.addColorStop(0, hexA(head, 0.95 * mt.life));
      grad.addColorStop(0.25, hexA(head, 0.4 * mt.life));
      grad.addColorStop(1, hexA(head, 0));
      ctx2d.strokeStyle = grad;
      ctx2d.lineWidth = 1.8;
      ctx2d.lineCap = 'round';
      ctx2d.beginPath();
      ctx2d.moveTo(mt.x, mt.y); ctx2d.lineTo(tx, ty);
      ctx2d.stroke();
      ctx2d.fillStyle = hexA('#ffffff', mt.life);
      ctx2d.beginPath();
      ctx2d.arc(mt.x, mt.y, 1.6, 0, Math.PI * 2);
      ctx2d.fill();
    }

    ctx2d.globalCompositeOperation = 'source-over';
  }

  function hexA(hex, a) {
    if (hex.indexOf('rgba') === 0) return hex;
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  return {
    init: function () {
      canvas = document.getElementById('bg2d');
      if (!canvas) return;
      ctx2d = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', function (e) {
        mouse.x = e.clientX / W; mouse.y = e.clientY / H;
      }, { passive: true });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { running = false; cancelAnimationFrame(rafId); }
        else if (ZBackground.visible) ZBackground.start();
      });
    },
    setTheme: function (th) { theme = th; },
    start: function () {
      if (running) return;
      running = true; this.visible = true;
      rafId = requestAnimationFrame(frame);
    },
    stop: function () {
      running = false; this.visible = false;
      cancelAnimationFrame(rafId);
    },
    visible: true
  };
})();
