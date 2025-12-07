#!/usr/bin/env bun
import { Command } from "commander";
import { listsCommand } from "./commands/lists";
import { planCommand } from "./commands/plan";
import { createListsCommand } from "./commands/create-lists";
import { classifyCommand } from "./commands/classify";
import { runCommand } from "./commands/run";

const program = new Command();

program
  .name("github-stars-arrange")
  .description("GitHub Stars를 Lists로 자동 정리하는 CLI 도구")
  .version("1.0.0");

// 개별 단계 명령어
program.addCommand(listsCommand);       // lists - Lists 조회/삭제
program.addCommand(planCommand);        // plan - 카테고리 기획
program.addCommand(createListsCommand); // create-lists - Lists 생성
program.addCommand(classifyCommand);    // classify - Stars 분류 및 추가

// 전체 자동 실행
program.addCommand(runCommand);         // run - 전체 워크플로우

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
