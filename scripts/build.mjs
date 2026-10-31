// 배포용 빌드: 정적 파일을 dist/로 복사하고 Tailwind CSS를 컴파일합니다.
// Cloudflare Pages: 빌드 명령 `npm ci && npm run build`, 출력 디렉터리 `dist`
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const STATIC = ['index.html', 'profile.json', 'profile-schema.json', 'assets', 'favicons', 'projects'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });
for (const p of STATIC) cpSync(p, `dist/${p}`, { recursive: true });

execFileSync(
    process.execPath,
    ['node_modules/tailwindcss/lib/cli.js', '-i', 'src/tailwind.css', '-o', 'dist/assets/tailwind.css', '--minify'],
    { stdio: 'inherit' }
);
