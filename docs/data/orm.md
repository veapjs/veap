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

## Polymorphic relations

Polymorphic relations allow a model to belong to more than one other model on a single association. Veap uses `MorphMap` to decouple database type strings from TypeScript class names.

### 1. Registering the MorphMap

Register polymorphic aliases at application or plugin initialization (e.g. in `init()` or `lib/veap.ts`), or define `static override morphAlias` on the model:

```ts
import { MorphMap } from "@veap/core/database";
import { Post } from "./models/post";
import { Video } from "./models/video";
import { Comment } from "./models/comment";

MorphMap.register({
  post: Post,
  video: Video,
  comment: Comment,
});
```

### 2. One-to-many polymorphic (`morphMany` / `morphTo`)

Suppose both `Post` and `Video` models can have multiple `Comment` records.

#### Migration schema

The child table needs an ID column and a type string column (snake_case convention):

```ts
// migrations/0002_create_comments.ts
await schema.createTable("comments", (table) => {
  table.uuid("id").primary();
  table.text("body").notNullable();
  table.uuid("commentable_id").notNullable();
  table.string("commentable_type").notNullable();
  table.timestamps(true, true);

  table.index(["commentable_type", "commentable_id"]);
});
```

#### Child model (`Comment`)

The child model calls `this.morphTo(name)` using the polymorphic prefix (`commentable`):

```ts
import { Model } from "@veap/core/database";

export interface CommentAttributes {
  id: string;
  body: string;
  commentableId: string;
  commentableType: string;
}

export class Comment extends Model<CommentAttributes> {
  static override table = "comments";
  static override fillable = ["body", "commentable_id", "commentable_type"];

  commentable() {
    return this.morphTo("commentable");
  }
}
```

#### Parent models (`Post` and `Video`)

The parent models call `this.morphMany(RelatedModel, name)`:

```ts
import { Model } from "@veap/core/database";
import { Comment } from "./comment";

export class Post extends Model<PostAttributes> {
  static override table = "posts";
  static override morphAlias = "post";

  comments() {
    return this.morphMany(Comment, "commentable");
  }
}

export class Video extends Model<VideoAttributes> {
  static override table = "videos";
  static override morphAlias = "video";

  comments() {
    return this.morphMany(Comment, "commentable");
  }
}
```

### 3. Many-to-many polymorphic (`morphToMany` / `morphedByMany`)

Suppose both `Post` and `Product` models share `Tag` records through a shared pivot table `taggables`.

#### Pivot migration schema

```ts
// migrations/0003_create_tags_and_taggables.ts
await schema.createTable("tags", (table) => {
  table.uuid("id").primary();
  table.string("name").notNullable();
  table.string("slug").unique().notNullable();
  table.timestamps(true, true);
});

await schema.createTable("taggables", (table) => {
  table
    .uuid("tag_id")
    .notNullable()
    .references("id")
    .inTable("tags")
    .onDelete("CASCADE");
  table.uuid("taggable_id").notNullable();
  table.string("taggable_type").notNullable();

  table.primary(["tag_id", "taggable_id", "taggable_type"]);
  table.index(["taggable_type", "taggable_id"]);
});
```

#### Defining the relation on models

The parent models declare `this.morphToMany(Tag, name)`:

```ts
import { Model } from "@veap/core/database";
import { Tag } from "./tag";

export class Post extends Model<PostAttributes> {
  static override table = "posts";
  static override morphAlias = "post";

  tags() {
    return this.morphToMany(Tag, "taggable");
  }
}
```

The tag model declares `this.morphedByMany(TargetModel, name)`:

```ts
import { Model } from "@veap/core/database";
import { Post } from "./post";

export class Tag extends Model<TagAttributes> {
  static override table = "tags";
  static override fillable = ["name", "slug"];

  posts() {
    return this.morphedByMany(Post, "taggable");
  }
}
```

### 4. Querying and eager loading polymorphic relations

Eager load polymorphic relations with `.with()`:

```ts
// Eager load comments and tags on posts
const post = await Post.query()
  .with("comments", "tags")
  .where("id", postId)
  .first();

console.log(post.comments); // Comment[]
console.log(post.tags); // Tag[]

// Eager load the polymorphic parent on comments
const comment = await Comment.query().with("commentable").first();

console.log(comment.commentable); // Post or Video instance!
```

### 4. Querying and filtering by relations

Filter models based on the existence, absence, or criteria of their relations (including polymorphic relations):

```ts
// 1. Filter by existence
const postsWithComments = await Post.query().has("comments").get();
const postsWithManyTags = await Post.query().has("tags", ">=", 3).get();

// 2. Filter with criteria (whereHas)
const activeDiscussions = await Post.query()
  .whereHas("comments", (q) => {
    q.where("approved", true).where("created_at", ">=", oneWeekAgo);
  })
  .get();

// 3. Filter by absence (whereDoesntHave)
const unassignedTags = await Tag.query().whereDoesntHave("posts").get();

// 4. Combined with OR conditions
const featuredOrCommented = await Post.query()
  .where("featured", true)
  .orWhereHas("comments", (q) => q.where("rating", 5))
  .get();
```

Eager load polymorphic relations with `.with()`:

```ts
// Eager load comments and tags on posts in single batch queries
const post = await Post.query()
  .with("comments", "tags")
  .where("id", postId)
  .first();

console.log(post.comments); // Comment[]
console.log(post.tags); // Tag[]

// Eager load the polymorphic parent on comments (resolves to Post or Video)
const comments = await Comment.query().with("commentable").limit(20).get();
for (const c of comments) {
  console.log(c.commentable); // Post or Video instance
}
```

## Attribute casting (`casts`)

Veap models support declarative attribute casting via the `static casts` dictionary. This handles serialization when writing to the database and deserialization when reading into model instances across both SQLite and PostgreSQL.

```ts
import { Model, type CastType } from "@veap/core/database";

export interface ProductAttributes {
  id: string;
  title: string;
  price: number;
  metadata: Record<string, any>;
  tags: string[];
  isAvailable: boolean;
  publishedAt: Date | null;
}

export class Product extends Model<ProductAttributes> {
  static override table = "products";

  static override casts: Record<string, CastType> = {
    price: "number",
    metadata: "json",
    tags: "json",
    isAvailable: "boolean",
    publishedAt: "datetime",
  };
}
```

### Supported cast types

| Cast Type    | Read Behavior                                               | Write Behavior                                                     |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `"json"`     | Automatically parses JSON strings into JS objects/arrays    | `JSON.stringify` automatically applied for SQLite and PostgreSQL   |
| `"boolean"`  | Converts `1`, `"1"`, `true`, `"true"` to boolean `true`     | Serializes to `1`/`0` on SQLite, boolean literal on PostgreSQL     |
| `"datetime"` | Converts ISO strings and UNIX timestamps into native `Date` | Formatted to ISO string for SQLite, native `Date` for PostgreSQL   |
| `"date"`     | Converts date string or timestamp into native `Date`        | Date formatted ISO string for SQLite, native `Date` for PostgreSQL |
| `"number"`   | Parses numeric strings into `number` (falls back if `NaN`)  | Numeric value passed directly to database driver                   |
| `"string"`   | Converts primitives to string representation                | String passed directly to database driver                          |

Columns ending in `_count` (e.g. from `withCount`) are automatically cast to `number`.

## Scopes and soft deletes

### Local scopes

Define local query shortcuts by prefixing static methods with `scope`:

```ts
export class Post extends Model<PostAttributes> {
  static scopePublished(query: ModelQueryBuilder) {
    return query
      .whereNotNull("published_at")
      .where("published_at", "<=", new Date());
  }

  static scopePopular(query: ModelQueryBuilder, minViews = 100) {
    return query.where("views", ">=", minViews);
  }
}

// Chained through dynamic query builder dispatch:
const popularPosts = await Post.query().published().popular(500).get();

// Or called explicitly:
const posts = await Post.scope("published").get();
```

### Global scopes

Global scopes apply automatically to all queries executed on the model:

```ts
// Apply a multi-tenant scope
Post.addGlobalScope("tenant", (query) => {
  query.where("tenant_id", currentTenantId);
});

// Remove a specific global scope for administrative queries:
const allPosts = await Post.query().withoutGlobalScope("tenant").get();

// Remove all global scopes:
const rawPosts = await Post.query().withoutGlobalScopes().get();
```

### Soft deletes

Soft deleting marks records as deleted using a timestamp instead of physically removing rows from the database.

1. Add the column in your migration:

```ts
await schema.createTable("posts", (table) => {
  table.uuid("id").primary();
  table.string("title").notNullable();
  table.timestamps(true, true);
  table.softDeletes(); // adds nullable "deleted_at" timestamp
});
```

2. Enable soft deletes on the model:

```ts
export class Post extends Model<PostAttributes> {
  static override table = "posts";
  static override softDeletes = true; // default deletedAt column is "deleted_at"
  // static override deletedAtColumn = "custom_deleted_at"; // optional override
}
```

3. Managing soft-deleted records:

```ts
const post = await Post.find(postId);

// Soft delete: sets deleted_at = new Date()
await post.delete();
console.log(post.trashed()); // true

// Restore soft-deleted record: sets deleted_at = null
await post.restore();
console.log(post.trashed()); // false

// Permanent deletion: executes physical DELETE query
await post.forceDelete();
```

4. Querying soft-deleted records:

By default, queries exclude soft-deleted records (`WHERE deleted_at IS NULL`). Use helper methods to include or isolate them:

```ts
// Include both active and soft-deleted rows:
const all = await Post.query().withTrashed().get();

// Retrieve only soft-deleted rows:
const trashed = await Post.query().onlyTrashed().get();

// Bulk soft delete:
await Post.query().where("status", "archived").delete();

// Bulk permanent force delete:
await Post.query().onlyTrashed().forceDelete();
```

## Model lifecycle hooks and transactions

Veap models support lifecycle hooks that run before and after database persistence operations.

### Hook methods

```ts
export class Post extends Model<PostAttributes> {
  // Before hooks - return false to abort the operation:
  async saving() {
    // Called before both create and update
    if (!this.slug && this.title) {
      this.slug = slugify(this.title);
    }
  }

  async creating() {
    // Called only before initial insert
    if (!this.author_id) {
      return false; // Aborts creation!
    }
  }

  async updating() {
    // Called only before updating an existing record
  }

  async deleting() {
    // Return false to prevent deletion
    if (this.is_protected) return false;
  }

  // After hooks - execute side effects:
  async saved() {
    // Cache invalidation or metrics
  }

  async created() {
    // Trigger welcome notifications
  }

  async deleted() {
    // Clean up associated file storage or remote references
  }
}
```

Aliases supported: `beforeSave` / `afterSave`, `beforeCreate` / `afterCreate`, `beforeUpdate` / `afterUpdate`, `beforeDelete` / `afterDelete`, `beforeRestore` / `afterRestore`.

### Atomic transactions with AsyncLocalStorage

Every database mutation in Veap should be executed inside `transaction()` from `@veap/core/database`. Node's `AsyncLocalStorage` implicitly propagates the active transaction context to all queries and model instances without manual parameter passing:

```ts
import { transaction } from "@veap/core/database";
import { Post } from "./models/post";
import { Tag } from "./models/tag";

export async function publishArticleWithTags(
  data: PostInput,
  tagNames: string[],
) {
  return await transaction(async (trx) => {
    // 1. Create post (automatically joins active transaction)
    const post = await Post.create({
      title: data.title,
      body: data.body,
      status: "published",
    });

    // 2. Attach tags
    for (const name of tagNames) {
      const tag = await Tag.firstOrCreate({ name });
      await post.tags().attach(tag.id);
    }

    // If any lifecycle hook returns false, or if an unhandled error is thrown,
    // the entire transaction is rolled back automatically.
    return post;
  });
}
```

## Model traits and mixins

In complex applications, multiple domain models across separate plugins often need identical functionality, such as polymorphic commenting, tagging, categorizing, or auditing. Because TypeScript and JavaScript only support single class inheritance, Veap implements the **functional class mixin pattern** (often referred to as **traits**).

Traits allow you to package relations, query builder methods, and domain helpers into reusable functions that wrap any base `Model` class.

### The trait anatomy

A standard Veap trait consists of three components:

1. **An interface:** Defines the instance methods added by the trait for TypeScript autocompletion.
2. **A query builder extension:** Adds domain query filters (such as `.withComments()` or `.whereHasComments()`).
3. **A mixin function:** Accepts a base class `TBase extends Constructor<Model>` and returns an extended class with attached methods and polymorphic relations.

Here is how `@veap/commentable` implements the `Commentable` trait:

```ts
import { Model, ModelQueryBuilder, type MorphMany } from "@veap/core/database";
import { Comment } from "../models/Comment";

export type Constructor<T = {}> = new (...args: any[]) => T;

export interface ICommentableModel {
  comments(): MorphMany<any, Comment>;
  approvedComments(): Promise<Comment[]>;
  addComment(attributes: {
    content: string;
    authorId?: string | null;
    authorName?: string | null;
    authorEmail?: string | null;
    parentId?: string | null;
    status?: "pending" | "approved" | "spam" | "rejected" | "trash";
  }): Promise<Comment>;
}

export function mixinCommentableQueryMethods<T extends any>(builder: T): T {
  const b = builder as any;
  b.whereHasComments = function () {
    return this.whereHas("comments");
  };
  b.withComments = function () {
    return this.with("comments");
  };
  return builder;
}

export function Commentable<TBase extends Constructor<Model>>(Base: TBase) {
  return class extends Base {
    static override query<M extends Model>(this: any): any {
      const q = (Base as any).query
        ? (Base as any).query.call(this)
        : super.query();
      return mixinCommentableQueryMethods(q);
    }

    comments(): MorphMany<any, Comment> {
      return (this as any).morphMany(Comment, "commentable");
    }

    async approvedComments(): Promise<Comment[]> {
      return await (this as any)
        .comments()
        .query()
        .where("status", "approved")
        .get();
    }

    async addComment(attributes: {
      content: string;
      authorId?: string | null;
      authorName?: string | null;
      authorEmail?: string | null;
      parentId?: string | null;
      status?: "pending" | "approved" | "spam" | "rejected" | "trash";
    }): Promise<Comment> {
      const comment = new Comment();
      const morphClass = this.constructor as typeof Model;
      const morphType = morphClass.morphAlias || morphClass.table;

      comment.setAttribute("commentable_type", morphType);
      comment.setAttribute("commentable_id", (this as any).id);
      comment.setAttribute("content", attributes.content);
      comment.setAttribute("status", attributes.status ?? "approved");
      if (attributes.authorId)
        comment.setAttribute("author_id", attributes.authorId);
      if (attributes.authorName)
        comment.setAttribute("author_name", attributes.authorName);
      if (attributes.authorEmail)
        comment.setAttribute("author_email", attributes.authorEmail);
      if (attributes.parentId)
        comment.setAttribute("parent_id", attributes.parentId);

      await comment.save();
      return comment;
    }
  };
}
```

### Composing multiple traits in models

Because traits are standard higher-order functions, you can compose multiple behaviors onto a single model by wrapping them in sequence.

For example, in `blog-plugin`, the `BlogPost` model composes commenting (`@veap/commentable`), categorizing (`@veap/categorizable`), tagging (`@veap/taggable`), and translations (`@veap/translatable`):

```ts
import { Model, type CastType } from "@veap/core/database";
import { Commentable } from "@veap/commentable";
import { Categorizable } from "@veap/categorizable";
import { Taggable } from "@veap/taggable";
import { TranslatableModel } from "@veap/translatable";
import { User } from "@veap/core/auth/models";

export interface BlogPostAttributes {
  id: string;
  views?: number;
  status: "draft" | "published" | "archived";
  authorId: string;
  publishedAt?: Date | null;
  title?: string;
  slug?: string;
  content?: string;
}

export class BlogPost extends Commentable(
  Categorizable(Taggable(TranslatableModel<BlogPostAttributes>)),
) {
  static override table = "blog_posts";
  static override morphAlias = "post"; // Decouples polymorphic foreign keys from table names

  static override casts: Record<string, CastType> = {
    views: "number",
    publishedAt: "datetime",
  };

  author() {
    return this.belongsTo(User, "author_id");
  }
}
```

### Using trait methods and queries

Once composed, all methods and relation queries from every applied trait are immediately available on model instances and query builders:

```ts
// 1. Querying with trait scopes and eager loading
const posts = await BlogPost.query().withComments().whereHasComments().get();

// 2. Interacting with instance methods added by traits
const post = await BlogPost.findOrFail(postId);

// Added by @veap/commentable:
await post.addComment({
  content: "Excellent overview of traits!",
  authorId: user.id,
});
const comments = await post.approvedComments();

// Added by @veap/taggable:
await post.attachTag("architecture");

// Added by @veap/categorizable:
await post.syncCategories(["engineering", "backend"]);
```

### Polymorphic stability with `morphAlias`

When using polymorphic traits, the child table (for example, `comments`) stores both the target entity ID (`commentable_id`) and the target entity type (`commentable_type`).

By default, traits use `Model.table` (for example, `"blog_posts"`). However, if you later rename the table, all existing records in `comments` would become detached. Setting `static override morphAlias = "post"` guarantees that the polymorphic column consistently stores `"post"`, protecting your database references against table renames.

### Creating a custom trait

To create a new reusable trait for your own plugins (for example, a `Likeable` trait):

```ts
// packages/my-plugin/src/traits/Likeable.ts
import { Model, type MorphMany } from "@veap/core/database";
import { Like } from "../models/Like";

export type Constructor<T = {}> = new (...args: any[]) => T;

export function Likeable<TBase extends Constructor<Model>>(Base: TBase) {
  return class extends Base {
    likes(): MorphMany<any, Like> {
      return (this as any).morphMany(Like, "likeable");
    }

    async isLikedBy(userId: string): Promise<boolean> {
      const count = await (this as any)
        .likes()
        .query()
        .where("user_id", userId)
        .count();
      return count > 0;
    }

    async toggleLike(userId: string): Promise<boolean> {
      const existing = await (this as any)
        .likes()
        .query()
        .where("user_id", userId)
        .first();

      if (existing) {
        await existing.delete();
        return false;
      }

      const like = new Like();
      const morphClass = this.constructor as typeof Model;
      like.setAttribute(
        "likeable_type",
        morphClass.morphAlias || morphClass.table,
      );
      like.setAttribute("likeable_id", (this as any).id);
      like.setAttribute("user_id", userId);
      await like.save();
      return true;
    }
  };
}
```

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
