// GitHub API 중계 (Cloudflare Pages Function)
//   /api/github/<path>  →  https://api.github.com/<path>
//
// - 허용한 경로만 중계합니다 (아무 API나 대신 호출해 주는 열린 프록시가 되지 않도록).
// - 엣지 캐시(Cache API)에 저장하고, TTL이 지나면 ETag로 재검증합니다.
//   304 응답은 GitHub 호출 한도에 포함되지 않으므로, 데이터가 바뀌지 않았다면 한도를 쓰지 않습니다.
// - 환경 변수 GITHUB_TOKEN(Secret)이 있으면 인증해서 호출합니다 (시간당 5,000회).
// - GitHub이 실패하면 만료된 캐시라도 있으면 그걸 돌려줍니다.

const ROUTES = [
    // 저장소 정보: 자주 안 바뀜
    { re: /^repos\/[\w.-]+\/[\w.-]+$/, ttl: 300 },
    // 커밋 상세: SHA로 조회하므로 내용이 절대 바뀌지 않음
    { re: /^repos\/[\w.-]+\/[\w.-]+\/commits\/[0-9a-f]{7,40}$/i, ttl: 31536000, immutable: true },
    // 활동 이벤트: GitHub의 X-Poll-Interval(60초)에 맞춤
    { re: /^users\/[\w-]+\/events\/public$/, ttl: 60 },
];

const STORE_SECONDS = 86400;       // 캐시 보관 기간 (TTL이 지나도 장애 대비로 남겨 둠)
const BROWSER_MAX_AGE = 60;        // 브라우저가 자체적으로 재사용하는 시간

const json = (obj, status, extra = {}) =>
    new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', 'X-GH-Proxy': '1', 'Cache-Control': 'no-store', ...extra },
    });

// 저장된 응답에서 브라우저로 내보낼 응답을 만든다
const serve = (stored, route, state, upstream) => {
    const headers = new Headers(stored.headers);
    // 한도 확인용 (인증되면 Limit이 5000)
    for (const h of ['x-ratelimit-limit', 'x-ratelimit-remaining']) {
        const v = upstream?.headers.get(h);
        if (v) headers.set(h, v);
    }
    headers.set('Cache-Control', route.immutable ? 'public, max-age=31536000, immutable' : `public, max-age=${BROWSER_MAX_AGE}`);
    headers.set('X-Cache', state);
    headers.set('X-Debug-Env', DEBUG_ENV_KEYS); // TEMP
    return new Response(stored.body, { status: 200, headers });
};

let DEBUG_ENV_KEYS = ''; // TEMP
export async function onRequestGet({ request, env, params, waitUntil }) {
    DEBUG_ENV_KEYS = Object.keys(env).join(',') + '|token=' + (env.GITHUB_TOKEN ? 'len' + String(env.GITHUB_TOKEN).length : 'none'); // TEMP
    const path = [].concat(params.path || []).join('/');
    const route = ROUTES.find((r) => r.re.test(path));
    if (!route) return json({ message: 'Not allowed' }, 404);

    const cache = caches.default;
    const cacheKey = new Request(`${new URL(request.url).origin}/api/github/${path}`);
    const cached = await cache.match(cacheKey);

    if (cached) {
        const age = (Date.now() - Number(cached.headers.get('X-Cached-At'))) / 1000;
        if (route.immutable || age < route.ttl) return serve(cached, route, 'HIT');
    }

    const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gudtldn.dev',
    };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const etag = cached?.headers.get('ETag');
    if (etag) headers['If-None-Match'] = etag;

    let upstream = null;
    try {
        upstream = await fetch(`https://api.github.com/${path}`, { headers });
    } catch (e) { /* 네트워크 오류: 아래에서 stale 처리 */ }

    // 바뀐 게 없음: 기존 본문을 재사용하고 시각만 갱신
    if (upstream?.status === 304 && cached) {
        const refreshed = new Response(cached.body, cached);
        refreshed.headers.set('X-Cached-At', String(Date.now()));
        waitUntil(cache.put(cacheKey, refreshed.clone()));
        return serve(refreshed, route, 'REVALIDATED', upstream);
    }

    // 새 데이터
    if (upstream?.ok) {
        const stored = new Response(await upstream.arrayBuffer(), {
            headers: {
                'Content-Type': 'application/json',
                'X-GH-Proxy': '1',
                'X-Cached-At': String(Date.now()),
                'Cache-Control': `public, max-age=${route.immutable ? 31536000 : STORE_SECONDS}`,
                ...(upstream.headers.get('ETag') && { ETag: upstream.headers.get('ETag') }),
            },
        });
        waitUntil(cache.put(cacheKey, stored.clone()));
        return serve(stored, route, 'MISS', upstream);
    }

    // 실패(한도 초과, 5xx, 네트워크 오류): 만료된 캐시라도 있으면 사용
    if (cached) return serve(cached, route, 'STALE');
    return json(
        { message: `GitHub API ${upstream?.status ?? 'unreachable'}` },
        upstream?.status ?? 502,
        Object.fromEntries(['x-ratelimit-limit', 'x-ratelimit-remaining'].flatMap((h) => (upstream?.headers.get(h) ? [[h, upstream.headers.get(h)]] : [])))
    );
}
