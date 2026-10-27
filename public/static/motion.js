"use strict";

(() => {
  // The card is the moving unit. Its contents and the original portrait are not
  // animated separately, and native navigation is never intercepted.
  if (!["public.home", "public.about", "public.entries", "public.document_reader"].includes(document.body?.dataset.route)) return;
  if (!("IntersectionObserver" in window) || typeof Element.prototype.animate !== "function") return;
  if (typeof window.matchMedia !== "function") return;

  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (preference.matches) return;
  // 讀者在「閱讀設定」選了減少動態（prefs.js 寫在 <html data-motion>）
  if (document.documentElement.dataset.motion === "reduce") return;

  const groups = Array.from(document.querySelectorAll(
    ".notebook-index .section-heading, .first-page, .editor-letter, .about-section, .entry-card, .document-home-tab, .reader-heading, .reader-directory, .reader-mobile-tabs, .reader-page-heading, .reader-search, .reader-image-card"
  ));
  if (!groups.length) return;

  const pending = new Set(groups);
  const active = new Set();
  let stopped = false;

  const observer = new IntersectionObserver((entries) => {
    let cardSequence = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting || stopped || preference.matches) continue;
      observer.unobserve(entry.target);
      if (!pending.delete(entry.target)) continue;

      // Defaults stay visible. Animate a complete card once, only as it enters;
      // never split each paragraph into a competing reveal or move focused UI.
      const target = entry.target;
      if (target.contains(document.activeElement)) continue;
      const isCard = target.matches(".entry-card, .document-home-tab, .reader-image-card");
      const delay = isCard ? Math.min(cardSequence++, 6) * 40 : 0;
      const animation = target.animate([
        { opacity: .7, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], {
        duration: isCard ? 340 : 380,
        delay,
        easing: "cubic-bezier(.2, .7, .2, 1)",
        fill: "none"
      });
      active.add(animation);
      animation.finished.then(() => {
        active.delete(animation);
        // Restore the authored CSS so hover/press can immediately take over.
        animation.cancel();
      }, () => active.delete(animation));
    }
    if (!pending.size) observer.disconnect();
  }, { threshold: .12, rootMargin: "0px 0px -5% 0px" });

  const stop = () => {
    stopped = true;
    observer.disconnect();
    pending.clear();
    active.forEach((animation) => animation.cancel());
    active.clear();
  };
  preference.addEventListener?.("change", (event) => {
    if (event.matches) stop();
  });
  window.addEventListener("pagehide", stop, { once: true });
  groups.forEach((group) => observer.observe(group));
})();
