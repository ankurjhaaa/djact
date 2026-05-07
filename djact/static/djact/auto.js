import { bootstrap } from "./core.js";
import { initNavigate } from "./navigate.js";
import { initDebug } from "./debug.js";

function init() {
	initDebug();
	bootstrap();
	initNavigate();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
