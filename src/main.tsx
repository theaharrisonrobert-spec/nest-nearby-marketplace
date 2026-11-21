import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

if (import.meta.env.DEV) {
  const logInputEvent = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select")) return;
    const name = target.getAttribute("name") || target.tagName.toLowerCase();
    console.log(`[RentReady input debug] ${event.type} reached ${name}`);
  };
  document.addEventListener("focusin", logInputEvent, true);
  document.addEventListener("input", logInputEvent, true);
}

createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
