/* ===========================================================
   Ganesh Chaturthi Invitation — scroll choreography
   Ported from the DCLogic component in
   "Ganesh Chaturthi Invitation.dc.html" (Claude Design).

   Performance-optimized: rAF-gated scroll, cached card scale,
   batched DOM reads, debounced resize, one-shot video init.
   =========================================================== */
(function () {
  'use strict';

  /* --- Configuration -------------------------------------- */
  var CONFIG = {
    mapsUrl:      'https://maps.app.goo.gl/n6iHKFjtodLQPsuQ7',
    showWhatsApp: true,
    showPetals:   true,
    shareMessage: 'Ganpati Bappa Morya! You and your family are invited for darshan ' +
                  'and aarti at our home on 14 & 15 September 2026. Directions: '
  };

  /* --- Element lookup (cached once) ----------------------- */
  var el = {};
  ['heroVideo', 'heroText', 'sec2', 'sec3', 'garlandL', 'garlandR',
   'bell1', 'bell2', 'bell3', 'bell4', 'diyaL', 'diyaR',
   'invite', 'card', 'cardRegion', 'mouse', 'bubble',
   'petals', 'shareBtn', 'mapBtn', 'bubbleBox',
   'calBtn', 'countdown', 'guestGreeting', 'thankYouScreen'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  /* --- Cached layout values (updated on resize) ----------- */
  var _vh = window.innerHeight;
  var _cachedCardScale = 1;

  function recalcCardScale() {
    if (el.cardRegion && el.card && el.card.scrollHeight) {
      _cachedCardScale = Math.max(0.7, Math.min(1,
        (el.cardRegion.clientHeight - 10) / el.card.scrollHeight));
    } else {
      _cachedCardScale = 1;
    }
  }

  /* --- Easing helpers ------------------------------------- */
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* Progress 0..1 of a sticky scene:
     - 0.0 to 0.15: entry phase while scene top moves from viewport bottom to top (r.top: vh -> 0)
     - 0.15 to 1.00: pinned phase while stage is stuck at top: 0 (r.top: 0 -> -(height - vh))
     Guarantees 85% of animation progress takes place WHILE pinned, so scrolling
     actively drives animation on screen with zero dead scroll holds. */
  function sceneProgress(node, viewportH) {
    var r = node.getBoundingClientRect();
    var entryProgress = clamp01((viewportH - r.top) / viewportH);
    var pinDist = Math.max(1, r.height - viewportH);
    var pinProgress = clamp01(-r.top / pinDist);
    return 0.15 * entryProgress + 0.85 * pinProgress;
  }

  /* --- Per-frame choreography ----------------------------- */
  var BELLS = [
    ['bell1', 0.10, 0.40, -150],
    ['bell2', 0.14, 0.48, -190],
    ['bell3', 0.18, 0.54, -190],
    ['bell4', 0.22, 0.60, -150]
  ];

  function frame() {
    var vh = _vh; /* use cached value — avoids forced layout on every frame */

    /* --- Batch DOM reads first ----------------------------- */
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    var p2 = el.sec2 ? sceneProgress(el.sec2, vh) : 0;
    var p3 = el.sec3 ? sceneProgress(el.sec3, vh) : 0;

    /* --- Scene 02: garland, bells, lamps, invitation copy --- */
    if (el.sec2) {
      /* Each garland half sweeps in from the edge it hangs against. */
      var g = easeOut(seg(p2, 0.05, 0.35));
      if (el.garlandL) {
        el.garlandL.style.transform = 'translate3d(' + (-110 * (1 - g)) + '%,0,0)';
      }
      if (el.garlandR) {
        el.garlandR.style.transform = 'translate3d(' + (110 * (1 - g)) + '%,0,0)';
      }

      BELLS.forEach(function (spec) {
        var node = el[spec[0]];
        if (!node) return;
        var t = easeOut(seg(p2, spec[1], spec[2]));
        node.style.transform = 'translate3d(0,' + (spec[3] * (1 - t)) + '%,0)';
      });

      var d = easeOut(seg(p2, 0.25, 0.65));
      if (el.diyaL) {
        el.diyaL.style.transform = 'translate3d(' + (-130 * (1 - d)) + '%,0,0)';
      }
      if (el.diyaR) {
        el.diyaR.style.transform = 'translate3d(' + (130 * (1 - d)) + '%,0,0) scaleX(-1)';
      }

      var i = seg(p2, 0.45, 0.90);
      if (el.invite) {
        el.invite.style.opacity = i;
        el.invite.style.transform =
          'translate3d(0,' + (26 * (1 - easeOut(i))) + 'px,0) scale(' + (0.96 + 0.04 * i) + ')';
      }
    }

    /* --- Scene 03: details card, mushak, speech bubble ------ */
    if (el.sec3) {
      var c = seg(p3, 0.10, 0.65);
      if (el.card) {
        /* Use cached card scale — recalculated only on resize, not every frame. */
        el.card.style.opacity = c;
        el.card.style.transform =
          'translate3d(0,' + (30 * (1 - easeOut(c))) + 'px,0) scale(' + _cachedCardScale + ')';
        maybeRevealCard(c); /* [ENHANCEMENT] stagger + WA pulse */
      }

      var m = easeOut(seg(p3, 0.25, 0.75));
      if (el.mouse) {
        el.mouse.style.transform = 'translate3d(' + (135 * (1 - m)) + '%,0,0)';
      }
      if (el.bubble) {
        el.bubble.style.opacity = seg(p3, 0.65, 0.90);
      }
    }

    /* --- Scene 01: hero copy fades on first scroll ---------- */
    if (el.heroText) {
      el.heroText.style.opacity = Math.max(0, 1 - scrollY / (vh * 0.45));
    }
  }

  /* --- Render loop (event-driven — stops when idle) -------- */
  /* rAF-gated: only one callback queued at a time. A trailing
     frame 200 ms after the last scroll ensures we land the final
     position, then go completely idle. */
  var ticking = false;
  var idleId  = null;

  function requestRender() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        frame();
      });
    }
    clearTimeout(idleId);
    /* One extra frame after scroll settles to land the final position. */
    idleId = setTimeout(function () {
      idleId = null;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          frame();
        });
      }
    }, 200);
  }

  /* --- Video initialisation (one-shot, not per-scroll) ---- */
  /* Safari/iOS can silently drop autoplay; we nudge the video
     once at boot and again on visibility change — never on scroll. */
  function startVideo() {
    var v = el.heroVideo;
    if (!v) return;
    v.muted = true;
    if (v.paused) {
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
  }

  /* --- [ENHANCEMENT] Stagger card fields on first reveal --- */
  var _cardRevealed = false;
  function maybeRevealCard(opacity) {
    if (_cardRevealed || opacity < 0.55) return;
    _cardRevealed = true;
    var items = el.card ? el.card.querySelectorAll('.field, .divider') : [];
    items.forEach(function (node, i) {
      node.classList.add(node.classList.contains('divider') ? 'divider--reveal' : 'field--reveal');
      node.style.animationDelay = (i * 60) + 'ms';
    });
    /* [ENHANCEMENT] Pulse the WhatsApp button after fields settle */
    if (el.shareBtn) {
      setTimeout(function () {
        el.shareBtn.classList.add('btn-share--pulse');
        el.shareBtn.addEventListener('animationend', function () {
          el.shareBtn.classList.remove('btn-share--pulse');
        }, { once: true });
      }, items.length * 60 + 500);
    }
  }

  /* --- [ENHANCEMENT] Confetti burst on share click --------- */
  var CONFETTI_COLORS = ['#f5a623','#f6d365','#f78fb3','#d4a017','#ff6b6b','#ffa552'];
  function launchConfetti() {
    var btn = el.shareBtn;
    if (!btn) return;
    var rect = btn.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    for (var i = 0; i < 28; i++) {
      (function (idx) {
        var p = document.createElement('span');
        p.className = 'confetti-particle';
        var angle = (Math.random() * 360) * (Math.PI / 180);
        var dist  = 40 + Math.random() * 80;
        var tx = Math.cos(angle) * dist;
        var ty = Math.sin(angle) * dist - 60;
        p.style.left = (cx - 4) + 'px';
        p.style.top  = (cy - 4) + 'px';
        p.style.background = CONFETTI_COLORS[idx % CONFETTI_COLORS.length];
        p.style.transform  = 'translate(' + tx + 'px,' + ty + 'px) rotate(0deg)';
        p.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';
        p.style.animationDelay   = (Math.random() * 0.12) + 's';
        document.body.appendChild(p);
        p.addEventListener('animationend', function () { p.remove(); }, { once: true });
      })(i);
    }
  }

  /* --- Interactions --------------------------------------- */
  function openMap() {
    window.open(CONFIG.mapsUrl, '_blank', 'noopener');
  }

  function shareOnWhatsApp() {
    launchConfetti(); /* [ENHANCEMENT] */
    /* Use the live Vercel/hosted URL so guests get a real clickable link */
    var pageUrl = window.location.origin + window.location.pathname;
    var text = CONFIG.shareMessage +
               '\n\n🔗 Open Invitation: ' + pageUrl +
               '\n\n🗺️ Directions: ' + CONFIG.mapsUrl;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  /* --- Resize handling (debounced) ------------------------ */
  var resizeTimer = null;

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      _vh = window.innerHeight;
      recalcCardScale();
      requestRender();
    }, 150);
  }

  /* --- Boot ----------------------------------------------- */
  function start() {
    /* --- Post-event Thank You mode (auto after Sep 15 2026) - */
    if (el.thankYouScreen) {
      var now = new Date();
      /* Show from Sep 16 onwards (event ends Sep 15) */
      var eventOver = new Date('2026-09-16T00:00:00');
      if (now >= eventOver) {
        el.thankYouScreen.hidden = false;
        return; /* skip rest of invite setup */
      }
    }

    if (el.petals) el.petals.hidden = !CONFIG.showPetals;
    if (el.shareBtn) {
      el.shareBtn.hidden = !CONFIG.showWhatsApp;
      el.shareBtn.addEventListener('click', shareOnWhatsApp);
    }
    if (el.mapBtn)  el.mapBtn.addEventListener('click', openMap);
    if (el.bubble)  el.bubble.addEventListener('click', openMap);

    /* --- Personalized greeting from ?name= URL param -------- */
    var params = new URLSearchParams(window.location.search);
    var guestName = (params.get('name') || '').trim();
    if (guestName && el.guestGreeting) {
      el.guestGreeting.textContent = 'Dear ' + guestName + ',';
      el.guestGreeting.hidden = false;
    }

    /* --- Countdown to 14 Sep 2026 --------------------------- */
    if (el.countdown) {
      var eventDate = new Date('2026-09-14T00:00:00');
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var days = Math.round((eventDate - today) / 86400000);
      el.countdown.textContent =
        days > 1  ? days + ' days to go 🪔' :
        days === 1 ? 'Tomorrow is the day! 🎉' :
        days === 0 ? 'Today is the day! 🎉' :
                     'Thank you for celebrating with us! 🙏';
    }

    /* --- Add to Calendar ------------------------------------ */
    if (el.calBtn) {
      el.calBtn.addEventListener('click', function () {
        var loc  = 'Sudam Shinde Chawl Room No 2, Prem Nagar Station Road, Jogeshwari East, Mumbai 400060';
        var desc = 'Darshan, aarti and prasad at our home.\n\nDirections: ' + CONFIG.mapsUrl;
        /* iOS/macOS Safari → .ics download; Android/Desktop → Google Calendar */
        var isApple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) &&
                      !/Chrome|CriOS|FxiOS/i.test(navigator.userAgent);
        if (isApple) {
          var ics = [
            'BEGIN:VCALENDAR', 'VERSION:2.0',
            'BEGIN:VEVENT',
            'DTSTART;VALUE=DATE:20260914',
            'DTEND;VALUE=DATE:20260916',
            'SUMMARY:Ganesh Chaturthi — Darshan & Aarti (Pisal Family)',
            'DESCRIPTION:' + desc.replace(/\n/g, '\\n'),
            'LOCATION:' + loc,
            'END:VEVENT', 'END:VCALENDAR'
          ].join('\r\n');
          var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'ganesh-chaturthi-2026.ics';
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          var gcUrl = 'https://www.google.com/calendar/render?action=TEMPLATE' +
            '&text='     + encodeURIComponent('Ganesh Chaturthi — Darshan & Aarti (Pisal Family)') +
            '&dates=20260914/20260916' +
            '&details='  + encodeURIComponent(desc) +
            '&location=' + encodeURIComponent(loc);
          window.open(gcUrl, '_blank', 'noopener');
        }
      });
    }

    /* --- Scroll: only schedule rAF, no video check ---------- */
    document.addEventListener('scroll', requestRender, { passive: true, capture: true });

    /* --- Resize: debounced ---------------------------------- */
    window.addEventListener('resize', onResize);

    /* --- Visibility: resume video + re-render --------------- */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        startVideo();
        requestRender();
      }
    });

    /* --- Video: one-shot start (not per-scroll) ------------- */
    startVideo();

    /* --- Card scale: initial calculation -------------------- */
    recalcCardScale();

    /* --- First render --------------------------------------- */
    requestRender();
  }

  window.addEventListener('pagehide', function () {
    clearTimeout(idleId);
    clearTimeout(resizeTimer);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
