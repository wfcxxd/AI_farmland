export function insertMainBackground() {
  const existing = document.querySelector(".main-background");
  if (existing) return;

  const bg = document.createElement("div");
  bg.className = "main-background";
  document.body.insertBefore(bg, document.body.firstChild);


  const value = getComputedStyle(document.documentElement).getPropertyValue("--sidebar-w");
  bg.style.setProperty("left", value.trim(), "important");
}
