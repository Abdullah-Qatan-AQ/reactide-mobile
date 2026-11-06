import type { IDEFile, IDELanguage } from "./ide-model";
import { languageForFile } from "./ide-model";
import { manifestForProject } from "./project-manifest";

const CONTENT_SECURITY_POLICY =
  "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src https:; object-src 'none'; frame-src https:; form-action 'none'; base-uri 'none'";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeStyleContent(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function escapeScriptContent(value: string): string {
  return value.replace(/<\/script/gi, "<\\/script");
}

function documentShell(body: string, title: string, stylesheet = ""): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}"><title>${escapeHtml(title)}</title><style>${escapeStyleContent(stylesheet)}</style></head><body>${body}</body></html>`;
}

const BASE_STYLE = `*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0}body{padding:20px;background:#0b0f16;color:#dbe3ee;font-family:system-ui,-apple-system,sans-serif;line-height:1.7}main{max-width:760px;margin:0 auto}.badge{display:inline-block;padding:3px 9px;border:1px solid #2d3d54;border-radius:999px;color:#61dafb;font:12px monospace}h1{margin:12px 0 4px;font-size:24px}p{color:#91a1b7}.panel{padding:16px;border:1px solid #2d3d54;border-radius:14px;background:#111823}pre{margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;font:13px/1.65 SFMono-Regular,Menlo,monospace;color:#dbe3ee;direction:ltr;text-align:left}.muted{color:#718198;font-size:12px}.md h2{font-size:19px;border-bottom:1px solid #2d3d54;padding-bottom:6px}.md code{color:#f2c94c;background:#1e2938;padding:2px 5px;border-radius:4px}.md ul{padding-right:22px}`;

function markdownBody(source: string): string {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let inList = false;
  for (const line of lines) {
    const value = line.trim();
    if (!value) {
      if (inList) { output.push("</ul>"); inList = false; }
      continue;
    }
    if (value.startsWith("### ")) output.push(`<h3>${inlineMarkdown(value.slice(4))}</h3>`);
    else if (value.startsWith("## ")) output.push(`<h2>${inlineMarkdown(value.slice(3))}</h2>`);
    else if (value.startsWith("# ")) output.push(`<h1>${inlineMarkdown(value.slice(2))}</h1>`);
    else if (/^[-*] /.test(value)) {
      if (!inList) { output.push("<ul>"); inList = true; }
      output.push(`<li>${inlineMarkdown(value.slice(2))}</li>`);
    } else output.push(`<p>${inlineMarkdown(value)}</p>`);
  }
  if (inList) output.push("</ul>");
  return output.join("");
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function isWebModule(file: IDEFile): boolean {
  return ["JavaScript", "TypeScript", "JSX", "TSX"].includes(languageForFile(file.name));
}

function projectModules(files: IDEFile[], entry: IDEFile): IDEFile[] {
  const sources = files.some((file) => file.name === entry.name) ? files : [...files, entry];
  const manifest = manifestForProject({ id: "preview", name: "preview", files: sources, activeFile: entry.name, sourceUrl: "", sourceType: "local", updatedAt: 0 });
  return sources.filter((file) => isWebModule(file) && manifest.files[file.name]?.role !== "docs" && manifest.files[file.name]?.role !== "text");
}

function moduleRunner(modules: IDEFile[], entryName: string, roots: string[] = [entryName]): string {
  const serialized = escapeScriptContent(JSON.stringify(Object.fromEntries(modules.map((file) => [file.name, { content: file.content, language: languageForFile(file.name) }]))));
  const rootsJson = JSON.stringify(roots);
  const entryJson = JSON.stringify(entryName);
  return `<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><script type="module">
const files=${serialized};const roots=${rootsJson};const entry=${entryJson};const cache=new Map();const externals=new Map();
const localSpecifiers=new Set();for(const file of Object.values(files)){for(const match of file.content.matchAll(/(?:from\\s*|import\\s*\\()\\s*[\"']([^\"']+)[\"']/g)){if(match[1].startsWith('.')||match[1].startsWith('/')||match[1].startsWith('@/'))localSpecifiers.add(match[1]);}}
const externalNames=new Set(['react','react-dom/client']);for(const file of Object.values(files)){for(const match of file.content.matchAll(/(?:from\\s*|import\\s*\\()\\s*[\"']([^\"']+)[\"']/g)){const name=match[1];if(!name.startsWith('.')&&!name.startsWith('/')&&!name.startsWith('@/'))externalNames.add(name);}}
try{
 await Promise.all([...externalNames].map(async(name)=>{const path=name==='react'?'react@19.2.3':name==='react-dom/client'?'react-dom@19.2.3/client?external=react':name;externals.set(name,await import('https://esm.sh/'+path));}));
 const normalize=(name)=>{const parts=[];for(const part of name.replace(/^@\\//,'').split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}return parts.join('/');};
 const candidates=(name)=>{const base=normalize(name);return [base,base+'.js',base+'.jsx',base+'.ts',base+'.tsx',base+'.mjs',base+'/index.js',base+'/index.jsx',base+'/index.ts',base+'/index.tsx'];};
 const resolve=(specifier,parent)=>{if(specifier.endsWith('.css'))return {css:true};const requested=specifier.startsWith('@/')?specifier.slice(2):specifier.startsWith('.')?normalize(parent.split('/').slice(0,-1).concat(specifier).join('/')):specifier;for(const candidate of candidates(requested)){if(files[candidate])return {id:candidate};}if(externals.has(specifier))return {external:specifier};throw new Error('تعذر العثور على الوحدة '+specifier+' المستوردة من '+parent);};
 const load=(id)=>{if(cache.has(id))return cache.get(id).exports;const file=files[id];if(!file)throw new Error('ملف مشروع غير موجود: '+id);const module={exports:{}};cache.set(id,module);const preset=file.language==='JSX'?['react']:file.language==='TSX'?['typescript','react']:file.language==='TypeScript'?['typescript']:[];const compiled=Babel.transform(file.content,{filename:id,presets:preset,plugins:['transform-modules-commonjs'],sourceType:'module',babelrc:false,configFile:false}).code;const requireModule=(specifier)=>{const target=resolve(specifier,id);if(target.css)return {};if(target.id)return load(target.id);return externals.get(target.external);};new Function('require','module','exports',compiled)(requireModule,module,module.exports);return module.exports;};
 const rootExports=[];for(const root of roots){if(files[root])rootExports.push([root,load(root)]);}
 const appModule=rootExports.find(([name])=>name===entry)?.[1]??rootExports[0]?.[1];let app=appModule?.default??appModule?.App??appModule;
 if(typeof app==='function'||(app&&typeof app==='object'&&app.$$typeof)){const React=externals.get('react')?.default??externals.get('react');const ReactDOM=externals.get('react-dom/client');let host=document.querySelector('#root,#app,[data-app-root]');if(!host){host=document.createElement('div');host.id='root';document.body.appendChild(host);}ReactDOM.createRoot(host).render(typeof app==='function'?React.createElement(app):app);}
}catch(error){document.body.innerHTML='<pre style="white-space:pre-wrap;color:#ff8f8a;background:#0b0f16;padding:20px;font:14px monospace"></pre>';document.querySelector('pre').textContent=error?.stack||String(error);}
</script>`;
}

function codePreview(file: IDEFile, files: IDEFile[], projectStyles: string): string {
  if (languageForFile(file.name) === "Python") {
    const source = escapeScriptContent(JSON.stringify(file.content));
    const runtime = `<script type="module">const output=document.getElementById('runtime-output');try{const{loadPyodide}=await import('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs');const py=await loadPyodide({stdout:(x)=>output.textContent+=x+'\\n',stderr:(x)=>output.textContent+=x+'\\n'});await py.runPythonAsync(${source});}catch(e){output.textContent=e?.stack||String(e);output.style.color='#ff8f8a';}</script>`;
    return documentShell(`<pre id="runtime-output" style="white-space:pre-wrap">جارٍ تشغيل Python...</pre>${runtime}`, file.name, `${BASE_STYLE}#runtime-output{padding:18px;background:#080c12;color:#dbe3ee}`);
  }
  const modules = projectModules(files, file);
  const runtime = moduleRunner(modules, file.name);
  return documentShell(`<div id="root"></div><div id="runtime-output"></div>${runtime}`, file.name, `${BASE_STYLE}\n${projectStyles}\nbody{padding:0}#runtime-output{position:fixed;inset:auto 12px 12px;max-height:35vh;overflow:auto;color:#ff8f8a;background:#080c12;white-space:pre-wrap;font:12px monospace}:empty{display:none}`);
}

function resolvePreviewEntry(files: IDEFile[], active: IDEFile): IDEFile {
  const available = new Map(files.map((file) => [file.name, file]));
  const manifest = manifestForProject({ id: "preview", name: "preview", files, activeFile: active.name, sourceUrl: "", sourceType: "local", updatedAt: 0 });
  const declared = available.get(manifest.entry);
  if (declared && (languageForFile(declared.name) === "HTML" || isWebModule(declared))) return declared;
  if (declared && languageForFile(declared.name) === "Python" && !files.some(isWebModule)) return declared;
  const html = files.find((file) => file.name.toLowerCase() === "index.html") ?? files.find((file) => languageForFile(file.name) === "HTML");
  if (html) return html;
  for (const preferred of ["App.tsx", "App.jsx", "app.tsx", "app.jsx", "index.tsx", "index.jsx", "main.tsx", "main.jsx", "index.ts", "main.ts", "main.js"]) {
    const match = files.find((file) => file.name.toLowerCase() === preferred.toLowerCase());
    if (match) return match;
  }
  return files.find(isWebModule) ?? files.find((file) => languageForFile(file.name) === "Python") ?? active;
}

export function projectPreviewEntry(files: IDEFile[], active: IDEFile): IDEFile {
  return resolvePreviewEntry(files, active);
}

export function buildHtmlPreview(file: IDEFile, files: IDEFile[]): string {
  const language = languageForFile(file.name);
  const stylesheet = files.filter((candidate) => languageForFile(candidate.name) === "CSS").map((candidate) => `/* ${candidate.name} */\n${candidate.content}`).join("\n");

  if (language === "HTML") {
    let html = file.content;
    if (!/<html\b/i.test(html)) html = `<!doctype html><html lang="ar" dir="rtl"><head></head><body>${html}</body></html>`;
    const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">${stylesheet ? `<style>${escapeStyleContent(stylesheet)}</style>` : ""}`;
    const modules = projectModules(files, file);
    const roots = modules.map((candidate) => candidate.name);
    const component = modules.find((candidate) => /^app\.(jsx|tsx)$/i.test(candidate.name)) ?? modules.find((candidate) => /^(index|main)\.(jsx|tsx)$/i.test(candidate.name));
    const runner = moduleRunner(modules, component?.name ?? roots[0] ?? file.name, roots);
    const headPattern = /<head\b[^>]*>/i;
    if (headPattern.test(html)) html = html.replace(headPattern, (opening) => `${opening}${head}`);
    else html = html.replace(/<html\b[^>]*>/i, (opening) => `${opening}<head>${head}</head>`);
    return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, `${runner}</body>`) : html.replace(/<\/html\s*>/i, `${runner}</html>`);
  }

  if (["JavaScript", "TypeScript", "JSX", "TSX", "Python"].includes(language)) return codePreview(file, files, stylesheet);
  if (language === "CSS") return documentShell(`<main><h1>معاينة CSS</h1><section class="panel"><h2>عنوان تجريبي</h2><p>هذه عينة لتعديل الأنماط. عاين التطبيق من ملف الدخول.</p><button>زر تجريبي</button></section></main>`, file.name, `${BASE_STYLE}\n${file.content}`);
  if (language === "Markdown") return documentShell(`<main class="md">${markdownBody(file.content)}</main>`, file.name, BASE_STYLE);
  if (language === "JSON") {
    let formatted = file.content;
    try { formatted = JSON.stringify(JSON.parse(file.content), null, 2); } catch { /* show invalid JSON as entered */ }
    return documentShell(`<main><h1>${escapeHtml(file.name)}</h1><section class="panel"><pre>${escapeHtml(formatted)}</pre></section></main>`, file.name, BASE_STYLE);
  }
  return documentShell(`<main><h1>${escapeHtml(file.name)}</h1><section class="panel"><pre>${escapeHtml(file.content)}</pre></section></main>`, file.name, BASE_STYLE);
}
