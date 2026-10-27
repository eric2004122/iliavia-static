// 18+／私人內容：預設收合；按鈕可一次全部展開或收合，並記在這台瀏覽器。
(function () {
  var KEY = "avia-show-sensitive";
  var blocks = document.querySelectorAll("details[data-sensitive]");
  var buttons = document.querySelectorAll("[data-sensitive-toggle]");
  if (!blocks.length) return;

  function remembered() {
    try { return window.localStorage.getItem(KEY) === "1"; } catch (err) { return false; }
  }
  function remember(show) {
    try { window.localStorage.setItem(KEY, show ? "1" : "0"); } catch (err) { /* 無法儲存就只影響這一頁 */ }
  }
  function label(show) {
    buttons.forEach(function (button) {
      button.textContent = show ? "收合 18+／私人內容" : "顯示 18+／私人內容";
      button.setAttribute("aria-pressed", show ? "true" : "false");
    });
  }

  var show = remembered();
  // 記得要顯示就全部打開；沒有的話維持模板的狀態（搜尋命中的區塊已經是打開的）
  if (show) blocks.forEach(function (block) { block.open = true; });
  label(show);
  buttons.forEach(function (button) {
    button.hidden = false;
    button.addEventListener("click", function () {
      show = !show;
      remember(show);
      blocks.forEach(function (block) { block.open = show; });
      label(show);
    });
  });
})();
