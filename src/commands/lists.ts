import { Command } from "commander";
import { confirm, input } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "../utils/config";
import {
  fetchGitHubLists,
  deleteAllGitHubLists,
  deleteGitHubList,
  createGitHubList,
  updateGitHubList,
} from "../api";

export const listsCommand = new Command("lists")
  .description("GitHub Lists 관리")
  .option("--show", "모든 Lists 조회 (기본값)")
  .option("--delete-all", "모든 Lists 삭제")
  .option("--create <name>", "새 List 생성")
  .option("--delete <name>", "특정 List 삭제")
  .option("-d, --description <desc>", "List 설명 (--create와 함께 사용)")
  .action(async (options) => {
    try {
      const config = loadConfig();

      if (options.deleteAll) {
        await handleDeleteAll(config);
      } else if (options.create) {
        await handleCreate(config, options.create, options.description);
      } else if (options.delete) {
        await handleDelete(config, options.delete);
      } else {
        await showAllLists(config);
      }
    } catch (error) {
      console.error("오류 발생:", (error as Error).message);
      process.exit(1);
    }
  });

async function showAllLists(config: {
  githubToken: string;
  githubUsername: string;
}) {
  const spinner = ora("Lists 조회 중...").start();

  try {
    const data = await fetchGitHubLists(config.githubUsername, config.githubToken);
    spinner.stop();

    if (data.totalLists === 0) {
      console.log("\n현재 생성된 Lists가 없습니다.");
      return;
    }

    console.log(`\n📋 총 ${data.totalLists}개의 Lists:\n`);
    console.log("─".repeat(70));

    for (const list of data.lists) {
      const repoCount = list.totalRepositories.toString().padStart(3);
      const visibility = list.isPrivate ? "🔒" : "🌐";
      console.log(`${visibility} ${list.name}`);
      console.log(`   설명: ${list.description || "(없음)"}`);
      console.log(`   저장소: ${repoCount}개`);
      console.log("─".repeat(70));
    }
  } catch (error) {
    spinner.fail("Lists 조회 실패");
    throw error;
  }
}

async function handleCreate(
  config: { githubToken: string },
  name: string,
  description?: string,
) {
  const spinner = ora(`"${name}" List 생성 중...`).start();

  try {
    const result = await createGitHubList(
      config.githubToken,
      name,
      description,
      false,
    );
    spinner.succeed(`"${result.list.name}" List가 생성되었습니다.`);
  } catch (error) {
    spinner.fail("List 생성 실패");
    throw error;
  }
}

async function handleDelete(
  config: { githubToken: string; githubUsername: string },
  name: string,
) {
  const spinner = ora("List 검색 중...").start();

  const data = await fetchGitHubLists(config.githubUsername, config.githubToken);
  const list = data.lists.find(
    (l) => l.name.toLowerCase() === name.toLowerCase(),
  );

  if (!list) {
    spinner.fail(`"${name}" List를 찾을 수 없습니다.`);
    return;
  }

  spinner.stop();

  const confirmed = await confirm({
    message: `"${list.name}" (${list.totalRepositories}개의 저장소)를 삭제하시겠습니까?`,
    default: false,
  });

  if (!confirmed) {
    console.log("취소되었습니다.");
    return;
  }

  const deleteSpinner = ora("삭제 중...").start();

  try {
    await deleteGitHubList(config.githubToken, list.id);
    deleteSpinner.succeed(`"${list.name}" List가 삭제되었습니다.`);
  } catch (error) {
    deleteSpinner.fail("삭제 실패");
    throw error;
  }
}

async function handleDeleteAll(config: {
  githubToken: string;
  githubUsername: string;
}) {
  const spinner = ora("현재 Lists 확인 중...").start();
  const data = await fetchGitHubLists(config.githubUsername, config.githubToken);
  spinner.stop();

  if (data.totalLists === 0) {
    console.log("\n삭제할 Lists가 없습니다.");
    return;
  }

  console.log(`\n총 ${data.totalLists}개의 Lists:`);
  for (const list of data.lists) {
    console.log(`  - ${list.name} (${list.totalRepositories}개의 저장소)`);
  }

  const confirmed = await confirm({
    message: `정말로 ${data.totalLists}개의 모든 Lists를 삭제하시겠습니까?`,
    default: false,
  });

  if (!confirmed) {
    console.log("취소되었습니다.");
    return;
  }

  const deleteSpinner = ora(`Lists 삭제 중... (0/${data.totalLists})`).start();

  try {
    const deletedCount = await deleteAllGitHubLists(
      config.githubUsername,
      config.githubToken,
      (deleted, total) => {
        deleteSpinner.text = `Lists 삭제 중... (${deleted}/${total})`;
      },
    );
    deleteSpinner.succeed(`${deletedCount}개의 Lists가 삭제되었습니다.`);
  } catch (error) {
    deleteSpinner.fail("일부 Lists 삭제 실패");
    throw error;
  }
}
