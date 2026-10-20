import type { Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initDatabase } from "../src/connection.js";
import { Model } from "../src/model.js";

class Product extends Model {
  static override table = "products";
  static override autoUuid = false; // Integer primary key with autoincrement
  static override casts = {
    metadata: "json",
    is_active: "boolean",
    released_at: "datetime",
  };
  static override softDeletes = true;
  static override fillable = ["name", "metadata", "is_active", "released_at"];

  declare name: string;
  declare metadata: any;
  declare is_active: boolean;
  declare released_at: any;
  declare deleted_at: any;
}

describe("Casts, Auto-Increment Primary Keys & Soft Delete Destroy", () => {
  let db: Knex;

  beforeAll(async () => {
    db = initDatabase({
      client: "better-sqlite3",
      connection: { filename: ":memory:" },
      useNullAsDefault: true,
    });

    await db.schema.createTable("products", (t) => {
      t.increments("id").primary();
      t.string("name").notNullable();
      t.text("metadata").nullable();
      t.integer("is_active").defaultTo(1);
      t.text("released_at").nullable();
      t.text("deleted_at").nullable();
      t.timestamps(true, true);
    });
  });

  afterAll(async () => {
    if (db) {
      await db.destroy();
    }
  });

  beforeEach(async () => {
    await db("products").delete();
  });

  it("assigns auto-increment primary key ID after save() when autoUuid is false", async () => {
    const p1 = new Product({ name: "Widget A" });
    expect(p1.id).toBeUndefined();

    await p1.save();
    expect(p1.id).toBeDefined();
    expect(typeof p1.id === "number" || typeof p1.id === "string").toBe(true);

    const p2 = await Product.create({ name: "Widget B" });
    expect(p2.id).toBeDefined();
    expect(p2.id).not.toBe(p1.id);
  });

  it("correctly serializes JSON attributes without double stringifying when given a JSON string", async () => {
    // 1. Pass object
    const p1 = await Product.create({
      name: "Object JSON",
      metadata: { features: ["fast", "reliable"] },
    });

    const rawRow1 = await db("products").where("id", p1.id).first();
    expect(rawRow1?.metadata).toBe('{"features":["fast","reliable"]}');

    // 2. Pass already JSON-stringified value
    const p2 = await Product.create({
      name: "String JSON",
      metadata: '{"features":["compact"]}',
    });

    const rawRow2 = await db("products").where("id", p2.id).first();
    // Must NOT be double-encoded as '"{\"features\":[\"compact\"]}"'
    expect(rawRow2?.metadata).toBe('{"features":["compact"]}');

    // Model hydrates it back into an object
    const refreshed2 = await Product.find(p2.id);
    expect(refreshed2?.metadata).toEqual({ features: ["compact"] });

    // 3. Pass raw primitive string (e.g. "JANBUD" or setting value)
    const p3 = await Product.create({
      name: "Primitive String JSON",
      metadata: "JANBUD",
    });

    const rawRow3 = await db("products").where("id", p3.id).first();
    // Must be valid JSON string literal for PostgreSQL/SQLite
    expect(rawRow3?.metadata).toBe('"JANBUD"');

    const refreshed3 = await Product.find(p3.id);
    expect(refreshed3?.metadata).toBe("JANBUD");
  });

  it("correctly serializes soft delete timestamp on Model.destroy(id)", async () => {
    const product = await Product.create({ name: "To Destroy" });
    const success = await Product.destroy(product.id);
    expect(success).toBe(true);

    const rawRow = await db("products").where("id", product.id).first();
    expect(rawRow?.deleted_at).toBeDefined();
    expect(typeof rawRow?.deleted_at).toBe("string");

    const found = await Product.find(product.id);
    expect(found).toBeNull();

    const trashed = await Product.withTrashed().find(product.id);
    expect(trashed).not.toBeNull();
  });
});
