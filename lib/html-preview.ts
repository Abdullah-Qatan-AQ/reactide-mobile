import type { IDEFile, IDELanguage } from "./ide-model";
import { languageForFile } from "./ide-model";

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeStyleContent(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function documentShell(body: string, title: string, stylesheet = ""): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}"><title>${escapeHtml(title)}</title><style>${escapeStyleContent(stylesheet)}</style></head><body>${body}</body></html>`;
}

const BASE_STYLE = `*{box-sizing:border-box}body{margin:0;padding:20px;background:#0b0f16;color:#dbe3ee;font-family:system-ui,-apple-system,sans-serif;line-height:1.7}main{max-width:760px;margin:0 auto}.badge{display:inline-block;padding:3px 9px;border:1px solid #2d3d54;border-radius:999px;color:#61dafb;font:12px monospace}h1{margin:12px 0 4px;font-size:24px}p{color:#91a1b7}.panel{padding:16px;border:1px solid #2d3d54;border-radius:14px;background:#111823}pre{margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;font:13px/1.65 SFMono-Regular,Menlo,monospace;color:#dbe3ee;direction:ltr;text-align:left}.key{color:#61dafb}.muted{color:#718198;font-size:12px}.md h2{font-size:19px;border-bottom:1px solid #2d3d54;padding-bottom:6px}.md code{color:#f2c94c;background:#1e2938;padding:2px 5px;border-radius:4px}.md ul{padding-right:22px}`;

function markdownBody(source: string): string {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let inList = false;
  for (const line of lines) {
    const value = line.trim();
    if (!value) {
      if (inList) {
        output.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (value.startsWith("### "))
      output.push(`<h3>${inlineMarkdown(value.slice(4))}</h3>`);
    else if (value.startsWith("## "))
      output.push(`<h2>${inlineMarkdown(value.slice(3))}</h2>`);
    else if (value.startsWith("# "))
      output.push(`<h1>${inlineMarkdown(value.slice(2))}</h1>`);
    else if (/^[-*] /.test(value)) {
      if (!inList) {
        output.push("<ul>");
        inList = true;
      }
      output.push(`<li>${inlineMarkdown(value.slice(2))}</li>`);
    } else output.push(`<p>${inlineMarkdown(value)}</p>`);
  }
  if (inList) output.push("</ul>");
  return output.join("");
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function codePreview(file: IDEFile, language: IDELanguage): string {
  const label = language === "Text" ? "نص" : language;
  return documentShell(
    `<main><span class="badge">${escapeHtml(label)}</span><h1>${escapeHtml(file.name)}</h1><p class="muted">معاينة غير رسومية · المحتوى معروض كما هو دون تنفيذ.</p><section class="panel"><pre>${escapeHtml(file.content)}</pre></section></main>`,
    `${file.name} · ${label}`,
    BASE_STYLE,
  );
}

export function buildHtmlPreview(file: IDEFile, files: IDEFile[]): string {
  const language = languageForFile(file.name);
  const stylesheet =
    files.find((candidate) => candidate.name.toLowerCase().endsWith(".css"))
      ?.content ?? "";

  if (language === "HTML") {
    let html = file.content;
    const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">${stylesheet ? `<style>${escapeStyleContent(stylesheet)}</style>` : ""}`;
    if (!/<html\b/i.test(html))
      html = `<!doctype html><html lang="ar" dir="rtl"><head></head><body>${html}</body></html>`;
    if (/<head\b[^>]*>/i.test(html))
      html = html.replace(
        /<head\b[^>]*>/i,
        (openingTag) => `${openingTag}${head}`,
      );
    else
      html = html.replace(
        /<html\b[^>]*>/i,
        (openingTag) => `${openingTag}<head>${head}</head>`,
      );
    return html;
  }

  if (language === "CSS") {
    return documentShell(
      `<main><span class="badge">CSS</span><h1>معاينة الأنماط</h1><p>هذه عينة رسومية للأنماط الموجودة في ${escapeHtml(file.name)}.</p><section class="panel preview-sample"><h2>عنوان تجريبي</h2><p>يتغير هذا المحتوى وفق CSS الخاص بك.</p><button>زر تجريبي</button></section></main>`,
      file.name,
      `${BASE_STYLE}\n${file.content}`,
    );
  }

  if (language === "Markdown") {
    return documentShell(
      `<main class="md"><span class="badge">Markdown</span>${markdownBody(file.content)}</main>`,
      file.name,
      BASE_STYLE,
    );
  }

  if (language === "JSON") {
    let formatted = file.content;
    try {
      formatted = JSON.stringify(JSON.parse(file.content), null, 2);
    } catch {
      /* keep invalid JSON visible */
    }
    return documentShell(
      `<main><span class="badge">JSON</span><h1>${escapeHtml(file.name)}</h1><p class="muted">معاينة بيانات غير تنفيذية.</p><section class="panel"><pre>${escapeHtml(formatted)}</pre></section></main>`,
      file.name,
      BASE_STYLE,
    );
  }

  return codePreview(file, language);
}
