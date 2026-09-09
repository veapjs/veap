#!/usr/bin/env node
import { container } from "../ioc/container.js";
import { CliService } from "./service.js";
import { CLI_SERVICE } from "../../domain/contracts/token.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pkg from "../../../package.json" with { type: "json" };

async function main() {
  process.env.VEAP_CLI = "1";
  const cliService = new CliService();
  container.register({
    token: CLI_SERVICE,
    useValue: cliService,
    singleton: true,
  });
  container.register({
    token: CliService,
    useValue: cliService,
    singleton: true,
  });
  container.register({
    token: "CliService",
    useValue: cliService,
    singleton: true,
  });

  const cli = cliService.program;

  cli
    .command(
      "init [name]",
      "Initialize a new Veap project (asks for details when omitted)",
    )
    .option("--docker", "Initialize Docker configuration")
    .option("--skip-install", "Skip dependencies installation")
    .option(
      "--pm <manager>",
      "Package manager to use: pnpm, npm, yarn or bun (auto-detected when omitted)",
    )
    .action(
      async (
        name: string | undefined,
        options: {
          docker?: boolean;
          skipInstall?: boolean;
          pm?: string;
        },
      ) => {
        const { initProject } = await import("./commands/init.js");
        await initProject(name, options);
      },
    );

  cli.help();
  cli.version(pkg.version);

  // Attempt to boot the application so providers can register their commands
  const libVeapPath = path.join(process.cwd(), "lib", "veap.ts");
  if (fs.existsSync(libVeapPath)) {
    try {
      const { createJiti } = await import("jiti");
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const jiti = createJiti(process.cwd(), {
        interopDefault: true,
        alias: {
          "server-only": path.join(__dirname, "server-only-mock.js"),
        },
      });
      const app = (await jiti.import(libVeapPath)) as any;

      if (app.initializeSystem) {
        // Run system initialization to trigger all boot() methods
        await app.initializeSystem();
      }
    } catch (e) {
      console.warn("Failed to boot Veap application:", e);
    }
  }

  // If we reach here and it's just help/version or a synchronous command,
  // we exit to prevent hanging from active database connections.
  // Note: cac's action handlers are asynchronous, so if a command matches,
  // cac doesn't wait for it unless we hook into it.
  // Actually cac.parse() returns { args, options, m: matchedCommand }
  // We should NOT process.exit(0) here if a command was matched!
  const parsed = cli.parse();
  if (parsed.options.help || parsed.options.version || !cli.matchedCommand) {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
