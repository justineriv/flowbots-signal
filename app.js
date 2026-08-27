/* FlowBots — shared behaviour.

   Motion model (single switch, deliberately simple):
   `html.motion-on` is set by the inline head script when motion should run.
   EVERY decorative animation is defined under that class. When it is absent
   the page is simply in its final, visible state — nothing is mid-animation
   and nothing can be left hidden. Animation is confined to the hero.        */
(function () {
  var motion = document.documentElement.classList.contains('motion-on');

  /* Single failsafe for the whole motion system.
     Every animation lives under html.motion-on, and motion-off is a verified
     state with nothing hidden. So if the hero entrance has not actually
     advanced shortly after load, drop the class: the page falls back to the
     finished, fully visible layout instead of sitting mid-animation. */
  if (motion) {
    var probe = document.querySelector('.hero-copy > *, .hero h1');
    if (probe) {
      setTimeout(function () {
        if (parseFloat(getComputedStyle(probe).opacity) < 0.9) {
          document.documentElement.classList.remove('motion-on');
        }
      }, 1200);
    }
  }

  /* mobile nav */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* Numbers. Only the hero panel counts up, and only when motion is on;
     everywhere else the final value is written immediately. */
  var fmt = function (n, dp) {
    var p = n.toFixed(dp).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  };
  var finalValue = function (el) {
    var t = parseFloat(el.getAttribute('data-target'));
    var dp = (el.getAttribute('data-target').split('.')[1] || '').length;
    return (el.getAttribute('data-prefix') || '') + fmt(t, dp) +
           (el.getAttribute('data-suffix') || '');
  };
  document.querySelectorAll('.countup').forEach(function (el) {
    var inHero = !!el.closest('.hero');
    if (!motion || !inHero) { el.textContent = finalValue(el); return; }
    var target = parseFloat(el.getAttribute('data-target'));
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var dp = (el.getAttribute('data-target').split('.')[1] || '').length;
    var start = null, dur = 1100, done = false;
    var step = function (ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = prefix + fmt(target * (1 - Math.pow(1 - p, 3)), dp) + suffix;
      if (p < 1) requestAnimationFrame(step); else done = true;
    };
    requestAnimationFrame(step);
    // If rAF never advances, still land on the real number.
    setTimeout(function () { if (!done) el.textContent = finalValue(el); }, 2000);
  });

  /* Hero feed cycling — hero only, motion only. */
  var feed = document.querySelector('.hero [data-feed]');
  if (feed && motion) {
    var items = Array.prototype.slice.call(feed.children);
    var VISIBLE = 4;
    items.forEach(function (el, i) {
      if (i >= VISIBLE) el.style.display = 'none';
      else el.style.animationDelay = (0.12 * i) + 's';
    });
    if (items.length > VISIBLE) {
      setInterval(function () {
        var first = feed.children[0];
        first.style.display = 'none';
        feed.appendChild(first);
        var next = feed.children[VISIBLE - 1];
        next.style.display = '';
        next.style.animation = 'none';
        void next.offsetWidth;
        next.style.animation = '';
        next.style.animationDelay = '0s';
      }, 3200);
    }
  } else if (feed) {
    // Static: show the first four, no motion, nothing hidden.
    Array.prototype.slice.call(feed.children).forEach(function (el, i) {
      if (i >= 4) el.style.display = 'none';
    });
  }

  /* How It Works — a control, not an animation. Click to switch panels.
     No auto-advance: animation is confined to the hero. */
  var hiw = document.querySelector('[data-hiw]');
  if (hiw) {
    var steps = hiw.querySelectorAll('.hiw-step');
    var screens = document.querySelectorAll('[data-hiw-screen]');
    var rail = hiw.querySelector('.hiw-rail i');
    var show = function (i) {
      if (rail) rail.style.transform = 'translateX(' + (i * 100) + '%)';
      steps.forEach(function (s, k) {
        s.classList.toggle('active', k === i);
        s.classList.toggle('done', k < i);
        s.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      screens.forEach(function (sc, k) { sc.style.display = k === i ? '' : 'none'; });
    };
    steps.forEach(function (s, i) { s.addEventListener('click', function () { show(i); }); });
    show(0);
  }

  /* Tabs */
  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var tabs = group.querySelectorAll('.tab');
    var name = group.getAttribute('data-tabs');
    var panels = document.querySelectorAll('[data-tabpanel="' + name + '"] .tabpanel, .tabpanel[data-tabgroup="' + name + '"]');
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        t.classList.add('active');
        t.setAttribute('aria-selected', 'true');
        panels.forEach(function (p, k) { p.classList.toggle('active', k === i); });
      });
    });
  });


  /* ---------------------------------------------------------------
     Conversion tracking scaffold.

     NO analytics ID is hardcoded here on purpose. At launch, add GA4 or
     GTM to the page head; every event below then flows through dataLayer
     with no further edits. Until then events are recorded on the page so
     the wiring is verifiable without pretending measurement exists.
     --------------------------------------------------------------- */
  window.fbEvents = window.fbEvents || [];
  function track(name, detail) {
    var payload = Object.assign({ event: name, page: location.pathname }, detail || {});
    window.fbEvents.push(payload);
    if (window.dataLayer && typeof window.dataLayer.push === 'function') {
      window.dataLayer.push(payload);
    }
    if (typeof window.gtag === 'function') { window.gtag('event', name, payload); }
  }
  window.fbTrack = track;

  document.querySelectorAll('[data-track]').forEach(function (el) {
    el.addEventListener('click', function () {
      track(el.getAttribute('data-track'), { label: (el.textContent || '').trim().slice(0, 60) });
    });
  });

  /* ---------------------------------------------------------------
     Lead form. Validates on submit, reports errors per field, and
     confirms what happens next. It is not wired to a backend in this
     prototype — submission is captured locally and flagged.
     --------------------------------------------------------------- */
  var form = document.querySelector('[data-leadform]');
  if (form) {
    var started = false;
    form.addEventListener('input', function () {
      if (!started) { started = true; track('form-start'); }
    }, { once: false });

    var showError = function (field, msg) {
      var err = document.getElementById(field.id + '-err');
      if (err) err.textContent = msg;
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
      field.classList.toggle('is-invalid', !!msg);
    };
    var validate = function (field) {
      var v = (field.value || '').trim();
      if (field.hasAttribute('required') && !v) {
        showError(field, 'This one is needed so we can send your assessment.');
        return false;
      }
      if (field.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        showError(field, 'Check the email address — it looks incomplete.');
        return false;
      }
      showError(field, '');
      return true;
    };
    form.querySelectorAll('input,select').forEach(function (f) {
      f.addEventListener('blur', function () { if (f.value.trim()) validate(f); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fields = Array.prototype.slice.call(form.querySelectorAll('input,select'));
      var bad = fields.filter(function (f) { return !validate(f); });
      if (bad.length) {
        track('form-error', { fields: bad.length });
        bad[0].focus();
        return;
      }
      track('form-submit', { problem: (form.querySelector('#lf-problem') || {}).value || '' });
      var success = document.querySelector('.lead-success');
      if (success) {
        form.hidden = true;
        success.hidden = false;
        success.setAttribute('tabindex', '-1');
        success.focus();
      }
    });
  }

  /* Sticky mobile CTA */
  var sticky = document.querySelector('.sticky-cta');
  if (sticky) {
    var onScroll = function () { sticky.classList.toggle('show', window.scrollY > 520); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
