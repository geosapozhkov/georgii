import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type Box = { x: number; y: number; w: number; h: number };

export function WindowFrame({
  title,
  line,
  hue,
  box,
  z,
  focused,
  narrow,
  minimized,
  onFocus,
  onClose,
  onMinimize,
  onChange,
  children,
}: {
  title: string;
  line: string;
  hue: string;
  box: Box;
  z: number;
  focused: boolean;
  narrow: boolean;
  minimized: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onChange: (box: Box) => void;
  children: ReactNode;
}) {
  const frame = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; edge: string; start: Box; cx: number; cy: number } | null>(null);

  function begin(event: ReactPointerEvent, edge: string) {
    if (narrow || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    onFocus();
    frame.current?.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, edge, start: box, cx: event.clientX, cy: event.clientY };
  }

  function move(event: ReactPointerEvent) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.cx;
    const dy = event.clientY - current.cy;
    const next = { ...current.start };
    if (current.edge === "move") {
      next.x = current.start.x + dx;
      next.y = Math.max(8, current.start.y + dy);
    } else {
      if (current.edge.includes("e")) next.w = Math.max(420, current.start.w + dx);
      if (current.edge.includes("s")) next.h = Math.max(300, current.start.h + dy);
      if (current.edge.includes("w")) {
        next.w = Math.max(420, current.start.w - dx);
        next.x = current.start.x + current.start.w - next.w;
      }
      if (current.edge.includes("n")) {
        next.h = Math.max(300, current.start.h - dy);
        next.y = Math.max(8, current.start.y + current.start.h - next.h);
      }
    }
    onChange(next);
  }

  function end(event: ReactPointerEvent) {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  }

  return (
    <section
      ref={frame}
      className={focused ? "window front" : "window"}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: z, display: minimized ? "none" : undefined }}
      onPointerDown={() => onFocus()}
      onPointerMove={move}
      onPointerUp={end}
    >
      <header className="window-title" onPointerDown={(event) => begin(event, "move")}>
        <i className="pip" style={{ background: hue }} />
        <div>
          <strong>{title}</strong>
          <em>{line}</em>
        </div>
        <div className="window-actions">
          <button type="button" aria-label={`Minimize ${title}`} onClick={onMinimize}>
            –
          </button>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>
            ×
          </button>
        </div>
      </header>
      <div className="window-body">{children}</div>
      {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((edge) => (
        <i key={edge} className={`resize ${edge}`} onPointerDown={(event) => begin(event, edge)} />
      ))}
    </section>
  );
}
