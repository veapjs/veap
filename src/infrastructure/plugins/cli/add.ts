import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import * as p from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import { findProjectRoot } from "../../../infrastructure/cli/utils.js";
import { regeneratePluginsRegistry } from "./utils.js";

async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

export async function addPlugin(
  pluginArg: string,
  options?: { local?: boolean; skipInstall?: boolean },
) {
  const rootDir = findProjectRoot(process.cwd());
  console.log(`\n📦 Adding plugin: ${pluginArg}...`);

  let pluginDir = "";
  let pluginPkgJsonPath = "";

  if (options?.local) {
    // Local installation from Git URL or npm package
    let gitUrl = pluginArg;
    const isGitUrl =
      /^(git|http|https|github):/.test(pluginArg) || pluginArg.endsWith(".git");

    if (!isGitUrl) {
      const spinUrl = ora(
        `Fetching Git repository URL for package ${pluginArg}...`,
      ).start();
      try {
        const output = execSync(`npm view ${pluginArg} repository.url`, {
          stdio: "pipe",
        })
          .toString()
          .trim();
        if (output) {
          gitUrl = output;
          spinUrl.succeed(`Found repository URL: ${gitUrl}`);
        } else {
          spinUrl.fail(`Could not find repository URL for ${pluginArg}`);
          process.exit(1);
        }
      } catch (_err) {
        spinUrl.fail(`Failed to fetch package details for ${pluginArg}`);
        process.exit(1);
      }
    }

    // Normalize git URL
    if (gitUrl.startsWith("git+")) {
      gitUrl = gitUrl.slice(4);
    }
    if (gitUrl.startsWith("git://")) {
      gitUrl = `https://${gitUrl.slice(6)}`;
    }

    const repoName =
      gitUrl
        .split("/")
        .pop()
        ?.replace(/\.git$/, "") || "custom-plugin";
    pluginDir = path.join(rootDir, "plugins", repoName);

    if (fs.existsSync(pluginDir)) {
      console.error(`Error: Local plugin already exists in ${pluginDir}`);
      process.exit(1);
    }

    const spin = ora(
      `Cloning repository ${gitUrl} to plugins/${repoName}...`,
    ).start();
    try {
      execSync(`git clone ${gitUrl} "${pluginDir}"`, { stdio: "ignore" });
      spin.succeed(`Cloned repository to plugins/${repoName}`);
    } catch (_err) {
      spin.fail(`Failed to clone repository ${gitUrl}`);
      process.exit(1);
    }

    pluginPkgJsonPath = path.join(pluginDir, "package.json");

    if (fs.existsSync(pluginPkgJsonPath)) {
      try {
        const pluginPkg = JSON.parse(
          fs.readFileSync(pluginPkgJsonPath, "utf-8"),
        );
        const pluginName = pluginPkg.name || repoName;

        // Add to root package.json as workspace dependency
        const rootPkgPath = path.join(rootDir, "package.json");
        if (fs.existsSync(rootPkgPath)) {
          const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
          rootPkg.dependencies = rootPkg.dependencies || {};
          rootPkg.dependencies[pluginName] = "workspace:*";
          fs.writeFileSync(
            rootPkgPath,
            `${JSON.stringify(rootPkg, null, 2)}\n`,
            "utf-8",
          );
        }

        // Run install to link the workspace package
        if (!options?.skipInstall) {
          const { detectPackageManager } =
            await import("../../../infrastructure/cli/package-manager.js");
          const pm = detectPackageManager(rootDir);
          const installSpin = ora(
            `Linking local plugin with ${pm} install...`,
          ).start();
          try {
            execSync(`${pm} install`, { cwd: rootDir, stdio: "ignore" });
            installSpin.succeed("Plugin linked successfully.");
          } catch (_err) {
            installSpin.fail(`Failed to run ${pm} install automatically.`);
          }
        }
      } catch (_) {}
    }
  } else {
    // NPM installation via package manager
    if (!options?.skipInstall) {
      const { detectPackageManager } =
        await import("../../../infrastructure/cli/package-manager.js");
      const pm = detectPackageManager(rootDir);
      const installCmd = pm === "npm" ? "install" : "add";
      const workspaceFlag = pm === "npm" ? "" : "-w";

      const spin = ora(`Installing npm package ${pluginArg}...`).start();
      try {
        execSync(`${pm} ${installCmd} ${pluginArg} ${workspaceFlag}`.trim(), {
          cwd: rootDir,
          stdio: "inherit",
        });
        spin.succeed(`Package ${pluginArg} installed.`);
      } catch (_err) {
        spin.fail(`Failed to install package ${pluginArg}`);
        process.exit(1);
      }
    }

    // Resolve where it is installed in node_modules
    const projectPkgPath = path.join(rootDir, "package.json");
    let resolvedPkgName = pluginArg;
    if (fs.existsSync(projectPkgPath)) {
      const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, "utf-8"));
      const deps = {
        ...(projectPkg.dependencies || {}),
        ...(projectPkg.devDependencies || {}),
      };
      for (const [name, val] of Object.entries(deps)) {
        if (
          val === pluginArg ||
          (typeof val === "string" && val.includes(pluginArg)) ||
          name === pluginArg
        ) {
          resolvedPkgName = name;
          break;
        }
      }
    }

    pluginDir = path.join(rootDir, "node_modules", resolvedPkgName);
    pluginPkgJsonPath = path.join(pluginDir, "package.json");
  }

  if (!fs.existsSync(pluginPkgJsonPath)) {
    console.error(
      `Error: Cannot find package.json for plugin at ${pluginPkgJsonPath}`,
    );
    process.exit(1);
  }

  const pluginPkg = JSON.parse(fs.readFileSync(pluginPkgJsonPath, "utf-8"));
  const VeapConfig = pluginPkg.veap || pluginPkg.veap || {};

  // 1. Configure environment variables (.env)
  if (VeapConfig.env) {
    const envPath = path.join(rootDir, ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    console.log(
      `\n ⚙️  Configuring environment variables for ${pluginPkg.name || pluginArg}:`,
    );
    // biome-ignore lint/suspicious/noExplicitAny: <ignore>
    for (const [varName, varConfig] of Object.entries(VeapConfig.env) as any) {
      const regex = new RegExp(`^${varName}=`, "m");
      if (regex.test(envContent)) {
        console.log(`  - ${varName} is already configured in .env`);
        continue;
      }

      const desc = varConfig.description || "No description provided";
      const reqStr = varConfig.required ? " (required)" : " (optional)";
      let value = "";

      while (true) {
        value = await askQuestion(
          `? Enter value for ${varName} - ${desc}${reqStr}: `,
        );
        if (varConfig.required && !value.trim()) {
          console.log(`  Error: ${varName} is required.`);
          continue;
        }
        break;
      }

      envContent += `\n# Added by Veap CLI for ${pluginPkg.name}\n${varName}="${value}"\n`;
    }
    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log(`✅ Environment variables saved to .env`);
  }

  // 2. Install dependencies recursively
  if (VeapConfig.dependencies && Array.isArray(VeapConfig.dependencies)) {
    console.log(
      `\n📦 Installing dependencies for ${pluginPkg.name || pluginArg}...`,
    );
    for (const dep of VeapConfig.dependencies) {
      await addPlugin(dep, options);
    }
  }

  // 3. Regenerate plugins.gen.ts
  regeneratePluginsRegistry(rootDir);

  console.log(`\n✨ Plugin "${pluginPkg.name || pluginArg}" is ready!`);
}
