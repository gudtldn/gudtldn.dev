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

`projects` 배열에 항목을 추가합니다. 필수는 `title`, `summary`뿐이고 나머지는 선택입니다.

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
    { "type": "github", "url": "https://github.com/..." },
    { "type": "demo", "url": "https://..." },
    { "type": "other", "label": "발표 자료", "url": "https://..." }
  ]
}
```

- `featured: true`인 항목이 먼저 표시됩니다.
- `image`가 없으면 그라데이션 블록이 대신 표시됩니다. 이미지는 `projects/` 폴더에 두고 경로로 지정하거나, 외부 CDN(R2 등)의 절대 URL을 그대로 넣어도 됩니다.
  - 썸네일은 **가로 1280px 안팎의 WebP/PNG** 권장 (원본 스크린샷은 용량이 크니 줄여서 올리세요). 16:9로 잘려 표시됩니다.
  - 이미지 위에는 하단 페이드, 옅은 파란 틴트, 얇은 테두리가 자동으로 겹쳐집니다.
- 프로젝트가 **1개**일 때는 카드가 가로로 꽉 찬 가로형(이미지 왼쪽, 텍스트 오른쪽)으로, **2개 이상**이면 2열 그리드로 표시됩니다.
- `links[].type`은 `github` / `demo` / `blog` / `video` / `other`. `label`을 생략하면 type에 맞는 기본 라벨이 붙습니다.
- `projects`가 비어 있거나 없으면 섹션 전체가 숨겨집니다.

### 그 외 섹션

| 키 | 설명 |
|---|---|
| `name`, `domain`, `bio`, `status`, `location` | 상단 소개. `bio`는 HTML 허용 |
| `socials`, `blogUrl`, `customLinks` | 링크 모음 |
| `currentlyFocusing` | 요즘 공부하는 것 |
| `techStack` | `logo`는 [skillicons.dev](https://skillicons.dev) 아이콘 ID |
| `infrastructure` | 사용 중인 인프라 카드 |
| `github` | 사용자명과 통계 카드 색상 |

## ⚠️ 함께 고쳐야 하는 곳

링크 미리보기(Discord, 카카오톡 등)는 JS를 실행하지 않는 크롤러가 읽기 때문에, **`index.html`의 `<title>`, `description`, `og:title`, `og:description`이 정적으로 들어 있습니다.**
`profile.json`의 `name`, `domain`, `bio`를 바꾸면 이 값들도 같이 바꿔야 합니다. (페이지 로드 후에는 JS가 `profile.json` 기준으로 덮어씁니다.)

## 임시 코드

`index.html`과 `assets/app.js`의 `START: Military ...` ~ `END: Military ...` 주석 구간은 군 복무 현황 표시용 임시 코드입니다. 필요 없어지면 해당 구간을 통째로 삭제하면 됩니다.

## 배포

Cloudflare Pages로 배포합니다. 빌드가 필요 없는 구조라 저장소 루트의 파일이 그대로 서비스됩니다.
(빌드 명령/출력 디렉터리 등 실제 설정은 Cloudflare 대시보드에서 확인하세요.)
