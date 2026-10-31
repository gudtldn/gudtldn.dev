// 로컬 개발: 파일이 바뀌면 다시 빌드하고 dist/를 http://localhost:8000 으로 서비스합니다.
// (Pages Function은 없으므로 GitHub API는 api.github.com으로 직접 호출됩니다.)
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 8000;
const WATCH = ['index.html', 'profile.json', 'profile-schema.json', 'assets', 'favicons', 'projects', 'src', 'tailwind.config.js'];
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
};

const build = () => {
    try { execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' }); }
    catch { console.error('빌드 실패: 위 오류를 확인하세요.'); }
};

build();
let timer;
for (const p of WATCH) {
    watch(p, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(build, 150); });
}

createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join('dist', normalize(path === '/' ? '/index.html' : path));
    if (!file.startsWith('dist')) { res.writeHead(403).end(); return; }
    try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
    } catch {
        res.writeHead(404).end('Not found');
    }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
