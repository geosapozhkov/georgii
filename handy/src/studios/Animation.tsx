import { useEffect, useRef, useState } from "react";
import { sampleKeys, upsertKey } from "../model/math";
import { uid } from "../model/ids";
import { useProject } from "../model/store";
import type { AnimLayer, RenderFrame } from "../model/types";
import type { StudioProps } from "../shell/meta";
import { ColorField, Slider, TextField, download, readImageFiles } from "../ui";

export function Animation({ focused }: StudioProps) {
  const { project, commit } = useProject();
  const comp = project.animation;
  const frames = project.rendering.frames;
  const [selectedId, setSelectedId] = useState<string | null>(comp.layers[0]?.id ?? null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dropping, setDropping] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const timeRef = useRef(time);
  timeRef.current = time;
  const selected = comp.layers.find((layer) => layer.id === selectedId) ?? null;

  useEffect(() => {
    const urls = new Set<string>();
    for (const layer of comp.layers) {
      layer.images.forEach((url) => urls.add(url));
      layer.frameIds.forEach((id) => {
        const frame = frames.find((item) => item.id === id);
        if (frame) urls.add(frame.url);
      });
    }
    for (const url of urls) {
      if (images.current.has(url)) continue;
      const image = new Image();
      image.src = url;
      image.onload = () => draw(timeRef.current);
      images.current.set(url, image);
    }
  }, [comp.layers, frames]);

  useEffect(() => {
    draw(time);
  }, [time, comp, frames]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setTime((current) => (current + dt >= comp.duration ? 0 : current + dt));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, comp.duration]);

  useEffect(() => {
    if (!focused) setPlaying(false);
  }, [focused]);

  function draw(at: number) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (canvas.width !== comp.width) canvas.width = comp.width;
    if (canvas.height !== comp.height) canvas.height = comp.height;
    context.clearRect(0, 0, comp.width, comp.height);
    context.fillStyle = "#141210";
    context.fillRect(0, 0, comp.width, comp.height);
    for (const layer of comp.layers) {
      if (!layer.visible || at < layer.in || at > layer.out) continue;
      const sample = sampleKeys(layer.keys, at);
      context.save();
      context.translate(sample.x, sample.y);
      context.rotate((sample.rotation * Math.PI) / 180);
      context.scale(sample.scale, sample.scale);
      context.globalAlpha = Math.max(0, Math.min(1, sample.opacity));
      if (layer.kind === "solid") {
        context.fillStyle = layer.color;
        context.fillRect(-160, -90, 320, 180);
      } else if (layer.kind === "text") {
        context.fillStyle = layer.color;
        context.font = "72px Fraunces, Palatino, serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(layer.text || "Text", 0, 0);
      } else {
        const urls = layer.images.length ? layer.images : layer.frameIds.map((id) => frames.find((frame) => frame.id === id)?.url).filter((url): url is string => Boolean(url));
        const span = Math.max(0.001, layer.out - layer.in);
        const index = Math.min(urls.length - 1, Math.max(0, Math.floor(((at - layer.in) / span) * urls.length)));
        const image = urls[index] ? images.current.get(urls[index]) : undefined;
        if (image && image.complete && image.naturalWidth) context.drawImage(image, -240, -135, 480, 270);
        else {
          context.strokeStyle = "#f4efe6";
          context.strokeRect(-240, -135, 480, 270);
        }
      }
      context.restore();
    }
  }

  function addLayer(partial: Pick<AnimLayer, "kind" | "name"> & Partial<AnimLayer>) {
    const id = uid("layer");
    commit((draft) => {
      draft.animation.layers.push({
        id,
        name: partial.name,
        kind: partial.kind,
        color: partial.color ?? "#f4efe6",
        text: partial.text ?? "Handy",
        frameIds: partial.frameIds ?? [],
        images: partial.images ?? [],
        in: 0,
        out: draft.animation.duration,
        visible: true,
        keys: partial.keys ?? [{ t: 0, x: draft.animation.width / 2, y: draft.animation.height / 2, scale: 1, rotation: 0, opacity: 1 }],
      });
    });
    setSelectedId(id);
  }

  function useFrames(source: RenderFrame[]) {
    if (!source.length) return;
    addLayer({ name: "Sequence", kind: "sequence", frameIds: source.map((frame) => frame.id), keys: [{ t: 0, x: comp.width / 2, y: comp.height / 2, scale: 1.5, rotation: 0, opacity: 1 }] });
  }

  const sample = selected ? sampleKeys(selected.keys, time) : null;

  function writeKey(patch: Partial<AnimLayer["keys"][number]>, history: "push" | "coalesce" | "end" = "push") {
    if (!selected) return;
    commit((draft) => {
      const layer = draft.animation.layers.find((item) => item.id === selected.id);
      if (!layer) return;
      layer.keys = upsertKey(layer.keys, time, patch);
    }, history);
  }

  return (
    <div className="studio animation-studio">
      <div className="tools">
        <button type="button" className="tool" onClick={() => setPlaying((value) => !value)}>{playing ? "II" : "▶"}</button>
      </div>
      <div
        className={dropping ? "stage dropping" : "stage"}
        onDragOver={(event) => { event.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropping(false);
          void readImageFiles([...event.dataTransfer.files]).then((urls) => {
            if (urls.length) addLayer({ name: "Dropped sequence", kind: "sequence", images: urls });
          });
        }}
      >
        <canvas ref={canvasRef} className="comp" />
      </div>
      <aside className="side">
        <h3>Animation</h3>
        <p>Drop image files here, or send a sequence from Rendering. Keys remember position, scale, turn, and opacity.</p>
        <p>{time.toFixed(2)}s</p>
        <div className="row">
          <button type="button" onClick={() => addLayer({ name: "Solid", kind: "solid", color: "#ffb000" })}>Solid</button>
          <button type="button" onClick={() => addLayer({ name: "Title", kind: "text", text: "Title" })}>Text</button>
          <button type="button" onClick={() => useFrames(frames)} disabled={!frames.length}>Use renders</button>
        </div>
        <Slider label="Duration" min={1} max={20} step={0.1} value={comp.duration} onChange={(value, history) => commit((draft) => { draft.animation.duration = value; }, history)} />
        {selected && sample && (
          <>
            <TextField label="Name" value={selected.name} onCommit={(value) => commit((draft) => { const layer = draft.animation.layers.find((item) => item.id === selected.id); if (layer) layer.name = value; })} />
            {selected.kind === "text" && <TextField label="Text" value={selected.text} onCommit={(value) => commit((draft) => { const layer = draft.animation.layers.find((item) => item.id === selected.id); if (layer) layer.text = value; })} />}
            {(selected.kind === "text" || selected.kind === "solid") && (
              <ColorField label="Color" value={selected.color} onChange={(value, history) => commit((draft) => { const layer = draft.animation.layers.find((item) => item.id === selected.id); if (layer) layer.color = value; }, history)} />
            )}
            <Slider label="X" min={0} max={comp.width} step={1} digits={0} value={sample.x} onChange={(value, history) => writeKey({ x: value }, history)} />
            <Slider label="Y" min={0} max={comp.height} step={1} digits={0} value={sample.y} onChange={(value, history) => writeKey({ y: value }, history)} />
            <Slider label="Scale" min={0.1} max={4} step={0.01} value={sample.scale} onChange={(value, history) => writeKey({ scale: value }, history)} />
            <Slider label="Turn" min={-180} max={180} step={1} digits={0} value={sample.rotation} onChange={(value, history) => writeKey({ rotation: value }, history)} />
            <Slider label="Opacity" min={0} max={1} step={0.01} value={sample.opacity} onChange={(value, history) => writeKey({ opacity: value }, history)} />
            <button type="button" className="danger" onClick={() => { commit((draft) => { draft.animation.layers = draft.animation.layers.filter((layer) => layer.id !== selected.id); }); setSelectedId(null); }}>Delete layer</button>
          </>
        )}
        <button type="button" onClick={() => { const url = canvasRef.current?.toDataURL("image/png"); if (url) download(`${project.name}-frame.png`, url); }}>Save still</button>
        <div className="layers">
          {comp.layers.map((layer) => (
            <button type="button" key={layer.id} className={layer.id === selectedId ? "on" : ""} onClick={() => setSelectedId(layer.id)}>{layer.name}</button>
          ))}
        </div>
      </aside>
      <div className="timeline">
        <div className="ruler" onPointerDown={(event) => seek(event, comp.duration, setTime, setPlaying)}>
          <i className="playhead" style={{ left: `${(time / comp.duration) * 100}%` }} />
        </div>
        {comp.layers.map((layer) => (
          <div className="lane" key={layer.id}>
            <span>{layer.name}</span>
            <div className="lane-track" onPointerDown={(event) => seek(event, comp.duration, setTime, setPlaying)}>
              {layer.keys.map((key, index) => (
                <button
                  type="button"
                  key={`${layer.id}-${index}`}
                  className="key"
                  style={{ left: `${(key.t / comp.duration) * 100}%` }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const track = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                    const move = (ev: PointerEvent) => {
                      const next = Math.min(comp.duration, Math.max(0, ((ev.clientX - track.left) / track.width) * comp.duration));
                      commit((draft) => {
                        const target = draft.animation.layers.find((item) => item.id === layer.id);
                        if (target?.keys[index]) target.keys[index].t = next;
                      }, "coalesce");
                    };
                    const up = () => {
                      commit((draft) => {
                        const target = draft.animation.layers.find((item) => item.id === layer.id);
                        target?.keys.sort((a, b) => a.t - b.t);
                      }, "end");
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", up);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function seek(event: React.PointerEvent, duration: number, setTime: (time: number) => void, setPlaying: (playing: boolean) => void) {
  const rect = event.currentTarget.getBoundingClientRect();
  setPlaying(false);
  setTime(Math.min(duration, Math.max(0, ((event.clientX - rect.left) / rect.width) * duration)));
}
