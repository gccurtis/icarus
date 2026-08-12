import { mount } from "svelte";

import App from "#src/App.svelte";
import "#style/app.css";

const target = document.querySelector("#app");
if (!(target instanceof HTMLElement)) throw new Error("No #app element in the document.");

// Svelte 5 mounts through mount(); `new App({ target })` is the Svelte 4 API.
mount(App, { target });
