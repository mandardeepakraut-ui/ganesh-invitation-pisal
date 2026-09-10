/* ===========================================================
   Ganesh Chaturthi Invitation — scroll choreography
   Ported from the DCLogic component in
   "Ganesh Chaturthi Invitation.dc.html" (Claude Design).
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

  /* --- Element lookup ------------------------------------- */
  var el = {};
  ['heroVideo', 'heroText', 'sec2', 'sec3', 'garlandL', 'garlandR',
   'bell1', 'bell2', 'bell3', 'bell4', 'diyaL', 'diyaR',
   'invite', 'card', 'cardRegion', 'mouse', 'bubble',
   'petals', 'shareBtn', 'mapBtn', 'bubbleBox',
   'calBtn', 'countdown', 'guestGreeting'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  /* --- Cached viewport height (updated on resize) ---------- */
  var _vh = window.innerHeight;

  /* --- Easing helpers ------------------------------------- */
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* Progress 0..1 of a sticky scene.
     0 when the section's top edge first crosses the bottom of the viewport,
     1 once the sticky stage has been scrolled all the way through. Counting
     the entry phase means the choreography is already running as the scene
     slides into view, rather than waiting for the stage to pin. */
  function sceneProgress(node, viewportH) {
    var r = node.getBoundingClientRect();
    return clamp01((viewportH - r.top) / Math.max(1, r.height));
  }

  /* --- Per-frame choreography ----------------------------- */
  /* Thresholds are tuned against the progress above: with a 180svh scene the
     stage pins at about p = 0.55, so the decor lands as it settles and the
     copy resolves just after, leaving a still hold before the scene exits. */
  var BELLS = [
    ['bell1', 0.04, 0.30, -150],
    ['bell2', 0.08, 0.36, -190],
    ['bell3', 0.11, 0.40, -190],
    ['bell4', 0.15, 0.46, -150]
  ];

  function frame() {
    var vh = _vh; /* use cached value — avoids forced layout on every frame */

    /* --- Scene 02: garland, bells, lamps, invitation copy --- */
    if (el.sec2) {
      var p = sceneProgress(el.sec2, vh);

      /* Each garland half sweeps in from the edge it hangs against. */
      var g = easeOut(seg(p, 0, 0.26));
      if (el.garlandL) {
        el.garlandL.style.transform = 'translate3d(' + (-110 * (1 - g)) + '%,0,0)';
      }
      if (el.garlandR) {
        el.garlandR.style.transform = 'translate3d(' + (110 * (1 - g)) + '%,0,0)';
      }

      BELLS.forEach(function (spec) {
        var node = el[spec[0]];
        if (!node) return;
        var t = easeOut(seg(p, spec[1], spec[2]));
        node.style.transform = 'translate3d(0,' + (spec[3] * (1 - t)) + '%,0)';
      });

      var d = easeOut(seg(p, 0.26, 0.54));
      if (el.diyaL) {
        el.diyaL.style.transform = 'translate3d(' + (-130 * (1 - d)) + '%,0,0)';
      }
      if (el.diyaR) {
        el.diyaR.style.transform = 'translate3d(' + (130 * (1 - d)) + '%,0,0) scaleX(-1)';
      }

      var i = seg(p, 0.44, 0.70);
      if (el.invite) {
        el.invite.style.opacity = i;
        el.invite.style.transform =
          'translate3d(0,' + (26 * (1 - easeOut(i))) + 'px,0) scale(' + (0.96 + 0.04 * i) + ')';
      }
    }

    /* --- Scene 03: details card, mushak, speech bubble ------ */
    if (el.sec3) {
      var p3 = sceneProgress(el.sec3, vh);

      var c = seg(p3, 0.10, 0.42);
      if (el.card) {
        /* Shrink the card if it would overflow its region on short screens. */
        var s = 1;
        if (el.cardRegion && el.card.scrollHeight) {
          s = Math.max(0.7, Math.min(1, (el.cardRegion.clientHeight - 10) / el.card.scrollHeight));
        }
        el.card.style.opacity = c;
        el.card.style.transform =
          'translate3d(0,' + (30 * (1 - easeOut(c))) + 'px,0) scale(' + s + ')';
        maybeRevealCard(c); /* [ENHANCEMENT] stagger + WA pulse */
      }

      var m = easeOut(seg(p3, 0.22, 0.58));
      if (el.mouse) {
        el.mouse.style.transform = 'translate3d(' + (135 * (1 - m)) + '%,0,0)';
      }
      if (el.bubble) {
        el.bubble.style.opacity = seg(p3, 0.58, 0.74);
      }
    }

    /* --- Scene 01: hero copy fades on first scroll ---------- */
    if (el.heroText) {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      el.heroText.style.opacity = Math.max(0, 1 - y / (vh * 0.45));
    }
  }

  /* --- Render loop (event-driven — stops when idle) -------- */
  /* Instead of burning 60 fps continuously, we schedule a frame
     on every scroll/resize and fire one final frame 200 ms after
     the last activity, then go completely idle. This alone cuts
     CPU/GPU usage to near-zero when the user isn't scrolling. */
  var rafId  = null;
  var idleId = null;

  function singleFrame() {
    rafId = null;
    frame();
  }

  function requestRender() {
    if (!rafId) rafId = requestAnimationFrame(singleFrame);
    clearTimeout(idleId);
    /* One extra frame after scroll settles to land the final position. */
    idleId = setTimeout(function () {
      idleId = null;
      if (!rafId) rafId = requestAnimationFrame(singleFrame);
    }, 200);
  }

  /* Safari/iOS can silently drop autoplay; nudge the video back. */
  function kickVideo() {
    var v = el.heroVideo;
    if (!v || !v.paused) return;
    v.muted = true;
    var pr = v.play();
    if (pr && pr.catch) pr.catch(function () {});
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

  /* --- Boot ----------------------------------------------- */
  function start() {
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

    document.addEventListener('scroll', function () {
      requestRender();
      kickVideo();
    }, { passive: true, capture: true });

    window.addEventListener('resize', function () {
      _vh = window.innerHeight;
      requestRender();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) requestRender();
    });

    setInterval(kickVideo, 4000);
    requestRender();
  }

  window.addEventListener('pagehide', function () {
    cancelAnimationFrame(rafId);
    clearTimeout(idleId);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
