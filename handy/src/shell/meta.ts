import type { StudioId } from "../model/types";

export type StudioProps = {
  focused: boolean;
  visible: boolean;
  onOpen: (id: StudioId) => void;
};

export const ROOMS: { id: StudioId; title: string; line: string; hue: string }[] = [
  { id: "thinking", title: "Thinking", line: "Frames, type, and layout", hue: "#7eb6ff" },
  { id: "formulation", title: "Formulation", line: "Push, turn, and sculpt form", hue: "#ffb000" },
  { id: "rendering", title: "Rendering", line: "Live light, then a sampled picture", hue: "#ff6b4a" },
  { id: "idea", title: "Idea", line: "Grade color and prepare print", hue: "#c77dff" },
  { id: "animation", title: "Animation", line: "Edit pictures on a timeline", hue: "#7dcfb6" },
  { id: "game", title: "Game", line: "Place the work and play it", hue: "#e8ff6a" },
];
