export type Vec3 = { x: number; y: number; z: number };

export type FormKind = "box" | "sphere" | "cylinder" | "torus";

export type FormObject = {
  id: string;
  name: string;
  kind: FormKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  metalness: number;
  roughness: number;
  sculpt: number[] | null;
};

export type DesignKind = "frame" | "rect" | "ellipse" | "text" | "path";

export type DesignNode = {
  id: string;
  kind: DesignKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  opacity: number;
  text: string;
  fontSize: number;
  points: { x: number; y: number }[];
  closed: boolean;
};

export type Grade = {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  shadows: number;
  highlights: number;
};

export type IdeaLayer = {
  id: string;
  name: string;
  kind: "bitmap" | "shape" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
  fill: string;
  shape: "rect" | "ellipse";
  text: string;
  fontSize: number;
  bitmapId: string | null;
};

export type RenderFrame = {
  id: string;
  name: string;
  url: string;
};

export type AnimKey = {
  t: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

export type AnimLayer = {
  id: string;
  name: string;
  kind: "solid" | "text" | "sequence";
  color: string;
  text: string;
  frameIds: string[];
  images: string[];
  in: number;
  out: number;
  visible: boolean;
  keys: AnimKey[];
};

export type EntityRole = "prop" | "player" | "goal" | "hazard";

export type GameEntity = {
  id: string;
  name: string;
  role: EntityRole;
  formId: string | null;
  kind: FormKind;
  color: string;
  scale: number;
  x: number;
  z: number;
  rotY: number;
  radius: number;
  block: number;
};

export type Project = {
  version: 1;
  name: string;
  thinking: { nodes: DesignNode[] };
  formulation: { objects: FormObject[] };
  rendering: {
    exposure: number;
    bounces: number;
    samples: number;
    width: number;
    height: number;
    frames: RenderFrame[];
  };
  idea: {
    width: number;
    height: number;
    grade: Grade;
    proof: boolean;
    paper: "coated" | "uncoated";
    inkLimit: number;
    guides: boolean;
    layers: IdeaLayer[];
    bitmaps: Record<string, string>;
  };
  animation: {
    fps: number;
    duration: number;
    width: number;
    height: number;
    layers: AnimLayer[];
  };
  game: {
    title: string;
    showRenderCard: boolean;
    entities: GameEntity[];
  };
};

export type StudioId = "thinking" | "formulation" | "rendering" | "idea" | "animation" | "game";
