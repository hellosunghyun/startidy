import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../utils/config";
import { GeminiService } from "../services/gemini";
import { savePlan, loadPlan, deletePlan } from "../utils/plan-storage";
import { fetchAllMyStarredRepos } from "../api";
import type { RepoSummary } from "../types";

export const planCommand = new Command("plan")
  .description("카테고리 기획 (Stars 분석 후 카테고리 생성)")
  .option("--show", "저장된 기획 보기")
  .option("--delete", "저장된 기획 삭제")
  .action(async (options) => {
    try {
      // --show: 저장된 기획 보기
      if (options.show) {
        const plan = loadPlan();
        if (!plan) {
          console.log("\n저장된 기획이 없습니다. 'plan' 명령어로 먼저 기획하세요.");
          return;
        }
        displayPlan(plan.categories, plan.repoCount, plan.createdAt);
        return;
      }

      // --delete: 저장된 기획 삭제
      if (options.delete) {
        if (deletePlan()) {
          console.log("\n✅ 저장된 기획이 삭제되었습니다.");
        } else {
          console.log("\n저장된 기획이 없습니다.");
        }
        return;
      }

      // 기본: 새로운 기획 생성
      const config = loadConfig();
      const gemini = new GeminiService(config);

      console.log("\n🎯 카테고리 기획을 시작합니다.\n");

      // Step 1: Starred repos 가져오기
      const spinner = ora("Starred 저장소 가져오는 중...").start();
      const result = await fetchAllMyStarredRepos(
        config.githubToken,
        config.githubUsername,
        (count) => {
          spinner.text = `Starred 저장소 가져오는 중... (${count}개)`;
        },
      );

      if (result.status !== 200 || !result.repos) {
        spinner.fail("Starred 저장소 조회 실패");
        throw new Error(`Failed to fetch starred repos: status ${result.status}`);
      }

      const repos = result.repos;
      spinner.succeed(`${repos.length}개의 Starred 저장소를 가져왔습니다.`);

      // Step 2: AI 카테고리 기획
      const planSpinner = ora(`AI가 ${config.maxCategories}개 카테고리를 기획하는 중...`).start();

      const repoSummaries: RepoSummary[] = repos.map((r) => ({
        owner: r.owner.login,
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
      }));

      const categories = await gemini.planCategories(repoSummaries);
      planSpinner.succeed(`${categories.length}개의 카테고리가 기획되었습니다.`);

      // Step 3: 기획 저장
      savePlan(categories, repos.length);
      console.log("\n💾 기획이 저장되었습니다. (.github-stars-plan.json)");

      // Step 4: 결과 표시
      displayPlan(categories, repos.length, new Date().toISOString());

      console.log("\n📌 다음 단계:");
      console.log("  1. 기존 Lists 삭제: bun run src/index.ts lists --delete-all");
      console.log("  2. Lists 생성: bun run src/index.ts create-lists");
      console.log("  3. Stars 분류: bun run src/index.ts classify");
      console.log("\n  또는 전체 자동 실행: bun run src/index.ts run");
    } catch (error) {
      console.error("\n❌ 오류 발생:", (error as Error).message);
      process.exit(1);
    }
  });

function displayPlan(
  categories: { name: string; description: string }[],
  repoCount: number,
  createdAt: string,
) {
  console.log("\n📋 기획된 카테고리:\n");
  console.log("─".repeat(60));

  categories.forEach((c, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${c.name}`);
    if (c.description) {
      console.log(`    ${c.description}`);
    }
  });

  console.log("─".repeat(60));
  console.log(`\n📊 요약:`);
  console.log(`  - 카테고리: ${categories.length}개`);
  console.log(`  - 대상 저장소: ${repoCount}개`);
  console.log(`  - 생성 시간: ${new Date(createdAt).toLocaleString("ko-KR")}`);
}
