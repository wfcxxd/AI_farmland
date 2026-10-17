/* ============ ui.js · 空状态与错误提示的统一渲染 ============ */
/**
 * 把提示写进容器（替换原有内容）。
 * @param {HTMLElement} el
 * @param {string} text
 * @param {"empty"|"error"|"ok"} [kind="empty"] 决定颜色
 */
export function setNotice(el, text, kind = "empty") {
  if (!el) return;
  const kindClass = kind === "empty" ? "" : ` ${kind === "error" ? "err" : "ok"}`;
  el.innerHTML = `<p class="empty-hint${kindClass}">${escapeHtml(text)}</p>`;
}

/** 只改文字、不动结构 */
export function setText(el, text) {
  if (el) el.textContent = text;
}

/** 转义 HTML，避免外部数据里的标签被当成结构 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
