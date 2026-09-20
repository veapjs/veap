# Contributing to Veap

Thank you for your interest in contributing to Veap.

Veap is a free and open-source framework for building modern web applications. Contributions of all kinds are welcome — from bug fixes and documentation improvements to new features, modules, tooling, and architectural proposals.

This guide explains how to contribute effectively and how the project is organized.

## 1. Before You Start

Before contributing, we recommend reading:

- [README](https://github.com/veap-sh/veap#readme)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [License](https://github.com/veap-sh/veap/blob/main/LICENSE.md)

For larger changes, please read the relevant documentation and existing implementation before opening a proposal.

## 2. Ways to Contribute

There are many ways to contribute to Veap.

You can:

- report bugs;
- propose new features;
- propose architectural changes;
- improve documentation;
- fix existing issues;
- improve performance;
- improve developer experience;
- add tests;
- improve CLI tooling;
- contribute framework packages;
- contribute modules or plugins;
- improve examples and templates;
- review pull requests;
- help other developers in community discussions.

Not every contribution needs to involve code.

## 3. Repository Structure

Veap is organized as a monorepo.

The exact structure may evolve, but the repository generally contains areas such as:

```text
veap/
├── packages/    # Core Veap packages
├── modules/     # Veap modules and plugins
├── templates/   # Application templates
├── examples/    # Example applications
├── docs/        # Documentation
├── scripts/     # Development and release tooling
├── .github/     # GitHub configuration
└── package.json
```

Before making a change, identify the smallest appropriate area of the repository for your contribution.

Avoid placing functionality in a package or module simply because it is convenient.

## 4. Development Environment

Veap uses Bun for repository development.

Make sure you have a current version of Bun installed before working on the repository.

Clone the repository:

```bash
git clone https://github.com/veap-sh/veap.git
cd veap
```

Install dependencies:

```bash
bun install
```

Run the development environment using the command documented by the repository.

Before submitting a pull request, make sure the repository can be installed, built, and tested successfully.

## 5. Branches

Create a dedicated branch for your work.

For example:

```bash
git checkout -b fix/router-error
# or:
git checkout -b feat/plugin-system
```

Avoid making unrelated changes on the same branch.

A branch should generally represent one logical change.

## 6. Issues First

For significant changes, start by opening or finding an existing issue.

This is especially important for:

- new framework features;
- public API changes;
- architectural changes;
- changes affecting multiple packages;
- breaking changes;
- new modules;
- changes to the plugin system;
- changes to the routing or rendering architecture.

Small fixes and documentation changes can usually go directly into a pull request.

## 7. Feature Requests

Feature requests should explain the problem rather than only describe the proposed implementation.

A useful feature request should answer:

- What problem does this solve?
- Who is affected by the problem?
- What is the expected behavior?
- Why is the current functionality insufficient?
- Are there alternative approaches?
- Would the change introduce a breaking change?

The implementation should generally follow from the problem rather than the other way around.

Use the project's Feature Request template when available.

## 8. RFC / Architecture Proposals

Architectural changes require additional discussion before implementation.

Use an RFC when a change affects:

- framework architecture;
- public APIs;
- package boundaries;
- module communication;
- plugin lifecycle;
- routing;
- rendering;
- data access;
- events;
- configuration;
- build tooling;
- runtime behavior;
- backwards compatibility.

### An RFC should describe:

- Problem
- Goals
- Non-goals
- Proposed design
- Alternatives considered
- API changes
- Migration strategy
- Compatibility considerations
- Security considerations
- Performance considerations

Do not begin a large architectural implementation before the direction has been discussed unless a maintainer has explicitly requested implementation.

## 9. Bug Reports

Before opening a bug report:

- Make sure you are using a supported version.
- Search existing issues.
- Reproduce the problem with the smallest possible example.
- Check whether the issue is caused by application code or Veap itself.

A useful bug report should include:

- Veap version;
- package or module involved;
- runtime and environment;
- operating system;
- package manager;
- reproduction steps;
- expected behavior;
- actual behavior;
- error messages;
- minimal reproduction when possible.

Avoid posting secrets, credentials, API keys, or private information.

Security vulnerabilities must not be reported through public issues. Follow the [Security Policy](./SECURITY.md).

## 10. Modules and Plugins

Veap is designed around a modular architecture.

New modules and plugins should be placed in `/modules/`.

Each module should have a clearly defined responsibility.

Avoid creating modules that combine unrelated functionality.

### Module principles

A module should:

- have a clearly defined purpose;
- expose a minimal public API;
- avoid unnecessary coupling;
- use documented Veap extension points;
- respect module boundaries;
- declare required dependencies;
- avoid modifying unrelated framework internals;
- provide tests where appropriate;
- provide documentation for public functionality.

### Module dependencies

If a module depends on another module, that dependency should be explicit.

For example:

```text
customers
   ↑
   │
 orders
```

An orders module should not silently assume that the customers module exists.

Dependencies should be declared and validated through the Veap module system.

### Sequential implementation

When implementing multiple modules for a feature, build and validate them one at a time.

Do not create a large set of partially implemented modules in a single change.

A typical implementation flow is:

```text
Module A → tests → integration → Module B → tests → integration
```

This keeps the architecture easier to review and prevents errors from propagating across multiple modules.

## 11. Core Packages

Changes to core Veap packages require additional care.

Before modifying a core package:

- understand its public API;
- inspect existing consumers;
- check package dependencies;
- consider backwards compatibility;
- add or update tests;
- document behavioral changes.

Avoid introducing framework-wide abstractions to solve a problem that can be solved locally.

Prefer the smallest architectural change that solves the underlying problem.

## 12. Public APIs

Once an API is publicly exposed, other projects may depend on it.

Before changing a public API, consider:

- backwards compatibility;
- type compatibility;
- runtime behavior;
- migration requirements;
- documentation;
- generated types;
- package consumers.

Breaking changes should be clearly documented and discussed before implementation.

## 13. Code Style

Follow the existing coding style of the project.

In general:

- use TypeScript for TypeScript code;
- prefer clear and explicit APIs;
- keep functions focused;
- avoid unnecessary abstractions;
- avoid duplicated logic;
- prefer composition over tightly coupled implementations;
- preserve strict typing;
- do not introduce any without a clear reason;
- keep public APIs minimal;
- write comments when they explain why, not obvious implementation details.

Do not reformat unrelated files as part of a feature or bug fix.

## 14. Testing

Changes should include appropriate tests.

Tests should cover behavior rather than implementation details whenever possible.

Depending on the change, this may include:

- unit tests;
- integration tests;
- framework tests;
- module tests;
- CLI tests;
- routing tests;
- build tests;
- type checks.

A bug fix should generally include a regression test demonstrating the previously broken behavior.

Before opening a pull request, run the project's validation commands.

For example:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Use the commands actually defined by the repository.

## 15. Documentation

Documentation is part of the feature.

If your change modifies public behavior, also update the relevant documentation.

Documentation changes may include:

- API documentation;
- guides;
- examples;
- configuration references;
- migration guides;
- module documentation;
- CLI documentation.

Do not leave a newly introduced public API undocumented.

## 16. Commit Messages

Write clear and focused commit messages.

Prefer:

```text
fix(router): handle missing route params
feat(cli): add module generation command
docs: improve plugin architecture guide
refactor(core): simplify module resolution
```

Keep commits focused on one logical change whenever practical.

Do not include unrelated formatting changes, generated files, or temporary debugging code.

## 17. Pull Requests

Pull requests should be focused and reviewable.

A good pull request should explain:

### What changed?
Describe the implementation.

### Why?
Explain the problem being solved.

### How?
Describe important implementation decisions.

### Testing
Explain how the change was tested.

### Breaking changes
Clearly identify any breaking changes.

### Related issues
Link related issues or RFCs.

Avoid submitting large pull requests containing unrelated changes.

## 18. Pull Request Checklist

Before submitting a pull request, verify:

- The change solves the intended problem.
- Existing functionality has not been unnecessarily changed.
- Tests have been added or updated where appropriate.
- Type checking passes.
- Linting passes.
- The project builds successfully.
- Documentation has been updated where necessary.
- No secrets or credentials are included.
- No unrelated files have been changed.
- Breaking changes are documented.
- The pull request description explains the change clearly.

## 19. Review Process

Pull requests may be reviewed for:

- correctness;
- architecture;
- API design;
- maintainability;
- performance;
- security;
- backwards compatibility;
- testing;
- documentation;
- consistency with Veap's design principles.

Maintainers may request changes before a pull request is merged.

Review comments should focus on the code and the proposed change, not on individuals.

## 20. Generated Files

Do not manually edit generated files unless the repository explicitly requires it.

If a generated file is committed to the repository, regenerate it using the project's documented tooling.

Changes to source files should generally be made in the source from which generated artifacts are produced.

## 21. Dependencies

New dependencies should be introduced only when they provide meaningful value.

Before adding a dependency, consider:

- whether the functionality can be implemented without it;
- package size;
- maintenance status;
- license;
- security history;
- runtime compatibility;
- browser/server compatibility;
- impact on the Veap ecosystem.

Avoid adding dependencies for trivial functionality.

## 22. Security

Do not disclose security vulnerabilities through public GitHub issues.

Follow the [Security Policy](./SECURITY.md) for responsible disclosure.

Never commit:

- passwords;
- API keys;
- private keys;
- access tokens;
- credentials;
- production secrets;
- private user data.

If you accidentally commit a secret, treat it as compromised and rotate it immediately.

## 23. Licensing

By contributing to Veap, you agree that your contribution may be distributed under the license applicable to the repository or component to which you contribute.

Before submitting substantial contributions, make sure you have the legal right to submit the work.

Do not submit code copied from projects with incompatible licenses.

If you are unsure about the licensing status of code, discuss it with the maintainers before submitting it.

## 24. Code of Conduct

All contributors are expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

Veap aims to maintain a respectful, constructive, and technically focused open-source community.

## 25. Questions

If you are unsure how something should be implemented, open a discussion or ask in the appropriate community channel before making a large change.

For security issues, always use the process described in the [Security Policy](./SECURITY.md).

## 26. Thank You

Every contribution helps improve Veap.

Whether you submit a small documentation fix, report a bug, improve performance, propose an architectural change, or build a new module, your contribution helps make the project better for the entire community.

Thank you for contributing to Veap.

Veap — Open-source framework for modern web applications.
