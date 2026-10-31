const KEY = "handy.v1.night";

export function nightPreferred(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {
    /* storage can be blocked */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyNight(night: boolean) {
  document.documentElement.dataset.theme = night ? "night" : "day";
  try {
    localStorage.setItem(KEY, night ? "1" : "0");
  } catch {
    /* storage can be blocked */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#2a2a2a" : "#e6e6e6");
}

export function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function themeGrey() {
  const night = document.documentElement.dataset.theme === "night";
  return night
    ? { background: 0x2a2a2a, floor: "#3a3a3a", grid: "#6e6e6e", gridMinor: "#454545", stage: "#2a2a2a" }
    : { background: 0xd9d9d9, floor: "#c8c8c8", grid: "#8a8a8a", gridMinor: "#bdbdbd", stage: "#d9d9d9" };
}
