import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// One reveal gate: coordinate font readiness and first paint before revealing
function triggerAppReady() {
  if (document.documentElement.classList.contains("is-ready")) return;

  // Double requestAnimationFrame ensures initial layout and first frame have been computed and painted
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("is-loading");
      document.documentElement.classList.add("is-ready");
    });
  });
}

// Ensure slow or blocked font loading never delays page presentation past 1200ms
const fontPromise = "fonts" in document ? document.fonts.ready : Promise.resolve();
const fontTimeoutPromise = new Promise((resolve) => setTimeout(resolve, 1200));

Promise.race([fontPromise, fontTimeoutPromise])
  .then(triggerAppReady)
  .catch(triggerAppReady);

