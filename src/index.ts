#!/usr/bin/env node
import { Command } from "commander";
import { listsCommand } from "./commands/lists";
import { planCommand } from "./commands/plan";
import { createListsCommand } from "./commands/create-lists";
import { classifyCommand } from "./commands/classify";
import { runCommand } from "./commands/run";

const program = new Command();

program
  .name("stardust")
  .description("AI-powered CLI tool to automatically organize your GitHub Stars into Lists")
  .version("1.0.0");

// Individual step commands
program.addCommand(listsCommand);       // lists - View/delete Lists
program.addCommand(planCommand);        // plan - Plan categories
program.addCommand(createListsCommand); // create-lists - Create Lists
program.addCommand(classifyCommand);    // classify - Classify and add Stars

// Full auto execution
program.addCommand(runCommand);         // run - Full workflow

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
