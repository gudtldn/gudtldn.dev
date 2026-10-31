# gudtldn.dev

개인 소개 페이지 겸 포트폴리오 ([gudtldn.dev](https://gudtldn.dev)).
빌드 과정 없는 정적 사이트이며, 화면 내용은 전부 `profile.json` 한 파일에서 읽어옵니다.

## 구조

```
.
├─ index.html          # 화면 마크업 + meta/OG 태그 (Alpine.js 템플릿)
├─ assets/
│  ├─ app.js           # Alpine 컴포넌트 (데이터 로드, GitHub 커밋 피드, 시계 등)
│  └─ style.css        # 커스텀 스타일 (유리 효과, 스켈레톤 애니메이션 등)
├─ profile.json        # 사이트에 표시되는 모든 데이터
├─ profile-schema.json # profile.json의 JSON Schema (에디터 자동완성/검증용)
├─ favicons/           # 파비콘, 웹 매니페스트
└─ projects/           # (선택) 프로젝트 썸네일 이미지
```

- 스타일링은 Tailwind CSS **Play CDN**, 반응형 동작은 Alpine.js(CDN)를 사용합니다.
- 아이콘/통계는 외부 서비스를 씁니다: skillicons.dev, github-readme-stats, ghchart, GitHub API.
  이 서비스들이 내려가면 해당 이미지/카드가 비어 보일 수 있습니다.

## 로컬에서 확인

`profile.json`을 `fetch`로 읽기 때문에 `file://`로 열면 동작하지 않습니다. 간단한 서버로 띄우세요.

```sh
python3 -m http.server 8000
# http://localhost:8000
```

## 내용 수정

대부분은 `profile.json`만 고치면 됩니다. 파일 첫 줄의 `$schema` 덕분에 VS Code 등에서 자동완성과 오타 검사가 됩니다.

### 프로젝트 추가

`projects` 배열에 항목을 추가합니다. **GitHub 저장소가 있으면 `repo` 한 줄이면 됩니다.**

```json
{ "repo": "gudtldn/SimpleEngine", "image": "projects/simpleengine.webp", "featured": true }
```

`repo`를 지정하면 아래 값을 GitHub에서 자동으로 가져옵니다. **`profile.json`에 적은 값이 항상 우선**하므로, 바꾸고 싶은 항목만 덮어쓰면 됩니다.

| 항목 | 기본값 (GitHub에서) | 덮어쓰기 |
|---|---|---|
| `title` | 저장소 이름 | `"title": "..."` |
| `summary` | 저장소 description | `"summary": "..."` |
| `tags` | 저장소 topics (소문자·하이픈 형식) | `"tags": ["C++23", ...]` |
| `status` | 마지막 push 시점 ("3일 전 업데이트", 30일 지나면 흐리게) | `"status": "실험"` |
| `links` | 저장소 링크 | `"links": [...]` |

> **문구는 GitHub 저장소의 description/README에서 관리하는 것을 권장합니다.** 사이트와 저장소에 같은 설명을 두 번 적지 않아도 됩니다.
> 썸네일(`image`)은 GitHub에서 가져올 수 없으므로 직접 지정합니다.
> `description`(2~3줄 상세 설명)은 GitHub에 대응하는 값이 없어서 **직접 적을 때만 표시되는 수동 전용 필드**입니다. 생략해도 됩니다.

저장소가 없는 항목(실험, 외부 프로젝트 등)은 `title`과 `summary`를 직접 적습니다. 나머지 선택 필드:

```json
{
  "title": "프로젝트 이름",
  "summary": "한 줄 요약",
  "description": "2~3줄 상세 설명",
  "tags": ["C++", "DirectX 12"],
  "image": "projects/foo.png",
  "status": "진행 중",
  "featured": true,
  "links": [
    { "type": "demo", "url": "https://..." },
    { "type": "other", "label": "발표 자료", "url": "https://..." }
  ]
}
```

- `featured: true`인 항목이 먼저 표시됩니다.
- `image`가 없으면 그라데이션 블록이 대신 표시됩니다. 이미지는 `projects/` 폴더에 두고 경로로 지정하거나, 외부 CDN(R2 등)의 절대 URL을 그대로 넣어도 됩니다.
  - 썸네일은 **가로 1280px 안팎의 WebP/PNG** 권장 (원본 스크린샷은 용량이 크니 줄여서 올리세요). 16:9로 잘려 표시됩니다.
  - 이미지 위에는 하단 페이드, 옅은 파란 틴트, 얇은 테두리가 자동으로 겹쳐집니다.
- `links[].type`은 `github` / `demo` / `blog` / `video` / `other`. `label`을 생략하면 type에 맞는 기본 라벨이 붙습니다.
- 프로젝트가 **1개**일 때는 카드가 가로로 꽉 찬 가로형(이미지 왼쪽, 텍스트 오른쪽)으로, **2개 이상**이면 2열 그리드로 표시됩니다.
- `projects`가 비어 있거나 없으면 섹션 전체가 숨겨집니다.

**동작 참고**
- GitHub API(`/repos/{owner}/{name}`)를 방문자 브라우저에서 호출하며, 결과는 10분간 `sessionStorage`에 캐시합니다. 비로그인 호출은 IP당 시간당 60회 제한이 있어서(커밋 피드와 공유), 실패하면 `profile.json`에 적힌 값만으로 표시됩니다.
- 로딩 중에는 `profile.json` 값이 먼저 보이고, GitHub 응답이 오면 갱신됩니다.

### 그 외 섹션

| 키 | 설명 |
|---|---|
| `name`, `domain`, `bio`, `status`, `location` | 상단 소개. `bio`는 HTML 허용 |
| `socials`, `blogUrl`, `customLinks` | 링크 모음 |
| `blogFeedUrl` | 블로그 Atom/RSS 피드 주소. 지정하면 "Latest Posts" 섹션에 최신 글 5개 표시 (아래 참고) |
| `currentlyFocusing` | 요즘 공부하는 것 |
| `techStack` | `logo`는 [skillicons.dev](https://skillicons.dev) 아이콘 ID |
| `infrastructure` | 사용 중인 인프라 카드 |
| `github` | 사용자명과 통계 카드 색상 |

### 블로그 최신 글

`blogFeedUrl`을 지정하면 방문자 브라우저가 피드를 직접 가져와 최신 글 5개(제목, 날짜, 한 줄 요약)를 표시합니다.

- Atom(Jekyll `jekyll-feed` 기본)과 RSS를 모두 지원합니다. 요약은 피드에 `<summary>`/`<description>`이 있을 때만 표시합니다.
- 블로그 서버가 **CORS를 허용해야** 동작합니다. GitHub Pages는 기본으로 허용합니다. 허용하지 않는 곳이면 섹션이 숨겨집니다 (Pages Function 등으로 중계 필요).
- 가져오기에 실패하거나 피드가 비어 있으면 섹션 전체가 숨겨지고, 결과는 10분간 `sessionStorage`에 캐시됩니다.
- `http(s)` 링크만 표시하며, 제목/요약은 텍스트로만 출력합니다 (HTML 실행 없음).

## GitHub API 중계 (Pages Function)

프로젝트 카드와 최근 커밋은 GitHub API를 씁니다. 방문자 브라우저가 직접 부르면 IP당 시간당 60회 제한에 걸리므로,
`functions/api/github/[[path]].js`가 `/api/github/*`로 중계하면서 엣지에 캐시합니다.

- 허용한 경로(저장소 정보, 커밋 상세, 사용자 공개 이벤트)만 중계합니다.
- 캐시 시간: 저장소 정보 5분, 활동 이벤트 1분, 커밋 상세는 SHA로 조회하므로 영구.
  시간이 지나면 ETag로 재검증하며, 바뀐 게 없으면(304) GitHub 호출 한도를 쓰지 않습니다.
- GitHub이 실패하면 만료된 캐시라도 있으면 그것을 돌려줍니다.
- **토큰(선택)**: Cloudflare Pages → Settings → Variables and Secrets에 `GITHUB_TOKEN`을 **Secret**으로 추가하면 시간당 5,000회로 늘어납니다.
  공개 데이터만 읽으므로 권한 없는 fine-grained 토큰이면 충분합니다. 없어도 동작합니다.
- 로컬(`python3 -m http.server`)에는 Function이 없으므로 `api.github.com`을 직접 호출합니다. Function까지 확인하려면 `npx wrangler pages dev .`를 사용하세요.
- Cache API는 `*.pages.dev` 주소에서는 저장되지 않을 수 있어, 캐시 효과는 커스텀 도메인(gudtldn.dev)에서 확인됩니다. 응답 헤더 `X-Cache`(HIT/MISS/REVALIDATED/STALE)로 볼 수 있습니다.

## ⚠️ 함께 고쳐야 하는 곳

링크 미리보기(Discord, 카카오톡 등)는 JS를 실행하지 않는 크롤러가 읽기 때문에, **`index.html`의 `<title>`, `description`, `og:title`, `og:description`이 정적으로 들어 있습니다.**
`profile.json`의 `name`, `domain`, `bio`를 바꾸면 이 값들도 같이 바꿔야 합니다. (페이지 로드 후에는 JS가 `profile.json` 기준으로 덮어씁니다.)

## 임시 코드

`index.html`과 `assets/app.js`의 `START: Military ...` ~ `END: Military ...` 주석 구간은 군 복무 현황 표시용 임시 코드입니다. 필요 없어지면 해당 구간을 통째로 삭제하면 됩니다.

## 배포

Cloudflare Pages로 배포합니다. 빌드가 필요 없는 구조라 저장소 루트의 파일이 그대로 서비스됩니다.
(빌드 명령/출력 디렉터리 등 실제 설정은 Cloudflare 대시보드에서 확인하세요.)
