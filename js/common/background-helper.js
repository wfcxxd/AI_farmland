export function insertMainBackground(container) {
    
  let bg = container.querySelector(".main-background");
  if (!bg) {
    bg = document.createElement("div");
    bg.className = "main-background";
    container.insertBefore(bg, container.firstChild);
  }
}
