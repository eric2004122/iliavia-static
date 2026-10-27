// 窄螢幕的分頁標籤：把目前這一頁的標籤捲到看得見的位置（只捲標籤列，不動整頁）。
(function () {
  var strip = document.querySelector(".reader-tab-chips");
  var current = strip && strip.querySelector('[aria-current="page"]');
  if (!strip || !current || strip.scrollWidth <= strip.clientWidth) return;
  strip.scrollLeft = Math.max(0, current.offsetLeft - strip.offsetLeft - 16);
})();
