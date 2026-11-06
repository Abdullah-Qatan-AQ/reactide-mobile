import type { IDEFile, IDELanguage } from "./ide-model";
import { languageForFile } from "./ide-model";

const CONTENT_SECURITY_POLICY =
  "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src https:; object-src 'none'; frame-src https:; form-action 'none'; base-uri 'none'";

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

function escapeScriptContent(value: string): string {
  return value.replace(/<\/script/gi, "<\\/script");
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

function codePreview(file: IDEFile, language: IDELanguage, files: IDEFile[], projectStyles: string): string {
  const label = language === "Text" ? "نص" : language;
  const firstHeading = file.content.match(/(?:^|\n)\s*(?:return\s+)?["'`]([^"'`\n]{2,80})["'`]/)?.[1] ?? `${label} component`;
  const imports = [...file.content.matchAll(/(?:from\s+|import\s+)["']([^"']+)["']/g)].map((match) => match[1]).slice(0, 5);
  const dependencyNote = imports.length
    ? `<p class="muted">مكتبات مكتشفة: ${imports.map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join(" ")}</p>`
    : `<p class="muted">لا توجد مكتبات خارجية مكتشفة في هذا الملف.</p>`;
  const sourceFiles = files.filter((candidate) => ["JavaScript", "TypeScript", "JSX", "TSX"].includes(languageForFile(candidate.name)));
  const combinedSource = sourceFiles.map((candidate) => {
    const source = candidate.content.replace(/^\s*import\s+.*$/gm, "");
    const normalized = candidate.name === file.name
      ? source.replace(/\bexport\s+(?=(?:const|let|var|function|class|interface|type)\b)/g, "")
      : source.replace(/\bexport\s+default\s+/g, "").replace(/\bexport\s+(?=(?:const|let|var|function|class|interface|type)\b)/g, "");
    return `\n// ---- ${candidate.name} ----\n${normalized}`;
  }).join("\n") || file.content;
  const source = escapeScriptContent(JSON.stringify(combinedSource));
  let runtime = "";
  if (language === "Python") runtime = `
<script type="module">
const source=${source};const output=document.getElementById("runtime-output");
const write=(value,error=false)=>{output.className=error?"runtime-output error":"runtime-output";output.textContent=String(value||"(لا يوجد ناتج)");};
const packages=[...source.matchAll(/^\\s*(?:from|import)\\s+([a-zA-Z0-9_-]+)/gm)].map((match)=>match[1]).filter((name)=>["numpy","pandas","matplotlib","scipy","sympy","micropip"].includes(name));
try{const{loadPyodide}=await import("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs");const pyodide=await loadPyodide({stdout:write,stderr:(value)=>write(value,true)});if(packages.length)await pyodide.loadPackage([...new Set(packages)]);await pyodide.runPythonAsync(source);if(!output.textContent)write("Python completed successfully");}catch(error){write(error?.stack||error,true);}
</script>`;
  else if (language === "JavaScript" || language === "TypeScript" || language === "JSX" || language === "TSX") {
    if (language === "JavaScript") {
      runtime = `
<script type="module">
const source=${source};const output=document.getElementById("runtime-output");
const write=(value,error=false)=>{output.className=error?"runtime-output error":"runtime-output";output.textContent=String(value||"(لا يوجد ناتج)");};
const runtimeConsole={log:(...values)=>write(values.map((value)=>typeof value==="string"?value:JSON.stringify(value)).join(" ")),error:(...values)=>write(values.join(" "),true)};
try{const executable=source.replace(/export\\s+default\\s+/g,"return ").replace(/export\\s+(?=(?:const|let|var|function|class)\\b)/g,"");const value=new Function("console",executable)(runtimeConsole);if(value!==undefined)write(typeof value==="string"?value:JSON.stringify(value,null,2));else if(!output.textContent)write("JavaScript completed successfully");}catch(error){write(error?.stack||error,true);}
</script>`;
    } else {
      const compiler = language === "TypeScript"
        ? `(await import("https://esm.sh/typescript@5.6.3")).transpileModule(source,{compilerOptions:{module:1,target:7,sourceMap:false}}).outputText`
        : `(await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://unpkg.com/@babel/standalone/babel.min.js";script.onload=()=>resolve(window.Babel);script.onerror=reject;document.head.appendChild(script);})).transform(source,{presets:${language === "TSX" ? "[\"typescript\",\"react\"]" : "[\"react\"]"},sourceType:"module"}).code`;
      runtime = `
<script type="module">
const source=${source};const output=document.getElementById("runtime-output");
const write=(value,error=false)=>{output.className=error?"runtime-output error":"runtime-output";if(value instanceof Node)output.replaceChildren(value);else output.textContent=typeof value==="string"?value:JSON.stringify(value,null,2);};
const externalize=(code)=>code.replace(/(from\\s*["']|import\\s*\\()["']([^"']+)["']/g,(all,prefix,name)=>{if(name.startsWith(".")||name.startsWith("/")||name.startsWith("http"))return all;return prefix+"https://esm.sh/"+name;});
try{const compiled=${compiler};const code=externalize(${language === "TypeScript" ? "compiled" : "\"import React from 'https://esm.sh/react@18.3.1';import{createRoot}from 'https://esm.sh/react-dom@18.3.1/client';\\n\"+compiled"});const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));const module=await import(url);URL.revokeObjectURL(url);const value=module.default??module;if(typeof value==="function"){const react=await import("https://esm.sh/react@18.3.1");const dom=await import("https://esm.sh/react-dom@18.3.1/client");dom.createRoot(output).render(react.createElement(value));}else write(value);}catch(error){write(error?.stack||error,true);}
</script>`;
    }
  }
  return documentShell(
    `<main><span class="badge">${escapeHtml(label)}</span><h1>${escapeHtml(file.name)}</h1><p class="muted">معاينة رسومية مع مترجم ${escapeHtml(label)} داخل WebView.</p><section class="scene"><div class="scene-bar"><span class="live-dot"></span><strong>${escapeHtml(firstHeading)}</strong><span class="scene-tag">${escapeHtml(label)}</span></div><div class="scene-body"><div id="runtime-output" class="runtime-output"><span class="loader"></span>جارٍ تجهيز المترجم...</div></div></section><p class="muted">ملفات مترجمة في المشروع: ${sourceFiles.map((candidate) => `<span class="chip">${escapeHtml(candidate.name)}</span>`).join(" ")}</p>${dependencyNote}<section class="panel"><pre>${escapeHtml(file.content)}</pre></section></main>${runtime}`,
    `${file.name} · ${label}`,
    `${BASE_STYLE}\n${escapeStyleContent(projectStyles)}\n.scene{overflow:hidden;border:1px solid #2d3d54;border-radius:16px;background:#111823;margin:18px 0}.scene-bar{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:1px solid #2d3d54}.live-dot{width:8px;height:8px;border-radius:50%;background:#53c68c;box-shadow:0 0 12px #53c68c}.scene-tag,.chip{padding:2px 7px;border:1px solid #2d3d54;border-radius:999px;color:#61dafb;font:11px monospace}.scene-tag{margin-right:auto}.scene-body{min-height:140px;padding:28px;background:radial-gradient(circle at 80% 10%,#1b3850,#0b0f16 55%)}.runtime-output{min-height:84px;display:grid;place-items:center;padding:16px;border-radius:12px;background:#081018;border:1px solid #2d3d54;color:#dbe3ee;font:13px/1.6 SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;direction:ltr;text-align:left}.runtime-output.error{color:#ff9b95;border-color:#8d3f45}.loader{width:18px;height:18px;border:2px solid #2d3d54;border-top-color:#61dafb;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`,
  );
}

export function buildHtmlPreview(file: IDEFile, files: IDEFile[]): string {
  const language = languageForFile(file.name);
  const stylesheet = files
    .filter((candidate) => languageForFile(candidate.name) === "CSS")
    .map((candidate) => `/* ${candidate.name} */\n${candidate.content}`)
    .join("\n");

  if (language === "HTML") {
    let html = file.content;
    const scripts = files
      .filter((candidate) => ["JavaScript", "TypeScript"].includes(languageForFile(candidate.name)))
      .map((candidate) => `<script type="module">// ${escapeHtml(candidate.name)}\n${escapeScriptContent(candidate.content)}</script>`)
      .join("");
    const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">${stylesheet ? `<style>${escapeStyleContent(stylesheet)}</style>` : ""}`;
    if (!/<html\b/i.test(html))
      html = `<!doctype html><html lang="ar" dir="rtl"><head></head><body>${html}</body></html>`;
    if (/<head\b[^>]*>/i.test(html))
      html = html.replace(
        /<head\b[^>]*>/i,
        (openingTag) => `${openingTag}${head}${scripts}`,
      );
    else
      html = html.replace(
        /<html\b[^>]*>/i,
        (openingTag) => `${openingTag}<head>${head}${scripts}</head>`,
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

  return codePreview(file, language, files, stylesheet);
}
