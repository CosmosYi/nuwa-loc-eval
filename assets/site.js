(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme toggle (follows the system until the viewer chooses) */
  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('nuwa-theme', next); } catch (e) { /* storage unavailable */ }
    });
  }

  /* ---------- nav state, reading progress */
  var nav = document.querySelector('.nav');
  var bar = document.querySelector('.progress span');
  var hero = document.querySelector('.hero');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      if (nav) nav.classList.toggle('scrolled', y > 8);
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.setProperty('--p', h > 0 ? Math.min(1, y / h).toFixed(4) : '0');
      if (hero) {
        var past = hero.getBoundingClientRect().bottom < 90;
        root.classList.toggle('past-hero', past);
        /* back in the hero: no section is current */
        if (!past && y < 40) document.querySelectorAll('.nav-links a[aria-current], .toc a[aria-current]').forEach(function (a) { a.removeAttribute('aria-current'); });
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- dimension tabs */
  document.querySelectorAll('[data-tabs]').forEach(function (box) {
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      if (focus !== null) {
        var list = tab.parentNode;
        if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: tab.offsetLeft - list.offsetLeft - 8, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    var first = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    select(first, null);
  });

  /* ---------- figure switch inside a panel */
  document.querySelectorAll('[data-figs]').forEach(function (box) {
    var buttons = box.querySelectorAll('.fig-switch button');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (o) {
          var on = o === b;
          o.setAttribute('aria-pressed', on ? 'true' : 'false');
          document.getElementById(o.getAttribute('data-fig')).hidden = !on;
        });
      });
    });
  });

  /* ---------- enlarge figures and cases */
  var dlg = document.querySelector('dialog.zoom');
  if (dlg && typeof dlg.showModal === 'function') {
    var img = dlg.querySelector('img');
    var cap = dlg.querySelector('.zoom-cap');
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-zoom]');
      if (!trigger) return;
      var src, alt, captionHtml = '';
      if (trigger.hasAttribute('data-src')) {
        src = trigger.getAttribute('data-src');
        var c = document.getElementById(trigger.getAttribute('data-caption'));
        captionHtml = c ? c.innerHTML : '';
        alt = c ? c.textContent : '';
      } else {
        var fig = trigger.closest('figure');
        var i = trigger.querySelector('img');
        src = i.getAttribute('src');
        alt = i.getAttribute('alt');
        // a full caption kept for the viewer when the page shows a shorter one
        var fc = document.getElementById(trigger.getAttribute('data-caption') || '') || (fig && fig.querySelector('figcaption'));
        captionHtml = fc ? fc.innerHTML : '';
      }
      img.src = src;
      img.alt = alt || '';
      cap.innerHTML = captionHtml;
      dlg.showModal();
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { img.removeAttribute('src'); });
  }

  /* ---------- copy BibTeX */
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    var label = b.querySelector('span') || b;
    b.addEventListener('click', function () {
      var src = document.getElementById(b.getAttribute('data-copy'));
      var text = src.textContent;
      function done(ok) {
        label.textContent = ok ? 'Copied' : 'Select and copy';
        setTimeout(function () { label.textContent = 'Copy'; }, 1800);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        var r = document.createRange();
        r.selectNodeContents(src);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        done(ok);
      }
    });
  });

  /* ---------- chart tooltips (redrawn charts carry data-tip on each mark) */
  var tip = null, hot = null;
  function hideTip() {
    if (hot) { hot.classList.remove('hot'); var ch = hot.closest('.chart'); if (ch) ch.classList.remove('has-hot'); hot = null; }
    if (tip) tip.hidden = true;
  }
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { if (hot) hideTip(); return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); }
    if (t !== hot) {
      hideTip();
      hot = t; t.classList.add('hot'); t.closest('.chart').classList.add('has-hot');
      tip.textContent = t.getAttribute('data-tip');
    }
    tip.hidden = false;
    var w = tip.offsetWidth, x = e.clientX + 14, y = e.clientY - tip.offsetHeight - 12;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y < 8) y = e.clientY + 18;
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }, { passive: true });
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ---------- pointer-following glow on cards */
  document.addEventListener('pointermove', function (e) {
    var g = e.target.closest && e.target.closest('.glow');
    if (!g) return;
    var r = g.getBoundingClientRect();
    g.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    g.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ---------- highlight the section in view; reveal blocks on scroll */
  var links = {};
  document.querySelectorAll('.nav-links a, .toc a').forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    (links[id] = links[id] || []).push(a);
  });
  var reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) {
          links[k].forEach(function (a) { if (k === en.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    Object.keys(links).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });

    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }
})();
