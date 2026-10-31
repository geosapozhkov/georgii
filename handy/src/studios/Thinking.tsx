import { useEffect, useRef, useState } from "react";
import { uid } from "../model/ids";
import { useProject } from "../model/store";
import type { DesignNode } from "../model/types";
import type { StudioProps } from "../shell/meta";
import { ColorField, IconButton, Slider, TextField, isTyping, measureText } from "../ui";

type Tool = "select" | "hand" | "frame" | "rect" | "ellipse" | "text" | "pen";
type Drag =
  | { kind: "pan"; sx: number; sy: number; cx: number; cy: number }
  | { kind: "move"; id: string; x: number; y: number; node: DesignNode }
  | { kind: "resize"; handle: string; node: DesignNode }
  | { kind: "create"; tool: Tool; x: number; y: number };

const palette = ["#f4efe6", "#ffb000", "#ff6b4a", "#7eb6ff", "#7dcfb6", "#c77dff"];

export function Thinking({ focused, onOpen }: StudioProps) {
  const { project, commit } = useProject();
  const nodes = project.thinking.nodes;
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>("title");
  const [cam, setCam] = useState({ x: 70, y: 36, zoom: 0.72 });
  const [ghost, setGhost] = useState<DesignNode | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [penId, setPenId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const camRef = useRef(cam);
  const drag = useRef<Drag | null>(null);
  const ghostRef = useRef<DesignNode | null>(null);
  camRef.current = cam;

  const shown = nodes.map((node) => (ghost && ghost.id === node.id ? ghost : node));
  if (ghost && !nodes.some((node) => node.id === ghost.id)) shown.push(ghost);
  const selected = shown.find((node) => node.id === selectedId) ?? null;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      setCam((current) => {
        const zoom = Math.min(6, Math.max(0.12, current.zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
        const wx = (sx - current.x) / current.zoom;
        const wy = (sy - current.y) / current.zoom;
        return { zoom, x: sx - wx * zoom, y: sy - wy * zoom };
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!focused) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        commit((draft) => {
          draft.thinking.nodes = draft.thinking.nodes.filter((node) => node.id !== selectedId);
        });
        setSelectedId(null);
      }
      if (event.key === "Escape") setPenId(null);
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if ((dx || dy) && selectedId) {
        event.preventDefault();
        commit((draft) => {
          const node = draft.thinking.nodes.find((item) => item.id === selectedId);
          if (!node) return;
          node.x += dx;
          node.y += dy;
          node.points = node.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, selectedId, commit]);

  function world(event: { clientX: number; clientY: number }) {
    const rect = stageRef.current!.getBoundingClientRect();
    const current = camRef.current;
    return {
      sx: event.clientX - rect.left,
      sy: event.clientY - rect.top,
      x: (event.clientX - rect.left - current.x) / current.zoom,
      y: (event.clientY - rect.top - current.y) / current.zoom,
    };
  }

  function showGhost(node: DesignNode | null) {
    ghostRef.current = node;
    setGhost(node);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 && event.button !== 1) return;
    const point = world(event);
    stageRef.current?.setPointerCapture(event.pointerId);
    const handle = (event.target as HTMLElement).dataset.handle;
    if (tool === "hand" || event.button === 1) {
      drag.current = { kind: "pan", sx: event.clientX, sy: event.clientY, cx: camRef.current.x, cy: camRef.current.y };
      return;
    }
    if (tool === "pen") {
      addPenPoint(point.x, point.y, event.detail >= 2);
      return;
    }
    if (tool !== "select") {
      drag.current = { kind: "create", tool, x: point.x, y: point.y };
      return;
    }
    if (handle && selected) {
      drag.current = { kind: "resize", handle, node: structuredClone(selected) };
      return;
    }
    const hit = [...shown].reverse().find((node) => node.opacity > 0 && hits(node, point.x, point.y));
    if (hit) {
      setSelectedId(hit.id);
      if (event.detail >= 2 && hit.kind === "text") setEditing(hit.id);
      drag.current = { kind: "move", id: hit.id, x: point.x, y: point.y, node: structuredClone(hit) };
    } else setSelectedId(null);
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = drag.current;
    if (!current) return;
    const point = world(event);
    if (current.kind === "pan") {
      setCam((cam) => ({ ...cam, x: current.cx + event.clientX - current.sx, y: current.cy + event.clientY - current.sy }));
      return;
    }
    if (current.kind === "move") {
      const dx = point.x - current.x;
      const dy = point.y - current.y;
      showGhost({
        ...current.node,
        x: current.node.x + dx,
        y: current.node.y + dy,
        points: current.node.points.map((item) => ({ x: item.x + dx, y: item.y + dy })),
      });
      return;
    }
    if (current.kind === "resize") {
      showGhost(resizeNode(current.node, current.handle, point.x, point.y));
      return;
    }
    const box = boxFrom(current.x, current.y, point.x, point.y);
    const kind = current.tool === "frame" ? "frame" : current.tool === "ellipse" ? "ellipse" : current.tool === "text" ? "text" : "rect";
    showGhost(makeNode(kind, box.x, box.y, Math.max(box.w, 1), Math.max(box.h, 1), nodes.length));
  }

  function onPointerUp() {
    const current = drag.current;
    const next = ghostRef.current;
    drag.current = null;
    if (!current || current.kind === "pan") return;
    if (current.kind === "create" && next) {
      const node = next.w < 8 && next.h < 8 ? { ...next, w: next.kind === "text" ? 240 : 140, h: next.kind === "text" ? 64 : 90 } : next;
      if (node.kind === "text") {
        const size = measureText(node.text, node.fontSize);
        node.w = size.w;
        node.h = size.h;
      }
      commit((draft) => {
        draft.thinking.nodes.push(node);
      });
      setSelectedId(node.id);
      if (node.kind === "text") setEditing(node.id);
    } else if (next && (current.kind === "move" || current.kind === "resize")) {
      commit((draft) => {
        const node = draft.thinking.nodes.find((item) => item.id === next.id);
        if (node) Object.assign(node, next);
      });
    }
    showGhost(null);
  }

  function addPenPoint(x: number, y: number, close: boolean) {
    const existing = nodes.find((node) => node.id === penId);
    if (!existing) {
      const id = uid("path");
      commit((draft) => {
        draft.thinking.nodes.push({
          ...makeNode("path", x, y, 8, 8, nodes.length),
          id,
          points: [{ x, y }],
          stroke: "#f4efe6",
          strokeWidth: 3,
          fill: "transparent",
        });
      });
      setPenId(id);
      setSelectedId(id);
      return;
    }
    commit((draft) => {
      const node = draft.thinking.nodes.find((item) => item.id === existing.id);
      if (!node) return;
      if (close) node.closed = true;
      else node.points.push({ x, y });
      const box = bounds(node.points);
      node.x = box.x;
      node.y = box.y;
      node.w = box.w;
      node.h = box.h;
    });
    if (close) setPenId(null);
  }

  function patch(recipe: (node: DesignNode) => void, history: "push" | "coalesce" | "end" = "push") {
    if (!selectedId) return;
    commit((draft) => {
      const node = draft.thinking.nodes.find((item) => item.id === selectedId);
      if (node) recipe(node);
    }, history);
  }

  function sendToIdea() {
    commit((draft) => {
      const source = draft.thinking.nodes.filter((node) => node.kind !== "path");
      if (!source.length) return;
      const minX = Math.min(...source.map((node) => node.x));
      const minY = Math.min(...source.map((node) => node.y));
      const maxX = Math.max(...source.map((node) => node.x + node.w));
      const maxY = Math.max(...source.map((node) => node.y + node.h));
      const scale = Math.min(draft.idea.width / Math.max(1, maxX - minX), draft.idea.height / Math.max(1, maxY - minY)) * 0.86;
      const offsetX = (draft.idea.width - (maxX - minX) * scale) / 2;
      const offsetY = (draft.idea.height - (maxY - minY) * scale) / 2;
      const kept = draft.idea.layers.filter((layer) => layer.kind === "bitmap");
      draft.idea.layers = [
        ...kept,
        ...source.map((node) => ({
          id: uid("idea"),
          name: node.name,
          kind: node.kind === "text" ? "text" as const : "shape" as const,
          x: (node.x - minX) * scale + offsetX,
          y: (node.y - minY) * scale + offsetY,
          w: Math.max(1, node.w * scale),
          h: Math.max(1, node.h * scale),
          opacity: node.opacity,
          visible: true,
          fill: node.fill,
          shape: node.kind === "ellipse" ? "ellipse" as const : "rect" as const,
          text: node.text,
          fontSize: Math.max(8, node.fontSize * scale),
          bitmapId: null,
        })),
      ];
    });
    onOpen("idea");
  }

  const screen = selected ? toScreen(selected, cam) : null;

  return (
    <div className="studio">
      <div className="tools">
        <IconButton title="Select" active={tool === "select"} onClick={() => setTool("select")}>V</IconButton>
        <IconButton title="Hand" active={tool === "hand"} onClick={() => setTool("hand")}>H</IconButton>
        <IconButton title="Frame" active={tool === "frame"} onClick={() => setTool("frame")}>F</IconButton>
        <IconButton title="Rectangle" active={tool === "rect"} onClick={() => setTool("rect")}>R</IconButton>
        <IconButton title="Ellipse" active={tool === "ellipse"} onClick={() => setTool("ellipse")}>O</IconButton>
        <IconButton title="Text" active={tool === "text"} onClick={() => setTool("text")}>T</IconButton>
        <IconButton title="Pen" active={tool === "pen"} onClick={() => setTool("pen")}>P</IconButton>
        <IconButton title="Zoom out" onClick={() => setCam((current) => ({ ...current, zoom: Math.max(0.12, current.zoom / 1.15) }))}>−</IconButton>
        <IconButton title="Zoom in" onClick={() => setCam((current) => ({ ...current, zoom: Math.min(6, current.zoom * 1.15) }))}>+</IconButton>
      </div>
      <div
        className="stage thinking-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <svg className="vector">
          <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
            <defs>
              <pattern id="handy-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1.1" fill="rgba(244,239,230,0.2)" />
              </pattern>
            </defs>
            <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#handy-dots)" />
            {shown.map((node) => (
              <Shape key={node.id} node={node} zoom={cam.zoom} />
            ))}
          </g>
        </svg>
        {selected && screen && selected.kind !== "path" && (
          <div className="selection" style={{ left: screen.left, top: screen.top, width: screen.width, height: screen.height, transform: `rotate(${selected.rotation}deg)` }}>
            {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
              <i key={handle} data-handle={handle} className="handle" style={handleStyle(handle)} />
            ))}
          </div>
        )}
        {editing && selected?.kind === "text" && screen && (
          <input
            autoFocus
            value={selected.text}
            style={{ position: "absolute", left: screen.left, top: screen.top, width: Math.max(120, screen.width), fontSize: selected.fontSize * cam.zoom }}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              const size = measureText(event.target.value, selected.fontSize);
              patch((node) => {
                node.text = event.target.value;
                node.w = size.w;
                node.h = size.h;
              }, "coalesce");
            }}
            onBlur={() => {
              commit(() => undefined, "end");
              setEditing(null);
            }}
          />
        )}
      </div>
      <aside className="side">
        <h3>Thinking</h3>
        <p>Lay out frames, shapes, and type. Send the layout to Idea when it should become a print.</p>
        <p>{Math.round(cam.zoom * 100)}%</p>
        <button type="button" onClick={sendToIdea}>Send layout to Idea</button>
        {selected && (
          <>
            <TextField label="Name" value={selected.name} onCommit={(value) => patch((node) => { node.name = value; })} />
            <ColorField label="Fill" value={selected.fill} onChange={(value, history) => patch((node) => { node.fill = value; }, history)} />
            <Slider label="Opacity" min={0} max={1} step={0.01} value={selected.opacity} onChange={(value, history) => patch((node) => { node.opacity = value; }, history)} />
            <Slider label="Rotation" min={-180} max={180} step={1} digits={0} value={selected.rotation} onChange={(value, history) => patch((node) => { node.rotation = value; }, history)} />
            {(selected.kind === "rect" || selected.kind === "frame") && (
              <Slider label="Corner" min={0} max={80} step={1} digits={0} value={selected.radius} onChange={(value, history) => patch((node) => { node.radius = value; }, history)} />
            )}
            {selected.kind === "text" && (
              <>
                <TextField
                  label="Text"
                  value={selected.text}
                  onCommit={(value) => {
                    const size = measureText(value, selected.fontSize);
                    patch((node) => {
                      node.text = value;
                      node.w = size.w;
                      node.h = size.h;
                    });
                  }}
                />
                <Slider
                  label="Size"
                  min={8}
                  max={180}
                  step={1}
                  digits={0}
                  value={selected.fontSize}
                  onChange={(value, history) => {
                    const size = measureText(selected.text, value);
                    patch((node) => {
                      node.fontSize = value;
                      node.w = size.w;
                      node.h = size.h;
                    }, history);
                  }}
                />
              </>
            )}
            <div className="row">
              <button
                type="button"
                onClick={() => {
                  const id = uid("node");
                  commit((draft) => {
                    const source = draft.thinking.nodes.find((node) => node.id === selected.id);
                    if (!source) return;
                    draft.thinking.nodes.push({
                      ...structuredClone(source),
                      id,
                      name: `${source.name} copy`,
                      x: source.x + 24,
                      y: source.y + 24,
                      points: source.points.map((point) => ({ x: point.x + 24, y: point.y + 24 })),
                    });
                  });
                  setSelectedId(id);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  commit((draft) => {
                    const index = draft.thinking.nodes.findIndex((node) => node.id === selected.id);
                    if (index >= 0) {
                      const [node] = draft.thinking.nodes.splice(index, 1);
                      draft.thinking.nodes.push(node);
                    }
                  });
                }}
              >
                Front
              </button>
              <button type="button" className="danger" onClick={() => { commit((draft) => { draft.thinking.nodes = draft.thinking.nodes.filter((node) => node.id !== selected.id); }); setSelectedId(null); }}>Delete</button>
            </div>
          </>
        )}
        <div className="layers">
          {[...nodes].reverse().map((node) => (
            <button type="button" key={node.id} className={node.id === selectedId ? "on" : ""} onClick={() => setSelectedId(node.id)}>
              {node.name}
            </button>
          ))}
        </div>
        {tool === "pen" && <p>Click to add points. Double-click to close the path.</p>}
      </aside>
    </div>
  );
}

function Shape({ node, zoom }: { node: DesignNode; zoom: number }) {
  if (node.kind === "path") {
    const d = node.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ") + (node.closed ? " Z" : "");
    return <path d={d} fill={node.closed ? node.fill : "none"} stroke={node.stroke} strokeWidth={node.strokeWidth} strokeLinejoin="round" opacity={node.opacity} />;
  }
  if (node.kind === "text") {
    return (
      <text x={node.x} y={node.y + node.fontSize} fill={node.fill} opacity={node.opacity} fontFamily="Fraunces, Palatino, serif" fontSize={node.fontSize} transform={`rotate(${node.rotation} ${node.x} ${node.y + node.h / 2})`}>
        {node.text}
      </text>
    );
  }
  const transform = `translate(${node.x} ${node.y}) rotate(${node.rotation} ${node.w / 2} ${node.h / 2})`;
  if (node.kind === "ellipse") {
    return <ellipse cx={node.w / 2} cy={node.h / 2} rx={Math.max(0, node.w / 2)} ry={Math.max(0, node.h / 2)} fill={node.fill} opacity={node.opacity} transform={transform} />;
  }
  return (
    <g opacity={node.opacity}>
      <rect width={node.w} height={node.h} rx={node.radius} fill={node.fill} stroke={node.kind === "frame" ? "rgba(244,239,230,0.35)" : "transparent"} strokeWidth={node.kind === "frame" ? 1 / zoom : 0} transform={transform} />
      {node.kind === "frame" && (
        <text x={node.x} y={node.y - 8 / zoom} fill="#b3aa9d" fontSize={12 / zoom} fontFamily="Outfit, sans-serif">
          {node.name}
        </text>
      )}
    </g>
  );
}

function makeNode(kind: DesignNode["kind"], x: number, y: number, w: number, h: number, index: number): DesignNode {
  return {
    id: uid("node"),
    kind,
    name: kind === "frame" ? "Frame" : kind === "text" ? "Text" : kind === "path" ? "Path" : "Shape",
    x, y, w, h,
    rotation: 0,
    fill: kind === "frame" ? "#17140f" : kind === "text" ? "#f4efe6" : palette[index % palette.length],
    stroke: "transparent",
    strokeWidth: 0,
    radius: kind === "frame" ? 0 : 0,
    opacity: 1,
    text: kind === "text" ? "Text" : "",
    fontSize: kind === "text" ? 42 : 24,
    points: [],
    closed: false,
  };
}

function hits(node: DesignNode, x: number, y: number): boolean {
  if (node.kind === "path") {
    const box = bounds(node.points);
    return x >= box.x - 6 && y >= box.y - 6 && x <= box.x + box.w + 6 && y <= box.y + box.h + 6;
  }
  const local = worldToLocal(node, x, y);
  if (node.kind === "ellipse") {
    const nx = (local.x / node.w) * 2 - 1;
    const ny = (local.y / node.h) * 2 - 1;
    return nx * nx + ny * ny <= 1;
  }
  return local.x >= 0 && local.y >= 0 && local.x <= node.w && local.y <= node.h;
}

function worldToLocal(node: DesignNode, x: number, y: number) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const angle = (-node.rotation * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return { x: dx * c - dy * s + node.w / 2, y: dx * s + dy * c + node.h / 2 };
}

function resizeNode(start: DesignNode, handle: string, x: number, y: number): DesignNode {
  const cx = start.x + start.w / 2;
  const cy = start.y + start.h / 2;
  const angle = (-start.rotation * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  let west = -start.w / 2;
  let east = start.w / 2;
  let north = -start.h / 2;
  let south = start.h / 2;
  if (handle.includes("e")) east = Math.max(west + 8, lx);
  if (handle.includes("w")) west = Math.min(east - 8, lx);
  if (handle.includes("s")) south = Math.max(north + 8, ly);
  if (handle.includes("n")) north = Math.min(south - 8, ly);
  const w = east - west;
  const h = south - north;
  const localCx = (east + west) / 2;
  const localCy = (south + north) / 2;
  const rot = (start.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const worldCx = cx + localCx * cos - localCy * sin;
  const worldCy = cy + localCx * sin + localCy * cos;
  return { ...start, w, h, x: worldCx - w / 2, y: worldCy - h / 2 };
}

function boxFrom(x0: number, y0: number, x1: number, y1: number) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

function bounds(points: { x: number; y: number }[]) {
  if (!points.length) return { x: 0, y: 0, w: 8, h: 8 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(8, Math.max(...xs) - x), h: Math.max(8, Math.max(...ys) - y) };
}

function toScreen(node: DesignNode, cam: { x: number; y: number; zoom: number }) {
  const width = node.w * cam.zoom;
  const height = node.h * cam.zoom;
  const left = (node.x + node.w / 2) * cam.zoom + cam.x - width / 2;
  const top = (node.y + node.h / 2) * cam.zoom + cam.y - height / 2;
  return { left, top, width, height };
}

function handleStyle(handle: string): React.CSSProperties {
  const x = handle.includes("e") ? "100%" : handle.includes("w") ? "0%" : "50%";
  const y = handle.includes("s") ? "100%" : handle.includes("n") ? "0%" : "50%";
  return { left: x, top: y };
}
