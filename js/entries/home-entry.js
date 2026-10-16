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
