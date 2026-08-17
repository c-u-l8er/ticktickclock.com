/* ==========================================================================
   The identifying animation for ticktickclock.com — SHELL.md §8.

   What it depicts: phases of a loop circulating, on several tracks at once.
   Nested racetracks stand for the multi-timescale memory the specification is
   built around — fast, medium, slow, glacial — and each carries a marker that
   goes round at its own rate. The outer track is divided by the five phase
   boundaries; a boundary lights as the marker crosses it, and the loop closes
   where it began. The tracks draw themselves in before anything circulates,
   because the truthful picture for a spec-rung surface is a structure being
   assembled rather than a dashboard reporting.

   IT RENDERS NO DATA AND ASSERTS NOTHING. §8.1 rule 2 is not negotiable and
   it is written in blood: gpscoord.com published `for (let i = 0; i < 12; i++)`
   — the loop bound of a decorative animation — beside the words "Active
   Pathfinders", for months. This page had its own version of that defect: a
   counter reading zero beside a label, next to two latency figures lifted out
   of a table of targets.

   So this file takes NO input from the document and writes NOTHING back into
   it. It queries exactly one element, its own canvas, and touches nothing
   else. If a number here ever collides with a number in the page's text,
   launch-gate.mjs refuses the build — and the fix is to change THIS FILE,
   never the page. Decoration yields.
   ========================================================================== */
(function () {
  var host = document.querySelector("[data-identity-animation]");
  if (!host || !host.getContext) return;
  var ctx = host.getContext("2d");
  if (!ctx) return;

  var FPS = 24;
  var FRAME = 1000 / FPS;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  /* palette, read from nothing; these are literals on purpose */
  var ACC = "228,92,255";
  var DIM = "240,233,247";
  var SIG = "90,209,200";

  var TRACKS = 4;      /* the timescales */
  var MARKS = 5;       /* the phase boundaries, on the outer track only */
  var tracks = [];
  var w = 0, h = 0, tick = 0, last = 0, raf = 0, drawn = 0;

  function layout(ww, hh) {
    tracks.length = 0;
    var cx = ww * 0.5, cy = hh * 0.5;
    var rx = ww * 0.42, ry = hh * 0.33;
    for (var i = 0; i < TRACKS; i++) {
      var k = 1 - i * 0.21;
      tracks.push({
        cx: cx, cy: cy,
        rx: Math.max(24, rx * k),
        ry: Math.max(14, ry * k),
        speed: 0.0042 / (1 + i * 1.35),
        phase: i * 0.17,
        seen: []
      });
    }
    for (var m = 0; m < MARKS; m++) tracks[0].seen.push(0);
  }

  function at(t, a) {
    return { x: t.cx + Math.cos(a) * t.rx, y: t.cy + Math.sin(a) * t.ry };
  }

  function ellipse(t, from, to) {
    ctx.beginPath();
    var steps = 96;
    for (var i = 0; i <= steps; i++) {
      var a = from + (to - from) * (i / steps);
      var p = at(t, a);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawn++;
    /* the tracks assemble over the first stretch, then hold */
    var build = Math.min(1, drawn / 46);

    for (var i = 0; i < tracks.length; i++) {
      var t = tracks[i];
      var span = 6.2832 * Math.min(1, build * (1.15 - i * 0.07));
      ellipse(t, -1.5708, -1.5708 + span);
      ctx.strokeStyle = "rgba(" + DIM + "," + (0.16 - i * 0.022) + ")";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    /* the phase boundaries, on the outer track */
    var outer = tracks[0];
    for (var m = 0; m < MARKS; m++) {
      var a = -1.5708 + (m / MARKS) * 6.2832;
      var p = at(outer, a);
      var lit = outer.seen[m];
      outer.seen[m] = lit * 0.955;
      var s = 3.2 + lit * 3.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, 6.2832);
      ctx.fillStyle = "rgba(" + ACC + "," + (0.24 + lit * 0.7) * build + ")";
      ctx.fill();
      if (lit > 0.06) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s + 5 + (1 - lit) * 9, 0, 6.2832);
        ctx.strokeStyle = "rgba(" + ACC + "," + lit * 0.36 + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (build < 1) return;

    /* the markers, one per timescale, each at its own rate */
    for (var k = 0; k < tracks.length; k++) {
      var tr = tracks[k];
      var ang = -1.5708 + tr.phase;
      var p2 = at(tr, ang);
      /* a short trailing arc, so the direction of travel is visible */
      ellipse(tr, ang - 0.5, ang);
      ctx.strokeStyle = "rgba(" + (k === 0 ? ACC : SIG) + "," + (0.5 - k * 0.09) + ")";
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, k === 0 ? 3.4 : 2.4, 0, 6.2832);
      ctx.fillStyle = "rgba(" + (k === 0 ? ACC : SIG) + "," + (0.92 - k * 0.14) + ")";
      ctx.fill();
    }
  }

  function advance() {
    for (var k = 0; k < tracks.length; k++) {
      var tr = tracks[k];
      var before = tr.phase;
      tr.phase += tr.speed * 24;
      if (tr.phase > 6.2832) tr.phase -= 6.2832;
      if (k === 0) {
        for (var m = 0; m < MARKS; m++) {
          var boundary = (m / MARKS) * 6.2832;
          if ((before < boundary && tr.phase >= boundary) || (tr.phase < before && boundary <= tr.phase)) {
            tr.seen[m] = 1;
          }
        }
      }
    }
  }

  /* --- the loop ---------------------------------------------------------- */
  function size() {
    var r = host.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = Math.max(r.width, 160); h = Math.max(r.height, 120);
    host.width = Math.round(w * dpr);
    host.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawn = 0;
    layout(w, h);
  }

  function still() { size(); for (var i = 0; i < 60; i++) { advance(); draw(); } }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    /* Stop when the tab is hidden, and when the hero has scrolled away.
       IntersectionObserver is NOT used at all — it never fires in a
       non-compositing renderer, and an animation that never starts reads as
       a broken page. SHELL.md §6. */
    if (document.hidden) return;
    if (now - last < FRAME) return;
    last = now;
    var r = host.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    tick++;
    advance();
    draw();
  }

  function boot() {
    if (reduce && reduce.matches) { still(); return; }
    size();
    if (raf) window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(frame);
  }

  var t = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(t);
    t = window.setTimeout(boot, 170);
  });
  if (reduce) reduce.onchange = boot;
  boot();
})();
