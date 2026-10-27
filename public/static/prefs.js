// 讀者的閱讀設定：存在這台瀏覽器的 localStorage。
// 這支在 <head> 直接執行，先把設定寫到 <html> 上，畫面一出來就是對的大小，不會閃一下。
(function () {
  var KEYS = { fontSize: "avia-font-size", sensitive: "avia-show-sensitive", motion: "avia-motion" };
  var DEFAULTS = { fontSize: "standard", sensitive: "0", motion: "system" };
  var ALLOWED = {
    fontSize: ["small", "standard", "large", "xlarge"],
    sensitive: ["0", "1"],
    motion: ["system", "reduce"],
  };

  function read(name) {
    var value = null;
    try { value = window.localStorage.getItem(KEYS[name]); } catch (err) { /* 無痕或封鎖時就用預設 */ }
    return ALLOWED[name].indexOf(value) >= 0 ? value : DEFAULTS[name];
  }
  function write(name, value) {
    try { window.localStorage.setItem(KEYS[name], value); return true; } catch (err) { return false; }
  }
  function apply() {
    var root = document.documentElement;
    root.setAttribute("data-font-size", read("fontSize"));
    root.setAttribute("data-motion", read("motion"));
  }
  apply();

  // 設定頁：選了就存、馬上套用
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector("[data-prefs-form]");
    if (!form) return;
    var status = form.querySelector("[data-prefs-status]");
    var fields = { fontSize: "font-size", sensitive: "sensitive", motion: "motion" };

    function sync() {
      Object.keys(fields).forEach(function (name) {
        var input = form.querySelector('input[name="' + fields[name] + '"][value="' + read(name) + '"]');
        if (input) input.checked = true;
      });
    }
    function say(text) { if (status) status.textContent = text; }

    sync();
    form.addEventListener("change", function (event) {
      var name = Object.keys(fields).filter(function (key) { return fields[key] === event.target.name; })[0];
      if (!name) return;
      var saved = write(name, event.target.value);
      apply();
      say(saved ? "已儲存在這台瀏覽器。" : "這個瀏覽器不允許儲存設定（可能是無痕模式），只會套用到這一頁。");
    });
    form.querySelector("[data-prefs-reset]").addEventListener("click", function () {
      Object.keys(KEYS).forEach(function (name) {
        try { window.localStorage.removeItem(KEYS[name]); } catch (err) { /* 忽略 */ }
      });
      apply();
      sync();
      say("已恢復預設。");
    });
  });
})();
