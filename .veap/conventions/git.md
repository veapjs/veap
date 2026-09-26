# Git and Workflow Conventions

To maintain a clean and easily parsable project history, this repository follows the **Conventional Commits** standard. AI Assistants operating in this repository must format their commit messages accordingly.

## Commit Format

```text
<type>(<scope>): <subject>

<body>
```

### Types

- `feat`: A new feature or plugin.
- `fix`: A bug fix.
- `docs`: Documentation changes (e.g., updating `.veap/` files).
- `style`: Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc).
- `refactor`: A code change that neither fixes a bug nor adds a feature.
- `perf`: A code change that improves performance.
- `test`: Adding missing tests or correcting existing tests.
- `chore`: Changes to the build process or auxiliary tools and libraries.

### Scope

In the Veap monorepo, the scope should generally be the name of the package or plugin being modified.
Example: `feat(auth-plugin): implement password reset`
Example: `fix(core): resolve topological sort issue in PluginRegistry`

## Pull Requests

- Keep PRs focused on a single architectural change or plugin feature.
- If introducing a breaking change to `@veap/framework`, an ADR MUST be proposed and accepted in `.veap/decisions/` prior to merging.
