import type { Category, RepoDetail } from "../types";
import type { Config } from "../utils/config";

export interface BatchRepoInfo {
  id: string; // "owner/name" format
  description: string | null;
  language: string | null;
  stars: number;
  readme: string | null;
}

/**
 * Batch prompt for classifying multiple repositories at once
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
   Description: ${repo.description || "None"}
   Language: ${repo.language || "None"} | Stars: ${repo.stars}
   README: ${readmeSnippet || "None"}`;
    })
    .join("\n\n");

  const minCats = config.minCategoriesPerRepo;
  const maxCats = config.maxCategoriesPerRepo;

  return `Analyze the following ${repos.length} GitHub repositories and select the most appropriate categories for each.

## Available Categories (${categories.length}):
${categoryList}

## Repository List:
${repoList}

## Requirements:
- Select **at least ${minCats}, maximum ${maxCats}** categories for each repository
- Prefer selecting ${maxCats} categories when possible (classify from multiple perspectives)
- Use exact category names from the list above only

Classify all ${repos.length} repositories without exception.`;
}

/**
 * Single repository classification prompt (fallback)
 */
export function buildClassifierPrompt(
  repo: RepoDetail,
  categories: Category[],
  config: Config,
): string {
  const categoryList = categories
    .map(
      (c, i) =>
        `${i + 1}. ${c.name}: ${c.description} (keywords: ${c.keywords.join(", ")})`,
    )
    .join("\n");

  const readmeSnippet = repo.readme
    ? repo.readme.slice(0, config.readmeMaxLengthSingle) +
      (repo.readme.length > config.readmeMaxLengthSingle ? "..." : "")
    : "No README";

  return `Analyze the following GitHub repository and select the most appropriate categories.

## Repository Information:
- Name: ${repo.owner}/${repo.name}
- Description: ${repo.description || "None"}
- Primary Language: ${repo.language || "None"}
- Stars: ${repo.stars}

## README (excerpt):
${readmeSnippet}

## Available Categories (${categories.length}):
${categoryList}

## Requirements:
1. Select **${config.minCategoriesPerRepo}-${config.maxCategoriesPerRepo}** most appropriate categories for this repository
2. Use exact category names from the list above`;
}
