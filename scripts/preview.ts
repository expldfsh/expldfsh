/**
 * Offline preview of the profile README: preview/index.html (desktop dark, desktop light, 390px mobile)
 * and preview/mobile.html (just the phone frame).
 *
 * README.md is mostly raw HTML plus a little Markdown, so a tiny local renderer is enough. GitHub's
 * /markdown API is deliberately not used: it re-wraps <img> inside <picture> differently from how
 * github.com renders a README, so it would mis-preview the mobile <source> switching.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fromRoot, loadConfig } from './lib/config.ts';

const config = loadConfig();
const markdown = readFileSync(fromRoot('README.md'), 'utf8');

const inline = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

function render(md: string): string {
  return md
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      if (block.trimStart().startsWith('<')) return block;
      if (block.startsWith('### ')) return `<h3>${inline(block.slice(4))}</h3>`;
      if (block.startsWith('- ')) return `<ul>${block.split('\n').map((li) => `<li>${inline(li.slice(2))}</li>`).join('')}</ul>`;
      return `<p>${inline(block.replace(/\n/g, ' '))}</p>`; // soft line breaks, as on github.com
    })
    .join('\n');
}

const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<base href="../"><style>
:root{--bg:#0d1117;--fg:#f0f6fc;--muted:#9198a1;--border:#3d444d;--link:#4493f8}
:root.light{--bg:#fff;--fg:#1f2328;--muted:#59636e;--border:#d1d9e0;--link:#0969da}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif}
.box{margin:16px;border:1px solid var(--border);border-radius:6px;padding:24px}
.head{font:12px ui-monospace,Menlo,monospace;color:var(--muted);margin:-8px 0 16px}
@media (max-width:600px){.box{padding:16px}}
h3{font-size:1.25em;margin:24px 0 16px}p,ul{margin:0 0 16px}ul{padding-left:2em}a{color:var(--link)}img{max-width:100%;box-sizing:content-box}
</style><script>if(location.hash==='#light')document.documentElement.className='light'</script></head>
<body><div class="box"><div class="head">${config.login} / README.md</div>${render(markdown)}</div></body></html>`;

const index = `<!doctype html><html><head><meta charset="utf-8"><title>Profile preview</title><style>
body{margin:0;padding:24px;background:#30343f;font:13px ui-monospace,Menlo,monospace;color:#c8d3f5;display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0}figcaption{margin-bottom:8px}iframe{border:0;background:#fff;display:block}
</style></head><body>
<figure><figcaption>desktop · dark</figcaption><iframe src="readme.html" width="930" height="1260"></iframe></figure>
<figure><figcaption>desktop · light</figcaption><iframe src="readme.html#light" width="930" height="1260"></iframe></figure>
<figure><figcaption>mobile · 390px</figcaption><iframe src="readme.html" width="390" height="1260"></iframe></figure>
</body></html>`;

// A phone-width frame on its own (browser windows usually can't shrink to 390px).
const mobile = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0d1117}iframe{border:0;display:block}</style></head>
<body><iframe src="readme.html" width="390" height="1400"></iframe></body></html>`;

mkdirSync(fromRoot('preview'), { recursive: true });
writeFileSync(fromRoot('preview/readme.html'), page);
writeFileSync(fromRoot('preview/index.html'), index);
writeFileSync(fromRoot('preview/mobile.html'), mobile);
console.log('Wrote preview/index.html (open it in a browser) and preview/mobile.html');
