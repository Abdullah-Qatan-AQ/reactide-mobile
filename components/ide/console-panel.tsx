import { ScrollView, StyleSheet, Text, View } from "react-native";

import { IDELog } from "@/lib/ide-model";

type ConsolePanelProps = { logs: IDELog[] };

export function ConsolePanel({ logs }: ConsolePanelProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>LOCAL EVENTS</Text>
          <Text style={styles.title}>سجل النشاط</Text>
        </View>
        <View style={styles.localTag}><View style={styles.localDot} /><Text style={styles.localText}>محلي</Text></View>
      </View>
      {logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⌁</Text>
          <Text style={styles.emptyTitle}>لا توجد أحداث بعد</Text>
          <Text style={styles.emptyBody}>يعرض هذا السجل إجراءات التطبيق مثل التحرير والاستيراد والمعاينة؛ لا يعرض خرج console من الكود.</Text>
        </View>
      ) : logs.map((log) => (
        <View key={log.id} style={[styles.log, log.level === "error" && styles.error, log.level === "warn" && styles.warn, log.level === "success" && styles.success]}>
          <View style={styles.logTop}>
            <Text style={styles.level}>{log.level === "success" ? "OK" : log.level.toUpperCase()}</Text>
            <Text style={styles.time}>{log.time}</Text>
          </View>
          <Text style={styles.message}>{log.message}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  content: { padding: 16, paddingBottom: 42, gap: 9 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  kicker: { color: "#61dafb", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  title: { color: "#f3f7fc", fontSize: 22, fontWeight: "800", marginTop: 3 },
  localTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(97,218,251,.10)" },
  localDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#61dafb" },
  localText: { color: "#61dafb", fontSize: 9, fontWeight: "800" },
  log: { borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#233043", backgroundColor: "#111823" },
  error: { borderColor: "rgba(248,81,73,.35)", backgroundColor: "rgba(248,81,73,.08)" },
  warn: { borderColor: "rgba(210,153,34,.35)", backgroundColor: "rgba(210,153,34,.08)" },
  success: { borderColor: "rgba(83,198,140,.30)", backgroundColor: "rgba(83,198,140,.06)" },
  logTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  level: { color: "#61dafb", fontSize: 9, letterSpacing: 1, fontWeight: "800" },
  time: { color: "#64738a", fontSize: 10, fontFamily: "monospace" },
  message: { color: "#c4d0df", fontFamily: "monospace", fontSize: 11, lineHeight: 17 },
  empty: { minHeight: 250, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyIcon: { color: "#61dafb", fontSize: 34 },
  emptyTitle: { color: "#dbe3ee", fontWeight: "800", fontSize: 15, marginTop: 10 },
  emptyBody: { color: "#718098", fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 7 },
});
