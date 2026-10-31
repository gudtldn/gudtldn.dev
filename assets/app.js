// GitHub API 호출: 같은 도메인의 Pages Function(/api/github/*)을 먼저 쓰고,
// 없는 환경(로컬 서버 등)에서는 api.github.com을 직접 호출한다.
async function githubFetch(path) {
    try {
        const res = await fetch(`/api/github/${path}`);
        if (res.headers.get('X-GH-Proxy')) return res;
    } catch (e) { /* 중계 불가 시 직접 호출 */ }
    return fetch(`https://api.github.com/${path}`);
}

document.addEventListener('alpine:init', () => {
    Alpine.data('profileApp', () => ({
        data: {
            name: "",
            domain: "",
            status: [],
            location: "",
            timezone: "UTC",
            timezoneAbbr: "",
            blogUrl: "",
            blogFeedUrl: "",
            bio: "",
            socials: [],
            customLinks: [],
            currentlyFocusing: [],
            projects: [],
            techStack: { languages: [], tools: [] },
            infrastructure: [],
            github: { username: "", themeColor: "3b82f6" }
        },
        loaded: false,
        error: false,
        copied: false,
        currentTime: "",
        // START: Military Service State
        militaryInfo: null,
        // END: Military Service State
        // START: GitHub Commits State
        recentCommits: [],
        commitsLoaded: false,
        commitsError: false,
        commitsVisible: [false, false, false],
        // END: GitHub Commits State
        // START: Projects State
        projectsView: [], // 화면에 표시할 프로젝트 (profile.json 값 + GitHub 값을 병합한 결과)
        // END: Projects State
        // featured 프로젝트를 앞으로 (나머지는 원래 순서 유지)
        get sortedProjects() {
            return [...this.projectsView.filter(p => p.featured), ...this.projectsView.filter(p => !p.featured)];
        },
        // 프로젝트가 1개면 카드를 가로로 꽉 채워 표시
        get isSingleProject() {
            return this.projectsView.length === 1;
        },
        // START: Projects Methods (GitHub repo 연동)
        // 우선순위: profile.json 값 > GitHub 값. gh가 없으면(로딩 전/실패) profile.json 값과 기본값만 사용
        mergeProject(p, gh) {
            const repoName = p.repo ? p.repo.split('/')[1] : '';
            let status = p.status;
            let statusActive = true;
            if (!status && gh && gh.pushed_at) {
                status = `${this.relativeTime(gh.pushed_at)} 업데이트`;
                statusActive = Date.now() - new Date(gh.pushed_at).getTime() < 30 * 24 * 60 * 60 * 1000;
            }
            return {
                key: p.repo || p.title,
                title: p.title ?? gh?.name ?? repoName,
                summary: p.summary ?? gh?.description ?? '',
                description: p.description,
                tags: p.tags ?? gh?.topics ?? [],
                image: p.image,
                featured: p.featured,
                links: p.links ?? (p.repo ? [{ type: 'github', url: gh?.html_url || `https://github.com/${p.repo}` }] : []),
                status,
                statusActive
            };
        },
        initProjects() {
            this.projectsView = (this.data.projects || []).map(p => this.mergeProject(p, null));
        },
        async loadProjectRepos() {
            const projects = this.data.projects || [];
            await Promise.all(projects.map(async (p, i) => {
                if (!p.repo) return;
                const gh = await this.fetchRepo(p.repo);
                if (gh) this.projectsView[i] = this.mergeProject(p, gh);
            }));
        },
        async fetchRepo(repo) {
            const CACHE_KEY = `gh_repo_${repo}`;
            const CACHE_TTL = 10 * 60 * 1000; // 10분
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) return data;
                }
            } catch (e) { /* sessionStorage 접근 불가 시 무시 */ }
            try {
                const res = await githubFetch(`repos/${repo}`);
                if (!res.ok) throw new Error(`GitHub API ${res.status}`);
                const j = await res.json();
                const data = { name: j.name, description: j.description, topics: j.topics, html_url: j.html_url, pushed_at: j.pushed_at };
                try {
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
                } catch (e) { /* 저장 실패 시 무시 */ }
                return data;
            } catch (e) {
                console.error(`GitHub repo fetch failed (${repo}):`, e);
                return null; // 실패 시 profile.json 값으로 표시
            }
        },
        // END: Projects Methods

        // START: Blog Posts (Atom/RSS 피드)
        blogPosts: [],
        // 피드(Atom 또는 RSS)를 { title, url, date, summary } 목록으로 변환. 형식이 이상하면 빈 배열
        parseFeed(xmlText, limit = 5) {
            const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
            if (doc.querySelector('parsererror')) return [];
            const text = (el, sel) => (el.querySelector(sel)?.textContent || '').trim();
            // 요약에 섞인 HTML 태그를 제거하고 한 줄로 정리 (DOMParser 문서는 스크립트/리소스를 실행하지 않음)
            const plain = (html) => {
                const body = new DOMParser().parseFromString(html || '', 'text/html').body;
                const t = (body.textContent || '').replace(/\s+/g, ' ').trim();
                return t.length > 120 ? t.slice(0, 120).trimEnd() + '…' : t;
            };
            const entries = [...doc.querySelectorAll('entry')];
            const items = entries.length ? entries : [...doc.querySelectorAll('item')];
            const posts = [];
            for (const el of items) {
                const title = text(el, 'title');
                // Atom: <link rel="alternate" href>, RSS: <link>텍스트</link>
                const linkEl = el.querySelector('link[rel="alternate"]') || el.querySelector('link');
                const url = (linkEl?.getAttribute('href') || linkEl?.textContent || '').trim();
                // http(s) 링크만 허용 (javascript: 등 차단)
                if (!title || !/^https?:\/\//i.test(url)) continue;
                const dateRaw = text(el, 'published') || text(el, 'updated') || text(el, 'pubDate');
                const date = new Date(dateRaw);
                posts.push({
                    title,
                    url,
                    time: isNaN(date) ? 0 : date.getTime(),
                    summary: plain(text(el, 'summary') || text(el, 'description'))
                });
            }
            return posts.sort((a, b) => b.time - a.time).slice(0, limit);
        },
        formatDate(time) {
            if (!time) return '';
            try {
                // en-CA는 YYYY-MM-DD 형식
                return new Intl.DateTimeFormat('en-CA', {
                    timeZone: this.data.timezone || 'Asia/Seoul',
                    year: 'numeric', month: '2-digit', day: '2-digit'
                }).format(new Date(time)).replace(/-/g, '.');
            } catch (e) { return ''; }
        },
        async loadBlogPosts() {
            const feedUrl = this.data.blogFeedUrl;
            if (!feedUrl) return;
            const CACHE_KEY = `blog_feed_${feedUrl}`;
            const CACHE_TTL = 10 * 60 * 1000; // 10분
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) { this.blogPosts = data; return; }
                }
            } catch (e) { /* sessionStorage 접근 불가 시 무시 */ }
            try {
                const res = await fetch(feedUrl);
                if (!res.ok) throw new Error(`Blog feed ${res.status}`);
                const posts = this.parseFeed(await res.text());
                this.blogPosts = posts;
                // 빈 결과는 캐시하지 않음
                if (posts.length > 0) {
                    try {
                        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: posts, timestamp: Date.now() }));
                    } catch (e) { /* 저장 실패 시 무시 */ }
                }
            } catch (e) {
                console.error('Blog feed fetch failed:', e);
                this.blogPosts = []; // 실패 시 섹션 숨김
            }
        },
        // END: Blog Posts
        projectLinkLabel(link) {
            const labels = { github: 'GitHub', demo: 'Demo', blog: 'Blog', video: 'Video' };
            return link.label || labels[link.type] || 'Link';
        },
        async init() {
            try {
                const response = await fetch('./profile.json');
                if (response.ok) {
                    this.data = await response.json();
                    this.updateMeta();
                    this.initProjects(); // START/END: Projects 초기 표시
                    this.loadProjectRepos(); // START/END: GitHub repo 정보 병합
                    this.loadBlogPosts(); // START/END: 블로그 최신 글
                    this.initTime(); // Load time after data is ready
                    this.fetchRecentCommits(); // START/END: GitHub Commits Fetch
                } else {
                    throw new Error("profile.json 로드 실패");
                }
            } catch (e) {
                console.error("데이터를 불러오는 중 문제가 발생했습니다:", e);
                this.error = true;
                document.title = "Error | Profile";
            } finally {
                setTimeout(() => this.loaded = true, 300);
            }
        },
        updateMeta() {
            const title = `${this.data.name} | ${this.data.domain}`;
            const description = this.data.bio.replace(/<[^>]*>?/gm, '').substring(0, 160);

            document.title = title;

            // Update Meta Tags
            const metaMap = {
                'description': description,
                'og:title': title,
                'og:description': description
            };

            Object.entries(metaMap).forEach(([name, content]) => {
                let el = document.querySelector(`meta[name="${name}"]`) || 
                         document.querySelector(`meta[property="${name}"]`);
                if (el) el.setAttribute('content', content);
            });
        },
        async copyDiscord(id) {
            if (!id) return;
            try {
                await navigator.clipboard.writeText(id);
                this.copied = true;
                setTimeout(() => this.copied = false, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
                // Fallback
                const el = document.createElement('textarea');
                el.value = id;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                this.copied = true;
                setTimeout(() => this.copied = false, 2000);
            }
        },

        // START: GitHub Commits Methods
        async fetchRecentCommits() {
            const username = this.data.github.username;
            if (!username) return;
            const CACHE_KEY = `gh_commits_${username}`;
            const CACHE_TTL = 5 * 60 * 1000; // 5분
            // 캐시 확인
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) {
                        this.recentCommits = data;
                        this.commitsLoaded = true;
                        if (data.length > 0) this._startCascadingDrop();
                        return;
                    }
                }
            } catch (e) { /* sessionStorage 접근 불가 시 무시 */ }
            // API 호출: Events → head SHA → Commits API 병렬 호출로 메시지 취득
            try {
                const res = await githubFetch(`users/${username}/events/public`);
                if (!res.ok) throw new Error(`GitHub API ${res.status}`);
                const events = await res.json();
                // PushEvent만 최대 3개 추출 (head SHA + repo + date 보존)
                const pushCandidates = [];
                for (const event of events) {
                    if (pushCandidates.length >= 3) break;
                    if (event.type !== 'PushEvent') continue;
                    if (!event.payload.head) continue;
                    pushCandidates.push({
                        sha: event.payload.head,
                        repo: event.repo.name,
                        date: event.created_at,
                        ref: event.payload.ref || ''
                    });
                }
                // 각 PushEvent의 head SHA로 커밋 메시지 병렬 취득
                const commitDetails = await Promise.all(
                    pushCandidates.map(async (p) => {
                        try {
                            const r = await githubFetch(`repos/${p.repo}/commits/${p.sha}`);
                            if (!r.ok) return null;
                            const data = await r.json();
                            const message = (data.commit?.message || '').split('\n')[0];
                            return {
                                sha: p.sha.substring(0, 7),
                                message: message || p.ref.replace('refs/heads/', ''),
                                repo: p.repo,
                                url: `https://github.com/${p.repo}/commit/${p.sha}`,
                                date: p.date
                            };
                        } catch (e) { return null; }
                    })
                );
                const commits = commitDetails.filter(Boolean);
                this.recentCommits = commits;
                // 빈 결과는 캐시하지 않음 (일시적 오류/빈 피드 구분)
                if (commits.length > 0) {
                    try {
                        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: commits, timestamp: Date.now() }));
                    } catch (e) { /* 저장 실패 시 무시 */ }
                }
            } catch (e) {
                console.error('GitHub commits fetch failed:', e);
                this.commitsError = true;
            } finally {
                this.commitsLoaded = true;
                if (this.recentCommits.length > 0) this._startCascadingDrop();
            }
        },
        _startCascadingDrop() {
            this.commitsVisible = [false, false, false];
            setTimeout(() => { this.commitsVisible = [true, false, false]; }, 0);
            setTimeout(() => { this.commitsVisible = [true, true, false]; }, 120);
            setTimeout(() => { this.commitsVisible = [true, true, true]; }, 240);
        },
        commitCardStyle(index) {
            const opacities = [1, 0.65, 0.38];
            const delays = [0, 120, 240];
            const visible = this.commitsVisible[index] || false;
            return {
                opacity: visible ? (opacities[index] ?? 1) : 0,
                transform: `translateY(${visible ? 0 : -20}px)`,
                transition: `opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${delays[index]}ms, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${delays[index]}ms`,
                marginLeft: `${index * 20}px`,
                maxWidth: `calc(100% - ${index * 20}px)`
            };
        },
        relativeTime(dateStr) {
            if (!dateStr) return '';
            const diff = Date.now() - new Date(dateStr).getTime();
            const m = Math.floor(diff / 60000);
            const h = Math.floor(diff / 3600000);
            const d = Math.floor(diff / 86400000);
            if (m < 1) return '방금 전';
            if (m < 60) return `${m}분 전`;
            if (h < 24) return `${h}시간 전`;
            if (d < 30) return `${d}일 전`;
            return `${Math.floor(d / 30)}달 전`;
        },
        // END: GitHub Commits Methods

        // START: Military Service Logic
        updateMilitaryInfo() {
            const now = new Date();
            // Enlistment: June 8, 2026 (Month index 5 in JS)
            const enlist = new Date(2026, 5, 8);
            // Discharge: Dec 7, 2027 (Month index 11 in JS)
            const discharge = new Date(2027, 11, 7);

            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const totalMs = discharge - enlist;
            const servedMs = now - enlist;
            const circ = 251.327; // Circle circumference for radial progress

            if (now < enlist) {
                const diffTime = enlist - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                this.militaryInfo = {
                    state: 'pre',
                    badgeText: `입대 D-${diffDays}`,
                    cardTitle: '군 입대 대기 중',
                    dday: `D-${diffDays}`,
                    percent: "0.000000",
                    dashoffset: circ,
                    asciiBar: '░'.repeat(20),
                    daysLeft: diffDays,
                    totalDays: Math.ceil(totalMs / (1000 * 60 * 60 * 24)),
                    color: '#f59e0b' // Solid vibrant Amber
                };
            } else if (now >= enlist && now < discharge) {
                const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
                const diffTime = discharge - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const percentVal = Math.min(100, Math.max(0, (servedMs / totalMs) * 100));

                const barLength = 20;
                const filledLength = Math.min(barLength, Math.max(0, Math.round((percentVal / 100) * barLength)));
                const asciiBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

                // Linear interpolation from Amber (245, 158, 11) to Emerald (16, 185, 129)
                const p = percentVal / 100;
                const r = Math.round(245 + (16 - 245) * p);
                const g = Math.round(158 + (185 - 158) * p);
                const b = Math.round(11 + (129 - 11) * p);
                const currentColor = `rgb(${r}, ${g}, ${b})`;

                this.militaryInfo = {
                    state: 'serving',
                    badgeText: `군 복무 중 (D-${diffDays})`,
                    cardTitle: '군 복무 현황',
                    dday: `D-${diffDays}`,
                    percent: percentVal.toFixed(7),
                    dashoffset: (circ - (percentVal / 100) * circ).toFixed(3),
                    asciiBar: asciiBar,
                    daysLeft: diffDays,
                    totalDays: totalDays,
                    color: currentColor
                };
            } else if (now >= discharge && now < new Date(discharge.getTime() + 30 * 24 * 60 * 60 * 1000)) {
                // After discharge, show completion state during a 30-day grace period
                const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
                this.militaryInfo = {
                    state: 'post',
                    badgeText: '전역 완료 🎉',
                    cardTitle: '군 복무 완료',
                    dday: '전역! 🎉',
                    percent: "100.000000",
                    dashoffset: 0,
                    asciiBar: '',
                    daysLeft: 0,
                    totalDays: totalDays,
                    color: '#10b981' // Solid Emerald Green
                };
            } else {
                this.militaryInfo = null; // Hide everything automatically after the 30-day grace period
            }
        },
        // END: Military Service Logic

        initTime() {
            const update = () => {
                const now = new Date();
                try {
                    const timeString = new Intl.DateTimeFormat('en-US', {
                        timeZone: this.data.timezone || 'Asia/Seoul',
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }).format(now);
                    this.currentTime = `${timeString} ${this.data.timezoneAbbr || ''}`;
                } catch (e) {
                    this.currentTime = now.toLocaleTimeString();
                }
                // START: Military Service Update Call
                this.updateMilitaryInfo();
                // END: Military Service Update Call
            };
            update();
            setInterval(update, 100);
        }
    }));
});
