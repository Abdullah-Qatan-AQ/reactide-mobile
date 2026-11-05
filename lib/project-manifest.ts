import type { IDEFile, IDELanguage, IDEProject } from "./ide-model";
import { languageForFile } from "./ide-model";

export type ProjectFileRole = "runtime" | "view" | "style" | "data" | "docs" | "text";

export type ProjectFileConfig = {
  role: ProjectFileRole;
  language?: IDELanguage;
  engine?: string;
};

export type ProjectBinding = {
  from: string;
  to: string;
  export?: string;
  import?: string;
};

export type IDEProjectManifest = {
  version: 1;
  entry: string;
  files: Record<string, ProjectFileConfig>;
  bindings: ProjectBinding[];
  dependencies?: {
    npm?: Record<string, string>;
    python?: string[];
  };
};

const ROLE_BY_LANGUAGE: Record<IDELanguage, ProjectFileRole> = {
  JavaScript: "runtime",
  TypeScript: "runtime",
  JSX: "runtime",
  TSX: "runtime",
  Python: "runtime",
  HTML: "view",
  CSS: "style",
  JSON: "data",
  Markdown: "docs",
  Text: "text",
};

const ENTRY_PRIORITY: IDELanguage[] = ["Python", "TypeScript", "TSX", "JavaScript", "JSX", "HTML"];

export const PROJECT_MANIFEST_FILE = "ide.project.json";

export function inferProjectManifest(files: IDEFile[]): IDEProjectManifest {
  const fileMap = Object.fromEntries(
    files
      .filter((file) => file.name !== PROJECT_MANIFEST_FILE)
      .map((file) => {
        const language = languageForFile(file.name);
        return [file.name, { role: ROLE_BY_LANGUAGE[language], language } satisfies ProjectFileConfig];
      }),
  );
  const entry = ENTRY_PRIORITY.flatMap((language) =>
    files.filter((file) => languageForFile(file.name) === language).map((file) => file.name),
  )[0] ?? files[0]?.name ?? "";
  return { version: 1, entry, files: fileMap, bindings: [] };
}

export function parseProjectManifest(content: string, files: IDEFile[]): IDEProjectManifest {
  const fallback = inferProjectManifest(files);
  try {
    const value = JSON.parse(content) as Partial<IDEProjectManifest>;
    if (value.version !== 1 || typeof value.entry !== "string" || !value.files || typeof value.files !== "object") return fallback;
    const available = new Set(files.map((file) => file.name));
    const normalizedFiles: Record<string, ProjectFileConfig> = {};
    for (const [name, config] of Object.entries(value.files)) {
      if (!available.has(name) || !config || typeof config !== "object") continue;
      const role = (config as ProjectFileConfig).role;
      if (!["runtime", "view", "style", "data", "docs", "text"].includes(role)) continue;
      normalizedFiles[name] = { role, language: (config as ProjectFileConfig).language, engine: (config as ProjectFileConfig).engine };
    }
    const entry = available.has(value.entry) ? value.entry : fallback.entry;
    const bindings = Array.isArray(value.bindings)
      ? value.bindings.filter((binding): binding is ProjectBinding => Boolean(binding && available.has(binding.from) && available.has(binding.to)))
      : [];
    return { version: 1, entry, files: { ...fallback.files, ...normalizedFiles }, bindings, dependencies: value.dependencies };
  } catch {
    return fallback;
  }
}

export function manifestForProject(project: IDEProject): IDEProjectManifest {
  const manifestFile = project.files.find((file) => file.name === PROJECT_MANIFEST_FILE);
  return manifestFile ? parseProjectManifest(manifestFile.content, project.files) : inferProjectManifest(project.files);
}

export function manifestToFile(manifest: IDEProjectManifest, updatedAt = Date.now()): IDEFile {
  return { name: PROJECT_MANIFEST_FILE, content: `${JSON.stringify(manifest, null, 2)}\n`, updatedAt };
}

export function updateProjectManifest(project: IDEProject, manifest: IDEProjectManifest): IDEProject {
  const nextFile = manifestToFile(manifest);
  const files = project.files.some((file) => file.name === PROJECT_MANIFEST_FILE)
    ? project.files.map((file) => (file.name === PROJECT_MANIFEST_FILE ? nextFile : file))
    : [...project.files, nextFile];
  return { ...project, files, updatedAt: Date.now() };
}
