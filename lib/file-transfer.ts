import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { IDEFile, IDEProject } from "@/lib/ide-model";

export type ProjectBundle = { format: "reactide-project"; version: 1; project: IDEProject };

export async function pickProjectInput(): Promise<{ name: string; content: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri);
  return { name: asset.name, content };
}

export async function shareProjectBundle(project: IDEProject): Promise<void> {
  if (!FileSystem.cacheDirectory) throw new Error("لا توجد مساحة تخزين مؤقتة متاحة");
  const filename = `${project.name.replace(/[^a-zA-Z0-9_-]/g, "-")}.reactide.json`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  const bundle: ProjectBundle = { format: "reactide-project", version: 1, project };
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(bundle, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "تصدير مشروع React IDE" });
    return;
  }
  throw new Error("مشاركة الملفات غير متاحة على هذا الجهاز");
}

export function parseImportedProject(name: string, content: string): IDEProject | IDEFile {
  if (name.toLowerCase().endsWith(".json")) {
    try {
      const parsed = JSON.parse(content) as Partial<ProjectBundle>;
      if (parsed.format === "reactide-project" && parsed.project?.files?.length) return parsed.project;
    } catch {
      // Treat invalid JSON as a normal source file so the user can inspect it.
    }
  }
  return { name, content, updatedAt: Date.now() };
}
