import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { IDEProject } from "@/lib/ide-model";
import { GithubRepo, GithubViewer } from "@/lib/github-api";

type ProjectsPanelProps = {
  project: IDEProject;
  externalUrl: string;
  onExternalUrlChange: (value: string) => void;
  onConnect: () => void;
  onOpenUrl: (url: string) => void;
  githubToken: string;
  githubViewer: GithubViewer | null;
  githubRepos: GithubRepo[];
  githubBusy: boolean;
  onGithubTokenChange: (value: string) => void;
  onGithubConnect: () => void;
  onGithubDisconnect: () => void;
};

export function ProjectsPanel({ project, externalUrl, onExternalUrlChange, onConnect, onOpenUrl, githubToken, githubViewer, githubRepos, githubBusy, onGithubTokenChange, onGithubConnect, onGithubDisconnect }: ProjectsPanelProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}><View><Text style={styles.kicker}>PROJECT HUB</Text><Text style={styles.title}>المشاريع والربط</Text></View><View style={styles.count}><Text style={styles.countValue}>{project.files.length}</Text><Text style={styles.countLabel}>ملفات</Text></View></View>
      <View style={styles.currentCard}><View style={styles.projectMark}><Text style={styles.projectMarkText}>R&gt;</Text></View><View style={{ flex: 1 }}><Text style={styles.projectName}>{project.name}</Text><Text style={styles.projectMeta}>محلي · محفوظ على الجهاز · آخر تعديل الآن</Text></View><View style={styles.connected}><View style={styles.connectedDot} /><Text style={styles.connectedText}>متصل</Text></View></View>
      <Text style={styles.sectionTitle}>مصدر خارجي</Text>
      <Text style={styles.sectionBody}>أضف رابط GitHub أو Git أو ZIP. سيبقى الربط قابلًا للتوسعة، ولن نطلب أو نخزّن token داخل التطبيق.</Text>
      <View style={styles.inputWrap}><Text style={styles.inputPrefix}>↗</Text><TextInput value={externalUrl} onChangeText={onExternalUrlChange} placeholder="https://github.com/user/repo" placeholderTextColor="#5f6f86" autoCapitalize="none" autoCorrect={false} style={styles.input} /></View>
      <Pressable style={styles.connectButton} onPress={onConnect}><Text style={styles.connectButtonText}>حفظ مصدر المشروع</Text><Text style={styles.connectArrow}>←</Text></Pressable>
      <View style={styles.providerGrid}>
        <Pressable style={styles.providerCard} onPress={() => onOpenUrl("https://github.com") }><Text style={styles.providerIcon}>◉</Text><Text style={styles.providerName}>GitHub</Text><Text style={styles.providerMeta}>مستودعات وOAuth</Text><Text style={styles.providerLink}>فتح GitHub ↗</Text></Pressable>
        <Pressable style={styles.providerCard} onPress={() => onOpenUrl("https://git-scm.com") }><Text style={[styles.providerIcon, { color: "#ff8a65" }]}>⌘</Text><Text style={styles.providerName}>Git / ZIP</Text><Text style={styles.providerMeta}>مصدر خارجي</Text><Text style={styles.providerLink}>فتح المصدر ↗</Text></Pressable>
      </View>
      <View style={styles.securityCard}><Text style={styles.securityIcon}>✓</Text><View style={{ flex: 1 }}><Text style={styles.securityTitle}>ملاحظة أمان</Text><Text style={styles.securityBody}>استخدم OAuth أو خادمًا آمنًا للرموز. لا تلصق مفاتيح الوصول في الملفات أو الإعدادات المحلية.</Text></View></View>
      <Text style={styles.sectionTitle}>GitHub API</Text>
      <Text style={styles.sectionBody}>يُخزَّن token في SecureStore على الجهاز ولا يظهر في الملفات أو السجل. استخدم token بصلاحية أقل ما يمكن.</Text>
      <View style={styles.inputWrap}><Text style={styles.inputPrefix}>◉</Text><TextInput value={githubToken} onChangeText={onGithubTokenChange} placeholder="ghp_… أو fine-grained token" placeholderTextColor="#5f6f86" secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} /></View>
      <View style={styles.githubActions}><Pressable style={styles.connectButton} onPress={onGithubConnect}><Text style={styles.connectButtonText}>{githubBusy ? "جارٍ الاتصال…" : githubViewer ? `متصل باسم ${githubViewer.login}` : "اتصال آمن بـ GitHub"}</Text></Pressable>{githubViewer && <Pressable style={styles.disconnect} onPress={onGithubDisconnect}><Text style={styles.disconnectText}>فصل</Text></Pressable>}</View>
      {githubRepos.length > 0 && <View style={styles.repoList}><Text style={styles.repoTitle}>آخر المستودعات</Text>{githubRepos.slice(0, 5).map((repo) => <Pressable key={repo.id} style={styles.repoRow} onPress={() => onOpenUrl(repo.html_url)}><Text style={styles.repoName}>{repo.name}</Text><Text style={styles.repoBadge}>{repo.private ? "خاص" : "عام"}</Text></Pressable>)}</View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  content: { padding: 16, paddingBottom: 44, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  kicker: { color: "#61dafb", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  title: { color: "#f3f7fc", fontSize: 22, fontWeight: "800", marginTop: 3 },
  count: { borderRadius: 12, minWidth: 53, paddingVertical: 7, alignItems: "center", backgroundColor: "#18212e", borderWidth: 1, borderColor: "#2d3d54" },
  countValue: { color: "#61dafb", fontSize: 16, fontWeight: "800" },
  countLabel: { color: "#718098", fontSize: 9 },
  currentCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#18212e" },
  projectMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#61dafb", alignItems: "center", justifyContent: "center" },
  projectMarkText: { color: "#04222e", fontWeight: "900", fontSize: 12 },
  projectName: { color: "#f0f5fb", fontWeight: "800", fontFamily: "monospace", fontSize: 13 },
  projectMeta: { color: "#7f8ea5", fontSize: 10, marginTop: 4 },
  connected: { flexDirection: "row", alignItems: "center", gap: 4 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#53c68c" },
  connectedText: { color: "#53c68c", fontSize: 10, fontWeight: "700" },
  sectionTitle: { color: "#dbe3ee", fontSize: 14, fontWeight: "800", marginTop: 5 },
  sectionBody: { color: "#7f8ea5", fontSize: 11, lineHeight: 18, marginTop: -5 },
  inputWrap: { height: 48, flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#111823", paddingHorizontal: 12 },
  inputPrefix: { color: "#61dafb", fontSize: 17, marginRight: 8 },
  input: { flex: 1, color: "#dbe3ee", fontFamily: "monospace", fontSize: 12 },
  connectButton: { height: 46, borderRadius: 12, backgroundColor: "#61dafb", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  connectButtonText: { color: "#04222e", fontWeight: "800", fontSize: 13 },
  connectArrow: { color: "#04222e", fontSize: 20, fontWeight: "800" },
  providerGrid: { flexDirection: "row", gap: 10 },
  providerCard: { flex: 1, minHeight: 132, borderRadius: 14, borderWidth: 1, borderColor: "#233043", backgroundColor: "#111823", padding: 12 },
  providerIcon: { color: "#dbe3ee", fontSize: 19, marginBottom: 8 },
  providerName: { color: "#dbe3ee", fontWeight: "800", fontSize: 12 },
  providerMeta: { color: "#718098", fontSize: 10, marginTop: 4 },
  providerLink: { color: "#61dafb", fontSize: 10, fontWeight: "700", marginTop: 15 },
  securityCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: "rgba(83,198,140,.3)", backgroundColor: "rgba(83,198,140,.07)" },
  securityIcon: { color: "#53c68c", fontSize: 18, fontWeight: "800" },
  securityTitle: { color: "#b6f0d0", fontWeight: "800", fontSize: 12 },
  securityBody: { color: "#8db59e", fontSize: 10, lineHeight: 16, marginTop: 3 },
  githubActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  disconnect: { height: 46, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: "rgba(248,81,73,.4)", alignItems: "center", justifyContent: "center" },
  disconnectText: { color: "#ff8f8a", fontSize: 11, fontWeight: "800" },
  repoList: { borderRadius: 13, borderWidth: 1, borderColor: "#233043", backgroundColor: "#111823", overflow: "hidden" },
  repoTitle: { color: "#8b98ab", fontSize: 10, fontWeight: "800", padding: 10, borderBottomWidth: 1, borderBottomColor: "#233043" },
  repoRow: { paddingHorizontal: 11, paddingVertical: 11, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#1b2635" },
  repoName: { flex: 1, color: "#dbe3ee", fontFamily: "monospace", fontSize: 11 },
  repoBadge: { color: "#61dafb", fontSize: 9 },
});
