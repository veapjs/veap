import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import {
  findProjectRoot,
  processStubs,
} from "../../../infrastructure/cli/utils.js";
import { stubPath } from "../../../infrastructure/cli/stubs.js";
import { regeneratePluginsRegistry } from "./utils.js";
import {
  applyDockerfileForPackageManager,
  detectPackageManager,
} from "../../../infrastructure/cli/package-manager.js";

export async function generatePlugin(
  name: string,
  options?: { skipInstall?: boolean },
) {
  const rootDir = findProjectRoot(process.cwd());
  const pluginDir = path.join(rootDir, "plugins", `${name}-plugin`);

  if (fs.existsSync(pluginDir)) {
    console.error(`Error: Plugin "${name}" already exists in ${pluginDir}`);
    process.exit(1);
  }

  const rootPluginsDir = path.join(rootDir, "plugins");
  if (!fs.existsSync(rootPluginsDir)) {
    fs.mkdirSync(rootPluginsDir, { recursive: true });
  }

  console.log(`🚀 Generating a plugin: ${name} in ${pluginDir}...`);

  try {
    const titleName = name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const pascalName = name.replace(/-/g, "");
    const date = new Date().toDateString();

    const variables = {
      name,
      titleName,
      pascalName,
      date,
    };

    // Stubs live at the package root of the installed @veap/framework.
    const stubsDir = stubPath("plugin");

    const spin = ora("Generating plugin files from stubs...").start();
    processStubs(stubsDir, pluginDir, variables);
    spin.succeed("Plugin files generated.");

    if (!options?.skipInstall) {
      const spinner = ora(
        "📦 Installing dependencies (pnpm install)...",
      ).start();
      execSync("pnpm install", { cwd: rootDir, stdio: "inherit" });
      spinner.succeed("Dependencies installed.");
    }

    console.log(`\n✨ Plugin "${name}" is ready!`);
    console.log(`💡 Run "pnpm veap generate:plugins" to register it.`);
  } catch (err) {
    console.error("Error generating plugin:", err);
  }
}
