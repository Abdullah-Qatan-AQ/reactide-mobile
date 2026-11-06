import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { IDEFile, languageForFile } from "@/lib/ide-model";
import { buildHtmlPreview } from "@/lib/html-preview";

type PreviewPanelProps = {
  file: IDEFile;
  files: IDEFile[];
  running: boolean;
  reloadKey: number;
  expanded: boolean;
  onRun: () => void;
  onOpenEditor: () => void;
  onToggleExpanded: () => void;
  onLoadComplete: () => void;
};

const ENTRY_NAMES = ["index.html", "App.jsx", "App.tsx", "app.jsx", "app.tsx", "index.jsx", "index.tsx", "main.jsx", "main.tsx", "main.js", "index.js", "main.ts"];

function projectEntry(files: IDEFile[], active: IDEFile): IDEFile {
  const htmlFiles = files.filter((candidate) => languageForFile(candidate.name) === "HTML");
  const htmlEntry = htmlFiles.find((candidate) => candidate.name.toLowerCase() === "index.html") ?? htmlFiles[0];
  if (htmlEntry) return htmlEntry;
  for (const name of ENTRY_NAMES.slice(1)) {
    const match = files.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
    if (match) return match;
  }
  const visualOrRunnable = files.find((candidate) => ["JavaScript", "TypeScript", "JSX", "TSX", "CSS", "Markdown", "JSON", "Python"].includes(languageForFile(candidate.name)));
  return visualOrRunnable ?? active;
}

export function PreviewPanel({ file, files, running, reloadKey, expanded, onRun, onOpenEditor, onToggleExpanded, onLoadComplete }: PreviewPanelProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const defaultEntry = projectEntry(files, file);
  const previewFile = files.find((candidate) => candidate.name === selectedName) ?? defaultEntry;
  const language = languageForFile(previewFile.name);
  const html = useMemo(() => buildHtmlPreview(previewFile, files), [previewFile, files]);
  const isVisual = ["HTML", "CSS", "Markdown", "JSON"].includes(language);

  return (
    <View style={styles.root}>
      <View style={styles.previewToolbar}>
        <View style={styles.urlBox}><View style={styles.onlineDot} /><Text style={styles.urlText} numberOfLines={1}>مشروع كامل · {previewFile.name}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="تحديث المعاينة" style={styles.refreshButton} onPress={onRun}><Text style={styles.refreshText}>{running ? "…" : "↻"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "تصغير المعاينة" : "تكبير المعاينة"} style={styles.expandButton} onPress={onToggleExpanded}><Text style={styles.expandText}>{expanded ? "↙" : "⛶"}</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filePicker}>
        {files.map((candidate) => <Pressable accessibilityRole="button" key={candidate.name} onPress={() => setSelectedName(candidate.name)} style={[styles.fileChip, candidate.name === previewFile.name && styles.fileChipActive]}><Text style={[styles.fileChipText, candidate.name === previewFile.name && styles.fileChipTextActive]} numberOfLines={1}>{candidate.name}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.previewStage}>
        <WebView
          key={`${previewFile.name}:${reloadKey}`}
          source={{ html, baseUrl: "about:blank" }}
          originWhitelist={["about:blank", "https://*"]}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => request.url.startsWith("about:blank") || request.url.startsWith("https://")}
          onLoadEnd={onLoadComplete}
          style={styles.webview}
        />
        <View pointerEvents="box-none" style={styles.statusOverlay}>
          <View style={styles.statusCard}><View style={[styles.onlineDot, running && styles.busyDot]} /><Text style={styles.statusTitle} numberOfLines={1}>{running ? `يتم تشغيل ${language}` : `${isVisual ? "معاينة رسومية" : "معاينة المشروع"} · ${language}`}</Text><Pressable onPress={onOpenEditor}><Text style={styles.runLink}>تحرير</Text></Pressable></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  previewToolbar: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, backgroundColor: "#111823", borderBottomWidth: 1, borderBottomColor: "#233043" },
  urlBox: { flex: 1, minWidth: 0, height: 34, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#0b0f16", flexDirection: "row", alignItems: "center", gap: 8 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#53c68c" },
  busyDot: { backgroundColor: "#d29922" },
  urlText: { flex: 1, color: "#8b98ab", fontFamily: "monospace", fontSize: 10 },
  refreshButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#1e2938", alignItems: "center", justifyContent: "center" },
  expandButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(97,218,251,.16)", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#61dafb", fontSize: 19, fontWeight: "700" },
  expandText: { color: "#61dafb", fontSize: 19, fontWeight: "700" },
  filePicker: { gap: 6, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#0f151f", borderBottomWidth: 1, borderBottomColor: "#233043" },
  fileChip: { maxWidth: 150, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#2d3d54" },
  fileChipActive: { backgroundColor: "rgba(97,218,251,.15)", borderColor: "#61dafb" },
  fileChipText: { color: "#8190a7", fontFamily: "monospace", fontSize: 10 },
  fileChipTextActive: { color: "#61dafb", fontWeight: "800" },
  previewStage: { flex: 1, minHeight: 0, backgroundColor: "#fff", position: "relative" },
  webview: { flex: 1, backgroundColor: "#fff" },
  statusOverlay: { position: "absolute", bottom: 8, left: 8, right: 8, alignItems: "center" },
  statusCard: { maxWidth: 440, width: "100%", paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: "#233043", backgroundColor: "rgba(17,24,35,.94)", flexDirection: "row", alignItems: "center", gap: 8 },
  statusTitle: { flex: 1, color: "#dbe3ee", fontWeight: "700", fontSize: 11 },
  runLink: { color: "#61dafb", fontWeight: "800", fontSize: 11 },
});
