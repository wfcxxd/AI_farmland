import { insertMainBackground } from "../common/background-helper.js";
import { showHistoryData } from "../modules/history.js";

const container = document.querySelector(".main-data");
showHistoryData(container);
insertMainBackground(container);

import { initSidebarToggle } from "../common/toggle-sidebar.js";
initSidebarToggle();
