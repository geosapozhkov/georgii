import { describe, expect, it } from "vitest";
import { createDefaultProject, normalizeProject, parseProjectFile, serializeProject } from "./project";

describe("project file", () => {
  it("round-trips the starter project", () => {
    const project = createDefaultProject();
    const opened = parseProjectFile(serializeProject(project));
    expect(opened.name).toBe("Untitled");
    expect(opened.formulation.objects).toHaveLength(project.formulation.objects.length);
    expect(opened.thinking.nodes[0].kind).toBe("frame");
    expect(opened.game.entities.some((entity) => entity.role === "player")).toBe(true);
  });

  it("fills missing rooms from the starter project", () => {
    const opened = normalizeProject({ name: "Night", handy: 1 });
    expect(opened.name).toBe("Night");
    expect(opened.idea.layers.length).toBeGreaterThan(0);
    expect(opened.rendering.frames).toEqual([]);
  });

  it("rejects a file from somewhere else", () => {
    expect(() => parseProjectFile('{"ok":true}')).toThrow(/Handy project/);
  });
});
