/* ============ background-helper.js · 插入主区域背景图 ============ */
export function insertMainBackground() {
  if (document.querySelector(".main-background")) return;

  const bg = document.createElement("div");
  bg.className = "main-background";
  document.body.insertBefore(bg, document.body.firstChild);
}
