const savedTheme = localStorage.getItem("theme") ?? "light";
document.body.classList.add(`theme-${savedTheme}`);

import { insertMainBackground } from "../common/background-helper.js";
import { showSettings} from "../modules/settings.js";

const container = document.querySelector(".main-data");
showSettings(container);
insertMainBackground(container);

import { initSidebarToggle } from "../common/toggle-sidebar.js";
initSidebarToggle();