import type {
  AnimLayer,
  DesignKind,
  DesignNode,
  FormKind,
  FormObject,
  GameEntity,
  Grade,
  IdeaLayer,
  Project,
  RenderFrame,
} from "./types";

const formKinds = new Set<FormKind>(["box", "sphere", "cylinder", "torus"]);
const designKinds = new Set<DesignKind>(["frame", "rect", "ellipse", "text", "path"]);

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function vec(value: unknown, fallback: { x: number; y: number; z: number }) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { x: num(record.x, fallback.x), y: num(record.y, fallback.y), z: num(record.z, fallback.z) };
}

export function neutralGrade(): Grade {
  return { exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0, shadows: 0, highlights: 0 };
}

export function createDefaultProject(): Project {
  return {
    version: 1,
    name: "Untitled",
    thinking: {
      nodes: [
        node({ id: "poster", kind: "frame", name: "Poster", x: 0, y: 0, w: 640, h: 800, fill: "#17140f" }),
        node({ id: "rule", kind: "rect", name: "Rule", x: 48, y: 56, w: 92, h: 8, fill: "#ffb000" }),
        node({
          id: "title",
          kind: "text",
          name: "Title",
          x: 48,
          y: 88,
          w: 420,
          h: 110,
          fill: "#f4efe6",
          text: "Handy",
          fontSize: 92,
        }),
        node({
          id: "subtitle",
          kind: "text",
          name: "Subtitle",
          x: 48,
          y: 210,
          w: 460,
          h: 44,
          fill: "#a89f91",
          text: "Six rooms, one project.",
          fontSize: 28,
        }),
        node({ id: "mark", kind: "ellipse", name: "Mark", x: 470, y: 620, w: 120, h: 120, fill: "#ff6b4a" }),
        node({ id: "chip", kind: "rect", name: "Chip", x: 48, y: 700, w: 210, h: 52, fill: "#f4efe6", radius: 26 }),
        node({
          id: "chip-label",
          kind: "text",
          name: "Chip label",
          x: 78,
          y: 712,
          w: 150,
          h: 32,
          fill: "#17140f",
          text: "Open a room",
          fontSize: 22,
        }),
      ],
    },
    formulation: {
      objects: [
        form({
          id: "form-sphere",
          name: "Orb",
          kind: "sphere",
          position: { x: -0.95, y: 0.5, z: 0.15 },
          color: "#d97848",
          metalness: 0.82,
          roughness: 0.18,
        }),
        form({
          id: "form-box",
          name: "Block",
          kind: "box",
          position: { x: 0.75, y: 0.46, z: 0.25 },
          scale: { x: 0.92, y: 0.92, z: 0.92 },
          color: "#d9d3c8",
          metalness: 0,
          roughness: 0.72,
        }),
        form({
          id: "form-torus",
          name: "Ring",
          kind: "torus",
          position: { x: 0.05, y: 0.18, z: -0.65 },
          color: "#e2b15a",
          metalness: 0.35,
          roughness: 0.32,
        }),
        form({
          id: "form-cylinder",
          name: "Post",
          kind: "cylinder",
          position: { x: 1.55, y: 0.55, z: -0.85 },
          scale: { x: 0.62, y: 1.1, z: 0.62 },
          color: "#7f8f86",
          metalness: 0.08,
          roughness: 0.48,
        }),
      ],
    },
    rendering: { exposure: 1.15, bounces: 2, samples: 24, width: 200, height: 112, frames: [] },
    idea: {
      width: 960,
      height: 540,
      grade: neutralGrade(),
      proof: false,
      paper: "coated",
      inkLimit: 300,
      guides: true,
      bitmaps: {},
      layers: [
        idea({ id: "ground", name: "Paper", kind: "shape", x: 0, y: 0, w: 960, h: 540, fill: "#1c1916" }),
        idea({ id: "cyan", name: "Cyan", kind: "shape", shape: "ellipse", x: 250, y: 150, w: 220, h: 220, fill: "#12a4d8" }),
        idea({ id: "magenta", name: "Magenta", kind: "shape", shape: "ellipse", x: 370, y: 150, w: 220, h: 220, fill: "#d4146c" }),
        idea({ id: "yellow", name: "Yellow", kind: "shape", shape: "ellipse", x: 310, y: 250, w: 220, h: 220, fill: "#ffd000" }),
        idea({
          id: "word",
          name: "Word",
          kind: "text",
          x: 64,
          y: 48,
          w: 420,
          h: 70,
          fill: "#f4efe6",
          text: "Grade and print",
          fontSize: 42,
        }),
      ],
    },
    animation: {
      fps: 24,
      duration: 4,
      width: 960,
      height: 540,
      layers: [
        {
          id: "title-card",
          name: "Title",
          kind: "text",
          color: "#f4efe6",
          text: "Handy",
          frameIds: [],
          images: [],
          in: 0,
          out: 4,
          visible: true,
          keys: [
            { t: 0, x: 480, y: 300, scale: 0.82, rotation: 0, opacity: 0 },
            { t: 0.8, x: 480, y: 260, scale: 1, rotation: 0, opacity: 1 },
            { t: 3.4, x: 480, y: 240, scale: 1.04, rotation: 0, opacity: 1 },
          ],
        },
      ],
    },
    game: {
      title: "First mark",
      showRenderCard: true,
      entities: [
        entity({ id: "player", name: "Player", role: "player", x: 0, z: 2.2, color: "#e8ff6a", scale: 0.42, radius: 0.34, block: 0.4 }),
        entity({
          id: "prop-block",
          name: "Block",
          role: "prop",
          formId: "form-box",
          x: -1.7,
          z: -0.4,
          radius: 0.55,
          block: 1,
        }),
        entity({
          id: "prop-ring",
          name: "Ring",
          role: "prop",
          formId: "form-torus",
          x: 1.8,
          z: -1.5,
          radius: 0.62,
          block: 0.45,
        }),
        entity({ id: "hazard-1", name: "Hazard", role: "hazard", x: 0.15, z: -1.35, color: "#ff6b4a", kind: "box", scale: 0.55, radius: 0.42, block: 0.4 }),
        entity({ id: "hazard-2", name: "Hazard 2", role: "hazard", x: -0.9, z: -2.7, color: "#ff6b4a", kind: "cylinder", scale: 0.4, radius: 0.36, block: 0.5 }),
        entity({ id: "goal", name: "Mark", role: "goal", x: 0.2, z: -4.6, color: "#7dcfb6", kind: "torus", scale: 0.85, radius: 0.55, block: 0.2 }),
      ],
    },
  };
}

function node(partial: Partial<DesignNode> & Pick<DesignNode, "id" | "kind" | "name">): DesignNode {
  return {
    x: 0,
    y: 0,
    w: 80,
    h: 80,
    rotation: 0,
    fill: "#f4efe6",
    stroke: "transparent",
    strokeWidth: 0,
    radius: 0,
    opacity: 1,
    text: "",
    fontSize: 24,
    points: [],
    closed: false,
    ...partial,
  };
}

function form(partial: Partial<FormObject> & Pick<FormObject, "id" | "name" | "kind">): FormObject {
  return {
    position: { x: 0, y: 0.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: "#d9d3c8",
    metalness: 0,
    roughness: 0.55,
    sculpt: null,
    ...partial,
  };
}

function idea(partial: Partial<IdeaLayer> & Pick<IdeaLayer, "id" | "name" | "kind">): IdeaLayer {
  return {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    opacity: 1,
    visible: true,
    fill: "#f4efe6",
    shape: "rect",
    text: "",
    fontSize: 32,
    bitmapId: null,
    ...partial,
  };
}

function entity(partial: Partial<GameEntity> & Pick<GameEntity, "id" | "name" | "role">): GameEntity {
  return {
    formId: null,
    kind: "sphere",
    color: "#f4efe6",
    scale: 0.5,
    x: 0,
    z: 0,
    rotY: 0,
    radius: 0.4,
    block: 0.8,
    ...partial,
  };
}

export function serializeProject(project: Project): string {
  return JSON.stringify({ handy: 1, project }, null, 2);
}

export function parseProjectFile(text: string): Project {
  const data = JSON.parse(text) as { handy?: number; project?: unknown };
  if (!data || data.handy !== 1) throw new Error("This file is not a Handy project.");
  return normalizeProject(data.project);
}

export function normalizeProject(input: unknown): Project {
  const base = createDefaultProject();
  if (!input || typeof input !== "object") return base;
  const record = input as Record<string, unknown>;
  const thinking = record.thinking as { nodes?: unknown } | undefined;
  const formulation = record.formulation as { objects?: unknown } | undefined;
  const rendering = record.rendering as Record<string, unknown> | undefined;
  const ideaRecord = record.idea as Record<string, unknown> | undefined;
  const animation = record.animation as Record<string, unknown> | undefined;
  const game = record.game as Record<string, unknown> | undefined;
  return {
    version: 1,
    name: str(record.name, base.name).slice(0, 80) || base.name,
    thinking: { nodes: asNodes(thinking?.nodes, base.thinking.nodes) },
    formulation: { objects: asForms(formulation?.objects, base.formulation.objects) },
    rendering: {
      exposure: num(rendering?.exposure, base.rendering.exposure),
      bounces: Math.round(num(rendering?.bounces, base.rendering.bounces)),
      samples: Math.round(num(rendering?.samples, base.rendering.samples)),
      width: Math.round(num(rendering?.width, base.rendering.width)),
      height: Math.round(num(rendering?.height, base.rendering.height)),
      frames: asFrames(rendering?.frames),
    },
    idea: {
      width: Math.round(num(ideaRecord?.width, base.idea.width)),
      height: Math.round(num(ideaRecord?.height, base.idea.height)),
      grade: asGrade(ideaRecord?.grade),
      proof: ideaRecord?.proof === true,
      paper: ideaRecord?.paper === "uncoated" ? "uncoated" : "coated",
      inkLimit: num(ideaRecord?.inkLimit, 300),
      guides: ideaRecord?.guides !== false,
      layers: asIdeaLayers(ideaRecord?.layers, base.idea.layers),
      bitmaps: asBitmaps(ideaRecord?.bitmaps),
    },
    animation: {
      fps: Math.round(num(animation?.fps, 24)),
      duration: num(animation?.duration, 4),
      width: Math.round(num(animation?.width, 960)),
      height: Math.round(num(animation?.height, 540)),
      layers: asAnimLayers(animation?.layers, base.animation.layers),
    },
    game: {
      title: str(game?.title, base.game.title),
      showRenderCard: game?.showRenderCard !== false,
      entities: asEntities(game?.entities, base.game.entities),
    },
  };
}

function asNodes(value: unknown, fallback: DesignNode[]): DesignNode[] {
  if (!Array.isArray(value)) return fallback;
  const nodes = value.filter((item) => item && typeof item === "object").map((item) => {
    const record = item as Record<string, unknown>;
    const kind = designKinds.has(record.kind as DesignKind) ? (record.kind as DesignKind) : "rect";
    return node({
      id: str(record.id, "node"),
      kind,
      name: str(record.name, "Shape"),
      x: num(record.x, 0),
      y: num(record.y, 0),
      w: Math.max(4, num(record.w, 80)),
      h: Math.max(4, num(record.h, 80)),
      rotation: num(record.rotation, 0),
      fill: str(record.fill, "#f4efe6"),
      stroke: str(record.stroke, "transparent"),
      strokeWidth: num(record.strokeWidth, 0),
      radius: num(record.radius, 0),
      opacity: num(record.opacity, 1),
      text: str(record.text, ""),
      fontSize: num(record.fontSize, 24),
      points: Array.isArray(record.points)
        ? record.points
            .filter((point) => point && typeof point === "object")
            .map((point) => {
              const pair = point as Record<string, unknown>;
              return { x: num(pair.x, 0), y: num(pair.y, 0) };
            })
        : [],
      closed: record.closed === true,
    });
  });
  return nodes.length ? nodes : fallback;
}

function asForms(value: unknown, fallback: FormObject[]): FormObject[] {
  if (!Array.isArray(value)) return fallback;
  const objects = value.filter((item) => item && typeof item === "object").map((item) => {
    const record = item as Record<string, unknown>;
    const kind = formKinds.has(record.kind as FormKind) ? (record.kind as FormKind) : "box";
    const sculpt = Array.isArray(record.sculpt) ? record.sculpt.filter((entry) => typeof entry === "number") : null;
    return form({
      id: str(record.id, "form"),
      name: str(record.name, "Form"),
      kind,
      position: vec(record.position, { x: 0, y: 0.5, z: 0 }),
      rotation: vec(record.rotation, { x: 0, y: 0, z: 0 }),
      scale: vec(record.scale, { x: 1, y: 1, z: 1 }),
      color: str(record.color, "#d9d3c8"),
      metalness: num(record.metalness, 0),
      roughness: num(record.roughness, 0.5),
      sculpt,
    });
  });
  return objects.length ? objects : fallback;
}

function asFrames(value: unknown): RenderFrame[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const record = item as Record<string, unknown>;
      return { id: str(record.id, "frame"), name: str(record.name, "Frame"), url: str(record.url, "") };
    })
    .filter((frame) => frame.url.startsWith("data:image/"));
}

function asGrade(value: unknown): Grade {
  const base = neutralGrade();
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  return {
    exposure: num(record.exposure, 0),
    contrast: num(record.contrast, 1),
    saturation: num(record.saturation, 1),
    temperature: num(record.temperature, 0),
    tint: num(record.tint, 0),
    shadows: num(record.shadows, 0),
    highlights: num(record.highlights, 0),
  };
}

function asIdeaLayers(value: unknown, fallback: IdeaLayer[]): IdeaLayer[] {
  if (!Array.isArray(value)) return fallback;
  const layers = value.filter((item) => item && typeof item === "object").map((item) => {
    const record = item as Record<string, unknown>;
    const kind = record.kind === "bitmap" || record.kind === "text" || record.kind === "shape" ? record.kind : "shape";
    return idea({
      id: str(record.id, "layer"),
      name: str(record.name, "Layer"),
      kind,
      x: num(record.x, 0),
      y: num(record.y, 0),
      w: Math.max(1, num(record.w, 100)),
      h: Math.max(1, num(record.h, 100)),
      opacity: num(record.opacity, 1),
      visible: record.visible !== false,
      fill: str(record.fill, "#f4efe6"),
      shape: record.shape === "ellipse" ? "ellipse" : "rect",
      text: str(record.text, ""),
      fontSize: num(record.fontSize, 32),
      bitmapId: typeof record.bitmapId === "string" ? record.bitmapId : null,
    });
  });
  return layers.length ? layers : fallback;
}

function asBitmaps(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].startsWith("data:image/"),
  );
  return Object.fromEntries(entries);
}

function asAnimLayers(value: unknown, fallback: AnimLayer[]): AnimLayer[] {
  if (!Array.isArray(value)) return fallback;
  const layers = value.filter((item) => item && typeof item === "object").map((item) => {
    const record = item as Record<string, unknown>;
    const kind = record.kind === "solid" || record.kind === "sequence" || record.kind === "text" ? record.kind : "solid";
    const keys = Array.isArray(record.keys)
      ? record.keys.filter((key) => key && typeof key === "object").map((key) => {
          const point = key as Record<string, unknown>;
          return {
            t: num(point.t, 0),
            x: num(point.x, 0),
            y: num(point.y, 0),
            scale: num(point.scale, 1),
            rotation: num(point.rotation, 0),
            opacity: num(point.opacity, 1),
          };
        })
      : [];
    return {
      id: str(record.id, "layer"),
      name: str(record.name, "Layer"),
      kind,
      color: str(record.color, "#f4efe6"),
      text: str(record.text, ""),
      frameIds: Array.isArray(record.frameIds) ? record.frameIds.filter((id) => typeof id === "string") : [],
      images: Array.isArray(record.images) ? record.images.filter((url) => typeof url === "string" && url.startsWith("data:image/")) : [],
      in: num(record.in, 0),
      out: num(record.out, 4),
      visible: record.visible !== false,
      keys,
    } satisfies AnimLayer;
  });
  return layers.length ? layers : fallback;
}

function asEntities(value: unknown, fallback: GameEntity[]): GameEntity[] {
  if (!Array.isArray(value)) return fallback;
  const entities = value.filter((item) => item && typeof item === "object").map((item) => {
    const record = item as Record<string, unknown>;
    const role = record.role === "player" || record.role === "goal" || record.role === "hazard" || record.role === "prop" ? record.role : "prop";
    const kind = formKinds.has(record.kind as FormKind) ? (record.kind as FormKind) : "box";
    return entity({
      id: str(record.id, "entity"),
      name: str(record.name, "Entity"),
      role,
      formId: typeof record.formId === "string" ? record.formId : null,
      kind,
      color: str(record.color, "#f4efe6"),
      scale: num(record.scale, 0.5),
      x: num(record.x, 0),
      z: num(record.z, 0),
      rotY: num(record.rotY, 0),
      radius: Math.max(0.1, num(record.radius, 0.4)),
      block: num(record.block, 0.8),
    });
  });
  return entities.length ? entities : fallback;
}
