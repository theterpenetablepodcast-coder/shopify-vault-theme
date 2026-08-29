/**
 * VAULT THEME — Core JavaScript
 * Scramble text, reveal animations, preloader,
 * cart drawer, gallery, vault radio
 */

(function () {
  'use strict';

  /* ============================================================
     CONSTANTS
  ============================================================ */
  const CHARS_ALPHA  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?';

  /* ============================================================
     UTILITY
  ============================================================ */
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max));
  const randChar = (set) => set[randInt(0, set.length)];
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* Reduce a Shopify CDN image URL to a comparable key.
     The variant JSON carries the original file, the thumbs carry a resized
     one — same image, different filename:
       .../abc.png?v=1            ->  abc.png
       .../abc_800x800_crop_center.png?v=1  ->  abc.png */
  const imageKey = (url) =>
    (url || '')
      .split('?')[0]
      .split('/')
      .pop()
      .replace(/_(?:\d+)?x(?:\d+)?(?:_crop_[a-z]+)?(?=\.[a-z0-9]+$)/i, '')
      .toLowerCase();

  /* Request a sensible size rather than the full-resolution original */
  const sizedImage = (url, w) =>
    !url ? url : url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;

  /* Money formatter — Shopify prices are in cents */
  const formatMoney = (cents) =>
    '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /* Update every cart-count badge in the header */
  function updateCartCount(n) {
    qsa('.cart-count').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? '' : 'none';
      if (n > 0) {
        el.classList.add('bump');
        setTimeout(() => el.classList.remove('bump'), 400);
      }
    });
  }

  /* ============================================================
     1. PRELOADER
  ============================================================ */
  function initPreloader() {
    const preloader = qs('#vault-preloader');
    if (!preloader) return;

    // Full dial animation only on the first page view of a session —
    // repeat visits go straight to content.
    let seen = false;
    try { seen = !!sessionStorage.getItem('vault-visited'); } catch (e) {}
    if (seen) {
      preloader.classList.add('hidden');
      document.body.classList.add('vault-open');
      return;
    }
    try { sessionStorage.setItem('vault-visited', '1'); } catch (e) {}

    const percentEl = qs('.dial-percent', preloader);
    const statusEl  = qs('.preloader-status', preloader);

    const isClubPage = document.body.classList.contains('cg-page');

    const messages = isClubPage ? [
      'Preparing your experience…',
      'Curating the collection…',
      'Opening the vault…',
      'Almost there…',
      'Welcome to the Club',
    ] : [
      'OPENING THE VAULT...',
      'LOADING COLLECTIONS...',
      'VAULT UNLOCKED',
    ];

    let count = 0;
    let msgIdx = 0;

    const ticker = setInterval(() => {
      count = Math.min(count + randInt(8, 18), 100);
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
        }, 400);
      }
    }, 50);
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
     6. ACCESS GRANTED / DENIED OVERLAY
  ============================================================ */
  function triggerAccessOverlay(type = 'GRANTED') {
    /* Club pages: no overlay — the experience speaks for itself */
    if (document.body.classList.contains('cg-page')) return;

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
    if (header) {
      const onScroll = () => {
        header.classList.toggle('scrolled', window.scrollY > 40);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Mobile menu — works for both the vault and club headers
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
     10. PRODUCT VARIANT SELECTOR
     Reads product variants JSON embedded in the page, matches
     the currently selected option buttons to a variant, then
     updates the hidden #variant-id input so the correct SKU is
     added to cart.
  ============================================================ */
  function initVariants() {
    const jsonEl   = document.getElementById('product-variants-json');
    const vidInput = document.getElementById('variant-id');
    if (!jsonEl) return; // No variants block — single-variant product handled by Liquid

    let variants = [];
    try { variants = JSON.parse(jsonEl.textContent); } catch(e) { return; }

    /* Build a lookup map keyed by "option1|option2|option3" */
    const variantMap = {};
    variants.forEach(v => {
      const key = [v.option1, v.option2, v.option3].filter(Boolean).join('|');
      variantMap[key] = v;
    });

    /* Return array of currently active option values in order */
    function getSelectedOptions() {
      return qsa('.variant-btns').map(group => {
        const active = qs('.variant-btn.active', group);
        return active ? active.dataset.value : null;
      }).filter(Boolean);
    }

    /* Re-evaluate which variant is selected and sync the DOM.
       `isInitial` is true for the sync on page load, where Liquid has already
       rendered the right image and re-swapping it would just cause a flash. */
    function updateVariant(isInitial) {
      const selected = getSelectedOptions();
      const key      = selected.join('|');
      const variant  = variantMap[key];

      /* Update hidden variant ID input */
      if (vidInput && variant) vidInput.value = variant.id;

      /* Show the variant's own photo, so picking "Apricot" actually shows the
         apricot one. Without this the shopper has no way to tell which colour
         a name refers to. */
      if (variant && !isInitial && window.VaultTheme.selectVariantMedia) {
        const media = variant.featured_media;
        const src   = (variant.featured_image && variant.featured_image.src) ||
                      (media && media.preview_image && media.preview_image.src);
        if (src) {
          window.VaultTheme.selectVariantMedia(sizedImage(src, 800), media && media.id);
        }
      }

      /* Update the "currently selected" label next to each option name */
      qsa('.variant-label[data-option-index]').forEach(label => {
        const idx  = parseInt(label.dataset.optionIndex, 10);
        const span = label.querySelector('.variant-label__selected');
        if (span && selected[idx] !== undefined) span.textContent = selected[idx];
      });

      /* Update price display */
      if (variant) {
        const priceEl   = qs('.price-current');
        const compareEl = qs('.price-compare');
        const saveEl    = qs('.price-save');

        if (priceEl) priceEl.textContent = formatMoney(variant.price);

        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          if (compareEl) { compareEl.textContent = formatMoney(variant.compare_at_price); compareEl.style.display = ''; }
          if (saveEl)    { saveEl.textContent = 'SAVE ' + formatMoney(variant.compare_at_price - variant.price); saveEl.style.display = ''; }
        } else {
          if (compareEl) compareEl.style.display = 'none';
          if (saveEl)    saveEl.style.display    = 'none';
        }

        /* Mark unavailable variant buttons for this option position */
        const atcBtn      = qs('.atc-btn');
        const soldOutBtn  = qs('.btn--outline[disabled]');
        if (atcBtn) atcBtn.disabled = !variant.available;

        /* Mark each button sold-out if no variant with those options is available */
        qsa('.variant-btns').forEach((group, groupIdx) => {
          qsa('.variant-btn', group).forEach(btn => {
            const testOptions = [...selected];
            testOptions[groupIdx] = btn.dataset.value;
            const testKey      = testOptions.join('|');
            const testVariant  = variantMap[testKey];
            const unavailable  = testVariant && !testVariant.available;
            btn.classList.toggle('soldout', unavailable);
          });
        });
      }
    }

    /* Wire up click handlers */
    qsa('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.variant-btns');
        if (parent) qsa('.variant-btn', parent).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateVariant();
      });
    });

    /* Sync on page load (pre-selected variant from URL / Liquid) */
    updateVariant(true);
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
     12. ADD TO CART — AJAX with cart drawer
  ============================================================ */
  function initAddToCart() {
    // Listen on form SUBMIT (not button click) so we control the request
    // without blocking native behaviour for non-/cart/add forms.
    qsa('form[action="/cart/add"]').forEach(form => {
      form.addEventListener('submit', e => {
        e.preventDefault();

        const btn = qs('[type="submit"]', form);
        const origHTML = btn ? btn.innerHTML : '';

        // ── Loading state ──
        if (btn) {
          btn.disabled = true;
          btn.classList.add('loading');
        }

        fetch('/cart/add.js', { method: 'POST', body: new FormData(form) })
          .then(r => {
            if (!r.ok) return r.json().then(d => { throw new Error(d.description || 'error'); });
            return r.json();
          })
          .then(item => {
            // ── Success state ──
            if (btn) {
              btn.classList.remove('loading');
              btn.classList.add('granted');           // CSS ::after shows ✓ SECURED
              setTimeout(() => {
                btn.classList.remove('granted');
                btn.disabled = false;
                btn.innerHTML = origHTML;
              }, 2200);
            }
            triggerAccessOverlay('GRANTED');
            showToast('ADDED: ' + item.title.substring(0, 42).toUpperCase());

            // Refresh cart state, open drawer
            return fetch('/cart.js').then(r => r.json());
          })
          .then(cart => {
            if (!cart) return;
            updateCartCount(cart.item_count);
            if (window.VaultTheme.renderCart) window.VaultTheme.renderCart(cart);
            if (window.VaultTheme.openDrawer)  window.VaultTheme.openDrawer();
          })
          .catch(err => {
            if (btn) {
              btn.disabled = false;
              btn.classList.remove('loading', 'granted');
              btn.innerHTML = origHTML;
            }
            showToast('ERROR — ' + (err.message || 'PLEASE TRY AGAIN').toUpperCase());
          });
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
    /* Drop any handler left over from a previous page — after an AJAX swap it
       would still be pointing at the old product's DOM. */
    delete window.VaultTheme.selectVariantMedia;

    qsa('.product-gallery').forEach(gallery => {
      const mainWrap = qs('.product-gallery__main', gallery);
      const thumbs   = qsa('.thumb', gallery);
      if (!mainWrap) return;

      /* ── helpers to get/remove current media elements ── */
      const getImg    = () => qs('#product-main-img',    mainWrap);
      const getVid    = () => qs('#product-main-video',  mainWrap);
      const getIframe = () => qs('#product-main-iframe', mainWrap);

      function showImage(src) {
        // tear down any video / iframe
        const vid = getVid();
        const ifr = getIframe();
        if (vid)  { vid.pause?.(); vid.remove(); }
        if (ifr)  ifr.remove();

        // restore / create img
        let img = getImg();
        if (!img) {
          img = document.createElement('img');
          img.id = 'product-main-img';
          img.width  = 800;
          img.height = 800;
          mainWrap.prepend(img);
        }
        img.style.display = '';
        img.style.opacity = '0';
        setTimeout(() => { img.src = src; img.style.opacity = '1'; }, 200);
      }

      /* ── Variant-driven image switching ──────────────────────────
         Exposed so initVariants can call it when a shopper picks a
         colour. It lives here because the gallery owns the video and
         iframe teardown — duplicating that in the variant code would
         leave a playing video sitting behind the new image. */
      window.VaultTheme.selectVariantMedia = function (src, mediaId) {
        if (!src) return;

        showImage(src);

        /* Highlight the matching thumb. Prefer the media id; fall back to
           comparing filenames, since the variant carries the original URL
           while the thumb carries a resized one. */
        let match = null;
        if (mediaId) {
          match = thumbs.find(t => String(t.dataset.mediaId) === String(mediaId));
        }
        if (!match) {
          const key = imageKey(src);
          match = thumbs.find(t => imageKey(t.dataset.full) === key);
        }
        if (match) {
          thumbs.forEach(t => t.classList.remove('active'));
          match.classList.add('active');
        }
      };

      function showVideo(src, mimeType) {
        const img = getImg();
        if (img) img.style.display = 'none';
        const ifr = getIframe();
        if (ifr) ifr.remove();
        const old = getVid();
        if (old) { old.pause?.(); old.remove(); }

        const vid        = document.createElement('video');
        vid.id           = 'product-main-video';
        vid.autoplay     = true;
        vid.muted        = true;
        vid.loop         = true;
        vid.playsInline  = true;
        vid.style.cssText = 'background:#000;';
        const s   = document.createElement('source');
        s.src     = src;
        s.type    = mimeType || 'video/mp4';
        vid.appendChild(s);
        mainWrap.prepend(vid);
        vid.load();
        vid.play().catch(() => {});
      }

      function showExternalVideo(id, host) {
        const img = getImg();
        if (img) img.style.display = 'none';
        const old = getVid();
        if (old) { old.pause?.(); old.remove(); }
        const oldIfr = getIframe();
        if (oldIfr) oldIfr.remove();

        const ifr    = document.createElement('iframe');
        ifr.id       = 'product-main-iframe';
        ifr.allow    = 'autoplay; encrypted-media';
        ifr.allowFullscreen = true;
        ifr.style.cssText = 'border:none;';

        if (host === 'vimeo') {
          ifr.src = `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1`;
        } else {
          ifr.src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}`;
        }
        mainWrap.prepend(ifr);
      }

      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbs.forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');

          const type = thumb.dataset.mediaType || 'image';

          if (type === 'video') {
            showVideo(thumb.dataset.videoSrc, thumb.dataset.videoType);
          } else if (type === 'external_video') {
            showExternalVideo(thumb.dataset.externalId, thumb.dataset.externalHost);
          } else {
            const src = thumb.dataset.full || qs('img', thumb)?.src;
            if (src) showImage(src);
          }
        });
      });

      // Auto-trigger the first thumb if it's a video and the main area
      // already shows the video element (Liquid rendered it) — this ensures
      // the video plays even if autoplay was blocked before JS ran.
      // Also handles the case where Liquid put a <video> in the main area
      // but the browser needs a JS-initiated play() call.
      const firstThumb = thumbs[0];
      if (firstThumb) {
        const firstType = firstThumb.dataset.mediaType || 'image';
        if (firstType === 'video') {
          const existingVid = getVid();
          if (existingVid) {
            // Video already in DOM from Liquid — just make sure it plays
            existingVid.muted = true;
            existingVid.play().catch(() => {});
          } else if (firstThumb.dataset.videoSrc) {
            // Video not in DOM yet — inject it
            showVideo(firstThumb.dataset.videoSrc, firstThumb.dataset.videoType);
          }
        } else if (firstType === 'external_video') {
          const existingIfr = getIframe();
          if (!existingIfr && firstThumb.dataset.externalId) {
            showExternalVideo(firstThumb.dataset.externalId, firstThumb.dataset.externalHost);
          }
        }
      }
    });
  }

  /* ============================================================
     15. MARQUEE — shuffle items randomly on each load
  ============================================================ */
  function initMarquees() {
    qsa('.announcement-bar__track, .marquee-band__track').forEach(track => {
      // Collect unique item elements (first third of the rendered set)
      const allItems  = [...track.children];
      const chunkSize = Math.floor(allItems.length / 3) || allItems.length;
      const seed      = allItems.slice(0, chunkSize);

      // Fisher-Yates shuffle
      for (let i = seed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seed[i], seed[j]] = [seed[j], seed[i]];
      }

      // Rebuild track: 4 shuffled passes so the loop is seamless
      track.innerHTML = '';
      for (let pass = 0; pass < 4; pass++) {
        seed.forEach(el => track.appendChild(el.cloneNode(true)));
      }
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
      /* Cap at 0.48 s so late-page cards don't wait 1+ seconds to appear */
      el.style.transitionDelay = Math.min(i * 0.06, 0.48) + 's';
      obs.observe(el);
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
          document.body.style.animation = 'flashAccent 0.4s ease';
          setTimeout(() => document.body.style.animation = '', 400);

          if (!qs('#flash-accent-kf')) {
            const s = document.createElement('style');
            s.id = 'flash-accent-kf';
            s.textContent = `@keyframes flashAccent {
              0%, 100% { filter: none; }
              50% { filter: brightness(1.2); box-shadow: inset 0 0 80px rgba(var(--clr-accent-rgb), 0.3); }
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
        border-bottom-color: var(--clr-accent);
        box-shadow: 0 1px 20px rgba(var(--clr-accent-rgb), 0.15);
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
     25. VAULT LIGHTBOX
  ============================================================ */
  function initLightbox() {
    // Guard — only build DOM once. The MutationObserver set up on first call
    // handles wiring galleries that appear after AJAX page swaps.
    if (qs('#vault-lightbox')) return;

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

        // Build image-only set (skip video / external_video thumbs for lightbox)
        // Normalise URLs — data-full is protocol-relative (//cdn…) but
        // img.src is absolute (https://cdn…); strip protocol for comparison.
        const norm = url => (url || '').replace(/^https?:/, '');

        const imageThumbs = [...thumbs].filter(t => {
          const mt = t.dataset.mediaType || 'image';
          return mt === 'image' || mt === 'model_3d' || mt === '';
        });

        const fallbackImg = qs('#product-main-img', galleryEl);

        const images = imageThumbs.length
          ? imageThumbs.map(t => {
              const raw = t.dataset.full || qs('img', t)?.getAttribute('src') || fallbackImg?.getAttribute('src') || '';
              return {
                src: raw,
                alt: qs('img', t)?.alt || fallbackImg?.alt || '',
                caption: qs('.product-info__title')?.textContent?.trim() || ''
              };
            })
          : (fallbackImg ? [{ src: fallbackImg.getAttribute('src'), alt: fallbackImg.alt, caption: '' }] : []);

        if (!images.length) return; // nothing to lightbox

        mainWrap.style.cursor = 'zoom-in';
        mainWrap.addEventListener('click', () => {
          // Only open lightbox when an image (not video/iframe) is currently showing
          const mainImg = qs('#product-main-img', galleryEl);
          if (!mainImg || mainImg.style.display === 'none') return;

          const currentNorm = norm(mainImg.src);
          let idx = images.findIndex(i => norm(i.src) === currentNorm);
          if (idx < 0) idx = 0;
          open(images, idx);
        });
      });
    }

    wireGallery();

    // Re-wire after any dynamic content loads
    const observer = new MutationObserver(() => { wireGallery(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ============================================================
     26. CART DRAWER
  ============================================================ */
  function initCartDrawer() {
    const drawer  = qs('#cart-drawer');
    const overlay = qs('#cdr-overlay');
    if (!drawer) return;

    const body      = qs('#cdr-body',      drawer);
    const countEl   = qs('#cdr-count',     drawer);
    const subtotal  = qs('#cdr-subtotal',  drawer);

    /* ── open / close ── */
    function openDrawer() {
      drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      qs('#cdr-close', drawer)?.focus();
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    qs('#cdr-close',  drawer)?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);
    qs('#cdr-checkout', drawer)?.addEventListener('click', () => {
      window.location.href = '/checkout';
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
    });

    /* ── Intercept header cart icon — open drawer instead ── */
    qsa('a[href="/cart"], a[href="{{ routes.cart_url }}"]').forEach(link => {
      if (link.closest('.site-header') || link.closest('.header-actions')) {
        link.addEventListener('click', e => {
          e.preventDefault();
          fetchAndOpen();
        });
      }
    });

    /* ── Render cart data into drawer ── */
    function renderCart(cart) {
      // Count badge
      updateCartCount(cart.item_count);
      countEl.textContent = cart.item_count
        ? cart.item_count + (cart.item_count === 1 ? ' ITEM' : ' ITEMS')
        : '';

      // Subtotal
      subtotal.textContent = formatMoney(cart.total_price);

      // Items
      if (!body) return;
      if (cart.item_count === 0) {
        body.innerHTML = `
          <div class="cart-drawer__empty">
            <p class="cart-drawer__empty-title">YOUR CART IS EMPTY</p>
            <p class="cart-drawer__empty-sub">NOTHING IN HERE YET</p>
            <a href="/collections" class="btn btn--primary" style="display:inline-flex;margin-top:8px;">
              SHOP THE RANGE
            </a>
          </div>`;
        return;
      }

      body.innerHTML = cart.items.map(item => {
        const imgSrc = item.featured_image
          ? item.featured_image.url.split('?')[0] + '?width=150'
          : '';
        const variantLine = (item.variant_title && item.variant_title !== 'Default Title')
          ? `<span class="cdr-item__variant">${item.variant_title.toUpperCase()}</span>`
          : '';
        return `
          <div class="cdr-item">
            <a href="${item.url}" class="cdr-item__img-link">
              ${imgSrc
                ? `<img src="${imgSrc}" alt="${item.product_title}" class="cdr-item__img" loading="lazy">`
                : `<div class="cdr-item__img" style="background:var(--clr-dark)"></div>`}
            </a>
            <div class="cdr-item__body">
              <a href="${item.url}" class="cdr-item__title">${item.product_title.toUpperCase()}</a>
              ${variantLine}
              <div class="cdr-item__meta">
                <span class="cdr-item__qty">QTY: ${item.quantity}</span>
                <span class="cdr-item__price">${formatMoney(item.line_price)}</span>
              </div>
            </div>
            <button class="cdr-item__remove" data-item-key="${item.key}"
                    aria-label="Remove ${item.product_title}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>`;
      }).join('');

      /* Wire remove buttons */
      qsa('.cdr-item__remove', body).forEach(btn => {
        btn.addEventListener('click', () => {
          btn.disabled = true;
          btn.style.opacity = '0.3';
          fetch('/cart/change.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: btn.dataset.itemKey, quantity: 0 })
          })
            .then(r => r.json())
            .then(cart => renderCart(cart))
            .catch(() => { btn.disabled = false; btn.style.opacity = '1'; });
        });
      });
    }

    /* ── Fetch + render + open ── */
    function fetchAndOpen() {
      openDrawer();
      if (body) body.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:var(--font-label);font-size:0.6rem;color:var(--clr-silver-dim);letter-spacing:0.2em;">LOADING CART...</div>';
      fetch('/cart.js')
        .then(r => r.json())
        .then(cart => renderCart(cart));
    }

    /* ── Expose on VaultTheme ── */
    window.VaultTheme.openDrawer    = openDrawer;
    window.VaultTheme.closeDrawer   = closeDrawer;
    window.VaultTheme.renderCart    = renderCart;
    window.VaultTheme.fetchAndOpen  = fetchAndOpen;
  }

  /* ============================================================
     27. STICKY ATC BAR — appears when main button scrolls off screen
  ============================================================ */
  function initStickyATC() {
    const mainForm = qs('form[action="/cart/add"]');
    const atcBtn   = qs('.atc-btn', mainForm || document);
    if (!atcBtn || !mainForm) return;

    const title = qs('.product-info__title')?.textContent?.trim() || '';
    const price = qs('.price-current')?.textContent?.trim() || '';

    const bar = document.createElement('div');
    bar.className = 'sticky-atc';
    bar.innerHTML = `
      <div class="sticky-atc__info">
        <p class="sticky-atc__title">${title}</p>
        <p class="sticky-atc__price">${price}</p>
      </div>
      <button type="button" class="btn btn--primary sticky-atc__btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        ADD TO CART
      </button>`;
    document.body.appendChild(bar);

    qs('.sticky-atc__btn', bar).addEventListener('click', () => {
      // Trigger the main form's submit event (picked up by initAddToCart)
      if (mainForm.requestSubmit) {
        mainForm.requestSubmit();
      } else {
        mainForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });

    const obs = new IntersectionObserver(entries => {
      bar.classList.toggle('visible', !entries[0].isIntersecting);
    }, { threshold: 0.5, rootMargin: '0px 0px -60px 0px' });

    obs.observe(atcBtn);
  }

  /* ============================================================
     28. VAULT RADIO — YouTube-powered floating music player
  ============================================================ */
  function initMusicPlayer() {
    const radio   = qs('#vault-radio');
    if (!radio) return;

    const playBtn  = qs('#vr-play',  radio);
    const muteBtn  = qs('#vr-mute',  radio);
    const trackEl  = qs('#vr-track');
    if (!playBtn) return;

    const iconPlay  = qs('.vr-icon-play',  playBtn);
    const iconPause = qs('.vr-icon-pause', playBtn);

    /* ── Extract YouTube video ID from any URL format ── */
    function extractVideoId(src) {
      if (!src) return null;
      src = src.trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(src)) return src;
      const m = src.match(
        /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );
      return m ? m[1] : null;
    }

    const videoId = extractVideoId(radio.dataset.yt || '');
    if (!videoId) return;

    let player      = null;
    let pendingPlay = false;  /* play queued before player was ready */

    const YT_ENDED = 0, YT_PLAYING = 1, YT_BUFFERING = 3;

    function setPlaying(state) {
      radio.classList.toggle('playing', state);
      if (iconPlay)  iconPlay.style.display  = state ? 'none' : '';
      if (iconPause) iconPause.style.display = state ? '' : 'none';
      playBtn.setAttribute('aria-label', state ? 'Pause' : 'Play');
      playBtn.disabled = false;
    }

    function showTrackError(msg) {
      if (!trackEl) return;
      const orig = trackEl.textContent;
      const origColor = trackEl.style.color;
      trackEl.textContent = msg;
      trackEl.style.color = '#ff4444';
      setTimeout(function() {
        trackEl.textContent = orig;
        trackEl.style.color = origColor;
      }, 4000);
    }

    function createPlayer() {
      const container = qs('#vr-yt-player');
      if (!container || !window.YT || !window.YT.Player) return;

      player = new window.YT.Player(container, {
        height: '1',
        width:  '1',
        videoId: videoId,
        playerVars: {
          autoplay:       0,
          controls:       0,
          disablekb:      1,
          fs:             0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline:    1,
          rel:            0,
          origin:         window.location.origin,  /* required for postMessage bridge */
        },
        events: {
          onReady: function(e) {
            e.target.setVolume(80);
            if (pendingPlay) {          /* honour a click that arrived before ready */
              pendingPlay = false;
              e.target.playVideo();
            }
          },
          onStateChange: function(e) {
            const s = e.data;
            setPlaying(s === YT_PLAYING || s === YT_BUFFERING);
            if (s === YT_ENDED) e.target.playVideo();  /* loop non-live videos */
          },
          onError: function(e) {
            setPlaying(false);
            pendingPlay = false;
            /* YT error 101/150 = embedding not allowed for this video */
            const msg = (e.data === 101 || e.data === 150)
              ? 'EMBEDDING RESTRICTED'
              : 'STREAM UNAVAILABLE';
            showTrackError(msg);
          }
        }
      });
    }

    /* ── Load YouTube IFrame API once, queue safely ── */
    function loadYTApi() {
      if (window.YT && window.YT.Player) { createPlayer(); return; }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function() {
        if (typeof prev === 'function') prev();
        createPlayer();
      };
      if (!qs('script[src*="youtube.com/iframe_api"]')) {
        const tag    = document.createElement('script');
        tag.src      = 'https://www.youtube.com/iframe_api';
        tag.onerror  = function() { showTrackError('API LOAD FAILED'); };
        document.head.appendChild(tag);
      }
    }

    /* ── Play / Pause ── */
    playBtn.addEventListener('click', function() {
      if (!player) {
        /* API still loading — queue the intent, show visual feedback */
        pendingPlay = true;
        setPlaying(true);
        playBtn.disabled = true;
        return;
      }
      const s = player.getPlayerState();
      if (s === YT_PLAYING || s === YT_BUFFERING) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    });

    /* ── Mute ── */
    muteBtn.addEventListener('click', function() {
      if (!player) return;
      if (player.isMuted()) {
        player.unMute();
        radio.classList.remove('muted');
        muteBtn.setAttribute('aria-label', 'Mute');
      } else {
        player.mute();
        radio.classList.add('muted');
        muteBtn.setAttribute('aria-label', 'Unmute');
      }
    });

    loadYTApi();
  }

  /* ============================================================
     29. BACK TO TOP
  ============================================================ */
  function initBackToTop() {
    const btn = qs('#back-to-top');
    if (!btn) return;

    const toggle = () => {
      const show = window.scrollY > 400;
      btn.style.display = show ? '' : 'none';
    };

    window.addEventListener('scroll', toggle, { passive: true });
    toggle(); // run once on init

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ============================================================
     30. AJAX PAGE TRANSITIONS — keeps music / cursor / drawer alive
         Only #MainContent is swapped; layout elements (radio, cursor,
         cart drawer) are never touched so audio plays continuously.
  ============================================================ */
  function initAjaxNav() {
    const main = qs('#MainContent');
    if (!main) return;

    /* paths that must do a real navigation */
    const HARD_NAV = ['/cart', '/checkout', '/account', '/password', '/admin'];

    /* Cultivators Club pages ship their own header and body styling from
       the layout, which an AJAX content swap can't update — always do a
       full navigation into or out of club territory.

       The handles come from the layout (snippets/club-handles.liquid) so
       this can't drift when a Club collection is added. Matched as whole
       path segments: a bare substring test on a handle like "core" would
       also swallow any unrelated path that happened to contain it. */
    const clubHandles = (window.VaultTheme && window.VaultTheme.clubHandles) ||
                        ['the-cultivators-club', 'the-uniform', 'the-drops'];

    function isClubPath(pathname) {
      if (pathname.includes('cultivator')) return true;
      const segments = pathname.split('/').filter(Boolean);
      return clubHandles.some(h => segments.includes(h));
    }

    function shouldIntercept(link) {
      if (!link || !link.href) return false;
      if (link.target === '_blank') return false;
      if (link.hasAttribute('download')) return false;
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
      let url;
      try { url = new URL(href, window.location.origin); } catch(e) { return false; }
      if (url.origin !== window.location.origin) return false;
      if (HARD_NAV.some(p => url.pathname.startsWith(p))) return false;
      if (document.body.classList.contains('cg-page')) return false;
      if (isClubPath(url.pathname)) return false;
      return true;
    }

    /* ── Intercept clicks ── */
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[href]');
      if (!shouldIntercept(link)) return;
      e.preventDefault();
      const url = new URL(link.getAttribute('href'), window.location.origin);
      if (url.href !== window.location.href) navigate(url.href, true);
    });

    /* ── Browser back / forward ── */
    window.addEventListener('popstate', function() {
      navigate(window.location.href, false);
    });

    /* ── Core navigation ── */
    async function navigate(url, pushState) {
      /* dim main content */
      main.style.transition = 'opacity 0.15s ease';
      main.style.opacity    = '0.12';

      try {
        const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!res.ok) throw new Error(res.status);
        const html   = await res.text();
        const doc    = new DOMParser().parseFromString(html, 'text/html');
        const newMain = doc.querySelector('#MainContent');
        if (!newMain) throw new Error('no #MainContent');

        /* swap content */
        main.innerHTML = newMain.innerHTML;
        document.title = doc.title;
        if (pushState) history.pushState({ url }, doc.title, url);
        window.scrollTo(0, 0);

        /* re-execute inline <script> blocks (e.g. vault gate) */
        qsa('script', main).forEach(function(old) {
          const s = document.createElement('script');
          Array.from(old.attributes).forEach(function(a) { s.setAttribute(a.name, a.value); });
          s.textContent = old.textContent;
          old.parentNode.replaceChild(s, old);
        });

        /* fade back in */
        main.style.opacity = '1';

        /* re-init page-specific JS */
        reinitPage();

        /* update active nav link */
        const curPath = new URL(url, window.location.origin).pathname;
        qsa('.site-nav__link').forEach(function(a) {
          const li = a.closest('li');
          const isActive = new URL(a.href, window.location.origin).pathname === curPath;
          li && li.classList.toggle('site-nav__item--active', isActive);
          isActive ? a.setAttribute('aria-current','page') : a.removeAttribute('aria-current');
        });

      } catch(err) {
        /* fall back to hard navigation on any error */
        window.location.href = url;
      }
    }

    /* ── Re-init only page-content functions (not global listeners) ── */
    function reinitPage() {
      /* remove stale sticky ATC bar before product page creates a new one */
      qsa('.sticky-atc').forEach(function(el) { el.remove(); });

      initScramble();
      initScrollScramble();
      initVariants();
      initQty();
      initAddToCart();
      initStickyATC();
      initAccordion();
      initGallery();
      initMarquees();
      initReveal();
      initCounters();
      initFilters();
      // initLightbox — NOT called here. The guard inside prevents duplicate DOM
      // creation, and the MutationObserver wired on first call automatically
      // picks up new .product-gallery elements after each AJAX page swap.
    }
  }

  /* ============================================================
     INIT ALL
  ============================================================ */
  function init() {
    injectScrolledStyles();
    injectCartStyles();
    initPreloader();
    initScramble();
    initScrollScramble();
    initHeader();
    initVariants();
    initQty();
    initCartDrawer();   // must be before initAddToCart so VaultTheme.renderCart exists
    initAddToCart();
    initStickyATC();
    initAccordion();
    initGallery();
    initMarquees();
    initReveal();
    initCounters();
    initKonamiVault();
    initFilters();
    initLightbox();
    initMusicPlayer();
    initBackToTop();
    initReviews();
    initAjaxNav();      // last — depends on all other inits being complete
  }


  /* ============================================================
     JUDGE.ME REVIEWS
     Judge.me's widget script tags its container as set up and
     then renders nothing on this theme, so we build the list
     ourselves from the same metafield its widget reads.
     The section ships hidden and is only revealed once we have
     at least one review to put in it.
  ============================================================ */
  function initReviews() {
    var section = document.querySelector('[data-vault-reviews]');
    var json    = document.querySelector('[data-reviews-json]');
    if (!section || !json) return;

    var data;
    try { data = JSON.parse(json.textContent); } catch (e) { return; }
    if (!data) return;

    var reviews = Array.isArray(data.reviews) ? data.reviews : [];
    if (!reviews.length) return;

    var summary = section.querySelector('[data-reviews-summary]');
    var list    = section.querySelector('[data-reviews-list]');

    if (summary) summary.innerHTML = reviewSummary(data);
    if (list)    list.innerHTML    = reviews.map(reviewCard).join('');

    section.removeAttribute('hidden');
  }

  function reviewStars(score) {
    var n = Math.round(Number(score) || 0);
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="vault-star' + (i <= n ? ' is-on' : '') + '">\u2605</span>';
    }
    return '<span class="vault-stars" role="img" aria-label="' + n + ' out of 5 stars">' + out + '</span>';
  }

  function reviewSummary(data) {
    var n = Number(data.number_of_reviews) || 0;
    return reviewStars(data.average_rating) +
           '<span class="vault-reviews__avg">' + (Number(data.average_rating) || 0).toFixed(1) + '</span>' +
           '<span class="vault-reviews__count">' + n + (n === 1 ? ' review' : ' reviews') + '</span>';
  }

  function reviewCard(r) {
    var date = '';
    if (r.created_at) {
      var d = new Date(r.created_at);
      if (!isNaN(d)) date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return '<article class="vault-review">' +
             '<div class="vault-review__head">' +
               reviewStars(r.rating) +
               '<span class="vault-review__name">' + reviewEscape(r.reviewer_name || 'Anonymous') + '</span>' +
               (r.verified_buyer ? '<span class="vault-review__verified">Verified buyer</span>' : '') +
               (date ? '<span class="vault-review__date">' + date + '</span>' : '') +
             '</div>' +
             (r.title ? '<p class="vault-review__title">' + reviewEscape(r.title) + '</p>' : '') +
             '<div class="vault-review__body"><p>' + reviewEscape(r.body || '').split(NL).join('<br>') + '</p></div>' +
           '</article>';
  }

  var NL = String.fromCharCode(10);

  function reviewEscape(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
