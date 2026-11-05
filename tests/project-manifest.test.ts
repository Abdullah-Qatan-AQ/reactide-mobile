import { describe, expect, it } from "vitest";
import type { IDEFile } from "../lib/ide-model";
import { inferProjectManifest, manifestForProject, parseProjectManifest } from "../lib/project-manifest";
import { engineForLanguage } from "../lib/runtime-engines";

const file = (name: string, content = ""): IDEFile => ({ name, content, updatedAt: 0 });

describe("project manifest", () => {
  it("discovers a Python entry and assigns roles by language", () => {
    const manifest = inferProjectManifest([file("index.html"), file("styles.css"), file("main.py"), file("data.json")]);
    expect(manifest.entry).toBe("main.py");
    expect(manifest.files["main.py"]?.role).toBe("runtime");
    expect(manifest.files["index.html"]?.role).toBe("view");
    expect(manifest.files["styles.css"]?.role).toBe("style");
    expect(manifest.files["data.json"]?.role).toBe("data");
  });

  it("keeps explicit roles and valid bindings while ignoring unknown files", () => {
    const files = [file("main.py"), file("index.html"), file("styles.css")];
    const manifest = parseProjectManifest(JSON.stringify({
      version: 1,
      entry: "main.py",
      files: {
        "main.py": { role: "runtime", engine: "python-embedded" },
        "index.html": { role: "view", engine: "android-webview-html" },
        "missing.js": { role: "runtime" },
      },
      bindings: [
        { from: "main.py", to: "index.html", export: "state", import: "window.projectState" },
        { from: "missing.js", to: "index.html" },
      ],
    }), files);
    expect(manifest.files["main.py"]?.engine).toBe("python-embedded");
    expect(manifest.bindings).toEqual([{ from: "main.py", to: "index.html", export: "state", import: "window.projectState" }]);
  });

  it("uses the manifest file when a project provides one", () => {
    const project = {
      id: "test",
      name: "test",
      files: [file("main.py"), file("index.html"), file("ide.project.json", JSON.stringify({ version: 1, entry: "index.html", files: { "main.py": { role: "runtime" }, "index.html": { role: "view" } }, bindings: [] }))],
      activeFile: "main.py",
      sourceUrl: "",
      sourceType: "local" as const,
      updatedAt: 0,
    };
    expect(manifestForProject(project).entry).toBe("index.html");
  });
});

describe("language engine registry", () => {
  it("keeps Python, TypeScript, and HTML on different engines", () => {
    expect(engineForLanguage("Python").id).toBe("python-embedded");
    expect(engineForLanguage("TypeScript").id).toBe("typescript-native-compiler");
    expect(engineForLanguage("HTML").id).toBe("android-webview-html");
    expect(engineForLanguage("Python").id).not.toBe(engineForLanguage("TypeScript").id);
  });
});
