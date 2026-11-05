import { useMemo } from "react";
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
  const language = languageForFile(file.name);
  const html = useMemo(() => buildHtmlPreview(file, files), [file, files]);
  const isVisual = ["HTML", "CSS", "Markdown", "JSON"].includes(language);

  return (
    <View style={styles.root}>
      <View style={styles.previewToolbar}>
        <View style={styles.urlBox}><View style={[styles.dot, { backgroundColor: "#53c68c" }]} /><Text style={styles.urlText}>local-preview://{file.name}</Text></View>
        <Pressable style={styles.refreshButton} onPress={onRun}><Text style={styles.refreshText}>{running ? "…" : "↻"}</Text></Pressable>
      </View>
      {html ? (
        <View style={styles.previewStage}>
          <View style={styles.deviceFrame}>
            <View style={styles.deviceTop}><View style={styles.camera} /></View>
            <WebView
              key={`${file.name}:${reloadKey}`}
              source={{ html, baseUrl: "about:blank" }}
              originWhitelist={["about:blank"]}
              javaScriptEnabled
              domStorageEnabled={false}
              allowFileAccess={false}
              allowUniversalAccessFromFileURLs={false}
              javaScriptCanOpenWindowsAutomatically={false}
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={(request) => request.url.startsWith("about:blank")}
              onLoadEnd={onLoadComplete}
              style={styles.webview}
            />
            <View style={styles.deviceBottom}><View style={styles.homeBar} /></View>
          </View>
          <View style={styles.statusCard}><View style={[styles.dot, { backgroundColor: running ? "#d29922" : "#53c68c" }]} /><View style={{ flex: 1 }}><Text style={styles.statusTitle}>{running ? `جارٍ تحديث معاينة ${language}` : `${isVisual ? "معاينة رسومية" : "معاينة غير رسومية"} · ${language}`}</Text><Text style={styles.statusBody}>المعاينة محلية؛ الاتصالات الخارجية وملفات الجهاز محظورة.</Text></View><Pressable onPress={onOpenEditor}><Text style={styles.runLink}>تحرير</Text></Pressable></View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.emptyStage}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>{language === "Python" ? "Py" : "{ }"}</Text></View>
            <Text style={styles.emptyTitle}>معاينة غير رسومية</Text>
            <Text style={styles.emptyBody}>يُعرض كود {language} بأمان دون تنفيذه محليًا، مع دعم التحديث والحفظ لكل الملفات.</Text>
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
  previewStage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, gap: 12 },
  deviceFrame: { flex: 1, width: "100%", maxWidth: 390, borderRadius: 22, borderWidth: 6, borderColor: "#253247", backgroundColor: "#fff", overflow: "hidden" },
  deviceTop: { height: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0f16" },
  camera: { width: 44, height: 4, borderRadius: 4, backgroundColor: "#253247" },
  webview: { flex: 1, backgroundColor: "#fff" },
  deviceBottom: { height: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0f16" },
  homeBar: { width: 60, height: 3, borderRadius: 4, backgroundColor: "#4a5a70" },
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
