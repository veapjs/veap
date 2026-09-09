import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { findProjectRoot } from "../utils.js";
import { stubPath } from "../stubs.js";
import {
  applyDockerfileForPackageManager,
  detectPackageManager,
} from "../package-manager.js";

export async function initDockerConfig(targetDir?: string) {
  const rootDir = targetDir || findProjectRoot(process.cwd());
  console.log(`\n🐳 Initializing Docker configuration in ${rootDir}...`);

  // Read project name and add deploy script to package.json
  const pkgPath = path.join(rootDir, "package.json");
  let projectName = "veap-app";
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      projectName = pkg.name || projectName;
      pkg.scripts = pkg.scripts || {};
      pkg.scripts["deploy"] = "docker compose up -d --build";
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
      console.log(`✅ Added "deploy" script to package.json`);
    } catch (_) {}
  }

  // Stubs live at the package root of the installed @veap/core.
  const stubsDir = stubPath("docker");

  const files = [
    { src: "Dockerfile.stub", dest: "Dockerfile" },
    { src: ".dockerignore.stub", dest: ".dockerignore" },
    { src: "compose.yml.stub", dest: "compose.yml" },
  ];

  const spin = ora("Copying Docker files...").start();

  try {
    for (const f of files) {
      const srcPath = path.join(stubsDir, f.src);
      const destPath = path.join(rootDir, f.dest);

      let content = fs.readFileSync(srcPath, "utf-8");
      // Replace project name in compose.yml
      if (f.dest === "compose.yml") {
        content = content.replace(/\{\{name\}\}/g, projectName);
      }

      fs.writeFileSync(destPath, content, "utf-8");
    }

    // Overwrite the pnpm Dockerfile with the variant matching the project's
    // package manager (detected from packageManager field / lockfiles).
    applyDockerfileForPackageManager(rootDir, detectPackageManager(rootDir));
    spin.succeed("Docker configuration files initialized.");
    console.log(`\n✨ Docker files are ready!`);
    console.log(`💡 Run: docker compose up -d (to start postgres and redis)`);
    console.log(
      `💡 Run: docker build -t ${projectName} . (to build the image)`,
    );
  } catch (err) {
    spin.fail("Failed to copy Docker configuration files.");
    console.error(err);
  }
}
