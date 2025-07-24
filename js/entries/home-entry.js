import { insertMainBackground } from "../common/background-helper.js";
import { showHome, startHomeAutoRefresh } from "../modules/home.js";

const container = document.querySelector(".main-data");
insertMainBackground(container);
showHome(container);
startHomeAutoRefresh();

import { initSidebarToggle } from "../common/toggle-sidebar.js";
initSidebarToggle();
