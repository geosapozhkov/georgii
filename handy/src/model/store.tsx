import { produce, type Draft } from "immer";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadProject, saveProject } from "./persist";
import { createDefaultProject } from "./project";
import type { Project } from "./types";

export type HistoryMode = "push" | "coalesce" | "end";

type ProjectApi = {
  project: Project;
  ready: boolean;
  saveState: "saving" | "saved" | "memory";
  canUndo: boolean;
  canRedo: boolean;
  commit: (recipe: (draft: Draft<Project>) => void, history?: HistoryMode) => void;
  undo: () => void;
  redo: () => void;
  openProject: (project: Project) => void;
  newProject: () => void;
};

const ProjectContext = createContext<ProjectApi | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project>(() => createDefaultProject());
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<ProjectApi["saveState"]>("memory");
  const [historyTick, setHistoryTick] = useState(0);
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const coalescing = useRef(false);

  useEffect(() => {
    let alive = true;
    loadProject().then((saved) => {
      if (!alive) return;
      if (saved) setProject(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      saveProject(project).then(
        () => setSaveState("saved"),
        () => setSaveState("memory"),
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [project, ready]);

  const commit = useCallback((recipe: (draft: Draft<Project>) => void, history: HistoryMode = "push") => {
    setProject((current) => {
      if (history === "end") coalescing.current = false;
      const next = produce(current, recipe);
      if (next === current) return current;
      const shouldPush = history === "push" || (history === "coalesce" && !coalescing.current);
      if (shouldPush) {
        past.current.push(current);
        if (past.current.length > 40) past.current.shift();
        future.current = [];
      }
      if (history === "coalesce") coalescing.current = true;
      return next;
    });
    setHistoryTick((tick) => tick + 1);
  }, []);

  const undo = useCallback(() => {
    coalescing.current = false;
    setProject((current) => {
      const previous = past.current.pop();
      if (!previous) return current;
      future.current.push(current);
      return previous;
    });
    setHistoryTick((tick) => tick + 1);
  }, []);

  const redo = useCallback(() => {
    coalescing.current = false;
    setProject((current) => {
      const next = future.current.pop();
      if (!next) return current;
      past.current.push(current);
      return next;
    });
    setHistoryTick((tick) => tick + 1);
  }, []);

  const openProject = useCallback((next: Project) => {
    coalescing.current = false;
    setProject((current) => {
      past.current.push(current);
      future.current = [];
      return next;
    });
    setHistoryTick((tick) => tick + 1);
  }, []);

  const newProject = useCallback(() => {
    openProject(createDefaultProject());
  }, [openProject]);

  const api = useMemo<ProjectApi>(
    () => ({
      project,
      ready,
      saveState,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      commit,
      undo,
      redo,
      openProject,
      newProject,
    }),
    [project, ready, saveState, historyTick, commit, undo, redo, openProject, newProject],
  );

  return <ProjectContext.Provider value={api}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectApi {
  const api = useContext(ProjectContext);
  if (!api) throw new Error("Handy project is missing.");
  return api;
}
