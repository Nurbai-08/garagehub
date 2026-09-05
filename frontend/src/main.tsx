import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { AppProviders } from "@/app/providers/AppProviders";
import "@/app/styles/index.css";
import "@/app/styles/profile.css";
import "@/app/styles/polish.css";
import "@/app/styles/home-enhancements.css";
import "@/app/styles/social-theme.css";
import "@/app/styles/mobile.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
