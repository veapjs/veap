import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { findProjectRoot } from "../../../infrastructure/cli/utils.js";
import { regeneratePluginsRegistry } from "./utils.js";

function normalizeGitUrl(url: string): string {
  if (url.startsWith("git+")) {
    url = url.slice(4);
  }
  if (url.startsWith("git://")) {
    url = `https://${url.slice(6)}`;
  }
  return url;
}

export async function ejectPlugin(pluginName: string) {
  const rootDir = findProjectRoot(process.cwd());
  console.log(`\n🚀 Ejecting plugin: ${pluginName}...`);

  // Check if root package.json has it
  const rootPkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(rootPkgPath)) {
    console.error("Error: Cannot find root package.json.");
    process.exit(1);
  }

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
  const deps = {
    ...(rootPkg.dependencies || {}),
    ...(rootPkg.devDependencies || {}),
  };

  if (!deps[pluginName]) {
    console.error(
      `Error: Plugin "${pluginName}" is not installed in dependencies.`,
    );
    process.exit(1);
  }

  // Find installed folder in node_modules
  const nodeModulesDir = path.join(rootDir, "node_modules", pluginName);
  const pluginPkgJsonPath = path.join(nodeModulesDir, "package.json");

  if (!fs.existsSync(pluginPkgJsonPath)) {
    console.error(
      `Error: Cannot find package.json for installed plugin at ${pluginPkgJsonPath}`,
    );
    process.exit(1);
  }

  const pluginPkg = JSON.parse(fs.readFileSync(pluginPkgJsonPath, "utf-8"));
  const repo = pluginPkg.repository;

  let gitUrl = "";
  if (typeof repo === "string") {
    gitUrl = repo;
  } else if (repo && typeof repo === "object") {
    gitUrl = repo.url || "";
  }

  if (!gitUrl) {
    // If not found in package.json, try querying pnpm registry
    const spinUrl = ora(
      `Querying registry for Git repository of ${pluginName}...`,
    ).start();
    try {
      const output = execSync(`npm view ${pluginName} repository.url`, {
        stdio: "pipe",
      })
        .toString()
        .trim();
      if (output) {
        gitUrl = output;
        spinUrl.succeed(`Found repository URL: ${gitUrl}`);
      } else {
        spinUrl.fail();
        console.error(
          `Error: Plugin package.json does not specify repository URL, and registry query returned nothing.`,
        );
        process.exit(1);
      }
    } catch (_err) {
      spinUrl.fail();
      console.error(
        `Error: Could not retrieve repository URL from package or registry.`,
      );
      process.exit(1);
    }
  }

  const normalizedUrl = normalizeGitUrl(gitUrl);
  const folderName = pluginName.replace(/^@.*\//, "");
  const destDir = path.join(rootDir, "plugins", folderName);

  if (fs.existsSync(destDir)) {
    console.error(`Error: Local plugin directory already exists at ${destDir}`);
    process.exit(1);
  }

  const cloneSpin = ora(
    `Cloning repository ${normalizedUrl} to plugins/${folderName}...`,
  ).start();
  try {
    execSync(`git clone ${normalizedUrl} "${destDir}"`, { stdio: "ignore" });
    cloneSpin.succeed(`Cloned repository to plugins/${folderName}`);
  } catch (_err) {
    cloneSpin.fail(`Failed to clone repository ${normalizedUrl}`);
    process.exit(1);
  }

  // Update root package.json dependency to workspace:*
  rootPkg.dependencies = rootPkg.dependencies || {};
  rootPkg.dependencies[pluginName] = "workspace:*";
  fs.writeFileSync(
    rootPkgPath,
    `${JSON.stringify(rootPkg, null, 2)}\n`,
    "utf-8",
  );
  console.log(`✅ Updated root package.json dependencies.`);

  // Link workspace packages
  const { detectPackageManager } =
    await import("../../../infrastructure/cli/package-manager.js");
  const pm = detectPackageManager(rootDir);
  const linkSpin = ora(
    `Running ${pm} install to link ejected plugin...`,
  ).start();
  try {
    execSync(`${pm} install`, { cwd: rootDir, stdio: "ignore" });
    linkSpin.succeed("Plugin linked successfully.");
  } catch (_err) {
    linkSpin.fail(`Failed to run ${pm} install automatically.`);
  }

  // Regenerate registry
  regeneratePluginsRegistry(rootDir);

  console.log(
    `\n✨ Plugin "${pluginName}" ejected successfully to local folder plugins/${folderName}!`,
  );
}
