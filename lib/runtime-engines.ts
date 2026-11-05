import type { IDELanguage } from "./ide-model";

export type RuntimeEngine = {
  id: string;
  language: IDELanguage;
  kind: "native" | "web" | "renderer";
  android: "planned" | "available";
  supportsGraphics: boolean;
  supportsPackages: "npm" | "pypi" | "none";
  notes: string;
};

export const RUNTIME_ENGINES: Record<IDELanguage, RuntimeEngine> = {
  JavaScript: { id: "javascript-v8", language: "JavaScript", kind: "native", android: "planned", supportsGraphics: true, supportsPackages: "npm", notes: "Dedicated JavaScript runtime; no source-language conversion." },
  TypeScript: { id: "typescript-native-compiler", language: "TypeScript", kind: "native", android: "planned", supportsGraphics: true, supportsPackages: "npm", notes: "TypeScript compiler feeds the JavaScript runtime while preserving TypeScript diagnostics." },
  JSX: { id: "jsx-react-compiler", language: "JSX", kind: "native", android: "planned", supportsGraphics: true, supportsPackages: "npm", notes: "React JSX compiler and renderer." },
  TSX: { id: "tsx-react-typescript", language: "TSX", kind: "native", android: "planned", supportsGraphics: true, supportsPackages: "npm", notes: "TypeScript plus React JSX compiler and renderer." },
  CSS: { id: "android-webview-css", language: "CSS", kind: "web", android: "available", supportsGraphics: true, supportsPackages: "none", notes: "Android WebView CSS engine." },
  HTML: { id: "android-webview-html", language: "HTML", kind: "web", android: "available", supportsGraphics: true, supportsPackages: "none", notes: "Android WebView HTML engine." },
  JSON: { id: "json-tree-renderer", language: "JSON", kind: "renderer", android: "available", supportsGraphics: true, supportsPackages: "none", notes: "Native data/tree renderer." },
  Markdown: { id: "markdown-renderer", language: "Markdown", kind: "renderer", android: "available", supportsGraphics: true, supportsPackages: "none", notes: "Markdown renderer with native output surface." },
  Python: { id: "python-embedded", language: "Python", kind: "native", android: "planned", supportsGraphics: true, supportsPackages: "pypi", notes: "Embedded CPython/Python-for-Android runtime with native package environment." },
  Text: { id: "text-renderer", language: "Text", kind: "renderer", android: "available", supportsGraphics: true, supportsPackages: "none", notes: "Native text page renderer." },
};

export function engineForLanguage(language: IDELanguage): RuntimeEngine {
  return RUNTIME_ENGINES[language];
}
