import AsyncStorage from "@react-native-async-storage/async-storage";

export type IDEView = "editor" | "preview" | "console" | "terminal" | "files" | "projects" | "settings";

export type IDELanguage =
  | "JavaScript"
  | "TypeScript"
  | "JSX"
  | "TSX"
  | "CSS"
  | "HTML"
  | "JSON"
  | "Markdown"
  | "Python"
  | "Text";

export type IDEFile = {
  name: string;
  content: string;
  updatedAt: number;
};

export type IDEProject = {
  id: string;
  name: string;
  files: IDEFile[];
  activeFile: string;
  sourceUrl: string;
  sourceType: "local" | "github" | "git" | "zip";
  updatedAt: number;
};

export type IDELog = {
  id: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  time: string;
};

export const STORAGE_KEY = "reactide-mobile-project-v1";

const now = () => Date.now();

export const DEFAULT_FILES: IDEFile[] = [
  {
    name: "App.jsx",
    content: `import React from "react";

export default function App() {
  return (
    <main className="screen">
      <span className="eyebrow">React IDE Mobile</span>
      <h1>ابنِ فكرتك من الهاتف</h1>
      <p>عدّل الكود، شغّل المعاينة، واربط مشروعك الخارجي عندما تكون جاهزًا.</p>
      <button>ابدأ الآن</button>
    </main>
  );
}`,
    updatedAt: now(),
  },
  {
    name: "styles.css",
    content: `.screen {
  min-height: 100vh;
  padding: 32px;
  background: #0b0f16;
  color: #dbe3ee;
  font-family: system-ui;
}

button {
  border: 0;
  border-radius: 12px;
  padding: 12px 18px;
  background: #61dafb;
  color: #04222e;
  font-weight: 700;
}`,
    updatedAt: now(),
  },
  {
    name: "README.md",
    content: `# مشروع React

هذا المشروع محفوظ على جهازك ويمكن ربطه لاحقًا بمستودع خارجي.

## الملفات
- App.jsx — نقطة الدخول
- styles.css — النمط العام
- main.py — مثال Python قابل للربط بمشغل خارجي
`,
    updatedAt: now(),
  },
  {
    name: "main.py",
    content: `def greet(name: str) -> str:
    return f"مرحبًا {name}"

if __name__ == "__main__":
    print(greet("React IDE"))
`,
    updatedAt: now(),
  },
  {
    name: "ide.project.json",
    content: `{
  "version": 1,
  "entry": "App.jsx",
  "files": {
    "main.py": { "role": "runtime", "language": "Python", "engine": "python-embedded" },
    "App.jsx": { "role": "runtime", "language": "JSX", "engine": "jsx-react-compiler" },
    "styles.css": { "role": "style", "language": "CSS", "engine": "android-webview-css" },
    "README.md": { "role": "docs", "language": "Markdown", "engine": "markdown-renderer" }
  },
  "bindings": []
}
`,
    updatedAt: now(),
  },
];

export const DEFAULT_PROJECT: IDEProject = {
  id: "local-react-project",
  name: "mobile-starter",
  files: DEFAULT_FILES,
  activeFile: "App.jsx",
  sourceUrl: "",
  sourceType: "local",
  updatedAt: now(),
};

const EXTENSION_LANGUAGE: Record<string, IDELanguage> = {
  js: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  ts: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  css: "CSS",
  html: "HTML",
  htm: "HTML",
  json: "JSON",
  md: "Markdown",
  mdx: "Markdown",
  py: "Python",
};

export function languageForFile(name: string): IDELanguage {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_LANGUAGE[extension] ?? "Text";
}

export function languageTone(language: IDELanguage): string {
  switch (language) {
    case "JSX":
    case "TSX":
      return "#61dafb";
    case "TypeScript":
    case "JavaScript":
      return "#f2c94c";
    case "CSS":
      return "#9b8cff";
    case "Python":
      return "#53c68c";
    case "HTML":
      return "#ff8a65";
    case "JSON":
      return "#e8b86b";
    case "Markdown":
      return "#b6c2d9";
    default:
      return "#8391a7";
  }
}

export function starterForFile(name: string): string {
  const language = languageForFile(name);
  if (language === "CSS") return ":root {\n  color-scheme: dark;\n}\n";
  if (language === "HTML") return "<!doctype html>\n<html lang=\"ar\" dir=\"rtl\">\n  <body>\n    <h1>مشروعي الجديد</h1>\n  </body>\n</html>\n";
  if (language === "JSON") return "{\n  \"name\": \"مشروع جديد\",\n  \"version\": \"1.0.0\"\n}\n";
  if (language === "Markdown") return "# مشروع جديد\n\nاكتب ملاحظاتك هنا.\n";
  if (language === "Python") return "def main():\n    print(\"Hello from Python\")\n\nif __name__ == \"__main__\":\n    main()\n";
  if (language === "TypeScript" || language === "TSX") return "export default function App() {\n  return null;\n}\n";
  if (language === "JSX") return "export default function App() {\n  return <div>Hello</div>;\n}\n";
  return "export default function main() {\n  return \"Hello\";\n}\n";
}

export function cloneDefaultProject(): IDEProject {
  return {
    ...DEFAULT_PROJECT,
    files: DEFAULT_FILES.map((file) => ({ ...file, updatedAt: now() })),
    updatedAt: now(),
  };
}

export async function loadProject(): Promise<IDEProject> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultProject();
    const parsed = JSON.parse(raw) as IDEProject;
    if (!parsed?.files?.length) return cloneDefaultProject();
    return parsed;
  } catch {
    return cloneDefaultProject();
  }
}

export async function saveProject(project: IDEProject): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function projectToText(project: IDEProject): string {
  const header = `# ${project.name}\n# مصدر المشروع: ${project.sourceType === "local" ? "محلي" : project.sourceUrl || "خارجي"}\n\n`;
  return header + project.files.map((file) => `===== ${file.name} =====\n${file.content}\n`).join("\n");
}

export function formatClock(date = new Date()): string {
  return date.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

export function fileIcon(name: string): string {
  const language = languageForFile(name);
  if (language === "JSX" || language === "TSX") return "⚛";
  if (language === "CSS") return "◈";
  if (language === "Python") return "⌘";
  if (language === "Markdown") return "▤";
  if (language === "JSON") return "{}";
  return "◇";
}
