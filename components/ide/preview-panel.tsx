import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { IDEFile, languageForFile } from "@/lib/ide-model";

type PreviewPanelProps = {
  file: IDEFile;
  running: boolean;
  onRun: () => void;
  onOpenEditor: () => void;
};

export function PreviewPanel({ file, running, onRun, onOpenEditor }: PreviewPanelProps) {
  const language = languageForFile(file.name);
  const hasReact = /return\s*\(?\s*<|function\s+App/.test(file.content);

  return (
    <View style={styles.root}>
      <View style={styles.previewToolbar}>
        <View style={styles.urlBox}>
          <View style={styles.greenDot} />
          <Text style={styles.urlText}>preview://mobile-starter</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={onRun}>
          <Text style={styles.refreshText}>{running ? "…" : "↻"}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.stage}>
        <View style={styles.deviceFrame}>
          <View style={styles.deviceTop}><View style={styles.camera} /></View>
          <View style={styles.previewSurface}>
            {hasReact ? (
              <>
                <View style={styles.previewBrand}><View style={styles.reactMark}><Text style={styles.reactMarkText}>R&gt;</Text></View><Text style={styles.previewLabel}>React IDE</Text></View>
                <Text style={styles.previewEyebrow}>MOBILE WORKSHOP</Text>
                <Text style={styles.previewTitle}>ابنِ فكرتك{`\n`}من الهاتف</Text>
                <Text style={styles.previewBody}>تعديل سريع، معاينة مباشرة، وربط واضح مع مشروعك الخارجي.</Text>
                <Pressable style={styles.previewCta} onPress={onOpenEditor}><Text style={styles.previewCtaText}>تعديل الكود</Text></Pressable>
                <View style={styles.previewStats}><View><Text style={styles.statValue}>04</Text><Text style={styles.statLabel}>ملفات</Text></View><View><Text style={styles.statValue}>JSX</Text><Text style={styles.statLabel}>اللغة</Text></View><View><Text style={styles.statValue}>✓</Text><Text style={styles.statLabel}>جاهز</Text></View></View>
              </>
            ) : (
              <View style={styles.emptyPreview}><Text style={styles.emptyIcon}>◇</Text><Text style={styles.emptyTitle}>لا توجد معاينة React لهذا الملف</Text><Text style={styles.emptyBody}>افتح ملف JSX أو TSX ثم شغّل المعاينة، أو اربط runtime خارجي للغة {language}.</Text></View>
            )}
          </View>
          <View style={styles.deviceBottom}><View style={styles.homeBar} /></View>
        </View>
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, { backgroundColor: running ? "#d29922" : "#53c68c" }]} />
          <View style={{ flex: 1 }}><Text style={styles.statusTitle}>{running ? "جارٍ بناء المعاينة" : "المعاينة جاهزة"}</Text><Text style={styles.statusBody}>مصدر العرض: {file.name} · محرك React معزول</Text></View>
          <Pressable onPress={onRun}><Text style={styles.runLink}>تشغيل</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  previewToolbar: { height: 54, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, backgroundColor: "#111823", borderBottomWidth: 1, borderBottomColor: "#233043" },
  urlBox: { flex: 1, height: 34, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#0b0f16", flexDirection: "row", alignItems: "center", gap: 8 },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#53c68c" },
  urlText: { color: "#8b98ab", fontFamily: "monospace", fontSize: 11 },
  refreshButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1e2938", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#61dafb", fontSize: 20, fontWeight: "700" },
  stage: { alignItems: "center", padding: 18, gap: 14 },
  deviceFrame: { width: 280, minHeight: 510, borderRadius: 29, borderWidth: 7, borderColor: "#253247", backgroundColor: "#04070b", overflow: "hidden", shadowColor: "#000", shadowOpacity: .4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  deviceTop: { height: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0f16" },
  camera: { width: 50, height: 5, borderRadius: 4, backgroundColor: "#253247" },
  previewSurface: { flex: 1, padding: 22, backgroundColor: "#101c2a" },
  previewBrand: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 42 },
  reactMark: { width: 25, height: 25, borderRadius: 8, backgroundColor: "#61dafb", alignItems: "center", justifyContent: "center" },
  reactMarkText: { color: "#04222e", fontSize: 10, fontWeight: "900" },
  previewLabel: { color: "#dbe3ee", fontWeight: "700", fontSize: 11 },
  previewEyebrow: { color: "#61dafb", letterSpacing: 1.3, fontSize: 8, fontWeight: "800" },
  previewTitle: { color: "#f4f8fc", fontSize: 28, fontWeight: "800", lineHeight: 34, marginTop: 10 },
  previewBody: { color: "#9caec5", lineHeight: 18, fontSize: 11, marginTop: 14 },
  previewCta: { marginTop: 24, alignSelf: "flex-start", borderRadius: 11, backgroundColor: "#61dafb", paddingHorizontal: 14, paddingVertical: 10 },
  previewCtaText: { color: "#04222e", fontSize: 11, fontWeight: "800" },
  previewStats: { marginTop: 35, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#26384d", flexDirection: "row", justifyContent: "space-between" },
  statValue: { color: "#dbe3ee", fontWeight: "800", fontSize: 15 },
  statLabel: { color: "#6e8099", fontSize: 9, marginTop: 3 },
  deviceBottom: { height: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0f16" },
  homeBar: { width: 70, height: 4, borderRadius: 4, backgroundColor: "#4a5a70" },
  emptyPreview: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  emptyIcon: { color: "#61dafb", fontSize: 34, marginBottom: 12 },
  emptyTitle: { color: "#f4f8fc", fontWeight: "800", textAlign: "center", fontSize: 15 },
  emptyBody: { color: "#91a1b7", textAlign: "center", lineHeight: 18, fontSize: 11, marginTop: 8 },
  statusCard: { width: "100%", padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#233043", backgroundColor: "#111823", flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusTitle: { color: "#dbe3ee", fontWeight: "700", fontSize: 12 },
  statusBody: { color: "#64738a", fontSize: 10, marginTop: 3 },
  runLink: { color: "#61dafb", fontWeight: "800", fontSize: 12 },
});
