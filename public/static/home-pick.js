// 首頁「隨機抽一個」：打開頁面時從 /data/picks.json 換成隨機的一張梗圖或一條黑歷史。
// 讀不到就保留建置時抽好的那一個。
(function () {
  var slot = document.querySelector("[data-home-pick]");
  if (!slot) return;
  function make(tag, props, text) {
    var element = Object.assign(document.createElement(tag), props || {});
    if (text !== undefined) element.textContent = text;
    return element;
  }
  fetch("/data/picks.json", { credentials: "same-origin" })
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(function (picks) {
      if (!Array.isArray(picks) || !picks.length) return;
      var pick = picks[Math.floor(Math.random() * picks.length)];
      if (pick.kind === "meme") {
        var link = make("a", { className: "home-pick-image", href: pick.url, target: "_blank", rel: "noopener" });
        link.append(make("img", { src: pick.url, alt: pick.alt, loading: "lazy" }));
        slot.replaceChildren(link, make("p", { className: "home-pick-label" }, "來自「鼠兔各種梗圖」"));
      } else {
        var text = make("p", { className: "home-pick-text" });
        if (pick.url) text.append(make("a", { href: pick.url, target: "_blank", rel: "noopener noreferrer" }, pick.text));
        else text.textContent = pick.text;
        slot.replaceChildren(make("p", { className: "home-pick-label" }, "黑歷史 #" + pick.number), text);
      }
    })
    .catch(function () { /* 保留建置時抽好的那一個 */ });
})();
