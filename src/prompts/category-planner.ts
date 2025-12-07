import type { RepoSummary } from "../types";
import type { Config } from "../utils/config";

export function buildCategoryPlannerPrompt(
  repos: RepoSummary[],
  config: Config,
): string {
  const repoList = repos
    .map(
      (r) =>
        `- ${r.owner}/${r.name}: ${r.description || "No description"} [${r.language || "Unknown"}] (${r.stars} stars)`,
    )
    .join("\n");

  return `당신은 GitHub Stars를 정리하는 전문가입니다.
아래는 사용자가 Star한 ${repos.length}개의 저장소 목록입니다.

## 저장소 목록:
${repoList}

## 요청사항:
이 저장소들을 효과적으로 분류할 수 있는 **정확히 ${config.maxCategories}개**의 카테고리를 기획해주세요.

## 카테고리 네이밍 규칙 (중요!):
- 형식: "대분류: 소분류" (예: "Lang: Python", "AI: LLM & Chatbot")
- **최대 ${config.listNameMaxLength}자 이내** (공백, 콜론 포함)
- 영어로 작성

## 대분류 예시:
- Lang: 프로그래밍 언어별 (Lang: Python, Lang: JS & TS, Lang: Go, Lang: Rust 등)
- AI: 인공지능 관련 (AI: LLM & Chatbot, AI: Image & Video, AI: Agent 등)
- Web: 웹 개발 (Web: Frontend & UI, Web: Backend & API, Web: Crawler 등)
- Infra: 인프라/데브옵스 (Infra: Docker & Cloud, Infra: Security, Infra: DB 등)
- Type: 유형별 (Type: Self-Hosted, Type: App & Tool, Type: Starter & Lib 등)
- MC: 마인크래프트 (MC: Server Core, MC: Mods & Plugins 등) - 해당되는 경우만
- 기타 필요한 대분류 자유롭게 추가

## 카테고리 기획 원칙:
1. 저장소들이 고르게 분포되도록 설계
2. 각 대분류마다 ETC 카테고리 포함 (예: "Lang: ETC", "AI: ETC")
3. 저장소 특성에 맞게 대분류/소분류 구성

정확히 ${config.maxCategories}개의 카테고리를 생성해주세요. 각 카테고리의 name은 반드시 ${config.listNameMaxLength}자 이내로!`;
}
