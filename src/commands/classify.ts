import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "../utils/config";
import { loadPlan } from "../utils/plan-storage";
import { delay } from "../utils/rate-limiter";
import { GeminiService } from "../services/gemini";
import type { Category, CreatedList } from "../types";
import type { BatchRepoInfo } from "../prompts/classifier";
import {
  fetchAllMyStarredRepos,
  fetchGitHubLists,
  fetchRepositoryReadme,
  getRepositoryNodeId,
  addRepoToGitHubLists,
  removeRepoFromAllLists,
  type Repo,
} from "../api";

export const classifyCommand = new Command("classify")
  .description("Stars를 분류하여 Lists에 추가")
  .option("--only-new", "아직 Lists에 추가되지 않은 Stars만 처리")
  .option("--use-existing", "기존 Lists를 카테고리로 사용 (plan 파일 불필요)")
  .option("--reset", "모든 Stars를 Lists에서 제거 (되돌리기)")
  .action(async (options) => {
    try {
      const config = loadConfig();

      // --reset: Stars를 Lists에서 제거
      if (options.reset) {
        await handleReset(config);
        return;
      }

      const gemini = new GeminiService(config);

      console.log("\n📂 Stars 분류를 시작합니다.\n");

      // Step 1: 기존 Lists 확인 및 매핑
      const spinner = ora("기존 Lists 확인 중...").start();
      const listsData = await fetchGitHubLists(config.githubUsername, config.githubToken);

      if (listsData.totalLists === 0) {
        spinner.fail("Lists가 없습니다.");
        console.log("   먼저 'create-lists' 명령어로 Lists를 생성하세요.");
        return;
      }

      const createdLists = new Map<string, CreatedList>();
      const addedRepoNames = new Set<string>();

      for (const list of listsData.lists) {
        createdLists.set(list.name, {
          id: list.id,
          name: list.name,
          description: list.description,
        });

        for (const repo of list.repositories) {
          addedRepoNames.add(`${repo.owner}/${repo.name}`);
        }
      }

      spinner.succeed(`${createdLists.size}개의 Lists 확인됨`);

      // Step 2: 카테고리 결정 (--use-existing 또는 plan 파일)
      let categories: Category[];

      if (options.useExisting) {
        // 기존 Lists를 카테고리로 사용
        categories = listsData.lists.map((list) => ({
          name: list.name,
          description: list.description || "",
          keywords: [],
        }));
        console.log(`📋 기존 ${categories.length}개 Lists를 카테고리로 사용`);
      } else {
        // plan 파일에서 카테고리 로드
        const plan = loadPlan();
        if (!plan) {
          console.log("❌ 저장된 기획이 없습니다.");
          console.log("   'plan' 명령어로 기획하거나, --use-existing 옵션을 사용하세요.");
          return;
        }
        categories = plan.categories;
        console.log(`📋 ${categories.length}개 카테고리 기획 로드됨`);
      }

      // Step 3: Starred repos 가져오기
      const repoSpinner = ora("Starred 저장소 가져오는 중...").start();
      const result = await fetchAllMyStarredRepos(
        config.githubToken,
        config.githubUsername,
        (count) => {
          repoSpinner.text = `Starred 저장소 가져오는 중... (${count}개)`;
        },
      );

      if (result.status !== 200 || !result.repos) {
        repoSpinner.fail("Starred 저장소 조회 실패");
        throw new Error(`Failed to fetch starred repos: status ${result.status}`);
      }

      let repos = result.repos;
      repoSpinner.succeed(`${repos.length}개의 Starred 저장소를 가져왔습니다.`);

      // Step 4: --only-new 필터링
      if (options.onlyNew) {
        const beforeCount = repos.length;
        repos = repos.filter(
          (repo) => !addedRepoNames.has(`${repo.owner.login}/${repo.name}`),
        );
        const skipped = beforeCount - repos.length;
        console.log(`  → ${skipped}개 이미 추가됨, ${repos.length}개 처리 예정`);
      }

      if (repos.length === 0) {
        console.log("\n✅ 처리할 Stars가 없습니다.");
        return;
      }

      // Step 5: 배치 분류 및 추가
      await classifyAndAddRepos(config, gemini, repos, categories, createdLists);

      console.log("\n✅ 분류 완료!");
    } catch (error) {
      console.error("\n❌ 오류 발생:", (error as Error).message);
      process.exit(1);
    }
  });

async function classifyAndAddRepos(
  config: ReturnType<typeof loadConfig>,
  gemini: GeminiService,
  repos: Repo[],
  categories: Category[],
  createdLists: Map<string, CreatedList>,
) {
  const batchSize = config.classifyBatchSize;
  const totalBatches = Math.ceil(repos.length / batchSize);

  console.log(`\n📂 ${repos.length}개 저장소를 ${batchSize}개씩 분류 중...\n`);

  let success = 0;
  let failed = 0;

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, repos.length);
    const batchRepos = repos.slice(batchStart, batchEnd);

    console.log(`── 배치 ${batchIdx + 1}/${totalBatches} (${batchStart + 1}-${batchEnd}) ──`);

    // README 조회
    const spinner = ora(`README 조회 중... (0/${batchRepos.length})`).start();
    let readmeCount = 0;
    const batchRepoInfos: BatchRepoInfo[] = await Promise.all(
      batchRepos.map(async (repo) => {
        const readme = await fetchRepositoryReadme(
          config.githubToken,
          repo.owner.login,
          repo.name,
        );
        readmeCount++;
        spinner.text = `README 조회 중... (${readmeCount}/${batchRepos.length})`;
        return {
          id: `${repo.owner.login}/${repo.name}`,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          readme,
        };
      }),
    );
    spinner.succeed(`README 조회 완료 (${batchRepos.length}개)`);

    // AI 분류
    const classifySpinner = ora("AI 분류 중...").start();
    let results: Map<string, string[]>;
    try {
      results = await gemini.classifyRepositoriesBatch(batchRepoInfos, categories);
      classifySpinner.succeed("분류 완료");
    } catch (error) {
      classifySpinner.fail("분류 실패");
      failed += batchRepos.length;
      continue;
    }

    // Lists에 추가
    const addSpinner = ora(`Lists에 추가 중... (0/${batchRepos.length})`).start();
    let addCount = 0;
    const addResults: { repoId: string; success: boolean; categories?: string[] }[] = [];

    for (const repo of batchRepos) {
      const repoId = `${repo.owner.login}/${repo.name}`;
      const categoryNames = results.get(repoId) || [];

      try {
        const listIds = categoryNames
          .map((name) => createdLists.get(name)?.id)
          .filter((id): id is string => !!id);

        if (listIds.length === 0) {
          addResults.push({ repoId, success: false });
          failed++;
        } else {
          const repoNodeId = await getRepositoryNodeId(
            config.githubToken,
            repo.owner.login,
            repo.name,
          );
          await addRepoToGitHubLists(config.githubToken, repoNodeId, listIds);
          addResults.push({ repoId, success: true, categories: categoryNames });
          success++;
          await delay(config.githubRequestDelay);
        }
      } catch (error) {
        addResults.push({ repoId, success: false });
        failed++;
      }

      addCount++;
      addSpinner.text = `Lists에 추가 중... (${addCount}/${batchRepos.length})`;
    }
    addSpinner.succeed(`Lists에 추가 완료 (${batchRepos.length}개)`);

    // 결과 출력
    for (const result of addResults) {
      if (result.success && result.categories) {
        console.log(`  ✅ ${result.repoId} → ${result.categories.slice(0, 2).join(", ")}`);
      } else {
        console.log(`  ❌ ${result.repoId}`);
      }
    }

    if (batchIdx < totalBatches - 1) {
      await delay(config.batchDelay);
    }
  }

  console.log("\n📊 결과:");
  console.log(`  ✅ 성공: ${success}개`);
  console.log(`  ❌ 실패: ${failed}개`);
}

async function handleReset(config: ReturnType<typeof loadConfig>) {
  console.log("\n🔄 Stars를 Lists에서 제거합니다.\n");

  // Lists 확인
  const spinner = ora("기존 Lists 확인 중...").start();
  const listsData = await fetchGitHubLists(config.githubUsername, config.githubToken);

  if (listsData.totalLists === 0) {
    spinner.fail("Lists가 없습니다.");
    return;
  }

  // Lists에 있는 모든 repo 수집
  const reposInLists = new Map<string, { owner: string; name: string }>();
  for (const list of listsData.lists) {
    for (const repo of list.repositories) {
      const key = `${repo.owner}/${repo.name}`;
      if (!reposInLists.has(key)) {
        reposInLists.set(key, { owner: repo.owner, name: repo.name });
      }
    }
  }

  spinner.stop();

  if (reposInLists.size === 0) {
    console.log("Lists에 추가된 저장소가 없습니다.");
    return;
  }

  console.log(`${listsData.totalLists}개의 Lists에서 ${reposInLists.size}개의 저장소 발견`);

  const confirmed = await confirm({
    message: `${reposInLists.size}개의 저장소를 모든 Lists에서 제거하시겠습니까?`,
    default: false,
  });

  if (!confirmed) {
    console.log("취소되었습니다.");
    return;
  }

  // 제거 실행
  const removeSpinner = ora(`Lists에서 제거 중... (0/${reposInLists.size})`).start();
  let removed = 0;
  let failed = 0;

  for (const [key, repo] of reposInLists) {
    try {
      const repoNodeId = await getRepositoryNodeId(
        config.githubToken,
        repo.owner,
        repo.name,
      );
      await removeRepoFromAllLists(config.githubToken, repoNodeId);
      removed++;
      await delay(config.githubRequestDelay);
    } catch (error) {
      failed++;
    }
    removeSpinner.text = `Lists에서 제거 중... (${removed + failed}/${reposInLists.size})`;
  }

  removeSpinner.succeed(`제거 완료`);
  console.log(`\n📊 결과:`);
  console.log(`  ✅ 성공: ${removed}개`);
  console.log(`  ❌ 실패: ${failed}개`);
}
