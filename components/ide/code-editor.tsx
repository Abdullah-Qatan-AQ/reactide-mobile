import { useMemo, useRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { IDEFile, languageForFile, languageTone } from "@/lib/ide-model";

type CodeEditorProps = { file: IDEFile; fontSize: number; onChange: (content: string) => void; onCursorChange: (line: number, column: number) => void };
type Token = { text: string; color: string };
const COLORS = { plain: "#dbe3ee", keyword: "#ff7ab2", string: "#a8e6a3", number: "#f2c94c", comment: "#718098", type: "#61dafb", punctuation: "#aebbd0" };

function tokenizeLine(line: string, language: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(\/\/.*|#.*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\b\d+(?:\.\d+)?\b|\b(?:const|let|var|function|return|export|default|import|from|as|if|else|for|while|class|new|async|await|def|in|True|False|None|print|type|interface|extends|implements|public|private|select|where)\b|[{}()[\];,.])/g;
  let cursor = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: line.slice(cursor, index), color: COLORS.plain });
    const text = match[0];
    let color = COLORS.punctuation;
    if (/^(\/\/|#|\/\*)/.test(text)) color = COLORS.comment;
    else if (/^[`'"]/.test(text)) color = COLORS.string;
    else if (/^\d/.test(text)) color = COLORS.number;
    else if (/^(?:const|let|var|function|return|export|default|import|from|as|if|else|for|while|class|new|async|await|def|in|True|False|None|print|type|interface|extends|implements|public|private|select|where)$/.test(text)) color = COLORS.keyword;
    else if (language === "TypeScript" || language === "TSX") color = COLORS.type;
    tokens.push({ text, color });
    cursor = index + text.length;
  }
  if (cursor < line.length) tokens.push({ text: line.slice(cursor), color: COLORS.plain });
  return tokens;
}

function HighlightedCode({ content, language, fontSize, lineHeight }: { content: string; language: string; fontSize: number; lineHeight: number }) {
  const lines = content.split("\n");
  return <Text style={[styles.highlightedCode, { fontSize, lineHeight }]}>{lines.map((line, index) => <Text key={`line-${index}`}>{tokenizeLine(line, language).map((token, tokenIndex) => <Text key={`${index}-${tokenIndex}`} style={{ color: token.color }}>{token.text}</Text>)}{index < lines.length - 1 ? "\n" : ""}</Text>)}</Text>;
}

export function CodeEditor({ file, fontSize, onChange, onCursorChange }: CodeEditorProps) {
  const inputRef = useRef<TextInput>(null);
  const language = languageForFile(file.name);
  const lines = useMemo(() => file.content.split("\n"), [file.content]);
  const lineHeight = Math.round(fontSize * 1.65);
  const handleSelection = (start: number) => {
    const parts = file.content.slice(0, start).split("\n");
    onCursorChange(parts.length, (parts[parts.length - 1]?.length ?? 0) + 1);
  };
  return <View style={styles.root}>
    <View style={styles.editorHeader}><View style={[styles.languageDot, { backgroundColor: languageTone(language) }]} /><Text style={styles.languageText}>{language}</Text><Text style={styles.headerMuted}>تلوين حي · تحرير أصلي</Text><Pressable style={styles.symbolButton} onPress={() => inputRef.current?.focus()}><Text style={styles.symbolText}>⌘</Text></Pressable></View>
    <View style={styles.editorBody}>
      <ScrollView style={styles.gutterScroll} contentContainerStyle={{ paddingVertical: 16 }} showsVerticalScrollIndicator={false} scrollEnabled={false}>{lines.map((_, index) => <Text key={`${file.name}-${index}`} style={[styles.lineNumber, { fontSize, lineHeight }]}>{index + 1}</Text>)}</ScrollView>
      <View style={styles.editorSurface}>
        {Platform.OS === "web" && <ScrollView style={styles.highlightScroll} contentContainerStyle={styles.codePadding} showsVerticalScrollIndicator={false}><HighlightedCode content={file.content} language={language} fontSize={fontSize} lineHeight={lineHeight} /></ScrollView>}
        <TextInput ref={inputRef} value={file.content} onChangeText={onChange} onSelectionChange={(event) => handleSelection(event.nativeEvent.selection.start)} multiline spellCheck={false} autoCorrect={false} textAlignVertical="top" scrollEnabled selectionColor="#61dafb" style={[styles.input, { color: Platform.OS === "web" ? "transparent" : COLORS.plain, fontSize, lineHeight, minHeight: Math.max(260, lines.length * lineHeight + 32) }]} accessibilityLabel={`محرر ${file.name}`} />
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  editorHeader: { height: 42, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#233043", backgroundColor: "#111823" },
  languageDot: { width: 8, height: 8, borderRadius: 4 }, languageText: { color: "#dbe3ee", fontSize: 12, fontWeight: "700" }, headerMuted: { color: "#64738a", fontSize: 11 },
  symbolButton: { marginLeft: "auto", width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#1e2938" }, symbolText: { color: "#61dafb", fontSize: 15, fontWeight: "800" },
  editorBody: { flex: 1, flexDirection: "row", backgroundColor: "#0b0f16" }, gutterScroll: { width: 46, flexGrow: 0, backgroundColor: "#111823", borderRightWidth: 1, borderRightColor: "#233043" }, lineNumber: { color: "#4a5a70", fontFamily: "monospace", textAlign: "right", paddingRight: 10 },
  editorSurface: { flex: 1, position: "relative" }, highlightScroll: { ...StyleSheet.absoluteFill }, codePadding: { paddingHorizontal: 14, paddingVertical: 16 }, highlightedCode: { fontFamily: "monospace", color: COLORS.plain },
  input: { ...StyleSheet.absoluteFill, paddingHorizontal: 14, paddingVertical: 16, color: "transparent", fontFamily: "monospace", writingDirection: "ltr", backgroundColor: "transparent", textAlign: "left", textAlignVertical: "top" },
});
