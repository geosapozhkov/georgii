import "@fontsource/fraunces/600.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import { createRoot } from "react-dom/client";
import { ProjectProvider } from "./model/store";
import { Shell } from "./shell/Shell";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <ProjectProvider>
      <Shell />
    </ProjectProvider>,
  );
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
