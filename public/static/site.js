"use strict";

document.querySelectorAll("[data-copy-url]").forEach((button) => {
  const label = button.textContent;
  let resetLabel;
  button.addEventListener("click", async () => {
    const status = document.querySelector(".copy-status");
    const url = button.dataset.copyUrl;
    clearTimeout(resetLabel);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "正在複製…";
    button.dataset.copyState = "pending";
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      button.dataset.copyState = "copied";
      button.textContent = "已複製連結";
      if (status) status.textContent = "連結已複製。";
    } catch {
      button.dataset.copyState = "error";
      button.textContent = "再次複製";
      if (status) {
        status.textContent = "瀏覽器無法自動複製，請選取下方連結：";
        const link = document.createElement("input");
        link.type = "text";
        link.readOnly = true;
        link.value = url;
        link.setAttribute("aria-label", "筆記永久連結");
        status.appendChild(link);
        link.select();
      }
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      resetLabel = setTimeout(() => {
        button.textContent = label;
        delete button.dataset.copyState;
      }, 2400);
    }
  });
});

// Enhance native GET navigation without intercepting links or changing the request.
document.querySelectorAll("form[data-search-form]").forEach((form) => {
  const button = form.querySelector("button[type='submit']");
  if (!button) return;
  const label = button.textContent;
  const reset = () => {
    form.removeAttribute("aria-busy");
    button.disabled = false;
    button.textContent = label;
  };
  form.addEventListener("submit", (event) => {
    if (event.defaultPrevented) return;
    form.setAttribute("aria-busy", "true");
    button.disabled = true;
    button.textContent = "搜尋中…";
  });
  // Restores controls when the browser returns this document from its page cache.
  window.addEventListener("pageshow", reset);
});

document.querySelector("[data-error-summary]")?.focus();

// Overflow stays local to the table, with a named keyboard-operable scroll region.
document.querySelectorAll(".table-scroll").forEach((region, index) => {
  const help = document.createElement("p");
  help.id = `table-scroll-help-${index}`;
  help.className = "field-help";
  help.textContent = "可左右滑動，或聚焦表格後使用方向鍵。";
  region.after(help);
  const update = () => {
    const overflows = region.scrollWidth > region.clientWidth + 1;
    help.hidden = !overflows;
    if (overflows) {
      region.tabIndex = 0;
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", region.closest("section")?.querySelector("h2")?.textContent || "資料表格");
      region.setAttribute("aria-describedby", help.id);
    } else {
      region.removeAttribute("tabindex");
      region.removeAttribute("role");
      region.removeAttribute("aria-label");
      region.removeAttribute("aria-describedby");
    }
  };
  update();
  if ("ResizeObserver" in window) new ResizeObserver(update).observe(region);
  else window.addEventListener("resize", update);
});

// Only the long-form editor needs an unsaved-change guard. Submitting normally
// still lets the server validate and save the existing version/CSRF fields.
document.querySelectorAll("form.editor-form").forEach((form) => {
  const fingerprint = () => JSON.stringify(Array.from(new FormData(form).entries()));
  const saved = fingerprint();
  let submitting = false;
  const guard = (event) => {
    if (!submitting && fingerprint() !== saved) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  const updateGuard = () => {
    if (!submitting && fingerprint() !== saved) window.addEventListener("beforeunload", guard);
    else window.removeEventListener("beforeunload", guard);
  };
  form.addEventListener("input", updateGuard);
  form.addEventListener("change", updateGuard);
  form.addEventListener("submit", (event) => {
    if (!event.defaultPrevented) {
      submitting = true;
      updateGuard();
    }
  });
  // Stop other POSTs before they reach the server while this edit is unresolved.
  document.addEventListener("submit", (event) => {
    if (event.target === form || fingerprint() === saved) return;
    event.preventDefault();
    let notice = document.querySelector("#unsaved-change-notice");
    if (!notice) {
      notice = document.createElement("p");
      notice.id = "unsaved-change-notice";
      notice.className = "flash flash-error";
      notice.setAttribute("role", "alert");
      notice.tabIndex = -1;
      notice.textContent = "還有未儲存的編輯。請先儲存筆記，或將欄位還原後再執行其他操作。";
      form.before(notice);
    }
    notice.focus();
  });
  window.addEventListener("pageshow", () => {
    submitting = false;
    updateGuard();
  });
  // Reset uses the form's original values and should stop warning once complete.
  form.addEventListener("reset", () => {
    setTimeout(updateGuard, 0);
  });
});
