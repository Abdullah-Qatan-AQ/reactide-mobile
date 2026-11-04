import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { IDEFile, fileIcon, languageForFile, languageTone } from "@/lib/ide-model";

type FilesPanelProps = {
  files: IDEFile[];
  activeFile: string;
  onSelect: (name: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onExport: () => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
};

export function FilesPanel({ files, activeFile, onSelect, onAdd, onImport, onExport, onRename, onDelete }: FilesPanelProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.kicker}>WORKSPACE</Text>
          <Text style={styles.title}>ملفات المشروع</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryButton} onPress={onImport} accessibilityRole="button" accessibilityLabel="استيراد ملف أو مشروع">
            <Text style={styles.secondaryText}>استيراد</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={onAdd} accessibilityRole="button" accessibilityLabel="إضافة ملف">
            <Text style={styles.addText}>＋ ملف</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.treeCard}>
        <View style={styles.treeTop}>
          <Text style={styles.folderIcon}>⌄</Text>
          <Text style={styles.folderName}>mobile-starter</Text>
          <Text style={styles.localPill}>محلي</Text>
        </View>
        {files.map((file) => {
          const language = languageForFile(file.name);
          const selected = file.name === activeFile;
          const cannotDelete = files.length <= 1;
          return (
            <View key={file.name} style={[styles.fileRow, selected && styles.fileRowSelected]}>
              <Pressable
                onPress={() => onSelect(file.name)}
                style={styles.fileMain}
                accessibilityRole="button"
                accessibilityLabel={`فتح ${file.name}`}
              >
                <Text style={[styles.fileIcon, { color: languageTone(language) }]}>{fileIcon(file.name)}</Text>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, selected && styles.fileNameSelected]} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileMeta}>{language} · {file.content.split("\n").length} أسطر</Text>
                </View>
              </Pressable>
              <View style={styles.fileActions}>
                <Pressable onPress={() => onRename(file.name)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`إعادة تسمية ${file.name}`}>
                  <Text style={styles.actionText}>✎</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDelete(file.name)}
                  disabled={cannotDelete}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`حذف ${file.name}`}
                  accessibilityState={{ disabled: cannotDelete }}
                >
                  <Text style={[styles.deleteAction, cannotDelete && styles.actionDisabled]}>⌫</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
      <Pressable style={styles.exportButton} onPress={onExport} accessibilityRole="button" accessibilityLabel="تصدير حزمة المشروع">
        <Text style={styles.exportIcon}>↗</Text><Text style={styles.exportText}>تصدير حزمة المشروع</Text><Text style={styles.exportHint}>.reactide.json</Text>
      </Pressable>
      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>⌁</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipTitle}>تخزين محلي على الجهاز</Text>
          <Text style={styles.tipBody}>تُحفظ تعديلاتك تلقائيًا في مساحة التطبيق، ويمكنك تصدير المشروع أو ربطه بمصدر خارجي.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: "#61dafb", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  title: { color: "#f3f7fc", fontSize: 22, fontWeight: "800", marginTop: 3 },
  addButton: { backgroundColor: "#61dafb", borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 },
  addText: { color: "#04222e", fontWeight: "800", fontSize: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  secondaryButton: { borderWidth: 1, borderColor: "#2d3d54", borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 },
  secondaryText: { color: "#b6c2d2", fontSize: 11, fontWeight: "700" },
  treeCard: { borderRadius: 16, borderWidth: 1, borderColor: "#233043", backgroundColor: "#111823", overflow: "hidden" },
  treeTop: { height: 46, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#233043" },
  folderIcon: { color: "#61dafb", fontSize: 18 },
  folderName: { color: "#dbe3ee", fontWeight: "800", flex: 1 },
  localPill: { color: "#53c68c", fontSize: 10, backgroundColor: "rgba(83,198,140,.12)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  fileRow: { minHeight: 64, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#1b2635" },
  fileRowSelected: { backgroundColor: "rgba(97,218,251,.10)", borderLeftWidth: 3, borderLeftColor: "#61dafb" },
  fileMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  fileIcon: { width: 28, textAlign: "center", fontFamily: "monospace", fontWeight: "800", fontSize: 15 },
  fileInfo: { flex: 1, minWidth: 0 },
  fileName: { color: "#aebbd0", fontFamily: "monospace", fontSize: 13, fontWeight: "700" },
  fileNameSelected: { color: "#f3f7fc" },
  fileMeta: { color: "#64738a", fontSize: 10, marginTop: 4 },
  fileActions: { width: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionText: { color: "#8b98ab", fontSize: 16, fontWeight: "700" },
  deleteAction: { color: "#ff8f8a", fontSize: 18, fontWeight: "800" },
  actionDisabled: { opacity: 0.35 },
  tipCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 14, backgroundColor: "#18212e", borderWidth: 1, borderColor: "#2d3d54" },
  exportButton: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#111823" },
  exportIcon: { color: "#61dafb", fontSize: 18 },
  exportText: { color: "#dbe3ee", fontWeight: "800", fontSize: 12 },
  exportHint: { color: "#64738a", fontFamily: "monospace", fontSize: 10, marginLeft: "auto" },
  tipIcon: { color: "#61dafb", fontSize: 22 },
  tipTitle: { color: "#dbe3ee", fontWeight: "700", fontSize: 12 },
  tipBody: { color: "#8b98ab", fontSize: 11, lineHeight: 17, marginTop: 3 },
});
