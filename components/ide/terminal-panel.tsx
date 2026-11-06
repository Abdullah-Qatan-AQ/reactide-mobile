import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRef } from "react";

import { WorkspaceStatus } from "@/lib/workspace-api";

type TerminalLine = { id: string; kind: "command" | "output" | "error" | "system"; text: string };

type TerminalPanelProps = {
  lines: TerminalLine[];
  command: string;
  running: boolean;
  onCommandChange: (value: string) => void;
  onRun: () => void;
  onInterrupt: () => void;
  onPreset: (command: string) => void;
  packageName: string;
  onPackageNameChange: (value: string) => void;
  onInstall: () => void;
  authSupported: boolean;
  localAvailable: boolean;
  packageRuntimeAvailable: boolean;
  localSessionReady: boolean;
  runtimeInstalling: boolean;
  runtimeStatus: string;
  onRetryRuntime: () => void;
  onReconnectShell: () => void;
  authenticated: boolean;
  workspaceStatus: WorkspaceStatus | null;
  workspaceError: string;
  userName?: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
};

const SAFE_PRESETS = ["pwd", "node --version", "npm --version", "pnpm --version", "python3 --version"];

export function TerminalPanel({
  lines, command, running, onCommandChange, onRun, onInterrupt, onPreset, packageName, onPackageNameChange,
  onInstall, authSupported, localAvailable, packageRuntimeAvailable, localSessionReady, runtimeInstalling, runtimeStatus, onRetryRuntime, onReconnectShell, authenticated, workspaceStatus, workspaceError, userName, onLogin, onLogout, onRefresh,
}: TerminalPanelProps) {
  const available = (localAvailable && packageRuntimeAvailable && localSessionReady) || Boolean(authenticated && workspaceStatus?.available);
  const outputRef = useRef<ScrollView>(null);
  const presets = localAvailable ? ["pwd", "ls -la", "cat App.jsx", "pkg update -y", "pkg install -y python", "python --version"] : SAFE_PRESETS;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
          <View><Text style={styles.kicker}>{localAvailable ? "TERMUX SHELL" : "WORKSPACE SHELL"}</Text><Text style={styles.title}>الطرفية</Text></View>
        <View style={[styles.status, available ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDot, available ? styles.statusDotOnline : styles.statusDotOffline]} />
          <Text style={[styles.statusText, available ? styles.statusTextOnline : styles.statusTextOffline]}>{localAvailable ? !packageRuntimeAvailable ? runtimeInstalling ? "تجهيز Termux…" : "Termux · غير جاهز" : localSessionReady ? "Termux · متصل" : runtimeInstalling ? "فتح جلسة PTY…" : "shell غير متصل" : available ? "RUNTIME مؤقت" : "غير متصل"}</Text>
        </View>
      </View>
      {localAvailable ? (
        <View style={styles.runtimeCard}><View style={{ flex: 1 }}><Text style={styles.runtimeTitle}>حزم Termux الرسمية · جلسة Bash تفاعلية</Text><Text style={styles.runtimeBody}>{runtimeStatus || "جارٍ تجهيز حزم Termux الرسمية لمساحة المشروع."}</Text></View>{!packageRuntimeAvailable && !runtimeInstalling && <Pressable onPress={onRetryRuntime} style={styles.smallAction}><Text style={styles.smallActionText}>إعادة التثبيت</Text></Pressable>}{packageRuntimeAvailable && !localSessionReady && !runtimeInstalling && <Pressable onPress={onReconnectShell} style={styles.smallAction}><Text style={styles.smallActionText}>إعادة فتح shell</Text></Pressable>}</View>
      ) : !authenticated ? (
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>سجّل الدخول لتفعيل مساحة الأوامر المحمية</Text>
          <Text style={styles.authBody}>{authSupported ? "استخدم Manus OAuth عبر معاينة الويب. مساحة runtime مؤقتة منفصلة لكل مستخدم؛ ليست shell عامة." : "تسجيل الدخول إلى runtime غير متاح على Android لأن تدفق Manus الحالي لا يوثّق PKCE للهاتف. لن نعالج رمزًا واردًا عبر رابط مخصص."}</Text>
          {authSupported && <Pressable onPress={onLogin} style={styles.authButton}><Text style={styles.authButtonText}>تسجيل الدخول</Text></Pressable>}
        </View>
      ) : (
        <View style={styles.runtimeCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.runtimeTitle}>{workspaceStatus?.label ?? "مساحة العمل"}{userName ? ` · ${userName}` : ""}</Text>
            <Text style={styles.runtimeBody}>{workspaceStatus?.available ? `جلسة موثقة · حد ${Math.ceil(workspaceStatus.maxStorageBytes / (1024 * 1024))} MB · حذف بعد ${workspaceStatus.expiresAfterHours} ساعة خمول · أوامر محدودة` : workspaceError || "جارٍ فحص اتصال runtime…"}</Text>
          </View>
          {available ? <Pressable onPress={onLogout} style={styles.smallAction}><Text style={styles.smallActionText}>خروج</Text></Pressable> : <Pressable onPress={onRefresh} style={styles.smallAction}><Text style={styles.smallActionText}>إعادة المحاولة</Text></Pressable>}
        </View>
      )}
      <ScrollView ref={outputRef} style={styles.output} contentContainerStyle={styles.outputContent} onContentSizeChange={() => outputRef.current?.scrollToEnd({ animated: true })}>
        {lines.map((line) => <Text key={line.id} style={[styles.line, line.kind === "command" && styles.command, line.kind === "error" && styles.error, line.kind === "system" && styles.system]}>{line.kind === "command" ? "$ " : ""}{line.text}</Text>)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {presets.map((preset) => <Pressable key={preset} disabled={!available || running || runtimeInstalling} style={[styles.preset, (!available || runtimeInstalling) && styles.disabled]} onPress={() => onPreset(preset)}><Text style={styles.presetText}>{preset}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.commandRow}>
        <Text style={styles.prompt}>$</Text>
        <TextInput value={command} onChangeText={onCommandChange} onSubmitEditing={onRun} editable={available && !running} placeholder={localAvailable ? "اكتب أمر Termux أو Linux…" : "اختر أمر فحص معتمدًا…"} placeholderTextColor="#5e6e85" autoCapitalize="none" autoCorrect={false} style={styles.commandInput} />
        {localAvailable && <Pressable disabled={!localSessionReady} onPress={onInterrupt} style={[styles.interrupt, !localSessionReady && styles.disabled]}><Text style={styles.interruptText}>^C</Text></Pressable>}
        <Pressable disabled={!available || running} style={[styles.exec, (!available || running) && styles.disabled]} onPress={onRun}><Text style={styles.execText}>{running ? "…" : "تشغيل"}</Text></Pressable>
      </View>
      <View style={styles.installCard}>
        <View style={{ flex: 1 }}><Text style={styles.installTitle}>{localAvailable ? "حزم مستودع Termux" : "حزم runtime"}</Text><Text style={styles.installBody}>{packageRuntimeAvailable ? localAvailable ? "pkg install يستخدم مستودعات Termux الرسمية فقط." : "مساحة runtime الويب متصلة." : localAvailable ? "ستتاح أوامر pkg بعد اكتمال التثبيت الأول." : "سجّل الدخول لمساحة منفصلة · scripts معطلة."}</Text></View>
        {packageRuntimeAvailable && <><TextInput value={packageName} onChangeText={onPackageNameChange} editable={available && !running} placeholder="اسم الحزمة" placeholderTextColor="#5e6e85" autoCapitalize="none" autoCorrect={false} style={styles.packageInput} />
        <Pressable disabled={!available || running} onPress={onInstall} style={[styles.installButton, (!available || running) && styles.disabled]}><Text style={styles.installText}>＋</Text></Pressable></>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080c12" },
  header: { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#1e2a3a", backgroundColor: "#111823" },
  kicker: { color: "#61dafb", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  title: { color: "#f3f7fc", fontSize: 22, fontWeight: "800", marginTop: 3 },
  status: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  statusOnline: { backgroundColor: "rgba(83,198,140,.1)" },
  statusOffline: { backgroundColor: "rgba(210,153,34,.12)" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotOnline: { backgroundColor: "#53c68c" },
  statusDotOffline: { backgroundColor: "#d29922" },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: .4 },
  statusTextOnline: { color: "#53c68c" },
  statusTextOffline: { color: "#d29922" },
  authCard: { margin: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#111823" },
  authTitle: { color: "#dbe3ee", fontWeight: "800", fontSize: 12 },
  authBody: { color: "#8190a7", fontSize: 10, lineHeight: 16, marginTop: 5 },
  authButton: { alignSelf: "flex-start", marginTop: 11, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, backgroundColor: "#61dafb" },
  authButtonText: { color: "#04222e", fontWeight: "900", fontSize: 11 },
  runtimeCard: { margin: 12, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#111823", flexDirection: "row", alignItems: "center", gap: 10 },
  runtimeTitle: { color: "#dbe3ee", fontWeight: "700", fontSize: 10 },
  runtimeBody: { color: "#8190a7", fontSize: 9, lineHeight: 14, marginTop: 3 },
  smallAction: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "#40536e" },
  smallActionText: { color: "#91a2b8", fontSize: 9, fontWeight: "700" },
  output: { flex: 1, backgroundColor: "#080c12" },
  outputContent: { padding: 15, gap: 7 },
  line: { color: "#b8c6d8", fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  command: { color: "#61dafb" },
  error: { color: "#ff8f8a" },
  system: { color: "#718098", fontStyle: "italic" },
  presets: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#0f151f", borderTopWidth: 1, borderTopColor: "#1e2a3a" },
  preset: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: "#2d3d54" },
  presetText: { color: "#91a2b8", fontFamily: "monospace", fontSize: 9 },
  disabled: { opacity: .45 },
  commandRow: { minHeight: 53, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#111823", borderTopWidth: 1, borderTopColor: "#233043" },
  prompt: { color: "#53c68c", fontFamily: "monospace", fontWeight: "800" },
  commandInput: { flex: 1, color: "#f0f5fb", fontFamily: "monospace", fontSize: 12 },
  interrupt: { paddingHorizontal: 9, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#40536e" },
  interruptText: { color: "#ff8f8a", fontSize: 11, fontWeight: "800", fontFamily: "monospace" },
  exec: { paddingHorizontal: 12, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#61dafb" },
  execText: { color: "#04222e", fontSize: 11, fontWeight: "900" },
  installCard: { minHeight: 66, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#18212e", borderTopWidth: 1, borderTopColor: "#2d3d54" },
  installTitle: { color: "#dbe3ee", fontWeight: "800", fontSize: 11 },
  installBody: { color: "#718098", fontSize: 9, marginTop: 3 },
  packageInput: { width: 112, height: 34, borderRadius: 8, borderWidth: 1, borderColor: "#2d3d54", paddingHorizontal: 8, color: "#dbe3ee", fontFamily: "monospace", fontSize: 10 },
  installButton: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#53c68c" },
  installText: { color: "#062313", fontSize: 19, fontWeight: "800" },
});

export type { TerminalLine };
