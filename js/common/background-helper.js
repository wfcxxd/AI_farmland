/**
 * 插入主区域背景图。
 * 原来这里会把 .main-background 的 left 推到一个 --sidebar-w 位置，
 * 但该元素本来就设了 left:0/right:0，再覆盖 left 会让背景只铺在侧栏右侧、
 * 并且和侧栏的收起动画不同步。背景应当整幅铺满，这里不再改 left。
 */
export function insertMainBackground() {
  if (document.querySelector(".main-background")) return;

  const bg = document.createElement("div");
  bg.className = "main-background";
  document.body.insertBefore(bg, document.body.firstChild);
}
