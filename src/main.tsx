import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installKeyboardFix } from "./lib/keyboard";
import { hideSplash } from "./lib/splash";
import "./styles.css";

installKeyboardFix();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

hideSplash();
