(() => {
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Parallax: hero image moves slightly slower than scroll
  const media = document.querySelector('[data-parallax="media"]');
  const cta = document.querySelector('.cta');
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ticking = false;

  function handleCtaVisibility() {
    if (!cta) return;
    const scrollY = window.scrollY || window.pageYOffset;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    if (scrollY > viewportH * 0.4) {
      cta.classList.add('cta--show');
    } else {
      cta.classList.remove('cta--show');
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      if (media && !prefersReduced) {
        const rect = media.getBoundingClientRect();
        const viewportH = window.innerHeight || document.documentElement.clientHeight;
        // Parallax progress only while hero is on screen
        const visibleTop = Math.min(viewportH, Math.max(0, viewportH - rect.top));
        const progress = visibleTop / (viewportH + rect.height);
        // translate range: 0 .. 40px
        const y = Math.round(progress * 40);
        // Keep scale to avoid edges while moving
        media.style.transform = `translate3d(0, ${y}px, 0) scale(1.06)`;
      }
      handleCtaVisibility();
      ticking = false;
    });
  }

  // Progress Bar logic
  const progressBar = document.getElementById('progress-bar');
  function updateProgressBar() {
    const scrollTop = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) : 0;
    if (progressBar) progressBar.style.width = (progress * 100) + '%';
  }

  window.addEventListener("scroll", () => {
    onScroll();
    updateProgressBar();
  }, { passive: true });
  window.addEventListener("resize", () => {
    onScroll();
    updateProgressBar();
  });
  onScroll();
  updateProgressBar();

  // Steps fly-in animation
  function inViewSteps() {
    const steps = document.querySelectorAll('.step');
    const trigger = window.innerHeight * 0.92;
    steps.forEach((step, i) => {
      const rect = step.getBoundingClientRect();
      if (rect.top < trigger) {
        step.classList.add('step--inview');
      } else {
        step.classList.remove('step--inview');
      }
    });
  }
  window.addEventListener('scroll', inViewSteps, { passive: true });
  window.addEventListener('resize', inViewSteps);
  document.addEventListener('DOMContentLoaded', inViewSteps);
  inViewSteps();
})();


