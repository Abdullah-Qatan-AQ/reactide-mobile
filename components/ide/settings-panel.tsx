import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type SettingsPanelProps = { dark: boolean; fontSize: number; wrap: boolean; onToggleDark: () => void; onChangeFontSize: (size: number) => void; onToggleWrap: () => void; onReset: () => void };

function SettingRow({ title, body, right, onPress }: { title: string; body: string; right: React.ReactNode; onPress: () => void }) {
  return <Pressable style={styles.row} onPress={onPress}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{body}</Text></View>{right}</Pressable>;
}

export function SettingsPanel({ dark, fontSize, wrap, onToggleDark, onChangeFontSize, onToggleWrap, onReset }: SettingsPanelProps) {
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View><Text style={styles.kicker}>WORKSPACE SETTINGS</Text><Text style={styles.title}>الإعدادات</Text><Text style={styles.subtitle}>اضبط مساحة العمل كما تحب، وتُحفظ التفضيلات مع المشروع.</Text></View>
    <View style={styles.card}>
      <SettingRow title="المظهر الداكن" body="مناسب للجلسات الطويلة والعمل الليلي" onPress={onToggleDark} right={<View style={[styles.switch, dark && styles.switchOn]}><View style={[styles.knob, dark && styles.knobOn]} /></View>} />
      <SettingRow title="التفاف الأسطر" body={wrap ? "مفعل — الكود يلتف داخل الشاشة" : "متوقف — يحافظ على عرض الكود الأصلي"} onPress={onToggleWrap} right={<View style={[styles.switch, wrap && styles.switchOn]}><View style={[styles.knob, wrap && styles.knobOn]} /></View>} />
      <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>حجم خط الكود</Text><Text style={styles.rowBody}>{fontSize}px · استخدم الأزرار للضبط</Text></View><View style={styles.stepper}><Pressable onPress={() => onChangeFontSize(Math.max(11, fontSize - 1))}><Text style={styles.step}>−</Text></Pressable><Text style={styles.fontValue}>{fontSize}</Text><Pressable onPress={() => onChangeFontSize(Math.min(20, fontSize + 1))}><Text style={styles.step}>＋</Text></Pressable></View></View>
    </View>
    <View style={styles.infoCard}><Text style={styles.infoIcon}>i</Text><View style={{ flex: 1 }}><Text style={styles.infoTitle}>عن التنفيذ الأصلي</Text><Text style={styles.infoBody}>المحرر وإدارة الملفات والتخزين هنا أصلية في React Native. المعاينة معزولة، ومزودات اللغات الخارجية تُربط لاحقًا عبر API آمن.</Text></View></View>
    <Pressable style={styles.resetButton} onPress={onReset}><Text style={styles.resetText}>إعادة المشروع إلى القالب الأولي</Text></Pressable>
    <Text style={styles.version}>React IDE Mobile · v1.0 · Native workspace</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  kicker: { color: "#61dafb", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  title: { color: "#f3f7fc", fontSize: 22, fontWeight: "800", marginTop: 3 },
  subtitle: { color: "#7f8ea5", fontSize: 11, lineHeight: 18, marginTop: 5 },
  card: { borderRadius: 15, borderWidth: 1, borderColor: "#233043", backgroundColor: "#111823", overflow: "hidden" },
  row: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#1d2939" },
  rowTitle: { color: "#dbe3ee", fontWeight: "700", fontSize: 13 },
  rowBody: { color: "#718098", fontSize: 10, lineHeight: 15, marginTop: 4 },
  switch: { width: 42, height: 25, borderRadius: 15, backgroundColor: "#2b3a50", padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: "#61dafb" },
  knob: { width: 19, height: 19, borderRadius: 10, backgroundColor: "#a9b6c8" },
  knobOn: { alignSelf: "flex-end", backgroundColor: "#04222e" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 9 },
  step: { color: "#61dafb", fontSize: 23, fontWeight: "400" },
  fontValue: { color: "#f3f7fc", fontFamily: "monospace", fontSize: 14, width: 27, textAlign: "center" },
  infoCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#18212e" },
  infoIcon: { width: 20, height: 20, borderRadius: 10, textAlign: "center", color: "#04222e", backgroundColor: "#61dafb", fontWeight: "900", fontSize: 13 },
  infoTitle: { color: "#dbe3ee", fontWeight: "800", fontSize: 12 },
  infoBody: { color: "#8b98ab", fontSize: 10, lineHeight: 16, marginTop: 4 },
  resetButton: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: "rgba(248,81,73,.4)", alignItems: "center", justifyContent: "center" },
  resetText: { color: "#ff8f8a", fontSize: 12, fontWeight: "800" },
  version: { color: "#4a5a70", textAlign: "center", fontSize: 10, fontFamily: "monospace", marginTop: 3 },
});
