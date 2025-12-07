import type { Category, RepoDetail } from "../types";
import type { Config } from "../utils/config";

export interface BatchRepoInfo {
  id: string; // "owner/name" 형식
  description: string | null;
  language: string | null;
  stars: number;
  readme: string | null;
}

/**
 * 여러 저장소를 한번에 분류하는 배치 프롬프트
 */
export function buildBatchClassifierPrompt(
  repos: BatchRepoInfo[],
  categories: Category[],
  config: Config,
): string {
  const categoryList = categories
    .map((c) => `- ${c.name}: ${c.description}`)
    .join("\n");

  const repoList = repos
    .map((repo, i) => {
      const readmeSnippet = repo.readme
        ? repo.readme.slice(0, config.readmeMaxLength).replace(/\n/g, " ").trim()
        : "";
      return `${i + 1}. ${repo.id}
   설명: ${repo.description || "없음"}
   언어: ${repo.language || "없음"} | Stars: ${repo.stars}
   README: ${readmeSnippet || "없음"}`;
    })
    .join("\n\n");

  const minCats = config.minCategoriesPerRepo;
  const maxCats = config.maxCategoriesPerRepo;

  return `아래 ${repos.length}개의 GitHub 저장소들을 분석하고, 각각 가장 적합한 카테고리를 선택해주세요.

## 사용 가능한 카테고리 (${categories.length}개):
${categoryList}

## 저장소 목록:
${repoList}

## 요청사항:
- 각 저장소마다 **반드시 ${minCats}개 이상, 최대 ${maxCats}개**의 카테고리를 선택하세요
- 가능하면 ${maxCats}개를 선택하세요 (다양한 관점에서 분류)
- 카테고리 이름은 정확히 위 목록에 있는 이름만 사용

${repos.length}개 모두 빠짐없이 분류해주세요.`;
}

/**
 * 단일 저장소 분류 프롬프트 (폴백용)
 */
export function buildClassifierPrompt(
  repo: RepoDetail,
  categories: Category[],
  config: Config,
): string {
  const categoryList = categories
    .map(
      (c, i) =>
        `${i + 1}. ${c.name}: ${c.description} (키워드: ${c.keywords.join(", ")})`,
    )
    .join("\n");

  const readmeSnippet = repo.readme
    ? repo.readme.slice(0, config.readmeMaxLengthSingle) +
      (repo.readme.length > config.readmeMaxLengthSingle ? "..." : "")
    : "README 없음";

  return `아래 GitHub 저장소를 분석하고, 가장 적합한 카테고리를 선택해주세요.

## 저장소 정보:
- 이름: ${repo.owner}/${repo.name}
- 설명: ${repo.description || "없음"}
- 주요 언어: ${repo.language || "없음"}
- Stars: ${repo.stars}

## README (일부):
${readmeSnippet}

## 사용 가능한 카테고리 (${categories.length}개):
${categoryList}

## 요청사항:
1. 이 저장소에 가장 적합한 카테고리를 **${config.minCategoriesPerRepo}~${config.maxCategoriesPerRepo}개** 선택하세요
2. 카테고리 이름은 정확히 위 목록에 있는 이름으로 선택하세요`;
}
