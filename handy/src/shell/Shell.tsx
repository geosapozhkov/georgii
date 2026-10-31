import { useEffect, useRef, useState } from "react";
import { parseProjectFile, serializeProject } from "../model/project";
import { useProject } from "../model/store";
import type { StudioId } from "../model/types";
import { Animation } from "../studios/Animation";
import { Formulation } from "../studios/Formulation";
import { Game } from "../studios/Game";
import { Idea } from "../studios/Idea";
import { Rendering } from "../studios/Rendering";
import { Thinking } from "../studios/Thinking";
import { downloadText, isTyping } from "../ui";
import { ErrorBoundary } from "./ErrorBoundary";
import { ROOMS } from "./meta";
import { WindowFrame } from "./WindowFrame";

type Win = { id: StudioId; x: number; y: number; w: number; h: number; z: number; minimized: boolean };
type InstallPrompt = Event & { prompt: () => Promise<void> };

const roomView = {
  thinking: Thinking,
  formulation: Formulation,
  rendering: Rendering,
  idea: Idea,
  animation: Animation,
  game: Game,
};

export function Shell() {
  const { project, ready, saveState, canUndo, canRedo, commit, undo, redo, openProject, newProject } = useProject();
  const [windows, setWindows] = useState<Win[]>(loadLayout);
  const [menu, setMenu] = useState<"file" | "edit" | "rooms" | null>(null);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const zRef = useRef(10);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 860px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("handy.v1.windows", JSON.stringify(windows));
  }, [windows]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const display = window.matchMedia("(display-mode: standalone)").matches;
    const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setStandalone(display || ios);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function open(id: StudioId) {
    setMenu(null);
    setWindows((current) => {
      const z = ++zRef.current;
      const existing = current.find((win) => win.id === id);
      if (existing) return current.map((win) => (win.id === id ? { ...win, minimized: false, z } : win));
      const index = ROOMS.findIndex((room) => room.id === id);
      const w = Math.min(980, Math.max(420, window.innerWidth - 48));
      const h = Math.min(680, Math.max(320, window.innerHeight - 150));
      return [...current, { id, x: 36 + index * 28, y: 24 + index * 22, w, h, z, minimized: false }];
    });
  }

  const active = windows.filter((win) => !win.minimized);
  const top = active.reduce<Win | null>((best, win) => (!best || win.z > best.z ? win : best), null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        downloadText(`${safeName(project.name)}.handy.json`, serializeProject(project));
      } else if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        setHelp((value) => !value);
      } else if (!meta && event.key >= "1" && event.key <= "6") {
        const room = ROOMS[Number(event.key) - 1];
        if (room) open(room.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, undo, redo]);

  if (!ready) {
    return (
      <div className="splash">
        <strong>Handy</strong>
      </div>
    );
  }

  return (
    <div className="app" onPointerDown={() => setMenu(null)}>
      <header className="topbar">
        <div className="brand">
          <button type="button" onClick={() => setWindows([])}>
            Handy
          </button>
        </div>
        <div className="menus" onPointerDown={(event) => event.stopPropagation()}>
          <div className="menu">
            <button type="button" onClick={() => setMenu(menu === "file" ? null : "file")}>
              File
            </button>
            {menu === "file" && (
              <div className="menu-pop">
                <button type="button" onClick={() => { newProject(); setMenu(null); }}>New project</button>
                <button type="button" onClick={() => { fileRef.current?.click(); setMenu(null); }}>Open…</button>
                <button
                  type="button"
                  onClick={() => {
                    downloadText(`${safeName(project.name)}.handy.json`, serializeProject(project));
                    setMenu(null);
                  }}
                >
                  Save file
                </button>
                <button type="button" onClick={() => { setHelp(true); setMenu(null); }}>Install and shortcuts</button>
              </div>
            )}
          </div>
          <div className="menu">
            <button type="button" onClick={() => setMenu(menu === "edit" ? null : "edit")}>
              Edit
            </button>
            {menu === "edit" && (
              <div className="menu-pop">
                <button type="button" disabled={!canUndo} onClick={() => { undo(); setMenu(null); }}>Undo</button>
                <button type="button" disabled={!canRedo} onClick={() => { redo(); setMenu(null); }}>Redo</button>
              </div>
            )}
          </div>
          <div className="menu">
            <button type="button" onClick={() => setMenu(menu === "rooms" ? null : "rooms")}>
              Rooms
            </button>
            {menu === "rooms" && (
              <div className="menu-pop">
                {ROOMS.map((room, index) => (
                  <button type="button" key={room.id} onClick={() => open(room.id)}>
                    {index + 1}. {room.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <input
          className="project-name"
          aria-label="Project name"
          value={project.name}
          onChange={(event) => commit((draft) => { draft.name = event.target.value; }, "coalesce")}
          onBlur={() => commit((draft) => { draft.name = draft.name.trim() || "Untitled"; }, "end")}
        />
        <span className="save-state">{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "In this tab"}</span>
        {install && !standalone && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void install.prompt();
              setInstall(null);
            }}
          >
            Install
          </button>
        )}
      </header>
      <main className="desk">
        <div className="watermark">Handy</div>
        {windows.length === 0 && (
          <div className="home">
            <h1>One desk.</h1>
            <p className="lede">
              Open a room on top of this desk. Keep several open, move work between them, and the project stays on this device.
            </p>
            <div className="flow">
              <span>Thinking feeds Idea</span>
              <span>Formulation feeds Rendering and Game</span>
              <span>Rendering frames feed Animation</span>
            </div>
            <div className="cards">
              {ROOMS.map((room) => (
                <button type="button" className="card" key={room.id} onClick={() => open(room.id)}>
                  <i style={{ background: room.hue }} />
                  <span>
                    <b>{room.title}</b>
                    <br />
                    <em>{room.line}</em>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {windows.map((win) => {
          const room = ROOMS.find((item) => item.id === win.id)!;
          const View = roomView[win.id];
          const shown = !win.minimized && (!narrow || win.id === top?.id);
          return (
            <WindowFrame
              key={win.id}
              title={room.title}
              line={room.line}
              hue={room.hue}
              box={win}
              z={win.z}
              focused={win.id === top?.id}
              narrow={narrow}
              minimized={win.minimized}
              onFocus={() =>
                setWindows((current) => current.map((item) => (item.id === win.id ? { ...item, z: ++zRef.current } : item)))
              }
              onClose={() => setWindows((current) => current.filter((item) => item.id !== win.id))}
              onMinimize={() => setWindows((current) => current.map((item) => (item.id === win.id ? { ...item, minimized: true } : item)))}
              onChange={(box) => setWindows((current) => current.map((item) => (item.id === win.id ? { ...item, ...box } : item)))}
            >
              <ErrorBoundary name={room.title}>
                <View focused={shown && win.id === top?.id} visible={shown} onOpen={open} />
              </ErrorBoundary>
            </WindowFrame>
          );
        })}
      </main>
      <footer className="dock">
        {ROOMS.map((room) => {
          const openWin = windows.find((win) => win.id === room.id);
          return (
            <button
              type="button"
              key={room.id}
              className={openWin && !openWin.minimized ? "open" : ""}
              aria-pressed={Boolean(openWin && !openWin.minimized)}
              onClick={() => open(room.id)}
            >
              <i style={{ background: room.hue }} />
              {room.title}
            </button>
          );
        })}
      </footer>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.handy.json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            openProject(parseProjectFile(await file.text()));
            setToast(`Opened ${file.name}`);
          } catch (error) {
            setToast(error instanceof Error ? error.message : "Could not open that file.");
          }
        }}
      />
      {toast && <div className="toast">{toast}</div>}
      {help && (
        <div className="help" onClick={() => setHelp(false)}>
          <div className="help-card" onClick={(event) => event.stopPropagation()}>
            <h2>Keep Handy on this device</h2>
            <ul>
              <li>Windows and macOS: in Chrome or Edge, choose Install Handy. Use the Install button when it appears.</li>
              <li>iPhone: in Safari, Share, then Add to Home Screen.</li>
              <li>Android: in Chrome, Install app or Add to Home screen.</li>
              <li>From the downloaded folder, run npm install and npm start, then open the address it prints. A phone on the same Wi-Fi can use that address too.</li>
            </ul>
            <h2>Shortcuts</h2>
            <ul>
              <li>1 through 6 open the rooms.</li>
              <li>Ctrl or Cmd S saves a project file. Ctrl or Cmd Z undoes.</li>
              <li>? opens this panel.</li>
              <li>The project also saves itself in this browser.</li>
            </ul>
            <button type="button" className="ghost" onClick={() => setHelp(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function loadLayout(): Win[] {
  try {
    const raw = sessionStorage.getItem("handy.v1.windows");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Win[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((win) => ROOMS.some((room) => room.id === win.id) && Number.isFinite(win.w) && Number.isFinite(win.h));
  } catch {
    return [];
  }
}

function safeName(name: string): string {
  return name.trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "handy";
}
