import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { startOAuthLogin } from "@/constants/oauth";
import { useThemeContext } from "@/lib/theme-provider";
import type { TerminalLine } from "@/components/ide/terminal-panel";
import { clearGithubToken, getGithubToken, getGithubViewer, GithubRepo, GithubViewer, listGithubRepos, saveGithubToken } from "@/lib/github-api";
import { parseImportedProject, pickProjectInput, shareProjectBundle } from "@/lib/file-transfer";
import { getWorkspaceStatus, installWorkspacePackage, runWorkspaceCommand } from "@/lib/workspace-api";
import { addRuntimeShellExitListener, addRuntimeShellOutputListener, getRuntimeWorkspacePath, installRuntime, isRuntimeInstalled, isRuntimeNativeAvailable, prepareRuntimeShell, startRuntimeShell, syncRuntimeFiles, writeRuntimeShell } from "@reactide/termux-runtime";
import type { SafeWorkspaceCommand, WorkspaceStatus } from "@/lib/workspace-api";
import { useAuth } from "@/hooks/use-auth";
import {
  cloneDefaultProject,
  fileIcon,
  formatClock,
  IDEFile,
  IDELog,
  IDEProject,
  IDEView,
  languageForFile,
  languageTone,
  loadProject,
  projectToText,
  saveProject,
  starterForFile,
} from "@/lib/ide-model";

// Keep the first native frame small. WebView, editor, and the secondary IDE
// panels are loaded only when React has already rendered the workspace or when
// the user opens that panel. This prevents a cold Android launch from parsing
// the entire IDE before the splash screen can be dismissed.
const CodeEditor = lazy(() => import("@/components/ide/code-editor").then((module) => ({ default: module.CodeEditor })));
const ConsolePanel = lazy(() => import("@/components/ide/console-panel").then((module) => ({ default: module.ConsolePanel })));
const FilesPanel = lazy(() => import("@/components/ide/files-panel").then((module) => ({ default: module.FilesPanel })));
const PreviewPanel = lazy(() => import("@/components/ide/preview-panel").then((module) => ({ default: module.PreviewPanel })));
const ProjectsPanel = lazy(() => import("@/components/ide/projects-panel").then((module) => ({ default: module.ProjectsPanel })));
const SettingsPanel = lazy(() => import("@/components/ide/settings-panel").then((module) => ({ default: module.SettingsPanel })));
const TerminalPanel = lazy(() => import("@/components/ide/terminal-panel").then((module) => ({ default: module.TerminalPanel })));

function PanelFallback() {
  return <View style={styles.panelFallback}><Text style={styles.panelFallbackText}>جارٍ تجهيز اللوحة…</Text></View>;
}

const NAV_ITEMS: { key: IDEView; label: string; icon: string }[] = [
  { key: "editor", label: "المحرر", icon: "⌘" },
  { key: "preview", label: "المعاينة", icon: "▷" },
  { key: "console", label: "السجل", icon: "⌁" },
  { key: "terminal", label: "طرفية", icon: "$" },
  { key: "files", label: "الملفات", icon: "▤" },
  { key: "projects", label: "المشاريع", icon: "⌂" },
  { key: "settings", label: "إعدادات", icon: "⚙" },
];

type ModalKind = "add" | "rename" | "source" | null;
const SAFE_WORKSPACE_COMMANDS = new Set<SafeWorkspaceCommand>([
  "pwd", "node --version", "npm --version", "pnpm --version", "python3 --version",
]);

export default function HomeScreen() {
  const { user, isAuthenticated, logout } = useAuth({ autoFetch: Platform.OS === "web" });
  const { colorScheme, setColorScheme } = useThemeContext();
  // Render a usable local workspace immediately; hydrate persisted data after
  // the first frame instead of blocking the whole screen on AsyncStorage.
  const [project, setProject] = useState<IDEProject>(() => cloneDefaultProject());
  const [view, setView] = useState<IDEView>("editor");
  const [logs, setLogs] = useState<IDELog[]>([]);
  const [fontSize, setFontSize] = useState(14);
  const dark = colorScheme === "dark";
  const [running, setRunning] = useState(false);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [saved, setSaved] = useState(true);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([{ id: "terminal-boot", kind: "system", text: Platform.OS === "web" ? "سجّل الدخول لتشغيل أوامر runtime البعيدة." : "Termux: تُجهّز بيئة Linux ومستودعات Termux الرسمية عند أول تشغيل." }]);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalPackage, setTerminalPackage] = useState("");
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [termuxAvailable, setTermuxAvailable] = useState(false);
  const [termuxInstalled, setTermuxInstalled] = useState(false);
  const [termuxInstalling, setTermuxInstalling] = useState(false);
  const [termuxStatus, setTermuxStatus] = useState("جارٍ فحص بيئة Termux...");
  const [termuxRetryKey, setTermuxRetryKey] = useState(0);
  const [termuxShellReady, setTermuxShellReady] = useState(false);
  const [termuxShellConnecting, setTermuxShellConnecting] = useState(false);
  const [termuxShellRetryKey, setTermuxShellRetryKey] = useState(0);
  const syncedTermuxProject = useRef("");
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubViewer, setGithubViewer] = useState<GithubViewer | null>(null);
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [githubBusy, setGithubBusy] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [modalValue, setModalValue] = useState("");
  const [pendingRename, setPendingRename] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const previousDocumentDirection = document.documentElement.dir;
    const previousBodyDirection = document.body.dir;
    document.documentElement.dir = "rtl";
    document.body.dir = "rtl";
    return () => {
      document.documentElement.dir = previousDocumentDirection;
      document.body.dir = previousBodyDirection;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProject().then((loaded) => {
        setProject(loaded);
        setLogs([{ id: "boot", level: "success", message: `تم فتح ${loaded.name} من التخزين المحلي`, time: formatClock() }]);
      }).catch(() => undefined);
      getGithubToken().then((token) => { if (token) setGithubToken(token); }).catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;
    void (async () => {
      try {
        if (!isRuntimeNativeAvailable()) throw new Error("وحدة تشغيل Termux غير موجودة في هذا البناء.");
        setTermuxAvailable(true);
        if (await isRuntimeInstalled()) {
          await prepareRuntimeShell();
          if (!cancelled) {
            setTermuxInstalled(true);
            setTermuxStatus("Termux جاهز · مستودعات Termux الرسمية");
          }
          return;
        }
        if (cancelled) return;
        setTermuxInstalling(true);
        setTermuxStatus("جارٍ تثبيت بيئة Termux الرسمية لأول مرة...");
        const installed = await installRuntime();
        if (cancelled) return;
        setTermuxInstalled(true);
        setTermuxStatus(installed.updateExitCode === 0 ? `Termux جاهز · ${installed.files} ملف · المستودع الرسمي محدث` : `Termux جاهز · ${installed.files} ملف؛ يمكن إعادة المحاولة بـ pkg update`);
        setTerminalLines((lines) => [...lines, { id: `${Date.now()}-termux-ready`, kind: installed.updateExitCode === 0 ? "system" : "error", text: installed.updateExitCode === 0 ? `تم تجهيز Termux وتحديث مستودعاته الرسمية (${installed.files} ملف). أوامر Linux والحزم تمر عبر Termux.` : "تم تثبيت Termux. تعذر تحديث فهرس الحزم؛ جرّب pkg update لاحقًا." }]);
      } catch (error) {
        if (!cancelled) setTermuxStatus(error instanceof Error ? error.message : "تعذر تجهيز Termux.");
      } finally {
        if (!cancelled) setTermuxInstalling(false);
      }
    })();
    return () => { cancelled = true; };
  }, [termuxRetryKey]);

  useEffect(() => {
    if (Platform.OS !== "android" || view !== "terminal" || !termuxInstalled) {
      setTermuxShellReady(false);
      return;
    }
    let cancelled = false;
    setTermuxShellConnecting(true);
    const outputSubscription = addRuntimeShellOutputListener(({ text }) => {
      const clean = text.replace(/\r/g, "");
      if (!clean) return;
      setTerminalLines((lines) => [...lines, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, kind: "output" as const, text: clean }].slice(-500));
    });
    const exitSubscription = addRuntimeShellExitListener(({ exitCode }) => {
      setTermuxShellReady(false);
      setTerminalLines((lines) => [...lines, { id: `${Date.now()}-termux-exit`, kind: "system", text: `جلسة shell انتهت (exit ${exitCode})` }]);
    });
    void (async () => {
      try {
        const projectSnapshot = JSON.stringify(project.files.map((item) => [item.name, item.content]));
        const workspacePath = projectSnapshot !== syncedTermuxProject.current
          ? await syncRuntimeFiles(project.files)
          : await getRuntimeWorkspacePath();
        syncedTermuxProject.current = projectSnapshot;
        await prepareRuntimeShell();
        await startRuntimeShell(workspacePath);
        if (!cancelled) {
          setTermuxShellReady(true);
          setTermuxStatus("طرفية Termux تفاعلية جاهزة · Bash داخل جلسة PTY");
        }
      } catch (error) {
        if (!cancelled) {
          setTermuxShellReady(false);
          setTermuxStatus(error instanceof Error ? error.message : "تعذر تشغيل جلسة Termux التفاعلية.");
          setTerminalLines((lines) => [...lines, { id: `${Date.now()}-termux-shell-error`, kind: "error", text: error instanceof Error ? error.message : "تعذر تشغيل جلسة Termux التفاعلية." }]);
        }
      } finally {
        if (!cancelled) setTermuxShellConnecting(false);
      }
    })();
    return () => {
      cancelled = true;
      outputSubscription?.remove();
      exitSubscription?.remove();
      setTermuxShellReady(false);
      setTermuxShellConnecting(false);
    };
  }, [view, termuxInstalled, project.files, termuxShellRetryKey]);

  const refreshWorkspaceStatus = useCallback(async () => {
    if (Platform.OS !== "web" || !isAuthenticated) {
      setWorkspaceStatus(null);
      setWorkspaceError(Platform.OS === "web" ? "" : "تسجيل الدخول إلى runtime غير متاح على Android في هذه النسخة.");
      return;
    }
    setWorkspaceError("");
    try {
      setWorkspaceStatus(await getWorkspaceStatus());
    } catch (error) {
      setWorkspaceStatus(null);
      setWorkspaceError(error instanceof Error ? error.message : "تعذر الاتصال بـ runtime.");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshWorkspaceStatus();
  }, [refreshWorkspaceStatus]);

  useEffect(() => {
    if (!project) return;
    const timer = setTimeout(() => {
      saveProject({ ...project, updatedAt: Date.now() }).then(() => setSaved(true));
    }, 450);
    return () => clearTimeout(timer);
  }, [project]);

  const activeFile = useMemo<IDEFile | null>(() => {
    if (!project) return null;
    return project.files.find((file) => file.name === project.activeFile) ?? project.files[0] ?? null;
  }, [project]);

  const appendLog = (level: IDELog["level"], message: string) => {
    setLogs((current) => [{ id: `${Date.now()}-${Math.random()}`, level, message, time: formatClock() }, ...current].slice(0, 50));
  };

  const handleLogin = async () => {
    try {
      await startOAuthLogin();
      appendLog("info", "بعد موافقة Manus سيعود المتصفح إلى معاينة الويب تلقائيًا.");
    } catch (error) {
      Alert.alert("تعذر تسجيل الدخول", error instanceof Error ? error.message : "تحقق من اتصال الجهاز.");
    }
  };

  const handleLogout = async () => {
    await logout();
    setWorkspaceStatus(null);
    setTerminalLines((lines) => [...lines, { id: `${Date.now()}-logout`, kind: "system", text: "تم تسجيل الخروج وإغلاق مساحة runtime." }]);
  };

  const updateFile = (content: string) => {
    if (!project || !activeFile) return;
    if (content !== activeFile.content) {
      setUndoStack((stack) => [...stack, activeFile.content].slice(-60));
      setRedoStack([]);
    }
    setSaved(false);
    setProject({
      ...project,
      files: project.files.map((file) => file.name === activeFile.name ? { ...file, content, updatedAt: Date.now() } : file),
      updatedAt: Date.now(),
    });
  };

  const selectFile = (name: string) => {
    if (!project) return;
    setProject({ ...project, activeFile: name });
    setUndoStack([]);
    setRedoStack([]);
    setView("editor");
  };

  const applyHistoryContent = (content: string) => {
    if (!project || !activeFile) return;
    setSaved(false);
    setProject({ ...project, files: project.files.map((file) => file.name === activeFile.name ? { ...file, content, updatedAt: Date.now() } : file), updatedAt: Date.now() });
  };

  const undo = () => {
    if (!activeFile || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, activeFile.content].slice(-60));
    applyHistoryContent(previous);
  };

  const redo = () => {
    if (!activeFile || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, activeFile.content].slice(-60));
    applyHistoryContent(next);
  };

  const openAddFile = () => {
    setModalKind("add");
    setModalValue("");
  };

  const openRename = (name: string) => {
    setPendingRename(name);
    setModalValue(name);
    setModalKind("rename");
  };

  const submitModal = () => {
    if (!project) return;
    const value = modalValue.trim();
    if (modalKind === "add") {
      if (!value || !/^[\w.-]+$/.test(value)) {
        Alert.alert("اسم الملف غير صالح", "استخدم اسمًا بسيطًا مثل component.tsx أو notes.md.");
        return;
      }
      if (project.files.some((file) => file.name.toLowerCase() === value.toLowerCase())) {
        Alert.alert("الملف موجود", "اختر اسمًا مختلفًا لهذا الملف.");
        return;
      }
      const nextFile: IDEFile = { name: value, content: starterForFile(value), updatedAt: Date.now() };
      setSaved(false);
      setProject({ ...project, files: [...project.files, nextFile], activeFile: value, updatedAt: Date.now() });
      appendLog("info", `أُضيف الملف ${value}`);
    } else if (modalKind === "rename") {
      if (value === pendingRename) {
        setModalKind(null);
        return;
      }
      if (!value || value.length > 120 || !/^[\w.-]+$/.test(value) || project.files.some((file) => file.name.toLowerCase() === value.toLowerCase())) {
        Alert.alert("اسم غير متاح", "استخدم اسم ملف بسيط حتى 120 حرفًا، دون مجلدات أو اسم مكرر.");
        return;
      }
      setSaved(false);
      setProject({ ...project, files: project.files.map((file) => file.name === pendingRename ? { ...file, name: value, updatedAt: Date.now() } : file), activeFile: project.activeFile === pendingRename ? value : project.activeFile, updatedAt: Date.now() });
      appendLog("info", `أُعيدت تسمية ${pendingRename} إلى ${value}`);
    } else if (modalKind === "source") {
      if (!value) {
        Alert.alert("الرابط مطلوب", "أدخل رابط GitHub أو Git أو ZIP.");
        return;
      }
      const sourceType = value.includes("github.com") ? "github" : value.toLowerCase().endsWith(".zip") ? "zip" : "git";
      setSaved(false);
      setProject({ ...project, sourceUrl: value, sourceType, updatedAt: Date.now() });
      appendLog("success", `تم حفظ مصدر ${sourceType === "github" ? "GitHub" : sourceType === "zip" ? "ZIP" : "Git"} للمشروع`);
    }
    setModalKind(null);
    setModalValue("");
  };

  const deleteFile = (name: string) => {
    if (!project || project.files.length <= 1) return;
    setDeleteTarget(name);
  };

  const confirmDelete = () => {
    if (!project || !deleteTarget) return;
    const remaining = project.files.filter((file) => file.name !== deleteTarget);
    if (remaining.length === 0) return;
    setSaved(false);
    setProject({
      ...project,
      files: remaining,
      activeFile: project.activeFile === deleteTarget ? remaining[0].name : project.activeFile,
      updatedAt: Date.now(),
    });
    appendLog("warn", `حُذف الملف ${deleteTarget}`);
    setDeleteTarget(null);
  };

  const runProject = () => {
    if (!project || !activeFile) return;
    setView("preview");
    setRunning(true);
    setPreviewReloadKey((key) => key + 1);
    appendLog("info", `تم تحديث معاينة ${activeFile.name} (${languageForFile(activeFile.name)}) داخل WebView محصور الشبكة.`);
  };

  const openExternal = async (rawUrl: string) => {
    const url = rawUrl.match(/^https?:\/\//) ? rawUrl : `https://${rawUrl}`;
    try {
      await Linking.openURL(url);
      appendLog("info", `تم فتح الرابط الخارجي: ${url}`);
    } catch {
      Alert.alert("تعذر فتح الرابط", "تحقق من الرابط أو من توفر المتصفح على الجهاز.");
      appendLog("error", `تعذر فتح الرابط: ${url}`);
    }
  };

  const shareProject = async () => {
    if (!project) return;
    try {
      await Share.share({ title: `مشروع ${project.name}`, message: projectToText(project) });
      appendLog("success", "تم فتح مشاركة المشروع من النظام");
    } catch {
      appendLog("error", "تعذرت مشاركة المشروع");
    }
  };

  const exportFiles = async () => {
    if (!project) return;
    try {
      await shareProjectBundle(project);
      appendLog("success", "تم تصدير حزمة المشروع عبر مشاركة النظام");
    } catch (error) {
      Alert.alert("تعذر التصدير", error instanceof Error ? error.message : "تعذر إنشاء ملف المشروع");
      appendLog("error", "فشل تصدير حزمة المشروع");
    }
  };

  const importFiles = async () => {
    try {
      const picked = await pickProjectInput();
      if (!picked || !project) return;
      const imported = parseImportedProject(picked.name, picked.content);
      if ("files" in imported) {
        const names = new Set<string>();
        for (const file of imported.files) {
          const key = file.name.toLowerCase();
          if (names.has(key)) throw new Error(`الحزمة تحتوي على اسم ملف مكرر: ${file.name}`);
          names.add(key);
        }
        setSaved(false);
        setProject(imported);
        appendLog("success", `تم استيراد مشروع ${imported.name} مع ${imported.files.length} ملفات`);
      } else {
        if (project.files.some((file) => file.name.toLowerCase() === imported.name.toLowerCase())) {
          throw new Error(`الملف ${imported.name} موجود بالفعل؛ أعد تسميته خارج التطبيق ثم أعد الاستيراد.`);
        }
        setSaved(false);
        setProject({ ...project, files: [...project.files, imported], activeFile: imported.name, updatedAt: Date.now() });
        appendLog("success", `تم استيراد الملف ${imported.name}`);
      }
      setView("files");
    } catch (error) {
      Alert.alert("تعذر الاستيراد", error instanceof Error ? error.message : "تعذر قراءة الملف");
      appendLog("error", "فشل استيراد الملف");
    }
  };

  const runTerminal = async () => {
    const command = terminalCommand.trim();
    if (!command || terminalRunning) return;
    if (Platform.OS !== "web") {
      if (!termuxAvailable || !termuxInstalled || !termuxShellReady) {
        setTerminalLines((lines) => [...lines, { id: `${Date.now()}-termux-wait`, kind: "system", text: termuxStatus || "انتظر تجهيز بيئة Termux الرسمية..." }]);
        return;
      }
      setTerminalCommand("");
      setTerminalRunning(true);
      try {
        await writeRuntimeShell(`${command}\n`);
      } catch (error) {
        setTerminalLines((lines) => [...lines, { id: `${Date.now()}-termux-err`, kind: "error", text: error instanceof Error ? error.message : "تعذر تشغيل أمر Termux" }]);
      } finally {
        setTerminalRunning(false);
      }
      return;
    }
    if (!isAuthenticated || !workspaceStatus?.available) {
      setTerminalLines((lines) => [...lines, { id: `${Date.now()}-auth`, kind: "error", text: "runtime غير متاح على Android أو غير متصل في الويب." }]);
      return;
    }
    if (!SAFE_WORKSPACE_COMMANDS.has(command as SafeWorkspaceCommand)) {
      setTerminalLines((lines) => [...lines, { id: `${Date.now()}-blocked`, kind: "error", text: "هذا الأمر غير مسموح. اختر أمرًا من الاختصارات الآمنة." }]);
      return;
    }
    setTerminalRunning(true);
    setTerminalLines((lines) => [...lines, { id: `${Date.now()}-cmd`, kind: "command", text: command }]);
    setTerminalCommand("");
    try {
      const result = await runWorkspaceCommand(command as SafeWorkspaceCommand);
      setTerminalLines((lines) => [...lines, { id: `${Date.now()}-out`, kind: result.error ? "error" : "output", text: result.output || result.error || "(لا يوجد ناتج)" }]);
    } catch (error) {
      setTerminalLines((lines) => [...lines, { id: `${Date.now()}-err`, kind: "error", text: error instanceof Error ? error.message : "تعذر الاتصال بالـ runtime" }]);
    } finally {
      setTerminalRunning(false);
    }
  };

  const installPackage = async () => {
    const packageName = terminalPackage.trim();
    if (!packageName || terminalRunning || !/^[A-Za-z0-9][A-Za-z0-9+_.-]*$/.test(packageName)) return;
    setTerminalRunning(true);
    if (Platform.OS === "web") setTerminalLines((lines) => [...lines, { id: `${Date.now()}-install`, kind: "command", text: `pnpm add --ignore-scripts --save-exact ${packageName}` }]);
    setTerminalPackage("");
    try {
      if (Platform.OS !== "web") {
        if (!termuxAvailable || !termuxInstalled || !termuxShellReady) throw new Error("جلسة shell تفاعلية غير جاهزة.");
        await writeRuntimeShell(`pkg install -y ${packageName}\n`);
      } else {
        if (!isAuthenticated || !workspaceStatus?.available) throw new Error("سجّل الدخول أولًا لتفعيل runtime الويب.");
        const result = await installWorkspacePackage(packageName);
        setTerminalLines((lines) => [...lines, { id: `${Date.now()}-install-out`, kind: "output", text: result.output || result.note || "تم تنزيل الحزمة" }]);
        appendLog("success", result.note || `تم تنزيل ${packageName} إلى runtime المؤقت`);
      }
    } catch (error) {
      setTerminalLines((lines) => [...lines, { id: `${Date.now()}-install-err`, kind: "error", text: error instanceof Error ? error.message : "تعذر تنزيل الحزمة" }]);
    } finally {
      setTerminalRunning(false);
    }
  };

  const connectGithub = async () => {
    const token = githubToken.trim();
    if (!token) {
      Alert.alert("Token مطلوب", "أدخل GitHub fine-grained token بصلاحيات أقل ما يمكن.");
      return;
    }
    setGithubBusy(true);
    try {
      await saveGithubToken(token);
      const viewer = await getGithubViewer(token);
      const repos = await listGithubRepos(token);
      setGithubViewer(viewer);
      setGithubRepos(repos);
      appendLog("success", `تم الاتصال بـ GitHub باسم ${viewer.login} وعُثر على ${repos.length} مستودعًا`);
    } catch (error) {
      await clearGithubToken();
      setGithubViewer(null);
      setGithubRepos([]);
      Alert.alert("تعذر الاتصال بـ GitHub", error instanceof Error ? error.message : "تحقق من token وصلاحياته");
      appendLog("error", "فشل اتصال GitHub");
    } finally {
      setGithubBusy(false);
    }
  };

  const disconnectGithub = async () => {
    await clearGithubToken();
    setGithubToken("");
    setGithubViewer(null);
    setGithubRepos([]);
    appendLog("info", "تم فصل GitHub وحذف token من SecureStore");
  };

  const resetProject = () => {
    Alert.alert("إعادة المشروع", "سيتم استبدال الملفات الحالية بقالب البداية المحلي.", [
      { text: "إلغاء", style: "cancel" },
      { text: "إعادة", style: "destructive", onPress: () => { const next = cloneDefaultProject(); setSaved(false); setProject(next); appendLog("warn", "تمت إعادة المشروع إلى القالب الأولي"); } },
    ]);
  };

  if (!project || !activeFile) {
    return <View style={styles.loading}><View style={styles.logo}><Text style={styles.logoText}>R&gt;</Text></View><Text style={styles.loadingTitle}>جارٍ تجهيز ورشة الكود</Text><Text style={styles.loadingBody}>استعادة مشروعك من التخزين المحلي…</Text></View>;
  }

  const screenBg = dark ? "#0b0f16" : "#eef3f8";
  const panelBg = dark ? "#111823" : "#ffffff";
  const textColor = dark ? "#dbe3ee" : "#182434";
  const nativeDirectionStyle = Platform.OS === "web" ? undefined : { direction: "rtl" as const };

  return (
    <SafeAreaView style={[styles.safe, nativeDirectionStyle, { backgroundColor: screenBg }]} edges={view === "preview" ? [] : ["top", "left", "right", "bottom"]}>
      <StatusBar style={dark ? "light" : "dark"} hidden={view === "preview"} />
      {Platform.OS === "android" && <NavigationBar style={dark ? "dark" : "light"} hidden={view === "preview"} />}
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {view !== "preview" && <View style={[styles.topbar, { backgroundColor: panelBg }]}>
          <View style={styles.brandWrap}><View style={styles.logoSmall}><Text style={styles.logoSmallText}>R&gt;</Text></View><View><Text style={[styles.brandName, { color: textColor }]}>React IDE</Text><Text style={styles.brandSub}>native workspace</Text></View></View>
          <View style={styles.topActions}>
            <Pressable onPress={undo} disabled={undoStack.length === 0} style={[styles.topIcon, undoStack.length === 0 && styles.topIconDisabled]}><Text style={styles.topIconText}>↶</Text></Pressable>
            <Pressable onPress={redo} disabled={redoStack.length === 0} style={[styles.topIcon, redoStack.length === 0 && styles.topIconDisabled]}><Text style={styles.topIconText}>↷</Text></Pressable>
            <Pressable onPress={shareProject} style={styles.topIcon}><Text style={styles.topIconText}>↗</Text></Pressable>
            <View style={styles.saveState}><View style={[styles.saveDot, { backgroundColor: saved ? "#53c68c" : "#d29922" }]} /><Text style={styles.saveText}>{saved ? "محفوظ" : "حفظ…"}</Text></View>
            <Pressable onPress={runProject} style={[styles.runButton, running && styles.runButtonBusy]} accessibilityRole="button" accessibilityLabel="فتح المعاينة"><Text style={styles.runButtonText}>{running ? "جارٍ…" : "معاينة"}</Text><Text style={styles.runIcon}>{running ? "…" : "▷"}</Text></Pressable>
          </View>
        </View>}

        <View style={styles.workspace}>
          <Suspense fallback={<PanelFallback />}>
          {view === "editor" && <View style={styles.editorView}>
            <View style={[styles.fileTabs, { backgroundColor: panelBg }]}>
              {project.files.slice(0, 4).map((file) => <Pressable key={file.name} onPress={() => selectFile(file.name)} style={[styles.fileTab, project.activeFile === file.name && styles.fileTabActive]}><Text style={[styles.fileTabIcon, { color: languageTone(languageForFile(file.name)) }]}>{fileIcon(file.name)}</Text><Text style={[styles.fileTabText, project.activeFile === file.name && styles.fileTabTextActive]} numberOfLines={1}>{file.name}</Text></Pressable>)}
              {project.files.length > 4 && <Text style={styles.moreFiles}>+{project.files.length - 4}</Text>}
            </View>
            <View style={styles.editorTitle}><Text style={styles.breadcrumb}>mobile-starter / </Text><Text style={[styles.activeName, { color: textColor }]}>{activeFile.name}</Text><Pressable style={styles.editorMenu} onPress={() => setView("files")}><Text style={styles.editorMenuText}>الملفات ↗</Text></Pressable></View>
            <CodeEditor file={activeFile} fontSize={fontSize} onChange={updateFile} onCursorChange={(line, column) => setCursor({ line, column })} />
          </View>}
          {view === "preview" && <PreviewPanel file={activeFile} files={project.files} running={running} reloadKey={previewReloadKey} onRun={runProject} onOpenEditor={() => setView("editor")} onLoadComplete={() => setRunning(false)} />}
          {view === "console" && <ConsolePanel logs={logs} />}
          {view === "terminal" && <TerminalPanel lines={terminalLines} command={terminalCommand} running={terminalRunning} onCommandChange={setTerminalCommand} onRun={runTerminal} onInterrupt={() => { void writeRuntimeShell("\u0003").catch(() => undefined); }} onPreset={setTerminalCommand} packageName={terminalPackage} onPackageNameChange={setTerminalPackage} onInstall={installPackage} authSupported={Platform.OS === "web"} localAvailable={Platform.OS !== "web"} packageRuntimeAvailable={Platform.OS === "web" ? Boolean(isAuthenticated && workspaceStatus?.available) : Boolean(termuxAvailable && termuxInstalled)} localSessionReady={Platform.OS === "web" || termuxShellReady} runtimeInstalling={termuxInstalling || termuxShellConnecting} runtimeStatus={termuxStatus} onRetryRuntime={() => { setTermuxStatus("جارٍ إعادة تهيئة Termux..."); setTermuxRetryKey((key) => key + 1); }} onReconnectShell={() => { setTermuxShellConnecting(true); setTermuxShellRetryKey((key) => key + 1); }} authenticated={Platform.OS === "web" && isAuthenticated} workspaceStatus={workspaceStatus} workspaceError={workspaceError} userName={user?.name} onLogin={handleLogin} onLogout={handleLogout} onRefresh={refreshWorkspaceStatus} />}
          {view === "files" && <FilesPanel files={project.files} activeFile={project.activeFile} onSelect={selectFile} onAdd={openAddFile} onImport={importFiles} onExport={exportFiles} onRename={openRename} onDelete={deleteFile} />}
          {view === "projects" && <ProjectsPanel project={project} externalUrl={project.sourceUrl} onExternalUrlChange={(value) => { setSaved(false); setProject({ ...project, sourceUrl: value }); }} onConnect={() => { setModalValue(project.sourceUrl); setModalKind("source"); }} onOpenUrl={openExternal} githubToken={githubToken} githubViewer={githubViewer} githubRepos={githubRepos} githubBusy={githubBusy} onGithubTokenChange={setGithubToken} onGithubConnect={connectGithub} onGithubDisconnect={disconnectGithub} />}
          {view === "settings" && <SettingsPanel fontSize={fontSize} onChangeFontSize={setFontSize} onReset={resetProject} colorScheme={colorScheme} onChangeColorScheme={setColorScheme} />}
          </Suspense>
        </View>

        {view !== "preview" && <View style={[styles.statusbar, { backgroundColor: panelBg }]}><Text style={styles.statusText}>Ln {cursor.line}, Col {cursor.column}</Text><Text style={styles.statusDivider}>·</Text><Text style={styles.statusText}>{languageForFile(activeFile.name)}</Text><Text style={styles.statusDivider}>·</Text><Text style={[styles.statusText, { color: saved ? "#53c68c" : "#d29922" }]}>{saved ? "✓ محفوظ محليًا" : "● تعديل غير محفوظ"}</Text><Pressable style={styles.shareStatus} onPress={shareProject}><Text style={styles.shareStatusText}>مشاركة ↗</Text></Pressable></View>}
        {view !== "preview" && <View style={[styles.navbar, { backgroundColor: panelBg }]}>{NAV_ITEMS.map((item) => { const active = view === item.key; return <Pressable key={item.key} onPress={() => setView(item.key)} style={styles.navItem}><View style={[styles.navIconWrap, active && styles.navIconActive]}><Text style={[styles.navIcon, active && styles.navIconTextActive]}>{item.icon}</Text>{item.key === "console" && logs.some((log) => log.level === "error") && <View style={styles.errorBadge} />}</View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text></Pressable>; })}</View>}
      </KeyboardAvoidingView>

      <Modal visible={modalKind !== null} transparent animationType="slide" onRequestClose={() => setModalKind(null)}>
        <View style={styles.modalBackdrop}><View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{modalKind === "add" ? "ملف جديد" : modalKind === "rename" ? "إعادة تسمية الملف" : "تثبيت مصدر خارجي"}</Text><Pressable onPress={() => setModalKind(null)}><Text style={styles.sheetClose}>×</Text></Pressable></View><Text style={styles.sheetHint}>{modalKind === "source" ? "احفظ الرابط كمرجع للمشروع. لن يتم تخزين أي token أو كلمة مرور." : "استخدم اسمًا واضحًا مع الامتداد حتى يتعرف المحرر على اللغة."}</Text><TextInput value={modalValue} onChangeText={setModalValue} autoFocus placeholder={modalKind === "source" ? "https://github.com/user/repo" : "component.tsx"} placeholderTextColor="#66768d" autoCapitalize="none" autoCorrect={false} style={styles.sheetInput} /><View style={styles.sheetActions}><Pressable style={styles.cancelButton} onPress={() => setModalKind(null)}><Text style={styles.cancelText}>إلغاء</Text></Pressable><Pressable style={styles.confirmButton} onPress={submitModal}><Text style={styles.confirmText}>{modalKind === "source" ? "حفظ الرابط" : "متابعة"}</Text></Pressable></View></View></View>
      </Modal>
      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteTitle}>تأكيد حذف الملف</Text>
            <Text style={styles.deleteMessage}>سيُحذف {deleteTarget} نهائيًا من مساحة العمل المحلية.</Text>
            <View style={styles.deleteActions}>
              <Pressable style={styles.deleteCancelButton} onPress={() => setDeleteTarget(null)} accessibilityRole="button" accessibilityLabel="إلغاء الحذف">
                <Text style={styles.deleteCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.deleteConfirmButton} onPress={confirmDelete} accessibilityRole="button" accessibilityLabel="تأكيد حذف الملف">
                <Text style={styles.deleteConfirmText}>حذف الملف</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, backgroundColor: "#0b0f16", alignItems: "center", justifyContent: "center" },
  logo: { width: 62, height: 62, borderRadius: 20, backgroundColor: "#61dafb", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoText: { color: "#04222e", fontSize: 20, fontWeight: "900" },
  loadingTitle: { color: "#dbe3ee", fontSize: 16, fontWeight: "800" },
  loadingBody: { color: "#718098", fontSize: 11, marginTop: 7 },
  topbar: { height: 62, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#233043" },
  brandWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoSmall: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#61dafb", alignItems: "center", justifyContent: "center" },
  logoSmallText: { color: "#04222e", fontSize: 10, fontWeight: "900" },
  brandName: { fontSize: 14, fontWeight: "800" },
  brandSub: { color: "#64738a", fontSize: 9, marginTop: 2, fontFamily: "monospace" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  topIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: "#2d3d54", alignItems: "center", justifyContent: "center" },
  topIconText: { color: "#b8c5d6", fontSize: 18 },
  topIconDisabled: { opacity: .35 },
  saveState: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5 },
  saveDot: { width: 6, height: 6, borderRadius: 3 },
  saveText: { color: "#7f8ea5", fontSize: 9 },
  runButton: { minWidth: 68, height: 35, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#61dafb", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  runButtonBusy: { opacity: .65 },
  runButtonText: { color: "#04222e", fontSize: 11, fontWeight: "900" },
  runIcon: { color: "#04222e", fontSize: 16, fontWeight: "900" },
  workspace: { flex: 1, minHeight: 0 },
  panelFallback: { flex: 1, backgroundColor: "#0b0f16", alignItems: "center", justifyContent: "center" },
  panelFallbackText: { color: "#718098", fontSize: 12 },
  editorView: { flex: 1 },
  fileTabs: { minHeight: 43, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 4, borderBottomWidth: 1, borderBottomColor: "#233043" },
  fileTab: { maxWidth: 132, height: 32, paddingHorizontal: 8, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  fileTabActive: { backgroundColor: "#1e2938" },
  fileTabIcon: { fontSize: 12, fontFamily: "monospace" },
  fileTabText: { color: "#718098", fontFamily: "monospace", fontSize: 10 },
  fileTabTextActive: { color: "#dbe3ee" },
  moreFiles: { color: "#64738a", fontSize: 10, marginLeft: "auto" },
  editorTitle: { height: 37, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#1b2635", backgroundColor: "#0f151f" },
  breadcrumb: { color: "#5f6f86", fontFamily: "monospace", fontSize: 10 },
  activeName: { fontFamily: "monospace", fontSize: 11, fontWeight: "700" },
  editorMenu: { marginLeft: "auto", paddingHorizontal: 7, paddingVertical: 5 },
  editorMenuText: { color: "#61dafb", fontSize: 10, fontWeight: "700" },
  statusbar: { minHeight: 30, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#233043" },
  statusText: { color: "#718098", fontFamily: "monospace", fontSize: 9 },
  statusDivider: { color: "#3f4d61", fontSize: 11 },
  shareStatus: { marginLeft: "auto" },
  shareStatusText: { color: "#61dafb", fontSize: 9, fontWeight: "800" },
  navbar: { minHeight: 66, paddingBottom: Platform.OS === "android" ? 4 : 0, flexDirection: "row", borderTopWidth: 1, borderTopColor: "#233043" },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  navIconWrap: { width: 33, height: 29, borderRadius: 9, alignItems: "center", justifyContent: "center", position: "relative" },
  navIconActive: { backgroundColor: "rgba(97,218,251,.15)" },
  navIcon: { color: "#718098", fontSize: 17 },
  navIconTextActive: { color: "#61dafb" },
  navLabel: { color: "#64738a", fontSize: 9 },
  navLabelActive: { color: "#61dafb", fontWeight: "800" },
  errorBadge: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f85149", position: "absolute", top: 2, right: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(3,7,12,.68)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#111823", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 9, paddingBottom: Platform.OS === "android" ? 22 : 34, borderTopWidth: 1, borderTopColor: "#2d3d54" },
  sheetHandle: { width: 42, height: 4, borderRadius: 3, backgroundColor: "#4a5a70", alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: "#f3f7fc", fontSize: 17, fontWeight: "800" },
  sheetClose: { color: "#8b98ab", fontSize: 28, lineHeight: 28 },
  sheetHint: { color: "#7f8ea5", fontSize: 11, lineHeight: 17, marginTop: 7, marginBottom: 12 },
  sheetInput: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: "#2d3d54", backgroundColor: "#0b0f16", paddingHorizontal: 13, color: "#dbe3ee", fontFamily: "monospace", fontSize: 13 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelButton: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#2d3d54", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#aebbd0", fontSize: 13, fontWeight: "700" },
  deleteDialog: { margin: 22, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: "#34455f", backgroundColor: "#111823" },
  deleteTitle: { color: "#f3f7fc", fontSize: 17, fontWeight: "800", textAlign: "right" },
  deleteMessage: { color: "#aebbd0", fontSize: 12, lineHeight: 20, marginTop: 10, textAlign: "right" },
  deleteActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  deleteCancelButton: { flex: 1, height: 44, borderRadius: 11, borderWidth: 1, borderColor: "#2d3d54", alignItems: "center", justifyContent: "center" },
  deleteCancelText: { color: "#b6c2d2", fontSize: 12, fontWeight: "700" },
  deleteConfirmButton: { flex: 1, height: 44, borderRadius: 11, backgroundColor: "#f85149", alignItems: "center", justifyContent: "center" },
  deleteConfirmText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  confirmButton: { flex: 1, height: 46, borderRadius: 12, backgroundColor: "#61dafb", alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#04222e", fontSize: 13, fontWeight: "900" },
});
