/* ============ home-entry.js · 主页入口：挂载仪表盘与农田动画 ============ */
import { applyTheme } from "../common/theme.js";
import { insertMainBackground } from "../common/background-helper.js";
import { initSidebarToggle } from "../common/toggle-sidebar.js";
import { showHome, startHomeAutoRefresh } from "../modules/home.js";

applyTheme();

const container = document.querySelector(".main-data");
insertMainBackground(container);
showHome(container);
startHomeAutoRefresh();
initSidebarToggle();
