import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { IDEFile, IDEProject } from "@/lib/ide-model";

export type ProjectBundle = { format: "reactide-project"; version: 1; project: IDEProject };
const MAX_IMPORT_BYTES = 4_000_000;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 500_000;
const utf8Length = (value: string) => encodeURIComponent(value).replace(/%[0-9A-F]{2}/gi, "U").length;
const safeName = (name: unknown): name is string =>
  typeof name === "string" && name.length > 0 && name.length <= 120 &&
  name !== "." && name !== ".." && !/[\\/\u0000-\u001f\u007f]/.test(name);

export async function pickProjectInput(): Promise<{ name: string; content: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_IMPORT_BYTES) throw new Error("حجم الملف أكبر من الحد المسموح (4 ميغابايت).");
  const content = await FileSystem.readAsStringAsync(asset.uri);
  if (utf8Length(content) > MAX_IMPORT_BYTES) throw new Error("حجم الملف أكبر من الحد المسموح (4 ميغابايت).");
  return { name: asset.name, content };
}

export async function shareProjectBundle(project: IDEProject): Promise<void> {
  if (!FileSystem.cacheDirectory) throw new Error("لا توجد مساحة تخزين مؤقتة متاحة");
  const safeProject = validateBundle({ format: "reactide-project", version: 1, project });
  const filename = `${project.name.replace(/[^a-zA-Z0-9_-]/g, "-")}.reactide.json`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  const bundle: ProjectBundle = { format: "reactide-project", version: 1, project: safeProject };
  const serialized = JSON.stringify(bundle, null, 2);
  if (utf8Length(serialized) > MAX_IMPORT_BYTES) throw new Error("حجم حزمة التصدير يتجاوز 4 ميغابايت.");
  await FileSystem.writeAsStringAsync(uri, serialized);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "تصدير مشروع React IDE" });
    return;
  }
  throw new Error("مشاركة الملفات غير متاحة على هذا الجهاز");
}

function validateBundle(input: unknown): IDEProject {
  if (!input || typeof input !== "object") throw new Error("بنية حزمة المشروع غير صالحة.");
  const bundle = input as Partial<ProjectBundle>;
  const project = bundle.project as Partial<IDEProject> | undefined;
  if (bundle.format !== "reactide-project" || bundle.version !== 1 || !project ||
      !safeName(project.name) || !Array.isArray(project.files) || project.files.length < 1 ||
      project.files.length > MAX_FILES) throw new Error("الحزمة ليست بصيغة React IDE مدعومة.");
  const seen = new Set<string>();
  let total = 0;
  const files: IDEFile[] = project.files.map((candidate) => {
    if (!candidate || !safeName(candidate.name) || typeof candidate.content !== "string") {
      throw new Error("الحزمة تحتوي على ملف غير صالح أو مسار مجلد.");
    }
    const nameKey = candidate.name.toLowerCase();
    if (seen.has(nameKey)) throw new Error(`اسم الملف مكرر: ${candidate.name}`);
    seen.add(nameKey);
    const size = utf8Length(candidate.content);
    if (size > MAX_FILE_BYTES) throw new Error(`الملف ${candidate.name} أكبر من 500 كيلوبايت.`);
    total += size;
    if (total > MAX_IMPORT_BYTES) throw new Error("إجمالي حجم الملفات أكبر من 4 ميغابايت.");
    return { name: candidate.name, content: candidate.content, updatedAt: Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : Date.now() };
  });
  const activeFile = files.some((file) => file.name === project.activeFile) ? project.activeFile! : files[0].name;
  const sourceType = ["local", "github", "git", "zip"].includes(String(project.sourceType))
    ? project.sourceType! : "local";
  return {
    id: typeof project.id === "string" ? project.id.slice(0, 120) : `import-${Date.now()}`,
    name: project.name,
    files,
    activeFile,
    sourceUrl: typeof project.sourceUrl === "string" ? project.sourceUrl.slice(0, 2000) : "",
    sourceType,
    updatedAt: Number.isFinite(project.updatedAt) ? Number(project.updatedAt) : Date.now(),
  };
}

export function parseImportedProject(name: string, content: string): IDEProject | IDEFile {
  if (!safeName(name)) throw new Error("اسم الملف يحتوي على مسار غير مسموح أو أطول من 120 حرفًا.");
  if (utf8Length(content) > MAX_IMPORT_BYTES) throw new Error("حجم الملف أكبر من الحد المسموح (4 ميغابايت).");
  if (name.toLowerCase().endsWith(".reactide.json")) {
    let parsed: unknown;
    try { parsed = JSON.parse(content); }
    catch { throw new Error("ملف حزمة React IDE ليس JSON صالحًا."); }
    return validateBundle(parsed);
  }
  return { name, content, updatedAt: Date.now() };
}
