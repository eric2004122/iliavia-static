/* Progressive enhancement: original-image anchors remain usable without JavaScript. */
"use strict";

(() => {
  const reader = document.querySelector(".document-reader");
  if (!reader || typeof HTMLDialogElement === "undefined" || typeof HTMLDialogElement.prototype.showModal !== "function") return;

  const pictures = Array.from(reader.querySelectorAll("a.reader-image-original")).flatMap((anchor) => {
    const source = anchor.querySelector("img");
    if (!source) return [];
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith("/document/image/") || url.username || url.password) return [];
      return [{ anchor, source, url: url.href, alt: source.getAttribute("alt") || "" }];
    } catch (_) {
      return [];
    }
  });
  if (!pictures.length) return;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function control(text, label, className = "") {
    const node = element("button", `reader-lightbox-button ${className}`.trim(), text);
    node.type = "button";
    node.setAttribute("aria-label", label);
    return node;
  }

  const dialog = element("dialog", "reader-lightbox");
  dialog.setAttribute("aria-labelledby", "reader-lightbox-title");
  dialog.setAttribute("aria-describedby", "reader-lightbox-help");
  const surface = element("div", "reader-lightbox-surface");
  const header = element("header", "reader-lightbox-header");
  const headingGroup = element("div", "reader-lightbox-heading");
  const title = element("h2", "", "文件圖片");
  title.id = "reader-lightbox-title";
  const count = element("p", "reader-lightbox-count");
  const closeButton = control("關閉 ×", "關閉圖片檢視器", "reader-lightbox-close");
  closeButton.autofocus = true;
  headingGroup.append(title, count);
  header.append(headingGroup, closeButton);

  const toolbar = element("div", "reader-lightbox-toolbar");
  const navigation = element("div", "reader-lightbox-navigation");
  navigation.setAttribute("role", "group");
  navigation.setAttribute("aria-label", "切換圖片");
  const previous = control("← 上一張", "上一張圖片");
  const next = control("下一張 →", "下一張圖片");
  navigation.append(previous, next);

  const zoomControls = element("div", "reader-lightbox-zoom");
  zoomControls.setAttribute("role", "group");
  zoomControls.setAttribute("aria-label", "圖片大小");
  const zoomOut = control("−", "縮小圖片");
  const zoomValue = element("output", "reader-lightbox-zoom-value", "適合");
  zoomValue.setAttribute("aria-label", "圖片放大倍率；1 倍為原始尺寸");
  zoomValue.setAttribute("aria-live", "polite");
  const zoomIn = control("＋", "放大圖片");
  const fit = control("適合視窗", "重設圖片大小以適合視窗", "reader-lightbox-fit");
  zoomControls.append(zoomOut, zoomValue, zoomIn, fit);
  toolbar.append(navigation, zoomControls);

  const viewport = element("div", "reader-lightbox-viewport");
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", "圖片檢視區，放大後可捲動查看");
  const stage = element("div", "reader-lightbox-stage");
  viewport.append(stage);
  const information = element("div", "reader-lightbox-information");
  const status = element("p", "reader-lightbox-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const original = element("a", "reader-lightbox-original", "另開原圖 ↗");
  original.target = "_blank";
  original.rel = "noopener noreferrer";
  information.append(status, original);
  const help = element("p", "reader-lightbox-help", "← → 切換圖片・Esc 關閉・1× 為原始尺寸，放大後可捲動查看");
  help.id = "reader-lightbox-help";
  surface.append(header, toolbar, viewport, information, help);
  dialog.append(surface);
  document.body.append(dialog);

  const levels = [1, 1.5, 2, 3];
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let index = 0;
  // -1 fits the whole image; 0..3 are actual source-pixel scales, not fit multipliers.
  let zoomIndex = -1;
  let currentImage = null;
  let imageLoaded = false;
  let generation = 0;
  let opener = null;
  let scrollLock = null;
  let closing = false;
  let closingTimer;
  let backdropPressed = false;

  function savedProperties(style, names) {
    return names.map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]);
  }

  function restoreProperties(style, properties) {
    properties.forEach(([name, value, priority]) => {
      if (value) style.setProperty(name, value, priority);
      else style.removeProperty(name);
    });
  }

  function lockScroll() {
    if (scrollLock) return;
    const body = document.body;
    const x = window.scrollX;
    const y = window.scrollY;
    const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    scrollLock = {
      x, y,
      body: savedProperties(body.style, ["position", "top", "left", "right", "width", "overflow", "padding-right"]),
      root: savedProperties(document.documentElement.style, ["scroll-behavior"]),
    };
    body.style.setProperty("position", "fixed");
    body.style.setProperty("top", `${-y}px`);
    body.style.setProperty("left", `${-x}px`);
    body.style.setProperty("right", "0");
    body.style.setProperty("width", "100%");
    body.style.setProperty("overflow", "hidden");
    body.style.setProperty("padding-right", `${padding + scrollbar}px`);
  }

  function releaseScroll(restoreFocus) {
    if (!scrollLock) return;
    const saved = scrollLock;
    scrollLock = null;
    restoreProperties(document.body.style, saved.body);
    document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
    window.scrollTo(saved.x, saved.y);
    restoreProperties(document.documentElement.style, saved.root);
  }

  function updateControls() {
    previous.disabled = index === 0;
    next.disabled = index === pictures.length - 1;
    zoomOut.disabled = !imageLoaded || zoomIndex === -1;
    zoomIn.disabled = !imageLoaded || zoomIndex === levels.length - 1;
    fit.disabled = !imageLoaded || zoomIndex === -1;
    zoomValue.textContent = zoomIndex < 0 ? "適合" : `${levels[zoomIndex]}×`;
    zoomIn.setAttribute("aria-label", zoomIndex < 0 ? "以原始尺寸檢視圖片" : "放大圖片");
    // A control disabled by this action must not leave keyboard focus stranded.
    const active = document.activeElement;
    if (dialog.open && active?.disabled && dialog.contains(active)) {
      const alternatives = active === next ? [previous, closeButton]
        : active === previous ? [next, closeButton]
        : active === zoomIn ? [zoomOut, closeButton] : [zoomIn, closeButton];
      alternatives.find((button) => !button.disabled)?.focus({ preventScroll: true });
    }
  }

  function sizeImage(preserveCenter = false) {
    if (!currentImage || !imageLoaded) return;
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(stage.scrollWidth, 1);
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(stage.scrollHeight, 1);
    const space = (parseFloat(getComputedStyle(stage).paddingLeft) || 0) * 2;
    const width = Math.max(1, viewport.clientWidth - space);
    const height = Math.max(1, viewport.clientHeight - space);
    const ratio = zoomIndex < 0
      ? Math.min(width / currentImage.naturalWidth, height / currentImage.naturalHeight, 1)
      : levels[zoomIndex];
    currentImage.width = Math.max(1, Math.round(currentImage.naturalWidth * ratio));
    currentImage.height = Math.max(1, Math.round(currentImage.naturalHeight * ratio));
    viewport.scrollLeft = preserveCenter ? Math.max(0, stage.scrollWidth * centerX - viewport.clientWidth / 2) : 0;
    viewport.scrollTop = preserveCenter ? Math.max(0, stage.scrollHeight * centerY - viewport.clientHeight / 2) : 0;
    updateControls();
  }

  function showImage(newIndex) {
    if (newIndex < 0 || newIndex >= pictures.length) return;
    const item = pictures[newIndex];
    index = newIndex;
    zoomIndex = -1;
    imageLoaded = false;
    const token = ++generation;
    count.textContent = `${index + 1} / ${pictures.length}`;
    original.href = item.url;
    original.setAttribute("aria-label", `另開第 ${index + 1} 張圖片的原圖`);
    status.textContent = "正在載入圖片…";
    status.classList.remove("is-error");
    viewport.setAttribute("aria-busy", "true");
    viewport.scrollTop = viewport.scrollLeft = 0;

    const image = element("img", "reader-lightbox-image");
    image.alt = item.alt || `文件圖片 ${index + 1}`;
    image.decoding = "async";
    image.hidden = true;
    const sourceWidth = item.source.naturalWidth || Number(item.source.getAttribute("width"));
    const sourceHeight = item.source.naturalHeight || Number(item.source.getAttribute("height"));
    if (sourceWidth > 0 && sourceHeight > 0) {
      image.width = sourceWidth;
      image.height = sourceHeight;
    }
    currentImage = image;
    image.addEventListener("load", () => {
      if (token !== generation || !dialog.open) return;
      if (!image.naturalWidth || !image.naturalHeight) {
        image.dispatchEvent(new Event("error"));
        return;
      }
      imageLoaded = true;
      image.hidden = false;
      viewport.removeAttribute("aria-busy");
      status.textContent = item.alt || `文件圖片 ${index + 1}`;
      sizeImage();
    }, { once: true });
    image.addEventListener("error", () => {
      if (token !== generation || !dialog.open) return;
      imageLoaded = false;
      image.hidden = true;
      viewport.removeAttribute("aria-busy");
      status.textContent = "圖片暫時無法載入。你可以切換圖片，或使用「另開原圖」重試。";
      status.classList.add("is-error");
      stage.replaceChildren(element("p", "reader-lightbox-image-error", "這張圖片目前無法顯示"));
      updateControls();
    }, { once: true });
    stage.replaceChildren(image);
    updateControls();
    image.src = item.url;
  }

  function cleanUp(restoreFocus = true) {
    clearTimeout(closingTimer);
    closing = false;
    backdropPressed = false;
    generation += 1;
    dialog.classList.remove("is-closing");
    stage.replaceChildren();
    currentImage = null;
    imageLoaded = false;
    viewport.removeAttribute("aria-busy");
    releaseScroll(restoreFocus);
    opener = null;
  }

  function closeImmediately(restoreFocus = true) {
    if (dialog.open) dialog.close();
    cleanUp(restoreFocus);
  }

  function requestClose() {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.add("is-closing");
    if (reducedMotion?.matches) closeImmediately();
    else closingTimer = setTimeout(closeImmediately, 140);
  }

  function openImage(newIndex, trigger) {
    if (dialog.open || closing) return false;
    opener = trigger;
    lockScroll();
    try {
      dialog.showModal();
    } catch (_) {
      cleanUp();
      return false;
    }
    showImage(newIndex);
    closeButton.focus({ preventScroll: true });
    return true;
  }

  pictures.forEach((item, pictureIndex) => {
    item.anchor.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (openImage(pictureIndex, item.anchor)) event.preventDefault();
    });
  });
  closeButton.addEventListener("click", requestClose);
  previous.addEventListener("click", () => showImage(index - 1));
  next.addEventListener("click", () => showImage(index + 1));
  zoomOut.addEventListener("click", () => {
    if (imageLoaded && zoomIndex >= 0) { zoomIndex -= 1; sizeImage(zoomIndex >= 0); }
  });
  zoomIn.addEventListener("click", () => {
    if (imageLoaded && zoomIndex < levels.length - 1) { zoomIndex += 1; sizeImage(true); }
  });
  fit.addEventListener("click", () => { zoomIndex = -1; sizeImage(); });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); requestClose(); });
  // Native close is queued. Ignore a stale close event if the user already reopened it.
  dialog.addEventListener("close", () => { if (!dialog.open) cleanUp(); });
  dialog.addEventListener("pointerdown", (event) => { backdropPressed = event.target === dialog; });
  dialog.addEventListener("click", (event) => {
    if (backdropPressed && event.target === dialog) requestClose();
    backdropPressed = false;
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (!closing) showImage(index + (event.key === "ArrowLeft" ? -1 : 1));
    } else if (event.key === "Tab") {
      const focusable = Array.from(dialog.querySelectorAll("button:not(:disabled), a[href], [tabindex='0']"))
        .filter((node) => node.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first?.focus({ preventScroll: true });
      }
    }
  });
  window.addEventListener("resize", () => { if (dialog.open) sizeImage(true); });
  reducedMotion?.addEventListener?.("change", (event) => {
    if (event.matches && closing) closeImmediately();
  });
  // BFCache stores a clean, unlocked reading page. Event handlers still work on return.
  window.addEventListener("pagehide", () => closeImmediately(false));
})();
