import { insertMainBackground } from "../common/background-helper.js";
import { showDetails, startDetailsAutoRefresh } from "../modules/details.js";

const container = document.querySelector(".main-data");
showDetails(container);
insertMainBackground(container);
startDetailsAutoRefresh();

import { initSidebarToggle } from "../common/toggle-sidebar.js";
initSidebarToggle();
