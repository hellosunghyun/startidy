# GitHub Stars Arrange

GitHub Stars를 AI(Gemini)를 활용해 자동으로 32개의 Lists로 정리하는 CLI 도구입니다.

## 주요 기능

- **자동 카테고리 기획**: Gemini AI가 Star한 저장소들을 분석해 32개의 카테고리를 자동 생성
- **스마트 분류**: 각 저장소의 제목, 설명, README를 분석해 적합한 카테고리에 자동 배치
- **대분류:소분류 형식**: `Lang: Python`, `AI: LLM & Chatbot` 같은 체계적인 네이밍 (20자 제한)
- **단계별 실행**: 각 단계를 개별 실행하거나 전체 자동 실행 가능
- **배치 처리**: 20개씩 병렬 처리로 빠른 분류

## 카테고리 예시

```
Lang: Python       Lang: JS & TS      Lang: Go           Lang: Rust
Lang: Java         Lang: C & C++      Lang: ETC

AI: LLM & Chatbot  AI: Agent          AI: Image & Video  AI: RAG & Data
AI: Voice & Audio  AI: ETC

Web: Frontend      Web: Backend       Web: Crawler       Web: Mobile App
Web: ETC

Infra: Docker      Infra: Security    Infra: DB          Infra: Data & ML
Infra: ETC

Type: Self-Hosted  Type: App & Tool   Type: Starter      Type: Resource
Type: ETC
```

## 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/github-stars-arrange.git
cd github-stars-arrange

# 의존성 설치 (Bun 필요)
bun install
```

## 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_USERNAME=your-username
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxx
```

### GitHub Token 발급

1. [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens) 접속
2. "Generate new token (classic)" 클릭
3. 권한 선택: `repo`, `read:user`
4. 토큰 생성 후 복사

### Gemini API Key 발급

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. "Create API Key" 클릭
3. API 키 복사

## 사용법

### 전체 자동 실행 (`run` 명령어)

```bash
# 전체 워크플로우 자동 실행 (기획 → 삭제 → 생성 → 분류)
bun run src/index.ts run

# 새로 Star한 것만 처리 (기존 Lists 유지)
bun run src/index.ts run --only-new

# 시뮬레이션 모드 (기획만 확인)
bun run src/index.ts run --dry-run
```

### 단계별 실행

#### 1. 카테고리 기획 (`plan`)

```bash
# Stars 분석 후 카테고리 기획 (파일로 저장됨)
bun run src/index.ts plan

# 저장된 기획 보기
bun run src/index.ts plan --show

# 저장된 기획 삭제
bun run src/index.ts plan --delete
```

#### 2. Lists 관리 (`lists`)

```bash
# Lists 전체 조회
bun run src/index.ts lists

# 새 List 생성
bun run src/index.ts lists --create "Lang: Python" -d "Python 관련 프로젝트"

# 특정 List 삭제
bun run src/index.ts lists --delete "Lang: Python"

# 모든 Lists 삭제
bun run src/index.ts lists --delete-all
```

#### 3. Lists 생성 (`create-lists`)

```bash
# 기획된 카테고리로 Lists 생성
bun run src/index.ts create-lists

# 기존 Lists가 있어도 추가 생성
bun run src/index.ts create-lists --force
```

#### 4. Stars 분류 (`classify`)

```bash
# Stars를 Lists에 분류/추가
bun run src/index.ts classify

# 아직 추가 안된 Stars만 처리
bun run src/index.ts classify --only-new

# 기존 Lists를 카테고리로 사용 (plan 파일 불필요)
bun run src/index.ts classify --use-existing

# 기존 Lists 기준으로 새 Stars만 분류
bun run src/index.ts classify --use-existing --only-new

# 되돌리기: 모든 Stars를 Lists에서 제거
bun run src/index.ts classify --reset
```

### 명령어 옵션 요약

| 명령어 | 옵션 | 설명 |
|--------|------|------|
| `run` | (없음) | 전체 자동 실행 |
| `run` | `--only-new` | 새 Stars만 처리 |
| `run` | `--dry-run` | 시뮬레이션 모드 |
| `plan` | (없음) | 카테고리 기획 |
| `plan` | `--show` | 저장된 기획 보기 |
| `plan` | `--delete` | 저장된 기획 삭제 |
| `lists` | (없음) | 모든 Lists 조회 |
| `lists` | `--create <name>` | 새 List 생성 |
| `lists` | `--delete <name>` | 특정 List 삭제 |
| `lists` | `--delete-all` | 모든 Lists 삭제 |
| `lists` | `-d, --description` | List 설명 (--create와 함께) |
| `create-lists` | (없음) | 기획으로 Lists 생성 |
| `create-lists` | `--force` | 기존 Lists 있어도 생성 |
| `classify` | (없음) | Stars 분류 |
| `classify` | `--only-new` | 미분류 Stars만 처리 |
| `classify` | `--use-existing` | 기존 Lists를 카테고리로 사용 |
| `classify` | `--reset` | 모든 Stars를 Lists에서 제거 |

### 수동 워크플로우 예시

```bash
# 1. 카테고리 기획
bun run src/index.ts plan

# 2. 기획 확인
bun run src/index.ts plan --show

# 3. 기존 Lists 삭제 (필요시)
bun run src/index.ts lists --delete-all

# 4. Lists 생성
bun run src/index.ts create-lists

# 5. Stars 분류
bun run src/index.ts classify
```

## 실행 예시

```
🚀 GitHub Stars 자동 정리를 시작합니다.

✔ 523개의 Starred 저장소를 가져왔습니다.
✔ 32개의 카테고리가 기획되었습니다.

? 기존 32개의 Lists를 삭제하시겠습니까? Yes
✔ 32개의 Lists 삭제 완료
✔ 32개의 Lists 생성 완료

📂 523개 저장소를 20개씩 분류 중...

── 배치 1/27 (1-20) ──
✔ README 조회 완료
✔ 분류 완료
  ✅ facebook/react → Web: Frontend
  ✅ tensorflow/tensorflow → AI: Data & ML
  ...

📊 결과:
  ✅ 성공: 520개
  ❌ 실패: 3개

✅ 완료! Stars가 Lists로 정리되었습니다.
```

## 프로젝트 구조

```
github-stars-arrange/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts              # CLI 진입점
    ├── types.ts              # 타입 정의
    ├── api/
    │   ├── index.ts          # API export
    │   ├── types.ts          # API 타입
    │   ├── lists.ts          # Lists CRUD
    │   ├── repos.ts          # 저장소 조회
    │   └── readme.ts         # README 조회
    ├── commands/
    │   ├── lists.ts          # lists 명령어
    │   ├── plan.ts           # plan 명령어
    │   ├── create-lists.ts   # create-lists 명령어
    │   ├── classify.ts       # classify 명령어
    │   └── run.ts            # run 명령어 (전체 자동)
    ├── services/
    │   └── gemini.ts         # Gemini AI 서비스
    ├── prompts/
    │   ├── category-planner.ts
    │   └── classifier.ts
    └── utils/
        ├── config.ts         # 환경 변수 설정
        ├── rate-limiter.ts   # Rate Limiting
        └── plan-storage.ts   # 기획 저장/로드
```

## 환경 변수 상세

`.env.example` 파일 참고. 주요 설정:

```env
# 필수
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_USERNAME=your-username
GEMINI_API_KEY=AIzaxxxxxxxxxx

# 카테고리 설정
MAX_CATEGORIES=32              # 최대 카테고리 수
MAX_CATEGORIES_PER_REPO=3      # 저장소당 최대 카테고리
MIN_CATEGORIES_PER_REPO=1      # 저장소당 최소 카테고리

# 배치 처리
CLASSIFY_BATCH_SIZE=20         # Gemini 분류 배치 크기
BATCH_DELAY=2000               # 배치 간 딜레이 (ms)

# Gemini 설정
GEMINI_MODEL=gemini-2.5-flash  # 사용할 모델
GEMINI_RPM=15                  # 분당 요청 제한 (Free tier)
```

## 기술 스택

- **Runtime**: [Bun](https://bun.sh/)
- **Language**: TypeScript
- **AI**: Google Gemini (gemini-2.5-flash)
- **CLI**: Commander.js, @inquirer/prompts, ora

## 제한사항

- GitHub Lists는 최대 32개까지 생성 가능
- 각 List 이름은 최대 20자
- Gemini API Free tier: 15 RPM

## 라이선스

MIT
