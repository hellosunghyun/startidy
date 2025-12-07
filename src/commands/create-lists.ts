import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../utils/config";
import { loadPlan } from "../utils/plan-storage";
import { delay } from "../utils/rate-limiter";
import { createGitHubList, fetchGitHubLists } from "../api";

export const createListsCommand = new Command("create-lists")
  .description("기획된 카테고리로 GitHub Lists 생성")
  .option("--force", "기존 Lists가 있어도 추가 생성")
  .action(async (options) => {
    try {
      const config = loadConfig();

      console.log("\n📁 Lists 생성을 시작합니다.\n");

      // Step 1: 저장된 기획 확인
      const plan = loadPlan();
      if (!plan) {
        console.log("❌ 저장된 기획이 없습니다.");
        console.log("   먼저 'plan' 명령어로 카테고리를 기획하세요.");
        return;
      }

      console.log(`📋 ${plan.categories.length}개 카테고리 기획 로드됨`);
      console.log(`   생성 시간: ${new Date(plan.createdAt).toLocaleString("ko-KR")}`);

      // Step 2: 기존 Lists 확인
      if (!options.force) {
        const spinner = ora("기존 Lists 확인 중...").start();
        const existing = await fetchGitHubLists(config.githubUsername, config.githubToken);
        spinner.stop();

        if (existing.totalLists > 0) {
          console.log(`\n⚠️ 기존 ${existing.totalLists}개의 Lists가 있습니다.`);
          console.log("   --force 옵션으로 추가 생성하거나,");
          console.log("   'lists --delete-all' 로 먼저 삭제하세요.");
          return;
        }
      }

      // Step 3: Lists 생성
      const spinner = ora("Lists 생성 중...").start();
      let created = 0;
      let failed = 0;

      for (const category of plan.categories) {
        try {
          await createGitHubList(
            config.githubToken,
            category.name,
            category.description,
            config.listIsPrivate,
          );

          created++;
          spinner.text = `Lists 생성 중... (${created}/${plan.categories.length})`;

          await delay(config.listCreateDelay);
        } catch (error) {
          failed++;
          console.warn(`\n  ⚠️ "${category.name}" 생성 실패: ${(error as Error).message}`);
        }
      }

      spinner.succeed(`${created}개의 Lists 생성 완료`);

      if (failed > 0) {
        console.log(`  ⚠️ ${failed}개 실패`);
      }

      console.log("\n📌 다음 단계:");
      console.log("  Stars 분류: bun run src/index.ts classify");
    } catch (error) {
      console.error("\n❌ 오류 발생:", (error as Error).message);
      process.exit(1);
    }
  });
