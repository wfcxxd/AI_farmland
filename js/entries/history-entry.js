/* ============ history-entry.js · 历史数据页入口 ============ */
import { applyTheme } from "../common/theme.js";
import { insertMainBackground } from "../common/background-helper.js";
import { initSidebarToggle } from "../common/toggle-sidebar.js";
import { showHistoryData } from "../modules/history.js";

applyTheme();

const container = document.querySelector(".main-data");
showHistoryData(container);
insertMainBackground(container);
initSidebarToggle();
