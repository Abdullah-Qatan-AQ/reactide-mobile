import { describe, expect, it } from "vitest";
import type { IDEFile } from "../lib/ide-model";
import { buildHtmlPreview } from "../lib/html-preview";

const file = (name: string, content = `content for ${name}`): IDEFile => ({
  name,
  content,
  updatedAt: 0,
});

describe("buildHtmlPreview", () => {
  it.each([
    ["index.html", "<h1>HTML</h1>"],
    ["styles.css", "body{color:red}"],
    ["README.md", "# Markdown"],
    ["data.json", '{"ok":true}'],
  ])("builds a graphical preview for %s", (name, content) => {
    const html = buildHtmlPreview(file(name, content), [file(name, content)]);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Content-Security-Policy");
    expect(html).not.toBe("");
  });

  it.each([
    "main.js",
    "app.ts",
    "App.jsx",
    "screen.tsx",
    "main.py",
    "notes.txt",
  ])("builds a non-graphical preview for %s", (name) => {
    const html = buildHtmlPreview(file(name, "<script>alert('x')</script>"), [
      file(name),
    ]);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("معاينة غير رسومية");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("applies a project stylesheet to HTML without enabling network access", () => {
    const html = buildHtmlPreview(file("index.html", "<main>hello</main>"), [
      file("index.html", "<main>hello</main>"),
      file("styles.css", "main{color:red}"),
    ]);
    expect(html).toContain("main{color:red}");
    expect(html).toContain("connect-src 'none'");
  });
});
