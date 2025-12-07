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

  return `You are an expert at organizing GitHub Stars.
Below is a list of ${repos.length} starred repositories.

## Repository List:
${repoList}

## Requirements:
Plan **exactly ${config.maxCategories}** categories to effectively classify these repositories.

## Category Naming Rules (Important!):
- Format: "Major: Minor" (e.g., "Lang: Python", "AI: LLM & Chatbot")
- **Maximum ${config.listNameMaxLength} characters** (including spaces and colon)
- Write in English

## Major Category Examples:
- Lang: By programming language (Lang: Python, Lang: JS & TS, Lang: Go, Lang: Rust, etc.)
- AI: Artificial intelligence (AI: LLM & Chatbot, AI: Image & Video, AI: Agent, etc.)
- Web: Web development (Web: Frontend & UI, Web: Backend & API, Web: Crawler, etc.)
- Infra: Infrastructure/DevOps (Infra: Docker & Cloud, Infra: Security, Infra: DB, etc.)
- Type: By type (Type: Self-Hosted, Type: App & Tool, Type: Starter & Lib, etc.)
- MC: Minecraft (MC: Server Core, MC: Mods & Plugins, etc.) - only if applicable
- Feel free to add other major categories as needed

## Category Planning Principles:
1. Design for even distribution of repositories
2. Include an ETC category for each major category (e.g., "Lang: ETC", "AI: ETC")
3. Structure major/minor categories based on repository characteristics

Generate exactly ${config.maxCategories} categories. Each category name must be within ${config.listNameMaxLength} characters!`;
}
