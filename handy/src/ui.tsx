import { useEffect, useState, type ReactNode } from "react";

type History = "push" | "coalesce" | "end";

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function download(filename: string, href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  download(filename, url);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function readImageFiles(files: File[]): Promise<string[]> {
  return Promise.all(
    files.filter((file) => file.type.startsWith("image/")).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export function Slider({
  label,
  min,
  max,
  step,
  value,
  digits = 2,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  digits?: number;
  onChange: (value: number, history: History) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <strong>{value.toFixed(digits)}</strong>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value), "coalesce")}
        onPointerUp={(event) => onChange(Number((event.target as HTMLInputElement).value), "end")}
        onBlur={(event) => onChange(Number(event.target.value), "end")}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number, history: History) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? round(value) : 0}
        onChange={(event) => onChange(Number(event.target.value), "coalesce")}
        onBlur={(event) => onChange(Number(event.target.value), "end")}
      />
    </label>
  );
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string, history: History) => void;
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#f4efe6";
  return (
    <label className="field color-field">
      <span>{label}</span>
      <input
        type="color"
        value={safe}
        onChange={(event) => onChange(event.target.value, "coalesce")}
        onPointerUp={(event) => onChange((event.target as HTMLInputElement).value, "end")}
        onBlur={(event) => onChange(event.target.value, "end")}
      />
    </label>
  );
}

export function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="field stack">
      <span>{label}</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
      />
    </label>
  );
}

export function IconButton({
  title,
  active = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={active ? "tool active" : "tool"} title={title} aria-label={title} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

let measureCanvas: HTMLCanvasElement | null = null;

export function measureText(text: string, fontSize: number): { w: number; h: number } {
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return { w: fontSize * 4, h: fontSize * 1.3 };
  context.font = `${fontSize}px Fraunces, Palatino, serif`;
  return { w: Math.max(24, context.measureText(text || "Text").width + 12), h: fontSize * 1.35 };
}
