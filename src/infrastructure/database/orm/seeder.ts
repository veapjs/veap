import { debug, info, warn } from "../../logging";
import { transaction } from "./connection";

export type SeederClass = new () => Seeder;

/**
 * Base Database Seeder class.
 */
export abstract class Seeder {
  /**
   * Run the database seeds.
   */
  abstract run(): Promise<void>;

  /**
   * Run additional seeders sequentially.
   */
  async call(seeders: SeederClass[] | SeederClass): Promise<void> {
    const list = Array.isArray(seeders) ? seeders : [seeders];

    for (const SeederCtor of list) {
      const seederName = SeederCtor.name || "Seeder";
      info("veap:Seeder", `Running seeder: ${seederName}`);
      const startTime = Date.now();

      try {
        const instance = new SeederCtor();
        await instance.run();
        const duration = Date.now() - startTime;
        debug("veap:Seeder", `Completed seeder: ${seederName} (${duration}ms)`);
      } catch (error) {
        warn("veap:Seeder", `Failed to run seeder: ${seederName}`, error);
        throw error;
      }
    }
  }
}

export interface RunSeedersOptions {
  /**
   * Whether to wrap all seeders execution inside a single database transaction.
   * Defaults to false.
   */
  inTransaction?: boolean;
}

/**
 * Runs one or multiple Seeders.
 */
export async function runSeeders(
  seeders: SeederClass[] | SeederClass,
  options: RunSeedersOptions = {},
): Promise<void> {
  const runner = async () => {
    const rootSeeder = new (class extends Seeder {
      async run(): Promise<void> {
        await this.call(seeders);
      }
    })();

    await rootSeeder.run();
  };

  if (options.inTransaction) {
    await transaction(async () => {
      await runner();
    });
  } else {
    await runner();
  }
}
