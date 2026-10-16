/**
 * 页面渲染的小工具。
 *
 * 解决的问题：三个页面各自用不同方式往容器里塞「空状态/错误提示」，
 * 有的用 innerHTML 拼字符串、有的用 textContent 改现成元素，
 * 样式类也各写各的。统一走这里。
 */

/**
 * 把一段提示写进容器（替换原有内容）。
 *
 * @param {HTMLElement} el        目标容器
 * @param {string} text           提示文字
 * @param {"empty"|"error"|"ok"} [kind="empty"] 决定样式：
 *        empty = 灰色空状态，error = 红色，ok = 绿色
 */
export function setNotice(el, text, kind = "empty") {
  if (!el) return;
  const kindClass = kind === "empty" ? "" : ` ${kind === "error" ? "err" : "ok"}`;
  el.innerHTML = `<p class="empty-hint${kindClass}">${escapeHtml(text)}</p>`;
}

/** 只改文字、不动结构（给已经有样式的元素用，比如 .alarm-none） */
export function setText(el, text) {
  if (el) el.textContent = text;
}

/**
 * 转义 HTML，避免服务器返回的字段里带标签把页面搞乱。
 * 目前只在 setNotice 里用；以后往模板字符串里插外部数据都应该过一遍。
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
