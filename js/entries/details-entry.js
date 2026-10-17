/* ============ details-entry.js · 数据图表页入口 ============ */
import { applyTheme } from "../common/theme.js";
import { insertMainBackground } from "../common/background-helper.js";
import { initSidebarToggle } from "../common/toggle-sidebar.js";
import { showDetails, startDetailsAutoRefresh } from "../modules/details.js";
import { getRefreshIntervalMs } from "../modules/settings.js";

applyTheme();

const container = document.querySelector(".main-data");
showDetails(container);
insertMainBackground(container);
// 用「设置」页里保存的刷新间隔，别再写死
startDetailsAutoRefresh(getRefreshIntervalMs());
initSidebarToggle();
