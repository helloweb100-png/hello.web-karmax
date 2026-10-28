/* =====================================================================
   ATRACCIONES KARMAX · app.js
   Orden: utilidades > preloader > scroll > UI > animaciones > 3D > forms.
   Cada módulo corre aislado (try/catch): si uno falla, el resto sigue y
   el contenido nunca queda oculto. Todo respeta prefers-reduced-motion.
   Librerías locales: GSAP + ScrollTrigger, Lenis y Three.js (carga diferida).
   ===================================================================== */
(() => {
  'use strict';

  /* ---------- Utilidades ---------- */
  const WA_NUMBER = '522221314976';
  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  const safe = (name, fn) => { try { fn(); } catch (err) { console.warn(`[karmax] ${name}:`, err); } };

  let lenis = null;
  const readyCbs = [];
  const onReady = (fn) => (doc.classList.contains('is-ready') ? fn() : readyCbs.push(fn));

  /* ---------- Enlaces de WhatsApp (data-wa => href con mensaje) ---------- */
  function initWhatsApp() {
    $$('[data-wa]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/wa\.me\/(\d+)/);
      a.href = `https://wa.me/${m ? m[1] : WA_NUMBER}?text=${encodeURIComponent(a.dataset.wa)}`;
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* ---------- Titulares: división por palabras ---------- */
  function splitWords(el, wrapperClass) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split(' ').forEach((word, i) => {
      const outer = document.createElement('span');
      outer.className = wrapperClass || 'w';
      outer.setAttribute('aria-hidden', 'true');
      if (wrapperClass) {
        outer.textContent = word;
      } else {
        const inner = document.createElement('span');
        inner.className = 'wi';
        inner.style.setProperty('--i', i);
        inner.textContent = word;
        outer.appendChild(inner);
      }
      el.appendChild(outer);
      el.appendChild(document.createTextNode(' '));
    });
  }

  /* =====================================================================
     PRELOADER
     ===================================================================== */
  function initLoader() {
    const loader = $('#loader');
    const finish = () => {
      doc.classList.remove('is-loading');
      doc.classList.add('is-ready');
      if (lenis) lenis.start();
      readyCbs.splice(0).forEach((fn) => safe('onReady', fn));
      if (loader) setTimeout(() => loader.classList.add('is-gone'), 1900);
    };
    if (!loader || reduceMotion) {
      if (loader) loader.classList.add('is-gone');
      finish();
      return;
    }

    const pctEl = $('#loaderPct');
    const msgEl = $('#loaderMsg');
    const bars = $$('.loader__bar i', loader);
    $$('.loader__panels i', loader).forEach((p, i) => p.style.setProperty('--k', i));
    const msgs = [
      [0, 'Inflando brincolines'], [18, 'Calentando al toro'], [38, 'Preparando la espuma'],
      [58, 'Puliendo la carreta'], [78, 'Encendiendo la locomotora'], [96, 'Todos a bordo'],
    ];
    let seen = false;
    try { seen = sessionStorage.getItem('karmax-seen') === '1'; sessionStorage.setItem('karmax-seen', '1'); } catch (e) { /* modo privado */ }
    const MIN = seen ? 900 : 2000, CAP = 5000;
    const t0 = performance.now();
    let prevT = t0;
    let loaded = document.readyState === 'complete';
    let pct = 0, lastMsg = -1, done = false;
    // Solo se espera lo crítico (tipografías y foto principal); el resto de la página sigue cargando en segundo plano
    const heroImg = $('.stage__card--a img');
    Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(),
    ]).then(() => { loaded = true; });
    window.addEventListener('load', () => { loaded = true; }, { once: true });

    const exit = () => {
      if (done) return;
      done = true;
      setTimeout(() => {
        loader.classList.add('is-done');
        setTimeout(finish, 650);
      }, 380);
    };
    // Respaldo: aunque los fotogramas se detengan (pestaña en segundo plano, equipo lento), el loader termina
    setTimeout(exit, CAP + 1500);

    const tick = (now) => {
      const t = now - t0;
      const dt = Math.min((now - prevT) / 1000, 0.1);
      prevT = now;
      let target = 1 - Math.pow(1 - clamp(t / MIN, 0, 1), 2.2);
      target *= 90;
      if ((loaded && t >= MIN) || t > CAP) target = 100;
      pct += (target - pct) * (1 - Math.exp(-dt * 5.5));   // suavizado independiente de los FPS
      if (target === 100 && pct > 99.4) pct = 100;

      pctEl.textContent = Math.round(pct);
      bars.forEach((b, i) => b.style.setProperty('--f', clamp((pct - i * 16.667) / 16.667, 0, 1)));
      let mi = 0;
      msgs.forEach((m, i) => { if (pct >= m[0]) mi = i; });
      if (mi !== lastMsg) { msgEl.textContent = msgs[mi][1]; lastMsg = mi; }

      if (pct >= 100) { exit(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* =====================================================================
     SCROLL SUAVE + DISPATCHER
     ===================================================================== */
  const scrollSubs = [];
  let lastY = 0, lastDir = 1;
  const emitScroll = (y, v) => {
    lastDir = y > lastY ? 1 : y < lastY ? -1 : lastDir;
    lastY = y;
    scrollSubs.forEach((fn) => fn(y, lastDir, v || 0));
  };
  const onScroll = (fn) => scrollSubs.push(fn);

  function initSmoothScroll() {
    if (!reduceMotion && window.Lenis) {
      lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      lenis.stop();
      lenis.on('scroll', (e) => emitScroll(e.scroll, e.velocity));
      if (hasGSAP) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((t) => lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);
      } else {
        const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    } else {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { emitScroll(window.scrollY, 0); ticking = false; });
      }, { passive: true });
    }

    // Anclas con desplazamiento suave
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(target, { duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  }

  /* =====================================================================
     NAVEGACIÓN, PROGRESO Y RIEL
     ===================================================================== */
  let closeMenu = () => {};
  function initNav() {
    const nav = $('#nav'), btn = $('#menuBtn'), menu = $('#menu');
    $$('.menu__nav a', menu).forEach((a, i) => a.style.setProperty('--k', i));

    const setMenu = (open) => {
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      doc.classList.toggle('menu-open', open);
      if (lenis) (open ? lenis.stop() : lenis.start());
      else doc.style.overflow = open ? 'hidden' : '';
    };
    closeMenu = () => { if (menu.classList.contains('is-open')) setMenu(false); };
    btn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    matchMedia('(min-width:1024px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

    // Progreso, ocultar/mostrar nav, sección activa
    const bar = $('.progress');
    const rail = $('#rail');
    const railLinks = rail ? $$('a', rail) : [];
    const navLinks = $$('.nav__links a');
    const ids = ['inicio', 'atracciones', 'galeria', 'toros', 'inflables', 'espuma', 'contacto'];
    const sections = ids.map((id) => document.getElementById(id));
    let maxScroll = 1;
    const measure = () => { maxScroll = Math.max(1, doc.scrollHeight - innerHeight); };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);
    if (hasGSAP) ScrollTrigger.addEventListener('refresh', measure);

    onScroll((y, dir) => {
      const p = clamp(y / maxScroll, 0, 1);
      bar.style.setProperty('--p', p.toFixed(4));
      if (rail) rail.style.setProperty('--p', p.toFixed(4));
      nav.classList.toggle('is-hidden', dir > 0 && y > 480 && !doc.classList.contains('menu-open'));

      let active = 0;
      sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= innerHeight * 0.5) active = i; });
      railLinks.forEach((a, i) => a.classList.toggle('is-active', i === active));
      navLinks.forEach((a) => {
        const k = ids.indexOf(a.getAttribute('href').slice(1));
        a.setAttribute('aria-current', String(k !== -1 && k === active));
      });
    });
    emitScroll(window.scrollY, 0);
  }

  /* =====================================================================
     REVEAL, CONTADORES, TILT, BOTONES
     ===================================================================== */
  function initReveal() {
    // Elementos que se revelan al entrar al viewport
    $$('.bento__cell').forEach((c, i) => { c.dataset.reveal = 'scale'; c.style.setProperty('--d', `${(i % 3) * 0.09}s`); });
    $$('.strip').forEach((c, i) => { c.dataset.reveal = ''; c.style.setProperty('--d', `${i * 0.1}s`); });
    $$('.occ__list li').forEach((c, i) => { c.dataset.reveal = ''; c.style.setProperty('--d', `${i * 0.06}s`); });
    $$('.more__row li').forEach((c, i) => { c.dataset.reveal = ''; c.style.setProperty('--d', `${i * 0.06}s`); });

    const els = $$('[data-reveal], [data-split]:not([data-intro-split])');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  }

  function initCounters() {
    const els = $$('[data-count]');
    const run = (el) => {
      const end = +el.dataset.count;
      if (reduceMotion) { el.textContent = end; return; }
      const t0 = performance.now(), dur = 1800;
      const step = (now) => {
        const k = clamp((now - t0) / dur, 0, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    els.forEach((el) => { el.textContent = '0'; });
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
    }), { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  function initTilt() {
    if (!finePointer || reduceMotion) return;
    $$('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${(px * 12).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-py * 12).toFixed(2)}deg`);
        el.classList.add('is-tilting');
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        el.classList.remove('is-tilting');
      });
    });
  }

  // Botones con "magnetismo" del contenido (no mueve el botón entero)
  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$('.btn--mag').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--mx', ((e.clientX - (r.left + r.width / 2)) * 0.18).toFixed(1));
        btn.style.setProperty('--my', ((e.clientY - (r.top + r.height / 2)) * 0.28).toFixed(1));
      });
      btn.addEventListener('pointerleave', () => { btn.style.setProperty('--mx', 0); btn.style.setProperty('--my', 0); });
    });
  }

  /* =====================================================================
     HERO: parallax con el cursor y con el scroll
     ===================================================================== */
  function initStage() {
    const stage = $('#stage'), hero = $('#inicio');
    if (!stage) return;
    if (hasGSAP && !reduceMotion) {
      gsap.to(stage, {
        yPercent: -9, scale: 0.96, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      });
    }
    if (!finePointer || reduceMotion) return;
    const items = $$('[data-depth]', stage).map((el) => ({ el, d: +el.dataset.depth, x: 0, y: 0 }));
    let mx = 0, my = 0, running = false;
    const loop = () => {
      let moving = false;
      items.forEach((it) => {
        const tx = -mx * 16 * it.d, ty = -my * 12 * it.d;
        it.x = lerp(it.x, tx, 0.08);
        it.y = lerp(it.y, ty, 0.08);
        if (Math.abs(it.x - tx) > 0.05 || Math.abs(it.y - ty) > 0.05) moving = true;
        it.el.style.setProperty('--tx', `${it.x.toFixed(2)}px`);
        it.el.style.setProperty('--ty', `${it.y.toFixed(2)}px`);
      });
      if (moving) requestAnimationFrame(loop); else running = false;
    };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!running) { running = true; requestAnimationFrame(loop); }
    });
  }

  /* =====================================================================
     MARQUEE (velocidad ligada al scroll)
     ===================================================================== */
  function initMarquee() {
    const track = $('#marqueeTrack');
    if (!track || reduceMotion || !track.animate) return;
    const set = $('.marquee__set', track);
    let w = set.getBoundingClientRect().width;
    while (track.scrollWidth < innerWidth * 2 + w) {
      const c = set.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }
    const anim = track.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-w}px)` }],
      { duration: (w / 70) * 1000, iterations: Infinity }
    );
    onScroll((y, dir, v) => { anim.playbackRate = 1 + Math.min(Math.abs(v) * 0.45, 6); });
    addEventListener('resize', () => {
      w = set.getBoundingClientRect().width;
      anim.effect.setKeyframes([{ transform: 'translateX(0)' }, { transform: `translateX(${-w}px)` }]);
    });
  }

  /* =====================================================================
     MANIFIESTO: las palabras se encienden con el scroll
     ===================================================================== */
  function initManifesto() {
    const text = $('.manifesto__text');
    if (!text) return;
    splitWords(text, 'word');
    const words = $$('.word', text);
    if (!hasGSAP || reduceMotion) { words.forEach((w) => { w.style.color = 'var(--ink)'; }); return; }
    gsap.to(words, {
      color: '#0d0e12', stagger: 0.12, ease: 'none',
      scrollTrigger: { trigger: text, start: 'top 82%', end: 'bottom 48%', scrub: true },
    });
  }

  /* =====================================================================
     EL TREN: scroll vertical => viaje horizontal (solo escritorio)
     ===================================================================== */
  function initTren() {
    const sec = $('#atracciones');
    if (!sec || !hasGSAP) return;
    const track = $('#trenTrack');
    const railWrap = $('.tren__rail', sec);

    gsap.matchMedia().add('(min-width:1024px) and (prefers-reduced-motion:no-preference)', () => {
      sec.classList.add('is-pinned');
      const wheels = $$('.vagon__wheel', sec);
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: sec, start: 'top top', end: () => `+=${dist()}`,
          pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true,
          onToggle: (self) => { const r = $('#rail'); if (r) r.classList.toggle('is-away', self.isActive); },
          onUpdate: (self) => {
            const p = self.progress, d = dist();
            const wr = (p * d / (Math.PI * 40)) * 360;
            wheels.forEach((w) => w.style.setProperty('--wr', `${wr.toFixed(1)}deg`));
            const rw = railWrap.clientWidth;
            railWrap.style.setProperty('--rp', `${(p * rw).toFixed(1)}px`);
            railWrap.style.setProperty('--rx', `${(p * (rw - 46)).toFixed(1)}px`);
          },
        },
      });
      return () => sec.classList.remove('is-pinned');
    });
  }

  /* =====================================================================
     TOROS: lista de modelos con autoplay
     ===================================================================== */
  function initToros() {
    const sec = $('#toros');
    if (!sec) return;
    const tabs = $$('.toros__tab', sec), slides = $$('.toros__slide', sec);
    const cap = $('#torosCap'), timer = $('.toros__timer i', sec), stage = $('.toros__stage', sec), list = $('.toros__list', sec);
    const DUR = 5500;
    const auto = !reduceMotion;
    let cur = 0, timerId = 0, visible = false, paused = false;

    const restart = () => {
      clearTimeout(timerId);
      timer.classList.remove('run');
      void timer.offsetWidth;
      if (auto && visible && !paused) {
        timer.style.setProperty('--dur', `${DUR}ms`);
        timer.classList.add('run');
        timerId = setTimeout(() => go(cur + 1), DUR);
      }
    };
    const go = (i, focus) => {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach((t, k) => {
        const on = k === cur;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      slides.forEach((s, k) => { s.classList.toggle('is-active', k === cur); s.setAttribute('aria-hidden', String(k !== cur)); });
      cap.textContent = $('figcaption', slides[cur]).textContent;
      if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: tabs[cur].offsetLeft - 24, behavior: 'smooth' });
      if (focus) tabs[cur].focus();
      restart();
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
    list.addEventListener('keydown', (e) => {
      const next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (next) { e.preventDefault(); go(cur + next, true); }
    });
    stage.addEventListener('pointerenter', () => { paused = true; restart(); });
    stage.addEventListener('pointerleave', () => { paused = false; restart(); });
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; restart(); }, { threshold: 0.35 }).observe(sec);
    go(0);
  }

  /* =====================================================================
     CARRETA: la imagen se abre a pantalla completa con el scroll
     ===================================================================== */
  function initCarreta() {
    const sec = $('#carreta');
    if (!sec || !hasGSAP) return;
    const frame = $('#carretaFrame'), img = $('.carreta__img', sec), copy = $('#carretaCopy');
    const t1 = $('.carreta__t--top', sec), t2 = $('.carreta__t--bot', sec);

    gsap.matchMedia().add('(prefers-reduced-motion:no-preference)', () => {
      sec.classList.add('is-expanding');
      const narrow = innerWidth < 700;
      // Ambos extremos con la misma sintaxis (4 lados + radio) para que GSAP interpole cada valor por separado
      const from = narrow ? 'inset(26% 8% 26% 8% round 26px)' : 'inset(30% 20% 30% 20% round 28px)';
      gsap.set(img, { scale: 1.4 });
      gsap.set(copy, { opacity: 0, y: 40 });
      gsap.timeline({
        scrollTrigger: { trigger: '.carreta__pin', start: 'top top', end: '+=170%', pin: true, scrub: 0.7, anticipatePin: 1 },
      })
        .fromTo(frame, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 1 }, 0)
        .to(img, { scale: 1, ease: 'none', duration: 1.1 }, 0)
        .to(t1, { yPercent: -170, opacity: 0, ease: 'power2.in', duration: 0.7 }, 0.05)
        .to(t2, { yPercent: 170, opacity: 0, ease: 'power2.in', duration: 0.7 }, 0.05)
        .to(copy, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.5 }, 0.9)
        .to({}, { duration: 0.35 });
      return () => sec.classList.remove('is-expanding');
    });
  }

  /* =====================================================================
     INFLABLES: parallax interno en cada foto del bento
     ===================================================================== */
  function initBento() {
    if (!hasGSAP || reduceMotion) return;
    $$('.bento__cell img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* =====================================================================
     EXTRAS (franjas) · OCASIONES (vista previa) · PASOS · FAQ
     ===================================================================== */
  function initStrips() {
    const strips = $$('.strip');
    const set = (s) => strips.forEach((x) => x.classList.toggle('is-active', x === s));
    strips.forEach((s) => {
      s.addEventListener('mouseenter', () => { if (finePointer) set(s); });
      s.addEventListener('focusin', () => set(s));
      s.addEventListener('click', () => set(s));
    });
  }

  function initOccasions() {
    const rows = $$('.occ__row');
    const type = $('#f-type');
    // Al elegir un tipo de evento, se preselecciona en el formulario
    rows.forEach((r) => r.addEventListener('click', () => {
      const v = r.dataset.event;
      if (type && v) { const o = $$('option', type).find((x) => x.textContent === v); if (o) type.value = o.value || o.textContent; }
    }));
    const prev = $('#occPreview');
    if (!prev || !finePointer || reduceMotion) return;
    const pimg = $('img', prev);
    let tx = 0, ty = 0, x = 0, y = 0, on = false, raf = 0;
    const loop = () => {
      x = lerp(x, tx, 0.14); y = lerp(y, ty, 0.14);
      prev.style.transform = `translate3d(${x}px,${y}px,0) rotate(${(tx - x) * 0.05}deg)`;
      raf = on || Math.abs(tx - x) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    rows.forEach((r) => {
      r.addEventListener('pointerenter', (e) => {
        pimg.src = r.dataset.img;
        if (!on) { x = tx = e.clientX - prev.offsetWidth / 2; y = ty = e.clientY - prev.offsetHeight / 2; }
        on = true; prev.classList.add('is-on');
        if (!raf) raf = requestAnimationFrame(loop);
      });
      r.addEventListener('pointermove', (e) => { tx = e.clientX - prev.offsetWidth / 2 + 40; ty = e.clientY - prev.offsetHeight / 2; });
      r.addEventListener('pointerleave', () => { on = false; prev.classList.remove('is-on'); });
    });
  }

  function initSteps() {
    const track = $('#stepsTrack');
    if (!track) return;
    if (!hasGSAP || reduceMotion) { track.style.setProperty('--p', 1); return; }
    ScrollTrigger.create({
      trigger: track, start: 'top 72%', end: 'bottom 60%', scrub: true,
      onUpdate: (self) => track.style.setProperty('--p', self.progress.toFixed(4)),
    });
  }

  function initFaq() {
    $$('.faq__q').forEach((btn) => btn.addEventListener('click', () => {
      const item = btn.closest('.faq__item');
      const open = !item.classList.contains('is-open');
      $$('.faq__item.is-open').forEach((i) => {
        if (i !== item) { i.classList.remove('is-open'); $('.faq__q', i).setAttribute('aria-expanded', 'false'); }
      });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    }));
  }

  /* =====================================================================
     VIDEO: solo reproduce cuando está en pantalla
     ===================================================================== */
  function initVideo() {
    const v = $('#trenVideo');
    if (!v) return;
    new IntersectionObserver((en) => {
      if (en[0].isIntersecting) {
        v.preload = 'auto';
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      } else v.pause();
    }, { threshold: 0.35 }).observe(v);
  }

  /* =====================================================================
     PARTÍCULAS: burbujas (espuma) y destellos (carreta)
     ===================================================================== */
  function initFields() {
    $$('canvas[data-field]').forEach((canvas) => {
      const mode = canvas.dataset.field;
      const host = canvas.parentElement;
      const ctx = canvas.getContext('2d');
      let w = 0, h = 0, dpr = 1, parts = [], pops = [], visible = false, raf = 0, last = 0;
      const rand = (a, b) => a + Math.random() * (b - a);
      const colors = ['255,226,26', '255,255,255', '25,217,238', '255,255,255', '224,33,39'];

      const make = (initial) => (mode === 'bubbles'
        ? { x: rand(0, w), y: initial ? rand(0, h) : h + rand(10, 120), r: rand(6, 34), vy: rand(14, 46), ph: rand(0, 6.28), sw: rand(8, 26) }
        : { x: rand(0, w), y: rand(0, h), r: rand(1.2, 3.6), ph: rand(0, 6.28), sp: rand(1, 3), vy: rand(-6, -1), c: colors[(Math.random() * colors.length) | 0] });

      const resize = () => {
        const r = host.getBoundingClientRect();
        dpr = Math.min(devicePixelRatio || 1, 2);
        w = r.width; h = r.height;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = mode === 'bubbles' ? clamp(Math.round(w / 22), 22, 64) : clamp(Math.round(w / 16), 28, 90);
        parts = Array.from({ length: n }, () => make(true));
      };

      const draw = (now) => {
        raf = requestAnimationFrame(draw);
        const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
        last = now;
        ctx.clearRect(0, 0, w, h);
        const t = now / 1000;
        if (mode === 'bubbles') {
          parts.forEach((p, i) => {
            p.y -= p.vy * dt;
            const x = p.x + Math.sin(t + p.ph) * p.sw;
            if (p.y < -p.r * 2) parts[i] = make(false);
            ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.2832);
            ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(25,160,205,.5)'; ctx.stroke();
            ctx.beginPath(); ctx.arc(x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, 6.2832);
            ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
          });
          pops = pops.filter((o) => (o.life -= dt) > 0);
          pops.forEach((o) => {
            const k = 1 - o.life / 0.5;
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 + k * 0.8), 0, 6.2832);
            ctx.lineWidth = 2; ctx.strokeStyle = `rgba(25,160,205,${0.7 * (1 - k)})`; ctx.stroke();
          });
        } else {
          parts.forEach((p) => {
            p.y += p.vy * dt;
            if (p.y < -10) { p.y = h + 10; p.x = rand(0, w); }
            const a = 0.25 + 0.75 * Math.abs(Math.sin(t * p.sp + p.ph));
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
            g.addColorStop(0, `rgba(${p.c},${a})`); g.addColorStop(1, `rgba(${p.c},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.2832); ctx.fill();
          });
        }
      };

      if (mode === 'bubbles' && finePointer) {
        host.addEventListener('pointermove', (e) => {
          const r = canvas.getBoundingClientRect();
          const px = e.clientX - r.left, py = e.clientY - r.top;
          parts.forEach((p, i) => {
            const x = p.x + Math.sin(performance.now() / 1000 + p.ph) * p.sw;
            if (Math.hypot(x - px, p.y - py) < p.r + 6) { pops.push({ x, y: p.y, r: p.r, life: 0.5 }); parts[i] = make(false); }
          });
        });
      }

      resize();
      new ResizeObserver(resize).observe(host);
      if (reduceMotion) { draw(performance.now()); cancelAnimationFrame(raf); return; }
      new IntersectionObserver((en) => {
        visible = en[0].isIntersecting;
        if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(draw); }
        if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
      }).observe(canvas);
    });
  }

  /* =====================================================================
     HERO 3D · objetos inflables flotando (Three.js, carga diferida)
     ===================================================================== */
  function initHero3D() {
    const canvas = $('#heroGL'), hero = $('#inicio');
    if (!canvas || reduceMotion) return;
    const conn = navigator.connection;   // ahorro de datos o 2G: se omite el 3D
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
    } catch (e) { return; }

    // Three.js pesa ~590 KB: se descarga al terminar la carga (en reposo) y la escena se construye
    // cuando el preloader ya salió, para que el loader corra fluido y los objetos "se inflen" al entrar.
    let scriptReady = false, started = false;
    const tryBuild = () => {
      if (scriptReady && !started && doc.classList.contains('is-ready')) { started = true; safe('hero3d', build); }
    };
    const inject = () => {
      const s = document.createElement('script');
      s.src = 'vendor/three.min.js';
      s.onload = () => { scriptReady = true; tryBuild(); };
      document.head.appendChild(s);
    };
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    if (document.readyState === 'complete') idle(inject);
    else addEventListener('load', () => idle(inject), { once: true });
    onReady(tryBuild);

    function build() {
      const THREE = window.THREE;
      const mobile = matchMedia('(max-width:767px)').matches;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
      camera.position.set(0, 0, 12);

      // Entorno procedural (cuarto de luz suave) para reflejos brillantes tipo globo
      const ec = document.createElement('canvas');
      ec.width = 1024; ec.height = 512;
      const g = ec.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, '#dfe8f6'); grd.addColorStop(0.5, '#8d9cb8'); grd.addColorStop(1, '#2b2e39');
      g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
      g.fillStyle = '#ffffff'; g.fillRect(110, 70, 170, 90); g.fillRect(600, 50, 230, 110); g.fillRect(380, 20, 90, 60);
      g.fillStyle = '#ffd23a'; g.fillRect(310, 210, 90, 40);
      g.fillStyle = '#4fb8ea'; g.fillRect(700, 230, 100, 46);
      g.fillStyle = '#ff5a5f'; g.fillRect(40, 250, 80, 36);
      const envTex = new THREE.CanvasTexture(ec);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.encoding = THREE.sRGBEncoding;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(envTex).texture;
      envTex.dispose(); pmrem.dispose();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa6c0, 0.45));
      const key = new THREE.DirectionalLight(0xffffff, 0.95);
      key.position.set(3, 5, 7);
      scene.add(key);

      /* --- Geometrías "inflables" con normales suaves --- */
      const geoSphere = new THREE.SphereGeometry(1, 64, 48);
      const geoTorus = new THREE.TorusGeometry(0.86, 0.38, 40, 84);
      const geoStar = (() => {
        const geo = new THREE.SphereGeometry(1, 96, 64);
        const p = geo.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          const a = Math.atan2(v.y, v.x);
          const f = 1 - Math.abs(Math.sin(2.5 * a));            // 5 puntas
          const k = 0.5 + 0.62 * Math.pow(f, 1.7);
          p.setXYZ(i, v.x * k, v.y * k, v.z * 0.55);
        }
        geo.computeVertexNormals();
        return geo;
      })();
      const geoCapsule = (() => {
        const pts = [];
        for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + (i / 14) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * 0.5), -0.55 + Math.sin(a) * 0.5)); }
        for (let i = 0; i <= 14; i++) { const a = (i / 14) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * 0.5), 0.55 + Math.sin(a) * 0.5)); }
        return new THREE.LatheGeometry(pts, 56);
      })();
      const geoPillow = (() => {
        const geo = new THREE.SphereGeometry(1, 64, 48);
        const p = geo.attributes.position, v = new THREE.Vector3(), n = 3.6;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          const r = Math.pow(Math.pow(Math.abs(v.x), n) + Math.pow(Math.abs(v.y), n) + Math.pow(Math.abs(v.z), n), 1 / n);
          p.setXYZ(i, v.x / r, v.y / r, v.z / r);
        }
        geo.computeVertexNormals();
        return geo;
      })();
      const GEO = { sphere: geoSphere, torus: geoTorus, star: geoStar, capsule: geoCapsule, pillow: geoPillow };

      const RED = 0xe02127, GRN = 0x9cbf24, BLU = 0x2aa7df, YEL = 0xffe21a, CYN = 0x19d9ee, TAN = 0xd8ad8a;
      // [forma, color, tamaño, ancla x, ancla y, profundidad]
      const DESKTOP = [
        ['sphere', RED, 0.85, 0.90, 0.74, 0], ['star', YEL, 0.78, 0.10, 0.80, -1], ['torus', BLU, 0.82, 0.97, -0.34, 1],
        ['capsule', GRN, 0.62, -0.12, -0.80, 0], ['pillow', CYN, 0.58, 0.52, -0.86, 1.5], ['sphere', TAN, 0.34, -0.62, 0.86, -1],
        ['torus', RED, 0.46, -0.92, -0.72, 0.5], ['star', BLU, 0.42, 0.40, -0.18, 2.2], ['capsule', YEL, 0.46, -0.97, 0.12, 0],
        ['sphere', GRN, 0.50, 0.76, 0.28, -1.5], ['star', CYN, 0.40, -0.36, -0.90, 0], ['pillow', RED, 0.50, 0.64, 0.90, -0.5],
      ];
      // En vertical el texto ocupa la mitad superior: los objetos del lado izquierdo viven solo abajo
      const PORTRAIT = [
        ['sphere', RED, 0.9, 0.86, 0.97, 0], ['star', YEL, 0.8, -0.55, 0.98, -1], ['torus', BLU, 0.85, 0.94, 0.62, 1],
        ['capsule', GRN, 0.65, -0.92, -0.08, 0], ['pillow', CYN, 0.6, 0.9, -0.12, 1], ['sphere', TAN, 0.4, -0.88, -0.38, -1],
        ['torus', RED, 0.5, 0.88, -0.62, 0], ['star', BLU, 0.48, -0.88, -0.85, 1], ['sphere', GRN, 0.55, 0.5, -0.97, 0],
      ];

      const objs = [];
      const build3 = (spec) => spec.forEach((s, i) => {
        const mat = new THREE.MeshPhysicalMaterial({ color: s[1], roughness: 0.32, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.1, reflectivity: 0.5, envMapIntensity: 0.85 });
        const mesh = new THREE.Mesh(GEO[s[0]], mat);
        mesh.scale.setScalar(0.0001);
        mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        scene.add(mesh);
        objs.push({
          mesh, size: s[2], ax: s[3], ay: s[4], z: s[5], off: { x: 0, y: 0 },
          ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.5, amp: 0.18 + Math.random() * 0.16,
          rx: (Math.random() - 0.5) * 0.7, ry: (Math.random() - 0.5) * 0.9, rz: (Math.random() - 0.5) * 0.4,
          delay: i * 0.09, lift: 0.5 + Math.random() * 0.9,
        });
      });

      let hw = 1, hh = 1, u = 1, portrait = false;
      const resize = () => {
        const r = hero.getBoundingClientRect();
        const w = Math.max(1, r.width), h = Math.max(1, r.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        hh = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
        hw = hh * camera.aspect;
        u = Math.min(hh * 0.22, hw * 0.2);
        const wantPortrait = camera.aspect < 1.05;
        if (!objs.length || wantPortrait !== portrait) {
          objs.forEach((o) => { scene.remove(o.mesh); o.mesh.material.dispose(); });
          objs.length = 0;
          portrait = wantPortrait;
          build3(portrait ? PORTRAIT : (mobile ? DESKTOP.slice(0, 9) : DESKTOP));
        }
      };
      resize();
      new ResizeObserver(resize).observe(hero);

      // Interacción: cursor y scroll
      const ptr = { x: 99, y: 99, nx: 0, ny: 0 };
      if (finePointer) {
        addEventListener('pointermove', (e) => {
          const r = hero.getBoundingClientRect();
          const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
          ptr.nx = nx; ptr.ny = ny; ptr.x = nx * hw; ptr.y = ny * hh;
        }, { passive: true });
      }
      let scrollP = 0;
      onScroll((y) => { scrollP = clamp(y / Math.max(1, hero.offsetHeight), 0, 1); });

      const easeOutElastic = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
      let inflateAt = Infinity, raf = 0, inView = true, t0 = performance.now(), prev = t0;
      onReady(() => { inflateAt = (performance.now() - t0) / 1000 + 0.15; });

      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const t = (now - t0) / 1000, dt = Math.min((now - prev) / 1000, 0.05);
        prev = now;
        camera.position.x = lerp(camera.position.x, ptr.nx * 0.55, 0.04);
        camera.position.y = lerp(camera.position.y, ptr.ny * 0.35, 0.04);
        camera.lookAt(0, 0, 0);
        objs.forEach((o) => {
          const k = easeOutElastic(clamp((t - inflateAt - o.delay) / 1.5, 0, 1));
          const bx = o.ax * hw + Math.cos(t * o.sp * 0.7 + o.ph) * o.amp * 0.5 * u;
          const by = o.ay * hh + Math.sin(t * o.sp + o.ph) * o.amp * u;
          let px = 0, py = 0;
          const dx = bx - ptr.x, dy = by - ptr.y, dist = Math.hypot(dx, dy), R = 2.6 * u;
          if (dist < R && dist > 1e-4) { const f = Math.pow(1 - dist / R, 2) * 1.6 * u; px = (dx / dist) * f; py = (dy / dist) * f; }
          o.off.x = lerp(o.off.x, px, 0.07); o.off.y = lerp(o.off.y, py, 0.07);
          o.mesh.position.set(bx + o.off.x, by + o.off.y + scrollP * hh * 1.1 * o.lift, o.z);
          o.mesh.rotation.x += (o.rx + scrollP * 1.5) * dt;
          o.mesh.rotation.y += (o.ry + scrollP * 1.2) * dt;
          o.mesh.rotation.z += o.rz * dt;
          o.mesh.scale.setScalar(Math.max(0.0001, o.size * u * k));
        });
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      // Pausa cuando el hero sale de pantalla o la pestaña se oculta
      const toggle = () => {
        const should = inView && !document.hidden;
        if (should && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); }
        if (!should && raf) { cancelAnimationFrame(raf); raf = 0; }
      };
      new IntersectionObserver((en) => { inView = en[0].isIntersecting; toggle(); }).observe(hero);
      document.addEventListener('visibilitychange', toggle);
    }
  }

  /* =====================================================================
     LIGHTBOX
     ===================================================================== */
  let lightbox = null; // { open(lista, indice) }: lo usan los inflables y la galería con filtros
  function initLightbox() {
    const lb = $('#lightbox');
    if (!lb) return;
    const img = $('#lbImg'), vid = $('#lbVideo'), cap = $('#lbCap'), num = $('#lbNum'), closeBtn = $('#lbClose');
    let items = [], idx = 0, lastFocus = null;

    const stopVideo = () => {
      if (!vid.getAttribute('src')) return;
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    };
    const show = (i) => {
      idx = (i + items.length) % items.length;
      const a = items[idx];
      const alt = ($('img', a) || {}).alt || '';
      if (a.dataset.video) {
        img.hidden = true;
        vid.hidden = false;
        vid.poster = a.href;
        vid.src = a.dataset.video;
        vid.setAttribute('aria-label', alt);
        const p = vid.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        stopVideo();
        vid.hidden = true;
        img.hidden = false;
        img.src = a.href;
        img.alt = alt;
      }
      cap.textContent = a.dataset.caption || '';
      num.textContent = items.length > 1 ? `${idx + 1} / ${items.length}` : '';
      const next = items[(idx + 1) % items.length];
      if (next && !next.dataset.video) { const n = new Image(); n.src = next.href; }
    };
    const open = (list, i) => {
      if (!list.length) return;
      items = list;
      lastFocus = document.activeElement;
      show(i);
      lb.hidden = false;
      if (lenis) lenis.stop();
      closeBtn.focus();
    };
    const close = () => {
      lb.hidden = true;
      stopVideo();
      if (lenis) lenis.start();
      if (lastFocus) lastFocus.focus();
    };
    lightbox = { open };

    const group = $$('[data-lightbox]');
    group.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); open(group, i); }));
    closeBtn.addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => show(idx - 1));
    $('#lbNext').addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (document.activeElement !== vid) {
        if (e.key === 'ArrowLeft') show(idx - 1);
        if (e.key === 'ArrowRight') show(idx + 1);
      }
      if (e.key === 'Tab') {
        const f = $$('button', lb), first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    });
    let sx = 0;
    lb.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    lb.addEventListener('pointerup', (e) => {
      if (e.target === vid) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 60) show(idx + (dx < 0 ? 1 : -1));
    });
  }

  /* =====================================================================
     GALERÍA: filtros por atracción. Las tarjetas del tren ("Ver toros
     mecánicos", "Ver inflables"...) también aplican el filtro.
     ===================================================================== */
  function initGallery() {
    const sec = $('#galeria');
    if (!sec) return;
    const filters = $('#galFilters'), grid = $('#galGrid'), info = $('#galInfo');
    const chips = $$('.gal__chip', filters);
    const items = $$('.gal__item', grid);
    const title = $('#galTitle'), text = $('#galText'), count = $('#galCount');
    const cta = $('#galCta'), ctaLabel = $('span', cta), status = $('#galStatus');
    const motion = hasGSAP && !reduceMotion;
    const sticky = matchMedia('(min-width:900px)');
    let cur = 'todos', token = 0;

    const inFilter = (it, f) => f === 'todos' || it.dataset.cat === f;
    const refresh = () => { if (hasGSAP) ScrollTrigger.refresh(); };
    const label = (list) => {
      const vids = list.filter((it) => it.dataset.video).length, pics = list.length - vids;
      const parts = [];
      if (pics) parts.push(`${pics} ${pics === 1 ? 'foto' : 'fotos'}`);
      if (vids) parts.push(`${vids} ${vids === 1 ? 'video' : 'videos'}`);
      return parts.join(' y ');
    };

    chips.forEach((c) => {
      const n = $('.gal__n', c);
      if (n) n.textContent = items.filter((it) => inFilter(it, c.dataset.filter)).length;
    });

    // Textos, chips activos y botón de WhatsApp de la categoría elegida
    const paint = (f) => {
      const chip = chips.find((c) => c.dataset.filter === f);
      const list = items.filter((it) => inFilter(it, f));
      chips.forEach((c) => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      title.textContent = chip.dataset.title;
      text.textContent = chip.dataset.text;
      count.textContent = label(list);
      ctaLabel.textContent = chip.dataset.cta;
      cta.dataset.wa = chip.dataset.wa;
      cta.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(chip.dataset.wa)}`;
      status.textContent = `Mostrando ${chip.dataset.title}: ${label(list)}.`;
      info.classList.remove('is-swap');
      void info.offsetWidth;
      info.classList.add('is-swap');
      if (filters.scrollWidth > filters.clientWidth) {
        const fr = filters.getBoundingClientRect(), cr = chip.getBoundingClientRect();
        filters.scrollTo({ left: filters.scrollLeft + cr.left - fr.left - (fr.width - cr.width) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };

    // Muestra solo las fotos de la categoría (con pocas fotos se ven más grandes)
    const swap = (f) => {
      const shown = [];
      items.forEach((it) => { const on = inFilter(it, f); it.hidden = !on; if (on) shown.push(it); });
      grid.classList.toggle('is-few', shown.length <= 3);
      return shown;
    };

    const playIn = (list) => {
      list.forEach((el) => el.classList.add('is-in'));
      if (!motion || !list.length) return;
      gsap.fromTo(list, { opacity: 0, y: 26, scale: 0.94 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out',
        stagger: Math.min(0.05, 0.9 / list.length), clearProps: 'opacity,transform', overwrite: true,
      });
    };

    // Si el usuario estaba más abajo de la barra de filtros, lo regresa al inicio de la galería
    const keepInView = () => {
      if (!sticky.matches) return;
      const gap = info.getBoundingClientRect().top - filters.getBoundingClientRect().bottom;
      if (gap >= 0) return;
      const y = window.scrollY + info.getBoundingClientRect().top - filters.getBoundingClientRect().bottom - 12;
      if (lenis) lenis.scrollTo(y, { duration: 0.8 });
      else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    // Devuelve una función que reproduce la entrada de las fotos (útil si se difiere hasta terminar un scroll)
    const setFilter = (f, { instant = false, deferIn = false } = {}) => {
      if (f === cur || !chips.some((c) => c.dataset.filter === f)) return () => {};
      const my = ++token;
      cur = f;
      paint(f);
      if (!motion) { playIn(swap(f)); refresh(); return () => {}; }

      gsap.killTweensOf(items);
      gsap.killTweensOf(grid);
      const leaving = items.filter((it) => !it.hidden);
      const h0 = grid.offsetHeight;
      let shown = [];
      const run = () => {
        if (my !== token) return;
        shown = swap(f);
        gsap.set(shown, { opacity: 0 });
        shown.forEach((el) => el.classList.add('is-in'));
        grid.style.height = '';
        const h1 = grid.offsetHeight;
        if (!instant && Math.abs(h1 - h0) > 4) {
          gsap.fromTo(grid, { height: h0 }, { height: h1, duration: 0.6, ease: 'power3.inOut', clearProps: 'height', onComplete: refresh });
        } else if (!deferIn) {
          refresh();
        }
        if (!deferIn) playIn(shown);
        if (!instant) keepInView();
      };
      if (!instant && leaving.length) {
        gsap.to(leaving, { opacity: 0, scale: 0.94, duration: 0.22, ease: 'power2.in', stagger: { amount: 0.12 }, onComplete: run });
      } else {
        run();
      }
      return () => { if (my === token) { playIn(shown); refresh(); } };
    };

    chips.forEach((c) => c.addEventListener('click', () => setFilter(c.dataset.filter)));

    // Fotos => visor con las fotos que se ven en ese momento
    items.forEach((a) => a.addEventListener('click', (e) => {
      if (!lightbox) return;
      e.preventDefault();
      const list = items.filter((it) => !it.hidden);
      lightbox.open(list, list.indexOf(a));
    }));

    // Tarjetas del tren => baja a la galería con el filtro aplicado
    const goTo = (f) => {
      const play = setFilter(f, { instant: true, deferIn: true });
      let done = false;
      const fire = () => { if (done) return; done = true; play(); };
      const offset = sticky.matches ? -92 : -20;
      if (lenis) lenis.scrollTo(filters, { offset, duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4), onComplete: fire });
      else window.scrollTo({ top: window.scrollY + filters.getBoundingClientRect().top + offset, behavior: reduceMotion ? 'auto' : 'smooth' });
      setTimeout(fire, lenis ? 1900 : 900);
      history.replaceState(null, '', '#galeria');
    };
    $$('.vagon').forEach((card) => {
      const link = $('[data-gal]', card);
      if (!link) return;
      link.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); goTo(link.dataset.gal); });
      card.addEventListener('click', (e) => { if (!e.target.closest('a')) goTo(link.dataset.gal); });
    });

    // La barra de filtros sube con el menú cuando este se oculta al bajar
    const nav = $('#nav');
    onScroll(() => filters.classList.toggle('is-top', nav.classList.contains('is-hidden')));

    // Primera entrada: cada foto aparece al llegar a la pantalla
    if (!motion || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((en) => en.isIntersecting && !en.target.classList.contains('is-in')).map((en) => en.target);
      entries.forEach((en) => { if (en.isIntersecting) io.unobserve(en.target); });
      if (seen.length) playIn(seen);
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    items.forEach((el) => io.observe(el));
  }

  /* =====================================================================
     FORMULARIO => WHATSAPP
     ===================================================================== */
  function initForm() {
    const form = $('#waForm');
    if (!form) return;
    const note = $('#formNote');
    const dateEl = $('#f-date');
    const now = new Date();
    dateEl.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const setErr = (id, msg) => {
      const input = $(`#${id}`), err = $(`#${id}-err`);
      err.textContent = msg || '';
      input.closest('.field').classList.toggle('has-error', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) input.setAttribute('aria-describedby', `${id}-err`);
      return !msg;
    };
    ['f-name', 'f-date', 'f-type'].forEach((id) => $(`#${id}`).addEventListener('input', () => setErr(id, '')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#f-name').value.trim();
      const date = dateEl.value;
      const type = $('#f-type').value;
      const okName = setErr('f-name', name.length < 2 ? 'Escribe tu nombre para saber con quién hablamos.' : '');
      const okDate = setErr('f-date', !date ? 'Elige la fecha de tu evento.' : date < dateEl.min ? 'Esa fecha ya pasó. Elige una fecha próxima.' : '');
      const okType = setErr('f-type', !type ? 'Elige el tipo de evento.' : '');
      if (!(okName && okDate && okType)) {
        const first = form.querySelector('[aria-invalid="true"]');
        if (first) first.focus();
        note.textContent = 'Revisa los campos marcados para continuar.';
        note.classList.remove('is-ok');
        return;
      }
      const [y, m, d] = date.split('-').map(Number);
      const pretty = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const attrs = $$('input[name="attr"]:checked', form).map((c) => c.value);
      const msg = $('#f-msg').value.trim();
      const text = [
        `Hola Karmax, soy ${name}. Quiero cotizar mi evento.`,
        `Tipo de evento: ${type}`,
        `Fecha: ${pretty}`,
        `Atracciones: ${attrs.length ? attrs.join(', ') : 'Quiero que me recomienden'}`,
        msg ? `Comentarios: ${msg}` : '',
        'Gracias.',
      ].filter(Boolean).join('\n');
      const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
      note.classList.add('is-ok');
      note.textContent = 'Listo, abriendo WhatsApp con tu mensaje.';
      const w = window.open(url, '_blank');
      if (w) w.opener = null; else location.href = url;
    });
  }

  /* =====================================================================
     BOTÓN FLOTANTE DE WHATSAPP
     ===================================================================== */
  function initWaFloat() {
    const wa = $('#waFloat');
    if (!wa) return;
    onReady(() => {
      setTimeout(() => { wa.classList.add('show-tip'); setTimeout(() => wa.classList.remove('show-tip'), 6000); }, 5000);
    });
  }

  /* =====================================================================
     ARRANQUE
     ===================================================================== */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

  // Seguro: si algo falla, el contenido se muestra igual
  setTimeout(() => doc.classList.add('reveal-all'), 9000);

  safe('whatsapp', initWhatsApp);
  safe('smooth', initSmoothScroll);
  safe('headings', () => $$('[data-split]').forEach((h) => splitWords(h)));
  safe('nav', initNav);
  safe('loader', initLoader);

  onReady(() => {
    safe('reveal', initReveal);
    if (location.hash) {
      const t = document.querySelector(location.hash);
      if (t) setTimeout(() => (lenis ? lenis.scrollTo(t, { immediate: true }) : t.scrollIntoView()), 100);
    }
  });

  safe('counters', initCounters);
  safe('tilt', initTilt);
  safe('magnetic', initMagnetic);
  safe('stage', initStage);
  safe('marquee', initMarquee);
  safe('manifesto', initManifesto);
  safe('tren', initTren);
  safe('toros', initToros);
  safe('carreta', initCarreta);
  safe('bento', initBento);
  safe('strips', initStrips);
  safe('occasions', initOccasions);
  safe('steps', initSteps);
  safe('faq', initFaq);
  safe('video', initVideo);
  safe('fields', initFields);
  safe('lightbox', initLightbox);
  safe('gallery', initGallery);
  safe('form', initForm);
  safe('wafloat', initWaFloat);
  safe('hero3d', initHero3D);

  // Reajusta los puntos de scroll cuando terminan de cargar las tipografías
  if (hasGSAP && document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
