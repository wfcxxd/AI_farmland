/* ============ theme.js · 深浅主题切换 ============ */
const THEMES = ["light", "dark"];

/** 主题变化事件名，图表等模块监听它来重绘 */
export const THEME_EVENT = "dsh:themechange";

export function getTheme() {
  // 地址栏 ?theme=dark 可临时强制主题（方便截图、演示、给评委看）
  const forced = readForcedTheme();
  if (forced) return forced;

  try {
    const saved = localStorage.getItem("theme");
    return THEMES.includes(saved) ? saved : "light";
  } catch {
    return "light";
  }
}

/** 读取 ?theme= 参数，只接受受支持的取值 */
function readForcedTheme() {
  try {
    const v = new URLSearchParams(location.search).get("theme");
    return THEMES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme = getTheme()) {
  const next = THEMES.includes(theme) ? theme : "light";

  document.documentElement.dataset.theme = next;
  // 兼容仍然按 body class 写的样式（比如 body.theme-dark .xxx）
  document.body.classList.remove(...THEMES.map((t) => `theme-${t}`));
  document.body.classList.add(`theme-${next}`);

  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: next } }));
  return next;
}

/** 保存并立即应用主题 */
export function saveTheme(theme) {
  const next = THEMES.includes(theme) ? theme : "light";
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* 隐私模式下写不了 localStorage，忽略即可 */
  }
  return applyTheme(next);
}

export { THEMES };
