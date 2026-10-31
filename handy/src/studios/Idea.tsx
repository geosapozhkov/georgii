import { useCallback, useEffect, useRef, useState } from "react";
import { uid } from "../model/ids";
import { gradePixel, rgbToCmyk, softProof, totalAreaCoverage } from "../model/math";
import { useProject } from "../model/store";
import type { IdeaLayer } from "../model/types";
import type { StudioProps } from "../shell/meta";
import { ColorField, IconButton, Slider, TextField, download } from "../ui";

type Tool = "select" | "brush" | "eraser" | "rect" | "ellipse" | "text";

export function Idea({ visible }: StudioProps) {
  const { project, commit } = useProject();
  const idea = project.idea;
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(idea.layers.at(-1)?.id ?? null);
  const [brushColor, setBrushColor] = useState("#f4efe6");
  const [brushSize, setBrushSize] = useState(28);
  const [ink, setInk] = useState("Move over the page");
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement | null>(null);
  const gradedRef = useRef<ImageData | null>(null);
  const savedUrl = useRef("");
  const drag = useRef<{ id: string; x: number; y: number; px: number; py: number } | { kind: "draw"; x: number; y: number } | { kind: "shape"; x: number; y: number; id: string } | null>(null);

  if (!paintRef.current) paintRef.current = document.createElement("canvas");

  const composite = useCallback(() => {
    const view = viewRef.current;
    const paint = paintRef.current;
    if (!view || !paint) return;
    if (view.width !== idea.width || view.height !== idea.height) {
      view.width = idea.width;
      view.height = idea.height;
    }
    const context = view.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.clearRect(0, 0, idea.width, idea.height);
    for (const layer of idea.layers) {
      if (!layer.visible) continue;
      context.save();
      context.globalAlpha = layer.opacity;
      if (layer.kind === "shape") {
        context.fillStyle = layer.fill;
        if (layer.shape === "ellipse") {
          context.beginPath();
          context.ellipse(layer.x + layer.w / 2, layer.y + layer.h / 2, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2);
          context.fill();
        } else context.fillRect(layer.x, layer.y, layer.w, layer.h);
      } else if (layer.kind === "text") {
        context.fillStyle = layer.fill;
        context.font = `${layer.fontSize}px Fraunces, Palatino, serif`;
        context.textBaseline = "top";
        context.fillText(layer.text, layer.x, layer.y);
      } else context.drawImage(paint, layer.x, layer.y, layer.w, layer.h);
      context.restore();
    }
    const image = context.getImageData(0, 0, idea.width, idea.height);
    const graded = context.createImageData(image);
    for (let index = 0; index < image.data.length; index += 4) {
      const pixel = gradePixel(image.data[index] / 255, image.data[index + 1] / 255, image.data[index + 2] / 255, idea.grade);
      graded.data[index] = Math.round(pixel.r * 255);
      graded.data[index + 1] = Math.round(pixel.g * 255);
      graded.data[index + 2] = Math.round(pixel.b * 255);
      graded.data[index + 3] = image.data[index + 3];
    }
    gradedRef.current = graded;
    const output = context.createImageData(graded);
    if (idea.proof) {
      for (let index = 0; index < graded.data.length; index += 4) {
        const proof = softProof(graded.data[index] / 255, graded.data[index + 1] / 255, graded.data[index + 2] / 255, idea.paper, idea.inkLimit);
        output.data[index] = Math.round(proof.rgb.r * 255);
        output.data[index + 1] = Math.round(proof.rgb.g * 255);
        output.data[index + 2] = Math.round(proof.rgb.b * 255);
        output.data[index + 3] = graded.data[index + 3];
      }
    } else output.data.set(graded.data);
    context.putImageData(output, 0, 0);
  }, [idea]);

  useEffect(() => {
    const paint = paintRef.current;
    if (!paint || !visible) return;
    const layer = idea.layers.find((item) => item.kind === "bitmap");
    const url = layer?.bitmapId ? idea.bitmaps[layer.bitmapId] ?? "" : "";
    if (paint.width !== idea.width || paint.height !== idea.height) {
      paint.width = idea.width;
      paint.height = idea.height;
      savedUrl.current = "";
    }
    if (!url || url === savedUrl.current) {
      composite();
      return;
    }
    const image = new Image();
    image.onload = () => {
      const context = paint.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, paint.width, paint.height);
      context.drawImage(image, 0, 0, paint.width, paint.height);
      savedUrl.current = url;
      composite();
    };
    image.src = url;
  }, [idea, composite, visible]);

  function boardPoint(event: { clientX: number; clientY: number }) {
    const canvas = viewRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / idea.width, rect.height / idea.height);
    const originX = (rect.width - idea.width * scale) / 2;
    const originY = (rect.height - idea.height * scale) / 2;
    return { x: (event.clientX - rect.left - originX) / scale, y: (event.clientY - rect.top - originY) / scale };
  }

  function ensureBitmap() {
    const existing = idea.layers.find((layer) => layer.kind === "bitmap");
    if (existing) return existing;
    const id = uid("paint");
    const bitmapId = uid("bmp");
    commit((draft) => {
      draft.idea.layers.push({
        id,
        name: "Marks",
        kind: "bitmap",
        x: 0,
        y: 0,
        w: draft.idea.width,
        h: draft.idea.height,
        opacity: 1,
        visible: true,
        fill: "#ffffff",
        shape: "rect",
        text: "",
        fontSize: 32,
        bitmapId,
      });
    });
    setSelectedId(id);
    return { id, bitmapId };
  }

  function stamp(x: number, y: number, erase: boolean) {
    const paint = paintRef.current;
    const context = paint?.getContext("2d");
    if (!paint || !context) return;
    context.save();
    context.globalCompositeOperation = erase ? "destination-out" : "source-over";
    context.fillStyle = brushColor;
    context.beginPath();
    context.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    composite();
  }

  function onPointerDown(event: React.PointerEvent) {
    const point = boardPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "brush" || tool === "eraser") {
      ensureBitmap();
      drag.current = { kind: "draw", x: point.x, y: point.y };
      stamp(point.x, point.y, tool === "eraser");
      return;
    }
    if (tool === "rect" || tool === "ellipse" || tool === "text") {
      const id = uid("idea");
      drag.current = { kind: "shape", x: point.x, y: point.y, id };
      commit((draft) => {
        draft.idea.layers.push({
          id,
          name: tool === "text" ? "Text" : "Shape",
          kind: tool === "text" ? "text" : "shape",
          x: point.x,
          y: point.y,
          w: tool === "text" ? 240 : 8,
          h: tool === "text" ? 48 : 8,
          opacity: 1,
          visible: true,
          fill: brushColor,
          shape: tool === "ellipse" ? "ellipse" : "rect",
          text: tool === "text" ? "Text" : "",
          fontSize: 36,
          bitmapId: null,
        });
      });
      setSelectedId(id);
      return;
    }
    const hit = [...idea.layers].reverse().find((layer) => layer.visible && layer.kind !== "bitmap" && point.x >= layer.x && point.y >= layer.y && point.x <= layer.x + layer.w && point.y <= layer.y + layer.h);
    setSelectedId(hit?.id ?? null);
    if (hit) drag.current = { id: hit.id, x: hit.x, y: hit.y, px: point.x, py: point.y };
  }

  function onPointerMove(event: React.PointerEvent) {
    const point = boardPoint(event);
    const graded = gradedRef.current;
    if (graded) {
      const x = Math.max(0, Math.min(idea.width - 1, Math.round(point.x)));
      const y = Math.max(0, Math.min(idea.height - 1, Math.round(point.y)));
      const index = (y * idea.width + x) * 4;
      const inkValue = rgbToCmyk(graded.data[index] / 255, graded.data[index + 1] / 255, graded.data[index + 2] / 255);
      const tac = totalAreaCoverage(inkValue);
      setInk(`C ${Math.round(inkValue.c * 100)}  M ${Math.round(inkValue.m * 100)}  Y ${Math.round(inkValue.y * 100)}  K ${Math.round(inkValue.k * 100)}  ·  TAC ${Math.round(tac)}`);
    }
    const current = drag.current;
    if (!current) return;
    if ("kind" in current && current.kind === "draw") {
      const steps = Math.max(1, Math.hypot(point.x - current.x, point.y - current.y));
      for (let step = 0; step <= steps; step += Math.max(1, brushSize / 4)) {
        const amount = step / steps;
        stamp(current.x + (point.x - current.x) * amount, current.y + (point.y - current.y) * amount, tool === "eraser");
      }
      current.x = point.x;
      current.y = point.y;
      return;
    }
    if ("kind" in current && current.kind === "shape") {
      commit((draft) => {
        const layer = draft.idea.layers.find((item) => item.id === current.id);
        if (!layer || layer.kind === "text") return;
        layer.x = Math.min(current.x, point.x);
        layer.y = Math.min(current.y, point.y);
        layer.w = Math.max(4, Math.abs(point.x - current.x));
        layer.h = Math.max(4, Math.abs(point.y - current.y));
      }, "coalesce");
      setDragging(true);
      return;
    }
    if ("id" in current) {
      commit((draft) => {
        const layer = draft.idea.layers.find((item) => item.id === current.id);
        if (!layer) return;
        layer.x = current.x + point.x - current.px;
        layer.y = current.y + point.y - current.py;
      }, "coalesce");
      setDragging(true);
    }
  }

  function onPointerUp() {
    const current = drag.current;
    drag.current = null;
    if (current && "kind" in current && current.kind === "draw") {
      const paint = paintRef.current;
      const layer = project.idea.layers.find((item) => item.kind === "bitmap");
      if (paint && layer?.bitmapId) {
        const url = paint.toDataURL("image/png");
        savedUrl.current = url;
        commit((draft) => {
          const target = draft.idea.layers.find((item) => item.id === layer.id);
          if (target) target.bitmapId = layer.bitmapId;
          if (layer.bitmapId) draft.idea.bitmaps[layer.bitmapId] = url;
        });
      }
    }
    if (dragging) commit(() => undefined, "end");
    setDragging(false);
  }

  const selected = idea.layers.find((layer) => layer.id === selectedId) ?? null;

  function patch(recipe: (layer: IdeaLayer) => void, history: "push" | "coalesce" | "end" = "push") {
    if (!selectedId) return;
    commit((draft) => {
      const layer = draft.idea.layers.find((item) => item.id === selectedId);
      if (layer) recipe(layer);
    }, history);
  }

  return (
    <div className="studio idea-studio">
      <div className="tools">
        {(["select", "brush", "eraser", "rect", "ellipse", "text"] as Tool[]).map((item) => (
          <IconButton key={item} title={item[0].toUpperCase() + item.slice(1)} active={tool === item} onClick={() => setTool(item)}>
            {item[0].toUpperCase()}
          </IconButton>
        ))}
      </div>
      <div className="stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <canvas ref={viewRef} className="board" />
        {idea.guides && <i className="guides" />}
      </div>
      <aside className="side">
        <h3>Idea</h3>
        <p>Grade the picture, then turn on soft proof to see ink on paper. The bars read the color under the pointer.</p>
        <p>{ink}</p>
        <ColorField label="Color" value={brushColor} onChange={(value) => setBrushColor(value)} />
        <Slider label="Brush" min={2} max={120} step={1} digits={0} value={brushSize} onChange={(value) => setBrushSize(value)} />
        <Slider label="Exposure" min={-2} max={2} step={0.01} value={idea.grade.exposure} onChange={(value, history) => commit((draft) => { draft.idea.grade.exposure = value; }, history)} />
        <Slider label="Contrast" min={0.4} max={1.8} step={0.01} value={idea.grade.contrast} onChange={(value, history) => commit((draft) => { draft.idea.grade.contrast = value; }, history)} />
        <Slider label="Saturation" min={0} max={2} step={0.01} value={idea.grade.saturation} onChange={(value, history) => commit((draft) => { draft.idea.grade.saturation = value; }, history)} />
        <Slider label="Temperature" min={-1} max={1} step={0.01} value={idea.grade.temperature} onChange={(value, history) => commit((draft) => { draft.idea.grade.temperature = value; }, history)} />
        <Slider label="Tint" min={-1} max={1} step={0.01} value={idea.grade.tint} onChange={(value, history) => commit((draft) => { draft.idea.grade.tint = value; }, history)} />
        <Slider label="Shadows" min={-1} max={1} step={0.01} value={idea.grade.shadows} onChange={(value, history) => commit((draft) => { draft.idea.grade.shadows = value; }, history)} />
        <Slider label="Highlights" min={-1} max={1} step={0.01} value={idea.grade.highlights} onChange={(value, history) => commit((draft) => { draft.idea.grade.highlights = value; }, history)} />
        <div className="row">
          <button type="button" onClick={() => commit((draft) => { draft.idea.proof = !draft.idea.proof; })}>{idea.proof ? "Soft proof on" : "Soft proof off"}</button>
          <button type="button" onClick={() => commit((draft) => { draft.idea.paper = draft.idea.paper === "coated" ? "uncoated" : "coated"; })}>{idea.paper}</button>
          <button type="button" onClick={() => commit((draft) => { draft.idea.guides = !draft.idea.guides; })}>{idea.guides ? "Guides on" : "Guides off"}</button>
        </div>
        <Slider label="Ink limit" min={180} max={340} step={1} digits={0} value={idea.inkLimit} onChange={(value, history) => commit((draft) => { draft.idea.inkLimit = value; }, history)} />
        <div className="row">
          <button type="button" onClick={() => resizeBoard(960, 540)}>Screen</button>
          <button type="button" onClick={() => resizeBoard(620, 877)}>A4</button>
          <button type="button" onClick={() => resizeBoard(800, 800)}>Square</button>
        </div>
        <button
          type="button"
          onClick={() => {
            const url = viewRef.current?.toDataURL("image/png");
            if (url) download(`${project.name}-print.png`, url);
          }}
        >
          Export PNG
        </button>
        {selected && selected.kind !== "bitmap" && (
          <>
            <TextField label="Name" value={selected.name} onCommit={(value) => patch((layer) => { layer.name = value; })} />
            <ColorField label="Fill" value={selected.fill} onChange={(value, history) => patch((layer) => { layer.fill = value; }, history)} />
            {selected.kind === "text" && (
              <>
                <TextField label="Text" value={selected.text} onCommit={(value) => patch((layer) => { layer.text = value; })} />
                <Slider label="Size" min={8} max={180} step={1} digits={0} value={selected.fontSize} onChange={(value, history) => patch((layer) => { layer.fontSize = value; }, history)} />
              </>
            )}
            <button type="button" className="danger" onClick={() => { commit((draft) => { draft.idea.layers = draft.idea.layers.filter((layer) => layer.id !== selected.id); }); setSelectedId(null); }}>Delete layer</button>
          </>
        )}
        <div className="layers">
          {[...idea.layers].reverse().map((layer) => (
            <button type="button" key={layer.id} className={layer.id === selectedId ? "on" : ""} onClick={() => setSelectedId(layer.id)}>
              {layer.name}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );

  function resizeBoard(width: number, height: number) {
    commit((draft) => {
      const sx = width / draft.idea.width;
      const sy = height / draft.idea.height;
      draft.idea.width = width;
      draft.idea.height = height;
      for (const layer of draft.idea.layers) {
        layer.x *= sx;
        layer.y *= sy;
        layer.w *= sx;
        layer.h *= sy;
        layer.fontSize *= Math.min(sx, sy);
        if (layer.kind === "bitmap") layer.bitmapId = null;
      }
      draft.idea.bitmaps = {};
    });
    savedUrl.current = "";
  }
}
