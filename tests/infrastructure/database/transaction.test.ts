import type { Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getActiveTransaction,
  getKnex,
  initDatabase,
  setKnex,
  transaction,
} from "../../../src/infrastructure/database/orm/connection";

describe("Database Transaction (AsyncLocalStorage)", () => {
  let db: Knex;

  beforeAll(async () => {
    db = initDatabase({
      client: "better-sqlite3",
      connection: { filename: ":memory:" },
      useNullAsDefault: true,
    });

    // Create a test table for transaction rollback/commit verification
    await db.schema.createTable("test_items", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
    });
  });

  afterAll(async () => {
    if (db) {
      await db.destroy();
    }
  });

  beforeEach(async () => {
    // Clear test table before each test
    await db("test_items").delete();
  });

  it("exposes no active transaction in normal execution", () => {
    expect(getActiveTransaction()).toBeUndefined();
    expect(getKnex()).toBe(db);
  });

  it("stores active transaction in AsyncLocalStorage inside transaction callback", async () => {
    let trxInside: Knex.Transaction | undefined;
    let knexInside: Knex | undefined;

    await transaction(async (trx) => {
      trxInside = getActiveTransaction();
      knexInside = getKnex();

      expect(trxInside).toBeDefined();
      expect(trxInside).toBe(trx);
      expect(knexInside).toBe(trx as unknown as Knex);
    });

    expect(getActiveTransaction()).toBeUndefined();
    expect(getKnex()).toBe(db);
  });

  it("commits database operations when callback completes successfully", async () => {
    const result = await transaction(async () => {
      // Use getKnex() which resolves to the active transaction
      const currentKnex = getKnex();
      await currentKnex("test_items").insert({ name: "item-committed" });
      return "success";
    });

    expect(result).toBe("success");

    // Verify row was committed to the database
    const rows = await db("test_items").select("*");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("item-committed");
  });

  it("rolls back all changes when an error is thrown inside transaction", async () => {
    await expect(
      transaction(async () => {
        const currentKnex = getKnex();
        await currentKnex("test_items").insert({ name: "item-rolled-back" });

        throw new Error("Simulated transaction failure");
      }),
    ).rejects.toThrow("Simulated transaction failure");

    // Verify row was rolled back and table is empty
    const rows = await db("test_items").select("*");
    expect(rows).toHaveLength(0);

    // Verify ALS was cleaned up
    expect(getActiveTransaction()).toBeUndefined();
  });

  it("reuses outer transaction when nested transaction() is called", async () => {
    let outerTrx: Knex.Transaction | undefined;
    let innerTrx: Knex.Transaction | undefined;

    await transaction(async (outer) => {
      outerTrx = outer;

      await transaction(async (inner) => {
        innerTrx = inner;
        expect(inner).toBe(outer);

        const currentKnex = getKnex();
        await currentKnex("test_items").insert({ name: "nested-item" });
      });
    });

    expect(outerTrx).toBeDefined();
    expect(innerTrx).toBe(outerTrx);

    const rows = await db("test_items").select("*");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("nested-item");
  });

  it("rolls back nested transaction changes when inner transaction fails", async () => {
    await expect(
      transaction(async () => {
        const currentKnex = getKnex();
        await currentKnex("test_items").insert({ name: "outer-item" });

        await transaction(async () => {
          await currentKnex("test_items").insert({ name: "inner-item" });
          throw new Error("Inner fail");
        });
      }),
    ).rejects.toThrow("Inner fail");

    const rows = await db("test_items").select("*");
    expect(rows).toHaveLength(0);
  });

  describe("Savepoints (options.savepoint = true)", () => {
    it("creates a separate savepoint transaction when savepoint: true", async () => {
      let outerTrx: Knex.Transaction | undefined;
      let innerTrx: Knex.Transaction | undefined;

      await transaction(async (outer) => {
        outerTrx = outer;

        await transaction(
          async (inner) => {
            innerTrx = inner;
            // With savepoint: true, inner is a savepoint transaction, distinct from outer
            expect(inner).not.toBe(outer);

            const currentKnex = getKnex();
            await currentKnex("test_items").insert({ name: "savepoint-item" });
          },
          { savepoint: true },
        );
      });

      expect(outerTrx).toBeDefined();
      expect(innerTrx).toBeDefined();

      const rows = await db("test_items").select("*");
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("savepoint-item");
    });

    it("rolls back ONLY inner changes to the savepoint when inner throws and outer catches", async () => {
      await transaction(async () => {
        const currentKnex = getKnex();
        await currentKnex("test_items").insert({ name: "outer-preserved" });

        try {
          await transaction(
            async () => {
              const spKnex = getKnex();
              await spKnex("test_items").insert({ name: "inner-aborted" });
              throw new Error("Savepoint failure");
            },
            { savepoint: true },
          );
        } catch (err: any) {
          expect(err.message).toBe("Savepoint failure");
        }

        // Outer transaction continues and inserts another item
        await currentKnex("test_items").insert({ name: "outer-subsequent" });
      });

      // Verify that outer items were committed, but inner savepoint item was rolled back
      const rows = await db("test_items").select("*").orderBy("id", "asc");
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.name)).toEqual([
        "outer-preserved",
        "outer-subsequent",
      ]);
    });
  });
});
