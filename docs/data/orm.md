# Models and the ORM

Veap's ORM is ActiveRecord over Knex. A model maps to a table, instances map to rows, and static methods build queries. Column naming follows the convention: attributes in code are camelCase, columns are snake_case; the model maps automatically in both directions.

## Defining a model

```ts
import { Model } from "@veap/core/database";

export interface PostAttributes {
  id: string;
  title: string;
  slug: string;
  content: string;
  authorId: string;
  publishedAt: Date | null;
}

export class Post extends Model<PostAttributes> {
  static override table = "posts"; // required: table name
  static override primaryKey = "id"; // default "id"
  static override autoUuid = true; // default true: UUID v4 on create

  static override fillable = ["title", "slug", "content", "author_id"];
  static override hidden = []; // stripped from toJSON()

  static override casts = {
    publishedAt: "datetime",
    meta: "json",
  };

  static override softDeletes = false; // enables deleted_at filtering
  static override timestamps = true; // created_at / updated_at maintained

  author() {
    return this.belongsTo(User, "author_id");
  }

  comments() {
    return this.hasMany(Comment, "post_id");
  }
}
```

Static options in full:

| Option            | Default        | Meaning                                                                                  |
| ----------------- | -------------- | ---------------------------------------------------------------------------------------- |
| `table`           | (required)     | table name                                                                               |
| `primaryKey`      | `"id"`         | primary key column                                                                       |
| `autoUuid`        | `true`         | generate UUID v4 for the primary key on create when not set                              |
| `timestamps`      | `true`         | `true`, `false`, or array subset like `["created_at"]`                                   |
| `casts`           | `{}`           | attribute casts (`datetime`, `json`, `number`, `boolean`, ...) applied on read and write |
| `softDeletes`     | `false`        | filter by `deleted_at` in queries, `delete()` sets it                                    |
| `deletedAtColumn` | `"deleted_at"` | soft delete column                                                                       |
| `fillable`        | `[]`           | mass-assignment allow list (checked against camel/snake forms)                           |
| `guarded`         | `[]`           | mass-assignment deny list; `["*"]` blocks all                                            |
| `hidden`          | `[]`           | attributes removed from `toJSON()` (and camel/snake aliases)                             |
| `morphAlias`      | undefined      | polymorphic alias for MorphMap                                                           |

## Querying

```ts
// fetch
const post = await Post.find(id); // null if missing
const post = await Post.findOrFail(id); // throws
const all = await Post.all();
const count = await Post.count();

// conditions (camelCase or snake_case both accepted)
const published = await Post.query()
  .where("published_at", "<=", new Date())
  .orderBy("created_at", "desc")
  .limit(10)
  .get();

const byAuthor = await Post.query().where({ authorId: userId }).first();

// create / update
const post = await Post.create({ title: "Hello", slug: "hello", authorId });
post.title = "Hello again";
await post.save(); // INSERT or UPDATE (dirty-checked)
await post.update({ title: "Third" }); // fill + save

// upserts
await Post.query().firstOrCreate({ slug }, { title: "Hello" });
await Post.query().updateOrCreate({ slug }, { title: "Hello" });

// delete
await post.delete(); // soft delete if enabled
await post.forceDelete(); // hard delete
await Post.destroy(id);
```

The builder covers `where/orWhere/whereIn/whereNotIn/whereNull/whereNotNull/whereBetween/whereLike/whereILike`, `select`, `orderBy/latest/oldest`, `limit/take`, `offset/skip`, `join/leftJoin`, `increment/decrement`, `exists`, and passes anything else through to Knex with `toKnex()`.

## Relations

```ts
const post = await Post.query().with("author", "comments.author").first();

post.author; // User instance (eager loaded)
post.comments; // Comment[] with their authors loaded too
```

Relation builders on instances: `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` (pivot table), and the polymorphic family `morphTo`, `morphOne`, `morphMany`, `morphToMany`, `morphedByMany`. Relation existence queries: `has`, `whereHas`, `whereDoesntHave`, `orWhereHas`, `withCount`.

Polymorphic types are resolved through `MorphMap`:

```ts
import { MorphMap } from "@veap/core/database";

MorphMap.register({ post: Post, comment: Comment });
```

## Scopes

```ts
export class Post extends Model<PostAttributes> {
  static scopePublished(query: any) {
    return query.whereNotNull("published_at");
  }
  static scopePopular(query: any, min: number) {
    return query.where("views", ">=", min);
  }
}

await Post.query().published().popular(10).get(); // dynamic dispatch
await Post.scope("published").get(); // explicit
```

Global scopes apply to every query and can be excluded with `withoutGlobalScope(name)` / `withoutGlobalScopes()`; soft deletes are implemented as a global scope. `withTrashed()` / `onlyTrashed()` include or isolate deleted rows.

## Model events

Instance hook methods run before the corresponding bus events; returning `false` from a `-ing` hook cancels the operation:

```ts
export class Post extends Model<PostAttributes> {
  async saving() {
    // alias: beforeSave
    if (!this.slug && this.title) this.slug = slugify(this.title);
  }
  async deleted() {
    // alias: afterDelete
    // cleanup
  }
}
```

Hooks: `saving/saved`, `creating/created`, `updating/updated`, `deleting/deleted`, `restoring/restored`. Each also publishes `model:<event>` and `model:<event>:<table>` on the event bus with `{ model, event, table }`; see [Events](../fundamentals/events.md#model-lifecycle-events).

## Factories and seeders

```ts
import { Factory } from "@veap/core/database";

export class PostFactory extends Factory<Post> {
  model = Post;
  definition() {
    return {
      title: this.faker?.lorem.sentence() ?? "Sample post",
      slug: randomSlug(),
    };
  }
}

// model side
export class Post extends Model<PostAttributes> {
  static override newFactory() {
    return new PostFactory();
  }
}

// usage
const post = await Post.factory().create();
const posts = await Post.factory().count(10).create();
```

`Factory.getForModel` registry and seeders exist for seeding flows; the blog plugin's seeders are working examples.

## Serialization

`toJSON()` returns a plain object with both original and camelCase keys, includes loaded relations, and strips `hidden` attributes (plus their aliases). This is the right shape for passing data to Client Components or JSON responses. `refresh()` re-reads attributes from the database; `isDirty()` tracks local changes.
