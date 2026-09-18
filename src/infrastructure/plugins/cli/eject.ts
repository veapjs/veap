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

export async function ejectPackage(packageName: string) {
  const rootDir = findProjectRoot(process.cwd());

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

  if (!deps[packageName]) {
    console.error(
      `Error: Package "${packageName}" is not installed in dependencies.`,
    );
    process.exit(1);
  }

  // Find installed folder in node_modules
  const nodeModulesDir = path.join(rootDir, "node_modules", packageName);
  const pkgJsonPath = path.join(nodeModulesDir, "package.json");

  if (!fs.existsSync(pkgJsonPath)) {
    console.error(
      `Error: Cannot find package.json for installed package at ${pkgJsonPath}`,
    );
    process.exit(1);
  }

  const installedPkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

  const isTemplate =
    installedPkg.veap?.type === "template" ||
    packageName.endsWith("-template") ||
    packageName.includes("template");

  const itemType = isTemplate ? "template" : "plugin";
  const targetSubdir = isTemplate ? "templates" : "plugins";

  console.log(`\n🚀 Ejecting ${itemType}: ${packageName}...`);

  const repo = installedPkg.repository;

  let gitUrl = "";
  if (typeof repo === "string") {
    gitUrl = repo;
  } else if (repo && typeof repo === "object") {
    gitUrl = repo.url || "";
  }

  if (!gitUrl) {
    // If not found in package.json, try querying registry
    const spinUrl = ora(
      `Querying registry for Git repository of ${packageName}...`,
    ).start();
    try {
      const output = execSync(`npm view ${packageName} repository.url`, {
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
          `Error: Package package.json does not specify repository URL, and registry query returned nothing.`,
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
  const folderName = packageName.replace(/^@.*\//, "");
  const destDir = path.join(rootDir, targetSubdir, folderName);

  if (fs.existsSync(destDir)) {
    console.error(
      `Error: Local ${itemType} directory already exists at ${destDir}`,
    );
    process.exit(1);
  }

  // Ensure target parent directory exists (e.g. templates/ or plugins/)
  const targetBaseDir = path.join(rootDir, targetSubdir);
  if (!fs.existsSync(targetBaseDir)) {
    fs.mkdirSync(targetBaseDir, { recursive: true });
  }

  const cloneSpin = ora(
    `Cloning repository ${normalizedUrl} to ${targetSubdir}/${folderName}...`,
  ).start();
  try {
    execSync(`git clone ${normalizedUrl} "${destDir}"`, { stdio: "ignore" });
    cloneSpin.succeed(`Cloned repository to ${targetSubdir}/${folderName}`);
  } catch (_err) {
    cloneSpin.fail(`Failed to clone repository ${normalizedUrl}`);
    process.exit(1);
  }

  // Ensure workspace pattern exists in root package.json if workspaces array is defined
  if (Array.isArray(rootPkg.workspaces)) {
    const workspacePattern = `${targetSubdir}/*`;
    if (!rootPkg.workspaces.includes(workspacePattern)) {
      rootPkg.workspaces.push(workspacePattern);
    }
  }

  // Update root package.json dependency to workspace:*
  rootPkg.dependencies = rootPkg.dependencies || {};
  rootPkg.dependencies[packageName] = "workspace:*";
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
    `Running ${pm} install to link ejected ${itemType}...`,
  ).start();
  try {
    execSync(`${pm} install`, { cwd: rootDir, stdio: "ignore" });
    linkSpin.succeed(
      `${isTemplate ? "Template" : "Plugin"} linked successfully.`,
    );
  } catch (_err) {
    linkSpin.fail(`Failed to run ${pm} install automatically.`);
  }

  // Regenerate registry only for plugins
  if (!isTemplate) {
    regeneratePluginsRegistry(rootDir);
  }

  console.log(
    `\n✨ ${isTemplate ? "Template" : "Plugin"} "${packageName}" ejected successfully to local folder ${targetSubdir}/${folderName}!`,
  );
}

export const ejectPlugin = ejectPackage;
