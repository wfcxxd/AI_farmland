/* ============ settings-entry.js · 设置页入口 ============ */
import { applyTheme } from "../common/theme.js";
import { insertMainBackground } from "../common/background-helper.js";
import { initSidebarToggle } from "../common/toggle-sidebar.js";
import { showSettings } from "../modules/settings.js";

applyTheme();

const container = document.querySelector(".main-data");
showSettings(container);
insertMainBackground(container);
initSidebarToggle();
