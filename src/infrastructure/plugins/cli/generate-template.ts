import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import {
  findProjectRoot,
  processStubs,
} from "../../../infrastructure/cli/utils.js";
import { stubPath } from "../../../infrastructure/cli/stubs.js";

export async function generateTemplate(
  name: string,
  options?: { skipInstall?: boolean },
) {
  const rootDir = findProjectRoot(process.cwd());
  const templateDir = path.join(rootDir, "templates", `${name}-template`);

  if (fs.existsSync(templateDir)) {
    console.error(`Error: Template "${name}" already exists in ${templateDir}`);
    process.exit(1);
  }

  const rootTemplatesDir = path.join(rootDir, "templates");
  if (!fs.existsSync(rootTemplatesDir)) {
    fs.mkdirSync(rootTemplatesDir, { recursive: true });
  }

  console.log(`🚀 Generating a template: ${name} in ${templateDir}...`);

  try {
    const titleName = name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const pascalName = name.replace(/-/g, "");

    const variables = {
      name,
      titleName,
      pascalName,
    };

    // Stubs live at the package root of the installed @veap/framework.
    const stubsDir = stubPath("template");

    const spin = ora("Generating template files from stubs...").start();
    processStubs(stubsDir, templateDir, variables);
    spin.succeed("Template files generated.");

    if (!options?.skipInstall) {
      const spinner = ora(
        "📦 Installing dependencies (pnpm install)...",
      ).start();
      execSync("pnpm install", { cwd: rootDir, stdio: "inherit" });
      spinner.succeed("Dependencies installed.");
    }

    console.log(`\n✨ Template "${name}" is ready!`);
  } catch (err) {
    console.error("Error generating template:", err);
  }
}
