/* =====================================================================
   app.js — Gold-Stufe: Dialoge mit Focus-Trap + Return-Focus + A11y
   =====================================================================

   Inhaltsverzeichnis
   ---------------------------------------------------------------------
   01) Helpers
   02) Boot: Current Year
   03) Motion Preferences
   04) Scroll Pipeline (rAF)
   05) Steps In-View
   06) Dialog System (Popover)
       06.1) Focus Trap + Return Focus
       06.2) ESC, Backdrop-Click, Close Buttons
       06.3) Scroll Lock
       06.4) ARIA: aria-hidden / inert für den Rest der Seite
   07) Theme Toggle (+ aria-pressed)

   ===================================================================== */

(() => {
  "use strict";

  /* ===================================================================
     01) Helpers
     =================================================================== */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const getScrollY = () => window.scrollY || window.pageYOffset || 0;
  const getViewportH = () =>
    window.innerHeight || document.documentElement.clientHeight || 0;

  function isHtmlElement(node) {
    return node && node.nodeType === 1;
  }

  function setAriaHidden(el, hidden) {
    if (!isHtmlElement(el)) return;
    if (hidden) el.setAttribute("aria-hidden", "true");
    else el.removeAttribute("aria-hidden");
  }

  /* ===================================================================
     02) Boot: Current Year ([data-year])
     =================================================================== */

  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ===================================================================
     03) Motion Preferences
     =================================================================== */

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ===================================================================
     04) Scroll Pipeline (requestAnimationFrame throttling)
     =================================================================== */

  const media = $('[data-parallax="media"]');
  const cta = $(".cta");
  const progressBar = document.getElementById("progress-bar");

  let ticking = false;

  function requestScrollTick() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(() => {
      runScrollEffects();
      ticking = false;
    });
  }

  function runScrollEffects() {
    runParallax();
    updateCtaVisibility();
    updateProgressBar();
  }

  function runParallax() {
    if (!media || prefersReducedMotion) return;

    const rect = media.getBoundingClientRect();
    const viewportH = getViewportH();

    const visibleTop = Math.min(viewportH, Math.max(0, viewportH - rect.top));
    const progress = visibleTop / (viewportH + rect.height);

    const y = Math.round(progress * 40);
    media.style.transform = `translate3d(0, ${y}px, 0) scale(1.06)`;
  }

  function updateCtaVisibility() {
    if (!cta) return;

    const scrollY = getScrollY();
    const viewportH = getViewportH();
    if (scrollY > viewportH * 0.4) cta.classList.add("cta--show");
    else cta.classList.remove("cta--show");
  }

  function updateProgressBar() {
    if (!progressBar) return;

    const scrollTop = getScrollY();
    const docHeight = document.documentElement.scrollHeight - getViewportH();
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;

    progressBar.style.width = `${progress * 100}%`;
  }

  window.addEventListener("scroll", requestScrollTick, { passive: true });
  window.addEventListener("resize", requestScrollTick);
  requestScrollTick();

  /* ===================================================================
     05) Steps In-View Animation
     =================================================================== */

  function updateStepsInView() {
    const steps = $$(".step");
    if (!steps.length) return;

    const trigger = getViewportH() * 0.92;

    for (const step of steps) {
      const rect = step.getBoundingClientRect();
      if (rect.top < trigger) step.classList.add("step--inview");
      else step.classList.remove("step--inview");
    }
  }

  window.addEventListener("scroll", updateStepsInView, { passive: true });
  window.addEventListener("resize", updateStepsInView);
  document.addEventListener("DOMContentLoaded", updateStepsInView);
  updateStepsInView();

  /* ===================================================================
     06) Dialog System (Popover) — GOLD
     =================================================================== */

  // Muss zur CSS-Transition passen
  const POPOVER_ANIM_MS = 300;

  // Merkt sich, welches Element vor dem Öffnen fokussiert war
  let lastActiveElement = null;

  // Merkt sich das aktuell offene Popover
  let activePopover = null;

  // Optional: "Rest der Seite" aus Screenreader/Tastatur rausnehmen.
  // Empfehlung: lege in HTML alles Hauptzeug in <main id="main"> und <header> + <footer>.
  const main = document.getElementById("main");
  const header = document.querySelector("header.topbar");
  const footer = document.querySelector("footer.footer");
  const ctaRegion = document.querySelector(".cta");

  // Scroll lock (simple & robust)
  let scrollLockY = 0;
  function lockScroll() {
    scrollLockY = getScrollY();
    // Body fixieren, damit iOS/Android nicht “durchscrollt”
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }
  function unlockScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollLockY);
  }

  // Focusable Elements nach Standard
  const FOCUSABLE_SELECTOR = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(",");

  function getFocusable(container) {
    if (!container) return [];
    return $$(FOCUSABLE_SELECTOR, container).filter((el) => {
      // Nicht sichtbar => nicht fokussierbar
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return false;
      return el.offsetParent !== null || style.position === "fixed";
    });
  }

  function setPageInert(isInert) {
    // Inert ist top, falls verfügbar. Sonst fallback via aria-hidden.
    const targets = [header, main, footer, ctaRegion].filter(Boolean);

    for (const el of targets) {
      // Popover selbst NICHT anfassen – ist nicht in dieser Liste.
      if ("inert" in el) {
        el.inert = isInert;
      } else {
        setAriaHidden(el, isInert);
      }
    }
  }

  function focusFirstIn(pop) {
    const focusables = getFocusable(pop);
    if (focusables.length) focusables[0].focus();
    else pop.focus?.(); // fallback: container fokus
  }

  function trapFocusHandler(e) {
    if (!activePopover) return;
    if (e.key !== "Tab") return;

    const focusables = getFocusable(activePopover);
    if (!focusables.length) {
      e.preventDefault();
      activePopover.focus?.();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Shift+Tab am Anfang => springe ans Ende
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
      return;
    }

    // Tab am Ende => springe an den Anfang
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
      return;
    }
  }

  function onGlobalKeydown(e) {
    // ESC schließt nur, wenn Dialog offen
    if (e.key === "Escape" && activePopover) {
      e.preventDefault();
      hidePopover(activePopover.id);
      return;
    }

    // Focus trap
    trapFocusHandler(e);
  }

  // Backdrop click: Klick auf Overlay (nicht auf Content) schließt
  function onPopoverPointerDown(e) {
    if (!activePopover) return;
    if (e.target === activePopover) {
      hidePopover(activePopover.id);
    }
  }

  function showPopover(id, { returnFocusTo } = {}) {
    const pop = document.getElementById(id);
    if (!pop) return;

    // Wenn bereits ein Dialog offen ist: erst schließen (simple policy)
    if (activePopover && activePopover !== pop) {
      hidePopover(activePopover.id, { skipReturnFocus: true });
    }

    lastActiveElement =
      returnFocusTo ||
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    activePopover = pop;

    // Seite “stilllegen”
    setPageInert(true);
    lockScroll();

    // Sichtbar machen
    pop.hidden = false;

    // A11y: Dialog bekommt Fokus, danach erstes fokussierbares Element
    // (kleiner Delay, damit CSS Transition zuverlässig greift)
    window.setTimeout(() => {
      pop.classList.add("show");
      focusFirstIn(pop);
    }, 10);

    // Events nur solange Dialog offen
    document.addEventListener("keydown", onGlobalKeydown);
    pop.addEventListener("pointerdown", onPopoverPointerDown);
  }

  function hidePopover(id, { skipReturnFocus = false } = {}) {
    const pop = document.getElementById(id);
    if (!pop) return;

    pop.classList.remove("show");

    window.setTimeout(() => {
      pop.hidden = true;

      // Cleanup
      if (activePopover === pop) activePopover = null;

      document.removeEventListener("keydown", onGlobalKeydown);
      pop.removeEventListener("pointerdown", onPopoverPointerDown);

      unlockScroll();
      setPageInert(false);

      // Fokus zurück dahin, wo man herkam
      if (!skipReturnFocus && lastActiveElement?.focus) {
        lastActiveElement.focus();
      }
      lastActiveElement = null;
    }, POPOVER_ANIM_MS);
  }

  // Bindings
  const impressumBtn = document.getElementById("impressum-link");
  const datenschutzBtn = document.getElementById("datenschutz-link");
  const closeImpressum = document.getElementById("close-impressum");
  const closeDatenschutz = document.getElementById("close-datenschutz");

  impressumBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    showPopover("impressum-popover", { returnFocusTo: impressumBtn });
  });

  datenschutzBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    showPopover("datenschutz-popover", { returnFocusTo: datenschutzBtn });
  });

  closeImpressum?.addEventListener("click", () => hidePopover("impressum-popover"));
  closeDatenschutz?.addEventListener("click", () => hidePopover("datenschutz-popover"));

  /* ===================================================================
     07) Theme Toggle (+ aria-pressed)
     =================================================================== */

  const themeToggle = document.getElementById("theme-toggle");
  const sunIcon = document.getElementById("theme-toggle-sun");
  const moonIcon = document.getElementById("theme-toggle-moon");

  if (!themeToggle || !sunIcon || !moonIcon) return;

  function getStoredTheme() {
    try {
      return localStorage.getItem("theme");
    } catch {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }

  function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function syncThemeIcons(theme) {
    if (theme === "dark") {
      sunIcon.classList.add("hide");
      moonIcon.classList.remove("hide");
      themeToggle.setAttribute("aria-pressed", "true");
    } else {
      sunIcon.classList.remove("hide");
      moonIcon.classList.add("hide");
      themeToggle.setAttribute("aria-pressed", "false");
    }
  }

  function applyTheme(theme, { persist = true } = {}) {
    document.documentElement.setAttribute("data-theme", theme);
    syncThemeIcons(theme);
    if (persist) setStoredTheme(theme);
  }

  function getCurrentTheme() {
    const stored = getStoredTheme();
    if (stored === "dark" || stored === "light") return stored;
    return systemPrefersDark() ? "dark" : "light";
  }

  applyTheme(getCurrentTheme(), { persist: true });

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark", { persist: true });
  });

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => {
    if (getStoredTheme()) return;
    applyTheme(e.matches ? "dark" : "light", { persist: false });
  });
})();
