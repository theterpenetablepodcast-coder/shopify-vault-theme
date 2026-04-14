/**
 * VAULT THEME — Core JavaScript
 * Animations: Matrix rain, scramble text, vault cursor,
 * click bursts, spinning letters, access overlay, preloader
 */

(function () {
  'use strict';

  /* ============================================================
     CONSTANTS
  ============================================================ */
  const CHARS_ALPHA  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?';
  const CHARS_CODE   = '01アイウエオカキクケコ∑∆Ω≠≈∞';
  const CHARS_HEX    = '0123456789ABCDEF';
  const GREEN        = '#00ff41';

  /* ============================================================
     UTILITY
  ============================================================ */
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max));
  const randChar = (set) => set[randInt(0, set.length)];
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ============================================================
     1. PRELOADER
  ============================================================ */
  function initPreloader() {
    const preloader = qs('#vault-preloader');
    if (!preloader) return;

    const percentEl = qs('.dial-percent', preloader);
    const statusEl  = qs('.preloader-status', preloader);

    const messages = [
      'INITIALISING VAULT SYSTEMS...',
      'ENCRYPTING CHANNEL...',
      'VERIFYING CREDENTIALS...',
      'SCANNING BIOMETRICS...',
      'ROTATING COMBINATION...',
      'ACCESS PROTOCOL LOADED',
      'VAULT UNLOCKED',
    ];

    let count = 0;
    let msgIdx = 0;

    const ticker = setInterval(() => {
      count = Math.min(count + randInt(4, 12), 100);
      if (percentEl) percentEl.textContent = count + '%';

      const msgStep = Math.floor((count / 100) * (messages.length - 1));
      if (msgStep !== msgIdx) {
        msgIdx = msgStep;
        if (statusEl) {
          statusEl.style.opacity = '0';
          setTimeout(() => {
            statusEl.textContent = messages[msgIdx];
            statusEl.style.opacity = '1';
          }, 150);
        }
      }

      if (count >= 100) {
        clearInterval(ticker);
        setTimeout(() => {
          preloader.classList.add('hidden');
          document.body.classList.add('vault-open');
          triggerAccessOverlay('GRANTED');
        }, 600);
      }
    }, 60);
  }

  /* ============================================================
     2. CUSTOM VAULT CURSOR
  ============================================================ */
  function initCursor() {
    const cursor = qs('#vault-cursor');
    const trail  = qs('#cursor-trail');
    if (!cursor) return;

    let mx = -100, my = -100;
    let tx = -100, ty = -100;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      cursor.style.left = mx + 'px';
      cursor.style.top  = my + 'px';
      setTimeout(() => {
        if (trail) {
          trail.style.left = mx + 'px';
          trail.style.top  = my + 'px';
        }
      }, 80);
    });

    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup',   () => cursor.classList.remove('clicking'));
    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
      if (trail) trail.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = '1';
      if (trail) trail.style.opacity = '0.4';
    });
  }

  /* ============================================================
     3. MATRIX RAIN
  ============================================================ */
  function initMatrix() {
    const canvas = qs('#matrix-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W, H, cols, drops;

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      cols  = Math.floor(W / 18);
      drops = Array.from({ length: cols }, () => randInt(0, 40));
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, W, H);

      ctx.font = '13px "Share Tech Mono", monospace';

      drops.forEach((y, i) => {
        const char = randChar(CHARS_CODE);
        const alpha = Math.random() > 0.97 ? 1 : 0.5;
        ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
        ctx.fillText(char, i * 18, y * 18);

        if (y * 18 > H && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      });
    }

    setInterval(draw, 55);
  }

  /* ============================================================
     4. TEXT SCRAMBLE / DECODE EFFECT
  ============================================================ */
  class Scramble {
    constructor(el, options = {}) {
      this.el      = el;
      this.chars   = options.chars || CHARS_ALPHA;
      this.speed   = options.speed || 40;
      this.reveal  = options.reveal || 3; // frames per char reveal
      this.original = el.dataset.text || el.textContent.trim();
      this.frame   = 0;
      this.resolve = null;
    }

    start(newText) {
      const text = newText || this.original;
      this.frame  = 0;
      cancelAnimationFrame(this._raf);

      return new Promise(res => {
        this.resolve = res;
        this._raf = requestAnimationFrame(() => this._tick(text));
      });
    }

    _tick(target) {
      const progress = this.frame / this.reveal;
      const revealed = Math.floor(progress);

      let out = '';
      for (let i = 0; i < target.length; i++) {
        if (target[i] === ' ') { out += ' '; continue; }
        if (i < revealed)      { out += target[i]; continue; }
        out += randChar(this.chars);
      }

      this.el.textContent = out;
      this.frame++;

      if (revealed < target.length) {
        this._raf = requestAnimationFrame(() => this._tick(target));
      } else {
        this.el.textContent = target;
        if (this.resolve) this.resolve();
      }
    }
  }

  /* ── Auto-init scramble on elements ── */
  function initScramble() {
    qsa('[data-scramble]').forEach(el => {
      el.dataset.text = el.textContent.trim();
      const sc = new Scramble(el, { speed: 40, reveal: 2 });

      // Start on page load
      sc.start();

      // Re-scramble on hover
      el.addEventListener('mouseenter', () => sc.start());
    });
  }

  /* ── IntersectionObserver: scramble on scroll into view ── */
  function initScrollScramble() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const sc = new Scramble(el, { reveal: 3 });
          sc.start();
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.2 });

    qsa('[data-scramble-scroll]').forEach(el => {
      el.dataset.text = el.textContent.trim();
      obs.observe(el);
    });
  }

  /* ============================================================
     5. CLICK BURSTS — spinning letters, rings, hexcodes
  ============================================================ */
  const BURST_CODES = [
    'VAULT_ACCESS', 'SECURE_ZONE', 'CLASSIFIED', 'ENCRYPTED',
    '0xDEADBEEF', 'AES-256', 'BIOMETRIC_OK', 'CLEARANCE_5',
    'STEEL_CORE', 'SAFE_LOCKED', 'COMBO_SET', 'NO_BREACH',
    '###SECURE###', '//AUTHORIZED', 'KEY_MATCH', 'UNLOCK',
    '::::GRANTED::::',
  ];

  function spawnClickBurst(x, y) {
    // Text pop
    const text = document.createElement('div');
    text.className = 'click-burst';
    text.textContent = BURST_CODES[randInt(0, BURST_CODES.length)];
    text.style.left = x + 'px';
    text.style.top  = y + 'px';
    document.body.appendChild(text);
    text.addEventListener('animationend', () => text.remove());

    // Expanding rings (2 with stagger)
    for (let i = 0; i < 2; i++) {
      const ring = document.createElement('div');
      ring.className = 'click-ring';
      ring.style.left = x + 'px';
      ring.style.top  = y + 'px';
      ring.style.animationDelay = i * 0.1 + 's';
      document.body.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove());
    }

    // Spinning individual letters
    spawnSpinLetters(x, y);
  }

  function spawnSpinLetters(x, y) {
    const count  = randInt(4, 8);
    const radius = randInt(30, 60);
    const chars  = CHARS_ALPHA + '{}[]<>';

    for (let i = 0; i < count; i++) {
      const angle    = (i / count) * Math.PI * 2;
      const tx = Math.cos(angle) * radius;
      const ty = Math.sin(angle) * radius;

      const el = document.createElement('span');
      el.textContent = randChar(chars);
      el.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        color: ${GREEN};
        font-family: 'Share Tech Mono', monospace;
        font-size: ${randInt(10,16)}px;
        pointer-events: none;
        z-index: 9997;
        text-shadow: 0 0 6px ${GREEN};
        animation: spinLetter 0.7s ease-out forwards;
        --tx: ${tx}px;
        --ty: ${ty}px;
        --rot: ${randInt(-720, 720)}deg;
        transform: translate(-50%, -50%);
      `;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  /* Inject keyframe animation if not present */
  function injectSpinKeyframes() {
    if (qs('#spin-keyframes')) return;
    const s = document.createElement('style');
    s.id = 'spin-keyframes';
    s.textContent = `
      @keyframes spinLetter {
        0%   { opacity: 1; transform: translate(-50%, -50%) rotate(0deg); }
        100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) rotate(var(--rot)) scale(0.2); }
      }
    `;
    document.head.appendChild(s);
  }

  function initClickBursts() {
    injectSpinKeyframes();
    document.addEventListener('click', (e) => {
      spawnClickBurst(e.clientX, e.clientY);
    });
  }

  /* ============================================================
     6. ACCESS GRANTED / DENIED OVERLAY
  ============================================================ */
  function triggerAccessOverlay(type = 'GRANTED') {
    const overlay = qs('#access-overlay');
    if (!overlay) return;

    overlay.className = `access-overlay access-overlay--${type.toLowerCase()} show`;
    const text = qs('.access-overlay__text', overlay);
    if (text) text.textContent = `ACCESS ${type}`;

    setTimeout(() => {
      overlay.classList.remove('show');
    }, 1200);
  }

  window.VaultTheme = window.VaultTheme || {};
  window.VaultTheme.accessOverlay = triggerAccessOverlay;

  /* ============================================================
     7. VAULT TOAST NOTIFICATIONS
  ============================================================ */
  function showToast(msg, duration = 3500) {
    const container = qs('#vault-toast');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  }

  window.VaultTheme.toast = showToast;

  /* ============================================================
     8. HEADER — sticky glow on scroll
  ============================================================ */
  function initHeader() {
    const header = qs('.site-header');
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Mobile menu
    const toggle = qs('.menu-toggle');
    const mobileNav = qs('.mobile-nav');
    if (toggle && mobileNav) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('open');
        mobileNav.classList.toggle('open');
      });
    }
  }

  /* ============================================================
     9. SCRAMBLE NAVIGATION LINKS
  ============================================================ */
  function initNavScramble() {
    qsa('.site-nav__link').forEach(link => {
      link.setAttribute('data-text', link.textContent.trim());

      link.addEventListener('mouseenter', () => {
        let frame = 0;
        const original = link.dataset.text;
        const maxFrames = original.length * 2;

        clearInterval(link._scramInterval);
        link._scramInterval = setInterval(() => {
          let out = '';
          for (let i = 0; i < original.length; i++) {
            if (original[i] === ' ') { out += ' '; continue; }
            out += frame > i * 2 ? original[i] : randChar(CHARS_HEX);
          }
          link.textContent = out;
          frame++;
          if (frame > maxFrames) {
            clearInterval(link._scramInterval);
            link.textContent = original;
          }
        }, 30);
      });

      link.addEventListener('mouseleave', () => {
        clearInterval(link._scramInterval);
        link.textContent = link.dataset.text;
      });
    });
  }

  /* ============================================================
     10. PRODUCT VARIANT SELECTOR
  ============================================================ */
  function initVariants() {
    qsa('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.variant-btns');
        if (parent) qsa('.variant-btn', parent).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  /* ============================================================
     11. QUANTITY BUTTONS
  ============================================================ */
  function initQty() {
    qsa('.qty-wrap').forEach(wrap => {
      const input = qs('.qty-input', wrap);
      const minus = qs('.qty-minus', wrap);
      const plus  = qs('.qty-plus', wrap);
      if (!input) return;

      if (minus) minus.addEventListener('click', () => {
        const v = parseInt(input.value) || 1;
        if (v > 1) input.value = v - 1;
      });

      if (plus) plus.addEventListener('click', () => {
        const v = parseInt(input.value) || 1;
        input.value = v + 1;
      });
    });
  }

  /* ============================================================
     12. ADD TO CART ANIMATION
  ============================================================ */
  function initAddToCart() {
    qsa('[data-atc]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.classList.add('granted');
        triggerAccessOverlay('GRANTED');
        showToast('ITEM SECURED — ADDED TO VAULT');

        setTimeout(() => {
          btn.classList.remove('granted');
        }, 2000);

        // Update cart count
        const count = qs('.cart-count');
        if (count) {
          const n = parseInt(count.textContent) || 0;
          count.textContent = n + 1;
          count.classList.add('bump');
          setTimeout(() => count.classList.remove('bump'), 400);
        }
      });
    });
  }

  /* ============================================================
     13. ACCORDION
  ============================================================ */
  function initAccordion() {
    qsa('.accordion-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.accordion-item');
        const body = qs('.accordion-body', item);
        const isOpen = trigger.classList.contains('open');

        // Close all
        qsa('.accordion-trigger.open').forEach(t => {
          t.classList.remove('open');
          const b = qs('.accordion-body', t.closest('.accordion-item'));
          if (b) b.classList.remove('open');
        });

        if (!isOpen) {
          trigger.classList.add('open');
          if (body) body.classList.add('open');
        }
      });
    });
  }

  /* ============================================================
     14. PRODUCT IMAGE GALLERY
  ============================================================ */
  function initGallery() {
    qsa('.product-gallery').forEach(gallery => {
      const mainImg = qs('.product-gallery__main img', gallery);
      const thumbs  = qsa('.thumb', gallery);

      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbs.forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          const src = thumb.dataset.full || qs('img', thumb)?.src;
          if (mainImg && src) {
            mainImg.style.opacity = '0';
            setTimeout(() => {
              mainImg.src = src;
              mainImg.style.opacity = '1';
            }, 200);
          }
        });
      });
    });
  }

  /* ============================================================
     15. MARQUEE CLONE (duplicate track for seamless loop)
  ============================================================ */
  function initMarquees() {
    qsa('.announcement-bar__track, .marquee-band__track').forEach(track => {
      // Clone the inner content to make it seamless
      const clone = track.innerHTML;
      track.innerHTML += clone;
    });
  }

  /* ============================================================
     16. REVEAL ANIMATIONS ON SCROLL
  ============================================================ */
  function initReveal() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    // Inject reveal styles
    const style = document.createElement('style');
    style.textContent = `
      [data-reveal] {
        opacity: 0;
        transform: translateY(24px);
        transition: opacity 0.6s ease, transform 0.6s ease;
      }
      [data-reveal].revealed {
        opacity: 1;
        transform: translateY(0);
      }
      [data-reveal="left"]  { transform: translateX(-24px); }
      [data-reveal="right"] { transform: translateX(24px); }
      [data-reveal="left"].revealed,
      [data-reveal="right"].revealed { transform: translateX(0); }
    `;
    document.head.appendChild(style);

    qsa('[data-reveal]').forEach((el, i) => {
      el.style.transitionDelay = (i * 0.06) + 's';
      obs.observe(el);
    });
  }

  /* ============================================================
     17. VAULT COMBO LOCK ANIM (decorative SVG ticks)
  ============================================================ */
  function initVaultDoor() {
    const dialGroup = qs('.vault-dial-group');
    if (!dialGroup) return;

    // Click to spin fast
    dialGroup.closest('svg')?.addEventListener('click', () => {
      dialGroup.style.animation = 'none';
      dialGroup.style.transition = 'none';

      let deg  = 0;
      let speed = 40;
      const spin = setInterval(() => {
        deg   += speed;
        speed *= 0.97;
        dialGroup.style.transform = `rotate(${deg}deg)`;
        if (speed < 0.5) {
          clearInterval(spin);
          dialGroup.style.animation = 'dialSpin 8s linear infinite';
        }
      }, 16);
    });
  }

  /* ============================================================
     18. COUNTER ANIMATIONS (stats section)
  ============================================================ */
  function initCounters() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el     = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const duration = 1800;
        const step   = 1000 / 60;
        const steps  = duration / step;
        let current  = 0;

        const timer = setInterval(() => {
          current += target / steps;
          el.textContent = Math.floor(Math.min(current, target)).toLocaleString();
          if (current >= target) clearInterval(timer);
        }, step);

        obs.unobserve(el);
      });
    }, { threshold: 0.5 });

    qsa('[data-count]').forEach(el => obs.observe(el));
  }

  /* ============================================================
     19. LIVE CLOCK / ACCESS CODE TICKER
  ============================================================ */
  function initTicker() {
    const el = qs('.access-ticker__code');
    if (!el) return;

    function update() {
      const now = new Date();
      const hh  = String(now.getHours()).padStart(2, '0');
      const mm  = String(now.getMinutes()).padStart(2, '0');
      const ss  = String(now.getSeconds()).padStart(2, '0');
      const ms  = String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);
      el.textContent = `${hh}:${mm}:${ss}.${ms}`;
    }

    update();
    setInterval(update, 50);
  }

  /* ============================================================
     20. KEYBOARD — vault code easter egg
  ============================================================ */
  const VAULT_CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight'];
  let codePos = 0;

  function initKonamiVault() {
    document.addEventListener('keydown', (e) => {
      if (e.key === VAULT_CODE[codePos]) {
        codePos++;
        if (codePos === VAULT_CODE.length) {
          codePos = 0;
          triggerAccessOverlay('GRANTED');
          showToast('MASTER CODE ACCEPTED — WELCOME TO THE VAULT');
          document.body.style.animation = 'flashGreen 0.4s ease';
          setTimeout(() => document.body.style.animation = '', 400);

          if (!qs('#flash-green-kf')) {
            const s = document.createElement('style');
            s.id = 'flash-green-kf';
            s.textContent = `@keyframes flashGreen {
              0%, 100% { filter: none; }
              50% { filter: brightness(1.2) hue-rotate(0deg); box-shadow: inset 0 0 80px rgba(0,255,65,0.3); }
            }`;
            document.head.appendChild(s);
          }
        }
      } else {
        codePos = 0;
      }
    });
  }

  /* ============================================================
     21. FILTER SIDEBAR TOGGLE (mobile)
  ============================================================ */
  function initFilters() {
    const toggle = qs('[data-filter-toggle]');
    const panel  = qs('.filter-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
    });
  }

  /* ============================================================
     22. HEADER SCROLL GLOW STYLE
  ============================================================ */
  function injectScrolledStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .site-header.scrolled {
        border-bottom-color: var(--clr-green);
        box-shadow: 0 1px 20px rgba(0,255,65,0.15);
      }
    `;
    document.head.appendChild(s);
  }

  /* ============================================================
     23. CART COUNT BUMP STYLE
  ============================================================ */
  function injectCartStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .cart-count.bump {
        animation: cartBump 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes cartBump {
        from { transform: scale(1); }
        50%  { transform: scale(1.6); }
        to   { transform: scale(1); }
      }
    `;
    document.head.appendChild(s);
  }

  /* ============================================================
     24. IMAGE FLICKER — random per-card animation timing
  ============================================================ */
  function initFlicker() {
    qsa('.vault-card__image-wrap img, .collection-card__img img, .product-gallery__main img').forEach(img => {
      const dur   = (rand(6, 14)).toFixed(2) + 's';
      const delay = (rand(0, 8)).toFixed(2)  + 's';
      img.style.setProperty('--flicker-dur',   dur);
      img.style.setProperty('--flicker-delay', delay);
    });
  }

  /* ============================================================
     25. VAULT LIGHTBOX
  ============================================================ */
  function initLightbox() {
    // Build the lightbox DOM once
    const lb = document.createElement('div');
    lb.id = 'vault-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = `
      <button class="lightbox__close" id="lb-close" aria-label="Close">✕</button>
      <div class="lightbox__inner">
        <div class="lightbox__img-wrap" id="lb-img-wrap">
          <div class="lightbox__scan" aria-hidden="true"></div>
          <img id="lb-img" src="" alt="">
        </div>
        <div class="lightbox__caption">
          <span id="lb-caption"></span>
          <span class="lightbox__caption-id" id="lb-id"></span>
        </div>
        <button class="lightbox__nav lightbox__nav--prev" id="lb-prev" aria-label="Previous image">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button class="lightbox__nav lightbox__nav--next" id="lb-next" aria-label="Next image">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(lb);

    const lbImg     = qs('#lb-img');
    const lbCaption = qs('#lb-caption');
    const lbId      = qs('#lb-id');
    const lbPrev    = qs('#lb-prev');
    const lbNext    = qs('#lb-next');

    let gallery = [];  // current image set
    let current = 0;

    const scanlines = qs('#scanlines');

    function open(images, idx) {
      gallery = images;
      current = idx;
      show();
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (scanlines) scanlines.classList.add('hidden');
      qs('#lb-close').focus();
    }

    function close() {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      if (scanlines) scanlines.classList.remove('hidden');
    }

    function show() {
      const item = gallery[current];
      lbImg.src = item.src;
      lbImg.alt = item.alt || '';
      lbCaption.textContent = item.caption || '';
      lbId.textContent = '// IMG ' + String(current + 1).padStart(2, '0') + ' OF ' + String(gallery.length).padStart(2, '0');
      lbPrev.style.display = gallery.length > 1 ? 'flex' : 'none';
      lbNext.style.display = gallery.length > 1 ? 'flex' : 'none';
    }

    function prev() { current = (current - 1 + gallery.length) % gallery.length; show(); }
    function next() { current = (current + 1) % gallery.length; show(); }

    qs('#lb-close').addEventListener('click', close);
    lbPrev.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    lbNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.id === 'lb-img-wrap') close(); });

    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    });

    /* ── Wire up product page gallery only ── */
    function wireGallery() {
      qsa('.product-gallery').forEach(galleryEl => {
        if (galleryEl.dataset.lbWired) return;
        galleryEl.dataset.lbWired = '1';

        const thumbs   = qsa('.thumb', galleryEl);
        const mainWrap = qs('.product-gallery__main', galleryEl);
        const mainImg  = qs('.product-gallery__main img', galleryEl);
        if (!mainImg) return;

        // Build image set from thumbs or just the main image
        const images = thumbs.length
          ? thumbs.map(t => ({
              src: t.dataset.full || qs('img', t)?.src || mainImg.src,
              alt: qs('img', t)?.alt || mainImg.alt,
              caption: document.querySelector('.product-info__title')?.textContent?.trim() || ''
            }))
          : [{ src: mainImg.src, alt: mainImg.alt, caption: '' }];

        mainWrap.style.cursor = 'zoom-in';
        mainWrap.addEventListener('click', () => {
          const currentSrc = mainImg.src;
          const idx = images.findIndex(i => i.src === currentSrc) || 0;
          open(images, Math.max(idx, 0));
        });
      });
    }

    wireGallery();

    // Re-wire after any dynamic content loads
    const observer = new MutationObserver(() => { wireCards(); wireGallery(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ============================================================
     INIT ALL
  ============================================================ */
  function init() {
    injectScrolledStyles();
    injectCartStyles();
    initPreloader();
    initCursor();
    initMatrix();
    initScramble();
    initScrollScramble();
    initClickBursts();
    initHeader();
    initNavScramble();
    initVariants();
    initQty();
    initAddToCart();
    initAccordion();
    initGallery();
    initMarquees();
    initReveal();
    initVaultDoor();
    initCounters();
    initTicker();
    initKonamiVault();
    initFilters();
    initFlicker();
    initLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
