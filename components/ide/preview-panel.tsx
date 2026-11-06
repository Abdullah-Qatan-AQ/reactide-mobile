import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { IDEFile, languageForFile } from "@/lib/ide-model";
import { buildHtmlPreview, projectPreviewEntry } from "@/lib/html-preview";

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
  const entry = projectPreviewEntry(files, file);
  const html = useMemo(() => buildHtmlPreview(entry, files), [entry, files]);

  return (
    <View style={styles.root}>
      <WebView
        key={`${entry.name}:${reloadKey}`}
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
      <View pointerEvents="box-none" style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="تحرير ملفات المشروع" onPress={onOpenEditor} style={styles.control}><Text style={styles.controlText}>تحرير</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="إعادة تشغيل معاينة المشروع" onPress={onRun} style={styles.control}><Text style={styles.refreshText}>{running ? "…" : "↻"}</Text></Pressable>
      </View>
      <View pointerEvents="none" style={styles.entryBadge}><View style={styles.dot} /><Text style={styles.entryText} numberOfLines={1}>معاينة المشروع · {entry.name} · {languageForFile(entry.name)}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: "#080c12", position: "relative" },
  webview: { flex: 1, backgroundColor: "#080c12" },
  controls: { position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 7 },
  control: { minWidth: 42, height: 38, paddingHorizontal: 11, borderRadius: 12, backgroundColor: "rgba(8,12,18,.78)", borderWidth: 1, borderColor: "rgba(255,255,255,.17)", alignItems: "center", justifyContent: "center" },
  controlText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  refreshText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  entryBadge: { position: "absolute", bottom: 8, left: 8, maxWidth: "75%", height: 28, paddingHorizontal: 9, borderRadius: 9, backgroundColor: "rgba(8,12,18,.68)", flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#53c68c" },
  entryText: { color: "rgba(255,255,255,.75)", fontSize: 10 },
});
