// 「再抽一句」：第一次按時讀 /data/quotes.json，之後在瀏覽器裡隨機換一句，不連續抽到同一句。
(function () {
  var stage = document.querySelector("[data-quote-url]");
  var quote = document.getElementById("profile-quote");
  var button = document.getElementById("profile-next-quote");
  if (!stage || !quote || !button) return;
  var quotes = null;

  function load() {
    if (quotes) return Promise.resolve(quotes);
    return fetch(stage.getAttribute("data-quote-url"), { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) throw new Error("empty");
        quotes = list;
        return list;
      });
  }

  button.addEventListener("click", function () {
    button.disabled = true;
    load()
      .then(function (list) {
        var current = Number(quote.getAttribute("data-index"));
        var choices = list.map(function (_, index) { return index; }).filter(function (index) { return index !== current; });
        var index = choices.length ? choices[Math.floor(Math.random() * choices.length)] : 0;
        quote.textContent = list[index];
        quote.setAttribute("data-index", String(index));
        quote.classList.remove("is-popping");
        void quote.offsetWidth;
        quote.classList.add("is-popping");
      })
      .catch(function () {
        quote.textContent = "抽不到，請重新整理頁面後再試一次";
      })
      .then(function () {
        button.disabled = false;
      });
  });
})();
