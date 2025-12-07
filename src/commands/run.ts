import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig, type Config } from "../utils/config";
import { delay } from "../utils/rate-limiter";
import { GeminiService } from "../services/gemini";
import type { Category, CreatedList, RepoSummary } from "../types";
import type { BatchRepoInfo } from "../prompts/classifier";
import {
  fetchAllMyStarredRepos,
  fetchGitHubLists,
  deleteAllGitHubLists,
  createGitHubList,
  fetchRepositoryReadme,
  getRepositoryNodeId,
  addRepoToGitHubLists,
  type Repo,
} from "../api";

export const runCommand = new Command("run")
  .description("전체 워크플로우 자동 실행 (기획 → 삭제 → 생성 → 분류)")
  .option("--only-new", "아직 Lists에 추가되지 않은 Stars만 처리 (기존 Lists 유지)")
  .option("--dry-run", "시뮬레이션 모드 (카테고리 기획만 확인)")
  .action(async (options) => {
    try {
      const config = loadConfig();
      const gemini = new GeminiService(config);

      if (config.debug) {
        console.log("\n[DEBUG] Config:", {
          maxCategories: config.maxCategories,
          classifyBatchSize: config.classifyBatchSize,
          geminiModel: config.geminiModel,
        });
      }

      console.log("\n🚀 GitHub Stars 자동 정리를 시작합니다.\n");

      // ========================================
      // Step 1: Starred repos 가져오기
      // ========================================
      const allRepos = await fetchStarredRepos(config);
      if (allRepos.length === 0) {
        console.log("Star한 저장소가 없습니다.");
        return;
      }

      // ========================================
      // Step 2: --only-new인 경우 기존 Lists 확인 및 필터링
      // ========================================
      let repos: Repo[];
      let existingLists: Map<string, CreatedList> | null = null;
      let existingCategories: Category[] | null = null;

      if (options.onlyNew) {
        const result = await filterNewReposOnly(config, allRepos);
        repos = result.newRepos;
        existingLists = result.existingLists;
        existingCategories = result.existingCategories;

        if (repos.length === 0) {
          console.log("\n✅ 모든 Stars가 이미 Lists에 추가되어 있습니다.");
          return;
        }

        if (existingCategories.length === 0) {
          console.log("\n⚠️ 기존 Lists가 없습니다. --only-new 없이 다시 실행해주세요.");
          return;
        }
      } else {
        repos = allRepos;
      }

      // ========================================
      // Step 3: 카테고리 기획 (--only-new가 아닌 경우)
      // ========================================
      let categories: Category[];

      if (options.onlyNew && existingCategories) {
        categories = existingCategories;
        console.log(`\n📋 기존 ${categories.length}개의 카테고리 사용`);
      } else {
        categories = await planCategories(gemini, repos, config);
      }

      // ========================================
      // Step 4: Dry Run이면 여기서 종료
      // ========================================
      if (options.dryRun) {
        displayDryRunResults(categories, config, repos.length);
        return;
      }

      // ========================================
      // Step 5: 기존 Lists 삭제 (--only-new가 아닌 경우)
      // ========================================
      if (!options.onlyNew) {
        await deleteExistingLists(config);
      }

      // ========================================
      // Step 6: Lists 생성 (--only-new가 아닌 경우)
      // ========================================
      let createdLists: Map<string, CreatedList>;

      if (options.onlyNew && existingLists && existingLists.size > 0) {
        createdLists = existingLists;
        console.log(`\n📁 기존 ${createdLists.size}개의 Lists 사용`);
      } else {
        createdLists = await createLists(config, categories);
      }

      // ========================================
      // Step 7: 분류 및 Lists에 추가
      // ========================================
      await classifyAndAddRepos(config, gemini, repos, categories, createdLists);

      console.log("\n✅ 완료! Stars가 Lists로 정리되었습니다.");
    } catch (error) {
      console.error("\n❌ 오류 발생:", (error as Error).message);
      process.exit(1);
    }
  });

// ============================================
// Helper Functions
// ============================================

async function fetchStarredRepos(config: Config): Promise<Repo[]> {
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

  spinner.succeed(`${result.repos.length}개의 Starred 저장소를 가져왔습니다.`);
  return result.repos;
}

async function filterNewReposOnly(
  config: Config,
  allRepos: Repo[],
): Promise<{
  newRepos: Repo[];
  existingLists: Map<string, CreatedList>;
  existingCategories: Category[];
}> {
  const spinner = ora("기존 Lists 확인 중...").start();

  const listsData = await fetchGitHubLists(config.githubUsername, config.githubToken);

  const addedRepoNames = new Set<string>();
  const existingLists = new Map<string, CreatedList>();
  const existingCategories: Category[] = [];

  for (const list of listsData.lists) {
    existingLists.set(list.name, {
      id: list.id,
      name: list.name,
      description: list.description,
    });

    existingCategories.push({
      name: list.name,
      description: list.description || "",
      keywords: [],
    });

    for (const repo of list.repositories) {
      addedRepoNames.add(`${repo.owner}/${repo.name}`);
    }
  }

  const newRepos = allRepos.filter(
    (repo) => !addedRepoNames.has(`${repo.owner.login}/${repo.name}`),
  );

  const skipped = allRepos.length - newRepos.length;
  spinner.succeed(`${skipped}개 이미 추가됨 → ${newRepos.length}개 새 저장소 처리 예정`);

  return { newRepos, existingLists, existingCategories };
}

async function planCategories(
  gemini: GeminiService,
  repos: Repo[],
  config: Config,
): Promise<Category[]> {
  const spinner = ora(`AI가 ${config.maxCategories}개 카테고리를 기획하는 중...`).start();

  const repoSummaries: RepoSummary[] = repos.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
  }));

  try {
    const categories = await gemini.planCategories(repoSummaries);
    spinner.succeed(`${categories.length}개의 카테고리가 기획되었습니다.`);
    return categories;
  } catch (error) {
    spinner.fail("카테고리 기획 실패");
    throw error;
  }
}

function displayDryRunResults(categories: Category[], config: Config, repoCount: number) {
  console.log("\n📋 [Dry Run] 기획된 카테고리:\n");
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
  console.log(`  - 처리 대상: ${repoCount}개 저장소`);
  console.log(`  - 배치 크기: ${config.classifyBatchSize}`);
  console.log(`  - Gemini 모델: ${config.geminiModel}`);
  console.log("\n(--dry-run 모드로 실제 실행은 하지 않았습니다.)");
}

async function deleteExistingLists(config: Config) {
  const spinner = ora("기존 Lists 확인 중...").start();
  const data = await fetchGitHubLists(config.githubUsername, config.githubToken);

  if (data.totalLists === 0) {
    spinner.succeed("기존 Lists 없음");
    return;
  }

  spinner.stop();

  const shouldDelete = await confirm({
    message: `기존 ${data.totalLists}개의 Lists를 삭제하시겠습니까?`,
    default: true,
  });

  if (!shouldDelete) {
    console.log("취소되었습니다.");
    process.exit(0);
  }

  const deleteSpinner = ora(`Lists 삭제 중... (0/${data.totalLists})`).start();
  const deletedCount = await deleteAllGitHubLists(
    config.githubUsername,
    config.githubToken,
    (deleted, total) => {
      deleteSpinner.text = `Lists 삭제 중... (${deleted}/${total})`;
    },
  );
  deleteSpinner.succeed(`${deletedCount}개의 Lists 삭제 완료`);
}

async function createLists(
  config: Config,
  categories: Category[],
): Promise<Map<string, CreatedList>> {
  const spinner = ora("Lists 생성 중...").start();
  const createdLists = new Map<string, CreatedList>();
  let created = 0;

  for (const category of categories) {
    try {
      const result = await createGitHubList(
        config.githubToken,
        category.name,
        category.description,
        config.listIsPrivate,
      );

      createdLists.set(category.name, {
        id: result.list.id,
        name: result.list.name,
        description: result.list.description,
      });

      created++;
      spinner.text = `Lists 생성 중... (${created}/${categories.length})`;

      await delay(config.listCreateDelay);
    } catch (error) {
      console.warn(`\n  ⚠️ "${category.name}" 생성 실패`);
    }
  }

  spinner.succeed(`${created}개의 Lists 생성 완료`);
  return createdLists;
}

async function classifyAndAddRepos(
  config: Config,
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
