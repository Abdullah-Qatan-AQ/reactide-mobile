import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type TerminalLine = { id: string; kind: "command" | "output" | "error" | "system"; text: string };

type TerminalPanelProps = {
  lines: TerminalLine[];
  command: string;
  running: boolean;
  onCommandChange: (value: string) => void;
  onRun: () => void;
  onPreset: (command: string) => void;
  packageName: string;
  onPackageNameChange: (value: string) => void;
  onInstall: () => void;
};

export function TerminalPanel({ lines, command, running, onCommandChange, onRun, onPreset, packageName, onPackageNameChange, onInstall }: TerminalPanelProps) {
  return <View style={styles.root}>
    <View style={styles.header}><View><Text style={styles.kicker}>WORKSPACE SHELL</Text><Text style={styles.title}>التيرمينال</Text></View><View style={styles.status}><View style={styles.statusDot} /><Text style={styles.statusText}>RUNTIME</Text></View></View>
    <ScrollView style={styles.output} contentContainerStyle={styles.outputContent}>
      {lines.map((line) => <Text key={line.id} style={[styles.line, line.kind === "command" && styles.command, line.kind === "error" && styles.error, line.kind === "system" && styles.system]}>{line.kind === "command" ? "$ " : ""}{line.text}</Text>)}
    </ScrollView>
    <View style={styles.presets}>{["pwd", "node --version", "python3 --version", "pnpm --version"].map((preset) => <Pressable key={preset} style={styles.preset} onPress={() => onPreset(preset)}><Text style={styles.presetText}>{preset}</Text></Pressable>)}</View>
    <View style={styles.commandRow}><Text style={styles.prompt}>$</Text><TextInput value={command} onChangeText={onCommandChange} onSubmitEditing={onRun} placeholder="اكتب أمرًا آمنًا…" placeholderTextColor="#5e6e85" autoCapitalize="none" autoCorrect={false} style={styles.commandInput} /><Pressable style={[styles.exec, running && styles.execBusy]} onPress={onRun}><Text style={styles.execText}>{running ? "…" : "تشغيل"}</Text></Pressable></View>
    <View style={styles.installCard}><View style={{ flex: 1 }}><Text style={styles.installTitle}>مدير الحزم المحلي</Text><Text style={styles.installBody}>نزّل حزمة إلى runtime المتصل دون إدخال secrets.</Text></View><TextInput value={packageName} onChangeText={onPackageNameChange} placeholder="expo-router" placeholderTextColor="#5e6e85" autoCapitalize="none" autoCorrect={false} style={styles.packageInput} /><Pressable onPress={onInstall} style={styles.installButton}><Text style={styles.installText}>＋</Text></Pressable></View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080c12" },
  header: { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#1e2a3a", backgroundColor: "#111823" },
  kicker: { color: "#61dafb", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  title: { color: "#f3f7fc", fontSize: 22, fontWeight: "800", marginTop: 3 },
  status: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(83,198,140,.1)" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#53c68c" },
  statusText: { color: "#53c68c", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  output: { flex: 1, backgroundColor: "#080c12" },
  outputContent: { padding: 15, gap: 7 },
  line: { color: "#b8c6d8", fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  command: { color: "#61dafb" },
  error: { color: "#ff8f8a" },
  system: { color: "#718098", fontStyle: "italic" },
  presets: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#0f151f", borderTopWidth: 1, borderTopColor: "#1e2a3a" },
  preset: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: "#2d3d54" },
  presetText: { color: "#91a2b8", fontFamily: "monospace", fontSize: 9 },
  commandRow: { minHeight: 53, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#111823", borderTopWidth: 1, borderTopColor: "#233043" },
  prompt: { color: "#53c68c", fontFamily: "monospace", fontWeight: "800" },
  commandInput: { flex: 1, color: "#f0f5fb", fontFamily: "monospace", fontSize: 12 },
  exec: { paddingHorizontal: 12, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#61dafb" },
  execBusy: { opacity: .6 },
  execText: { color: "#04222e", fontSize: 11, fontWeight: "900" },
  installCard: { minHeight: 66, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#18212e", borderTopWidth: 1, borderTopColor: "#2d3d54" },
  installTitle: { color: "#dbe3ee", fontWeight: "800", fontSize: 11 },
  installBody: { color: "#718098", fontSize: 9, marginTop: 3 },
  packageInput: { width: 112, height: 34, borderRadius: 8, borderWidth: 1, borderColor: "#2d3d54", paddingHorizontal: 8, color: "#dbe3ee", fontFamily: "monospace", fontSize: 10 },
  installButton: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#53c68c" },
  installText: { color: "#062313", fontSize: 19, fontWeight: "800" },
});

export type { TerminalLine };
