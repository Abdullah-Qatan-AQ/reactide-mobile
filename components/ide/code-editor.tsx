import { useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { IDEFile, languageForFile, languageTone } from "@/lib/ide-model";

type CodeEditorProps = {
  file: IDEFile;
  fontSize: number;
  wrap: boolean;
  onChange: (content: string) => void;
  onCursorChange: (line: number, column: number) => void;
};

export function CodeEditor({ file, fontSize, wrap, onChange, onCursorChange }: CodeEditorProps) {
  const inputRef = useRef<TextInput>(null);
  const language = languageForFile(file.name);
  const lines = useMemo(() => file.content.split("\n"), [file.content]);
  const lineHeight = Math.round(fontSize * 1.65);

  const handleSelection = (start: number) => {
    const before = file.content.slice(0, start);
    const parts = before.split("\n");
    onCursorChange(parts.length, (parts[parts.length - 1]?.length ?? 0) + 1);
  };

  return (
    <View style={styles.root}>
      <View style={styles.editorHeader}>
        <View style={[styles.languageDot, { backgroundColor: languageTone(language) }]} />
        <Text style={styles.languageText}>{language}</Text>
        <Text style={styles.headerMuted}>تحرير أصلي</Text>
        <Pressable style={styles.symbolButton} onPress={() => inputRef.current?.focus()}>
          <Text style={styles.symbolText}>⌘</Text>
        </Pressable>
      </View>
      <View style={styles.editorBody}>
        <ScrollView
          style={styles.gutterScroll}
          contentContainerStyle={{ paddingVertical: 16 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          {lines.map((_, index) => (
            <Text key={`${file.name}-${index}`} style={[styles.lineNumber, { fontSize, lineHeight }]}>
              {index + 1}
            </Text>
          ))}
        </ScrollView>
        <TextInput
          ref={inputRef}
          value={file.content}
          onChangeText={onChange}
          onSelectionChange={(event) => handleSelection(event.nativeEvent.selection.start)}
          multiline
          spellCheck={false}
          autoCorrect={false}
          textAlignVertical="top"
          scrollEnabled
          selectionColor="#61dafb"
          style={[
            styles.input,
            {
              fontSize,
              lineHeight,
              minHeight: Math.max(260, lines.length * lineHeight + 32),
              textAlign: "left",
            },
            wrap ? styles.wrap : styles.noWrap,
          ]}
          accessibilityLabel={`محرر ${file.name}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f16" },
  editorHeader: {
    height: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#233043",
    backgroundColor: "#111823",
  },
  languageDot: { width: 8, height: 8, borderRadius: 4 },
  languageText: { color: "#dbe3ee", fontSize: 12, fontWeight: "700" },
  headerMuted: { color: "#64738a", fontSize: 11 },
  symbolButton: {
    marginLeft: "auto",
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e2938",
  },
  symbolText: { color: "#61dafb", fontSize: 15, fontWeight: "800" },
  editorBody: { flex: 1, flexDirection: "row", backgroundColor: "#0b0f16" },
  gutterScroll: {
    width: 46,
    flexGrow: 0,
    backgroundColor: "#111823",
    borderRightWidth: 1,
    borderRightColor: "#233043",
  },
  lineNumber: {
    color: "#4a5a70",
    fontFamily: "monospace",
    textAlign: "right",
    paddingRight: 10,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    color: "#dbe3ee",
    fontFamily: "monospace",
    backgroundColor: "#0b0f16",
  },
  noWrap: { textAlign: "left" },
  wrap: { textAlign: "left" },
});
