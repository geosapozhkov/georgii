import type { StudioId } from "../model/types";

export type StudioProps = {
  focused: boolean;
  visible: boolean;
  onOpen: (id: StudioId) => void;
};

export const ROOMS: { id: StudioId; title: string; line: string }[] = [
  { id: "thinking", title: "Thinking", line: "Frames, type, and layout" },
  { id: "formulation", title: "Formulation", line: "Push, turn, and sculpt form" },
  { id: "rendering", title: "Rendering", line: "Live light, then a sampled picture" },
  { id: "idea", title: "Idea", line: "Grade color and prepare print" },
  { id: "animation", title: "Animation", line: "Edit pictures on a timeline" },
  { id: "game", title: "Game", line: "Place the work and play it" },
];
