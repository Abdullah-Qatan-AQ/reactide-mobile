import { IDEFile } from "@/lib/ide-model";

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

function escapeStyleContent(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

export function buildHtmlPreview(file: IDEFile, files: IDEFile[]): string {
  if (!/\.html?$/i.test(file.name)) return "";

  const stylesheet = files.find((candidate) => candidate.name.toLowerCase().endsWith(".css"))?.content;
  const head = [
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    stylesheet ? `<style>${escapeStyleContent(stylesheet)}</style>` : "",
  ].join("");

  let html = file.content;
  if (!/<html\b/i.test(html)) {
    html = `<!doctype html><html lang="ar" dir="rtl"><head></head><body>${html}</body></html>`;
  }
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (openingTag) => `${openingTag}${head}`);
  } else {
    html = html.replace(/<html\b[^>]*>/i, (openingTag) => `${openingTag}<head>${head}</head>`);
  }
  return html;
}
