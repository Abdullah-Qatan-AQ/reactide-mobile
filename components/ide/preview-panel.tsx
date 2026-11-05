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
  onRun: () => void;
  onOpenEditor: () => void;
  onLoadComplete: () => void;
};

export function PreviewPanel({ file, files, running, reloadKey, onRun, onOpenEditor, onLoadComplete }: PreviewPanelProps) {
  const [selectedName, setSelectedName] = useState(file.name);
  const previewFile = files.find((candidate) => candidate.name === selectedName) ?? file;
  const language = languageForFile(previewFile.name);
  const html = useMemo(() => buildHtmlPreview(previewFile, files), [previewFile, files]);
  const isVisual = ["HTML", "CSS", "Markdown", "JSON"].includes(language);

  return (
    <View style={styles.root}>
      <View style={styles.previewToolbar}>
        <View style={styles.urlBox}><View style={[styles.dot, { backgroundColor: "#53c68c" }]} /><Text style={styles.urlText}>local-preview://{previewFile.name}</Text></View>
        <Pressable style={styles.refreshButton} onPress={onRun}><Text style={styles.refreshText}>{running ? "…" : "↻"}</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filePicker}>
        {files.map((candidate) => <Pressable key={candidate.name} onPress={() => setSelectedName(candidate.name)} style={[styles.fileChip, candidate.name === previewFile.name && styles.fileChipActive]}><Text style={[styles.fileChipText, candidate.name === previewFile.name && styles.fileChipTextActive]}>{candidate.name}</Text></Pressable>)}
      </ScrollView>
      {html ? (
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
          <View style={styles.statusCard}><View style={[styles.dot, { backgroundColor: running ? "#d29922" : "#53c68c" }]} /><View style={{ flex: 1 }}><Text style={styles.statusTitle}>{running ? `جارٍ تحديث معاينة ${language}` : `${isVisual ? "معاينة رسومية" : "معاينة رسومية للمكوّن"} · ${language}`}</Text><Text style={styles.statusBody}>تضم المعاينة ملفات المشروع، ويمكن اختيار أي ملف من الشريط أعلاه.</Text></View><Pressable onPress={onOpenEditor}><Text style={styles.runLink}>تحرير</Text></Pressable></View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.emptyStage}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>{language === "Python" ? "Py" : "{ }"}</Text></View>
            <Text style={styles.emptyTitle}>معاينة رسومية</Text>
            <Text style={styles.emptyBody}>يُعرض مشهد رسومي لهذا الملف مع الكود والاعتماديات المكتشفة.</Text>
            <Pressable style={styles.editButton} onPress={onOpenEditor}><Text style={styles.editButtonText}>العودة إلى المحرر</Text></Pressable>
          </View>
          <View style={styles.statusCard}><View style={[styles.dot, { backgroundColor: "#53c68c" }]} /><View style={{ flex: 1 }}><Text style={styles.statusTitle}>المعاينة متصلة</Text><Text style={styles.statusBody}>{file.name} · {language}</Text></View></View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  previewToolbar: { height: 54, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, backgroundColor: "#111823", borderBottomWidth: 1, borderBottomColor: "#233043" },
  urlBox: { flex: 1, height: 34, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#0b0f16", flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  urlText: { color: "#8b98ab", fontFamily: "monospace", fontSize: 10 },
  refreshButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1e2938", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#61dafb", fontSize: 20, fontWeight: "700" },
  filePicker: { gap: 7, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#0f151f", borderBottomWidth: 1, borderBottomColor: "#233043" },
  fileChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#2d3d54" },
  fileChipActive: { backgroundColor: "rgba(97,218,251,.15)", borderColor: "#61dafb" },
  fileChipText: { color: "#8190a7", fontFamily: "monospace", fontSize: 10 },
  fileChipTextActive: { color: "#61dafb", fontWeight: "800" },
  previewStage: { flex: 1, minHeight: 0, backgroundColor: "#fff" },
  webview: { flex: 1, backgroundColor: "#fff" },
  emptyStage: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 18, gap: 14 },
  emptyCard: { width: "100%", maxWidth: 390, padding: 22, borderRadius: 18, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#111823", alignItems: "center" },
  emptyIcon: { width: 52, height: 52, borderRadius: 15, backgroundColor: "#1e2938", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyIconText: { color: "#61dafb", fontWeight: "900", fontFamily: "monospace", fontSize: 14 },
  emptyTitle: { color: "#f4f8fc", fontWeight: "800", textAlign: "center", fontSize: 16 },
  emptyBody: { color: "#91a1b7", textAlign: "center", lineHeight: 20, fontSize: 12, marginTop: 10 },
  editButton: { marginTop: 18, borderRadius: 11, backgroundColor: "#61dafb", paddingHorizontal: 16, paddingVertical: 11 },
  editButtonText: { color: "#04222e", fontWeight: "800", fontSize: 12 },
  statusCard: { width: "100%", maxWidth: 390, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#233043", backgroundColor: "#111823", flexDirection: "row", alignItems: "center", gap: 10 },
  statusTitle: { color: "#dbe3ee", fontWeight: "700", fontSize: 12 },
  statusBody: { color: "#64738a", fontSize: 10, marginTop: 3 },
  runLink: { color: "#61dafb", fontWeight: "800", fontSize: 12 },
});
