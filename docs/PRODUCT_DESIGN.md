# Context Injector - Product Design

## Vision

A CLI tool to manage and inject AI coding contexts across projects. Open source, decentralized, using Git URLs for sharing.

## Supported Tools (v1)

| Tool | Config File | Location |
|------|-------------|----------|
| Claude Code | `CLAUDE.md` | Project root |
| GitHub Copilot | `copilot-instructions.md` | `.github/` |
| Kilo Code | `kilo.md` | Project root or `.kilo/` |
| OpenCode | `opencode.md` | Project root |
| OpenAI Codex | `AGENTS.md` | Project root |

## Core Concepts

### 1. Context Source

Any Git repository containing context files. Identified by URL:

```
github.com/org/repo
github.com/org/monorepo/path/to/context
gitlab.com/team/rules
```

### 2. Context Package Structure

```
my-context/
├── context.yaml          # Metadata & dependencies
├── index.md              # Summary (always loaded)
├── details/              # Detailed contexts (loaded on demand)
│   ├── code-style.md
│   ├── architecture.md
│   └── testing.md
└── tools/                # Tool-specific overrides (optional)
    ├── claude.md         # Claude-specific additions
    └── copilot.md        # Copilot-specific additions
```

### 3. context.yaml Schema

```yaml
name: frontend-standards
version: 2.1.0
description: Frontend development standards

# Dependencies on other contexts
depends:
  - github.com/company/base-standards@^1.0
  - github.com/company/typescript-rules@^2.0

# What to include in the summary (index.md is always included)
summary:
  - details/code-style.md#quick-reference    # Specific section

# Tags for discovery and smart loading
tags:
  - frontend
  - react
  - typescript
```

## Tags System

Tags enable discovery, smart recommendations, and intelligent context loading.

### Tag Categories

| Category | Example Tags | Purpose |
|----------|--------------|---------|
| **Platform** | `frontend`, `backend`, `mobile`, `devops` | Broad categorization |
| **Framework** | `react`, `vue`, `express`, `django`, `spring` | Framework-specific |
| **Language** | `typescript`, `python`, `go`, `rust` | Language-specific |
| **Domain** | `payments`, `auth`, `ml`, `data-pipeline` | Business domain |
| **Practice** | `testing`, `security`, `performance`, `accessibility` | Cross-cutting concerns |

### Usage 1: Search & Discovery

**Search requires configured sources.** There's no central registry - you configure where to search.

**Configure search sources (global or per-project):**

```yaml
# ~/.config/ctx/config.yaml (global)
# or .context/manifest.yaml (per-project)

registries:
  - github.com/techcorp/context-catalog       # Company catalog
  - github.com/awesome-contexts/community     # Community catalog
```

**Catalog repo structure:**

A catalog is just a repo with an `index.yaml`:

```yaml
# github.com/techcorp/context-catalog/index.yaml
contexts:
  - url: github.com/techcorp/engineering-standards
    tags: [typescript, testing, general]
    description: "Company-wide engineering standards"

  - url: github.com/techcorp/backend-standards
    tags: [backend, express, node, api]
    description: "Backend development patterns"

  - url: github.com/techcorp/frontend-standards
    tags: [frontend, react, typescript]
    description: "Frontend development patterns"

  - url: github.com/techcorp/payment-patterns
    tags: [payments, fintech, retry]
    description: "Payment processing patterns"
```

**Search commands:**

```bash
# Search configured registries
ctx search --tag react
ctx search --tag backend --tag typescript

# Search specific registry
ctx search --tag payments --registry github.com/techcorp/context-catalog

# List installed contexts by tag (always works, no registry needed)
ctx list --tag frontend
```

**Alternative: GitHub Topics (optional)**

Contexts can use GitHub topics for discovery:

```bash
# Search GitHub for repos with 'ctx-context' topic + your tags
ctx search --github --tag react
```

Requires context repos to have `ctx-context` GitHub topic.

### Usage 2: Smart Recommendations

When initializing a project, `ctx` can analyze and suggest:

```bash
ctx init --detect
```

Output:
```
Detected project characteristics:
  ✓ TypeScript (tsconfig.json)
  ✓ React (react in package.json)
  ✓ Testing with Jest

Recommended contexts:
  github.com/techcorp/engineering-standards    [typescript]
  github.com/techcorp/frontend-standards       [react, frontend]
  github.com/techcorp/testing-practices        [testing, jest]

Add all? (y/n)
```

### Usage 3: Agent Smart Loading

In the generated config, tags help agents decide what to read:

```markdown
## Available Contexts

| Topic | Tags | File |
|-------|------|------|
| React Patterns | `react`, `frontend` | `.context/.../react.md` |
| API Design | `backend`, `api` | `.context/.../api.md` |
| Security | `security` | `.context/.../security.md` |

**Reading Strategy:**
- Working on React components → prioritize `react`, `frontend` tags
- Designing APIs → prioritize `backend`, `api` tags
- Reviewing auth code → include `security` tag contexts
```

### Usage 4: Manifest Tag Filtering

Projects can declare their type to filter irrelevant contexts:

```yaml
# manifest.yaml
project:
  tags:
    - frontend
    - react
    - typescript

sources:
  - github.com/techcorp/engineering-standards@^2.0
  - github.com/techcorp/fullstack-patterns@^1.0   # has both frontend & backend

# When generating, only include content tagged with project's tags
generate:
  filter_by_project_tags: true  # Ignore backend-specific sections
```

### Usage 5: Context Compatibility

Warn on potential mismatches:

```bash
ctx add github.com/techcorp/ios-patterns
```

Output:
```
⚠ Warning: This context is tagged [ios, swift, mobile]
  Your project appears to be [web, react, typescript]

Add anyway? (y/n)
```

### Tag Inheritance

Contexts can inherit tags from dependencies:

```yaml
# frontend-standards/context.yaml
name: frontend-standards
tags:
  - frontend
  - web
depends:
  - github.com/techcorp/engineering-standards  # inherits its tags too
```

When loaded, effective tags = own tags + dependency tags.

## Dependency Resolution

### Deduplication Strategy

```
Project depends on:
  ├── github.com/company/frontend@2.0
  │   └── depends: github.com/company/base@^1.0  → resolves to 1.2.0
  └── github.com/company/backend@3.0
      └── depends: github.com/company/base@^1.0  → reuses 1.2.0

Result: base@1.2.0 installed once
```

### Version Resolution Rules

1. Exact match: `@1.2.3` → use exactly 1.2.3
2. Semver range: `@^1.0` → latest compatible (1.x.x)
3. Branch: `@main` → latest commit on main
4. Commit: `@a1b2c3d` → exact commit
5. No version: → latest release tag, or main if no tags

### Conflict Handling

```yaml
# If incompatible versions required:
# frontend needs base@^1.0
# legacy-tool needs base@^0.9

# Error with resolution options:
ctx install
# Error: Conflicting versions for github.com/company/base
#   - frontend@2.0 requires base@^1.0
#   - legacy-tool@1.0 requires base@^0.9
#
# Solutions:
#   1. ctx add github.com/company/base@1.0 --force
#   2. Update legacy-tool to support base@^1.0
```

## Progressive Context Loading

### Design Principle

**Don't dump everything into the config file.** Instead:
1. Provide a **summary** with essential rules
2. Provide an **index** of available detailed contexts
3. Let agents **fetch details on demand**

### Generated CLAUDE.md Structure

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code).

## Context Sources

This project uses [context-manager](https://github.com/user/context-manager).
Contexts are located in `.context/packages/`.

## Quick Reference

<!-- Auto-merged from all index.md files -->
[Essential rules that apply to most tasks]

## Available Contexts

When you need detailed guidance, read the relevant files:

| Topic | File | Description |
|-------|------|-------------|
| Code Style | `.context/packages/base/details/code-style.md` | Formatting, naming conventions |
| React Patterns | `.context/packages/frontend/details/react.md` | Component patterns, hooks |
| API Design | `.context/packages/backend/details/api.md` | REST conventions, error handling |
| Testing | `.context/packages/base/details/testing.md` | Test structure, coverage |

## Project-Specific Rules

<!-- Content from local ./context.md if exists -->
```

### How Agents Use This

1. **Always loaded**: Quick Reference section
2. **On-demand**: Agent reads specific files when:
   - Working on React components → reads `react.md`
   - Designing API → reads `api.md`
   - Writing tests → reads `testing.md`

### Agent-Driven Context Evolution

Agents can **automatically improve contexts** during normal workflow:

**Triggers for Context Updates:**

| Trigger | Example | Action |
|---------|---------|--------|
| **Outdated info** | Context says "use React 17" but project uses React 19 | Agent proposes update |
| **Missing pattern** | Agent discovers a useful pattern not documented | Agent adds to context |
| **Incorrect rule** | Rule causes issues in practice | Agent suggests correction |
| **New best practice** | Agent learns something from user feedback | Agent captures knowledge |

**Agent Instruction (included in generated config):**

```markdown
## Context Contribution

These contexts are **editable**. When you notice:
- Outdated information
- Missing patterns that would help future work
- Rules that don't work well in practice
- New best practices discovered during this session

You should:
1. Edit the relevant context file in `.context/packages/`
2. Briefly explain the change to the user
3. The change will be staged for review

Example:
"I noticed the API error handling guide is missing the new retry pattern we just implemented.
I've updated `.context/packages/.../api.md` to include it.
Run `ctx status` to review pending context changes."
```

**Workflow Integration:**

```
User: "Help me implement retry logic for API calls"
│
Agent: [Reads .context/packages/.../api.md]
│
Agent: [Implements retry logic]
│
Agent: [Realizes this pattern should be documented]
│
Agent: [Edits .context/packages/.../api.md to add retry pattern]
│
Agent: "Done! I also updated the API context with this retry pattern
        so future work can reference it."
│
└─→ User can: ctx status → ctx push (when ready)
```

**Auto-Sensing Context Updates:**

When agent completes certain tasks, it should consider context updates:

| Task Type | Context Check |
|-----------|---------------|
| Bug fix | "Should error handling docs be updated?" |
| New feature | "Is there a pattern here worth documenting?" |
| Refactoring | "Did we establish a new convention?" |
| Code review | "Are the coding standards still accurate?" |

**Safety Guardrails:**

1. **User visibility** - Always tell user what was changed
2. **No auto-push** - Changes stay local until user runs `ctx push`
3. **Diff review** - User can `ctx diff` before pushing
4. **Revert easy** - `ctx reset <package>` discards local changes

### Instruction to Agents

The generated config includes:

```markdown
## How to Use Contexts

When working on specific areas, read the relevant context files listed above.
For example:
- Before refactoring React code, read the React Patterns context
- Before designing APIs, read the API Design context
- When unsure about conventions, check the Code Style context

You have full access to these files via the Read tool.
```

## CLI Commands

### Initialize

#### Initialize Project Context Manager

```bash
ctx init
# Creates:
#   .context/
#   ├── manifest.yaml
#   └── .gitignore
```

#### Initialize New Context Repository

```bash
# Interactive mode - prompts for all options
ctx init --context

# Quick personal context
ctx init --context --type personal

# Quick organizational context
ctx init --context --type organizational

# Full customization
ctx init --context \
  --type organizational \
  --name "engineering-standards" \
  --description "Company-wide engineering standards" \
  --org "techcorp" \
  --tags "general,typescript,testing"
```

**Interactive Prompts:**

```
? Context type: (Use arrow keys)
❯ Personal - For individual use or small teams
  Organizational - For company-wide standards

? Context name: engineering-standards

? Description: Company-wide engineering standards

? Organization/Owner: techcorp

? Tags (comma-separated): general, typescript, testing, security

? License: (Use arrow keys)
❯ MIT
  Apache-2.0
  ISC
  Unlicense
  Proprietary

? Initialize Git repository? (Y/n) y

? Add GitHub topic 'ctx-context'? (Y/n) y
```

**Generated Structure:**

```
engineering-standards/
├── context.yaml          # Context metadata
├── index.md              # Summary (always loaded)
├── details/              # Detailed contexts (optional)
│   ├── code-style.md
│   ├── testing.md
│   └── .gitkeep
├── tools/                # Tool-specific overrides (optional)
│   ├── claude.md
│   └── copilot.md
├── .gitignore
├── README.md             # Usage guide
└── LICENSE               # Based on selection
```

**Generated context.yaml (Organizational):**

```yaml
name: engineering-standards
version: 0.1.0
type: organizational
organization: techcorp
description: Company-wide engineering standards

# Dependencies on other contexts
depends: []
  # - github.com/awesome-contexts/base-standards@^1.0

# What to include in the summary (index.md is always included)
summary: []
  # - details/code-style.md#quick-reference
  # - details/testing.md#test-structure

# Tags for discovery and smart loading
tags:
  - general
  - typescript
  - testing
  - security

# License
license: MIT

# Maintainers
maintainers:
  - name: Your Name
    email: you@techcorp.com
    github: yourusername
```

**Generated context.yaml (Personal):**

```yaml
name: my-coding-standards
version: 0.1.0
type: personal
author: Your Name
description: My personal coding standards and preferences

depends: []
summary: []

tags:
  - personal
  - preferences

license: MIT
```

**Generated index.md:**

```markdown
# Engineering Standards

> Company-wide engineering standards

## Quick Reference

Add your essential rules here that should always be loaded.

Example:
- Use TypeScript strict mode
- Write tests for all public APIs
- Follow conventional commits

## Detailed Guides

For comprehensive documentation, see:
- [Code Style](details/code-style.md)
- [Testing Practices](details/testing.md)

Add more documents in the `details/` folder.
```

**Generated README.md:**

```markdown
# Engineering Standards

Company-wide engineering standards

## Installation

Add this context to your project:

```bash
ctx add github.com/techcorp/engineering-standards
```

## Contents

- **index.md** - Essential standards (always loaded)
- **details/** - Detailed documentation (loaded on demand)
  - code-style.md - Coding style guidelines
  - testing.md - Testing practices

## Usage

After adding this context, AI assistants will automatically:
1. Follow the standards in `index.md` for all tasks
2. Read detailed guides when working on specific areas

## Contributing

To suggest improvements:

1. Fork this repository
2. Make your changes
3. Submit a pull request

Or use `ctx push` from your project:

```bash
# Edit the context locally in your project
vim .context/packages/github.com/techcorp/engineering-standards/index.md

# Push changes back
ctx push github.com/techcorp/engineering-standards
```

## License

MIT
```

**Output:**

```
✓ Created context.yaml
✓ Created index.md
✓ Created details/.gitkeep
✓ Created tools/.gitkeep
✓ Created README.md
✓ Created LICENSE
✓ Created .gitignore
✓ Initialized Git repository

Next steps:
  1. Edit index.md to add your essential standards
  2. Add detailed docs in details/ folder
  3. Create a GitHub repository:
     
     gh repo create techcorp/engineering-standards --public
     git remote add origin git@github.com:techcorp/engineering-standards.git
     git add .
     git commit -m "Initial context"
     git push -u origin main
     
  4. Tag your first release:
     
     git tag v0.1.0
     git push --tags
     
  5. Share with your team:
     
     ctx add github.com/techcorp/engineering-standards

Learn more: https://github.com/context-manager/docs
```

### Add Context

```bash
ctx add github.com/company/standards
ctx add github.com/company/frontend@v2.0
ctx add github.com/company/monorepo/contexts/react
```

### Install

```bash
ctx install                  # Install all dependencies
ctx install --frozen         # Use exact versions from lock file

# Process:
# 1. Resolve dependency tree
# 2. Deduplicate
# 3. Download to .context/packages/
# 4. Generate config files (CLAUDE.md, etc.)
```

### Upgrade

```bash
ctx upgrade                           # Upgrade all
ctx upgrade github.com/company/base   # Upgrade specific
ctx upgrade --latest                  # Ignore semver, get latest
```

### Generate

```bash
ctx generate                 # Regenerate all config files
ctx generate --target claude # Only CLAUDE.md
ctx generate --target copilot
ctx generate --target kilo
ctx generate --target opencode
ctx generate --target codex  # Only AGENTS.md
```

### Sync (Push Changes Back)

**Core Principle:** Leverage Git natively. Each context in `.context/packages/` is a Git repo (or sparse checkout).

**Local Editing:**

Users edit files directly in `.context/packages/`:
```bash
# Edit context file directly
vim .context/packages/github.com/company/base/details/code-style.md
```

**View Changes (uses Git):**

```bash
ctx diff                                 # Show all local changes (git diff)
ctx diff github.com/company/base        # Show changes for specific context
ctx status                               # Show modified contexts (git status)
```

**Push to Remote:**

```bash
ctx push github.com/company/base
# → Creates branch: ctx/<project-name>/<timestamp>
# → Pushes changes
# → Creates PR
# → Returns PR URL

# With custom branch name
ctx push github.com/company/base --branch fix-typo

# Push all modified contexts
ctx push --all
```

**Push Flow:**

```
ctx push github.com/company/base
│
├─→ 1. Create local branch: ctx/my-webapp/20240115-103000
│
├─→ 2. Commit local changes
│
├─→ 3. Try to push
│      ├─ Success → Create PR → Return PR URL
│      └─ Failed  → "Error: No push access to github.com/company/base.
│                    Fork the repo first, then update manifest to use your fork."
│
└─→ Done
```

**Branch Naming Convention:**

```
ctx/<project-name>/<timestamp>

Examples:
- ctx/my-webapp/20240115-103000
- ctx/backend-api/20240120-142530
```

### Other

```bash
ctx list                     # List installed contexts
ctx tree                     # Show dependency tree
ctx why <package>            # Why is this package installed
ctx outdated                 # Show available updates
ctx reset <package>          # Discard local changes (git checkout)
ctx reset --all              # Discard all local changes
ctx cache clean              # Clear download cache
```

## File Structure in Project

```
my-project/
├── .context/
│   ├── manifest.yaml           # User-declared dependencies
│   ├── lock.yaml               # Resolved versions (auto-generated)
│   └── packages/               # Git repos (each is a full/sparse checkout)
│       └── github.com/
│           └── company/
│               ├── base/                 # ← This is a git repo
│               │   ├── .git/             # Git history preserved
│               │   ├── context.yaml
│               │   ├── index.md
│               │   └── details/
│               └── frontend/             # ← This is a git repo
│                   ├── .git/
│                   ├── context.yaml
│                   ├── index.md
│                   └── details/
├── CLAUDE.md                   # Auto-generated
├── AGENTS.md                   # Auto-generated (OpenAI Codex)
├── .github/
│   └── copilot-instructions.md # Auto-generated
├── kilo.md                     # Auto-generated
├── opencode.md                 # Auto-generated
└── context.md                  # Optional: project-specific overrides
```

**Note:** `.context/packages/` is gitignored from the main project, but each package inside is its own Git repo with full history.

### manifest.yaml

```yaml
sources:
  - github.com/company/base-standards@^1.0
  - github.com/company/frontend@^2.0
  - github.com/myteam/react-patterns@main

# Output configuration
generate:
  claude: true           # Generate CLAUDE.md
  copilot: true          # Generate .github/copilot-instructions.md
  kilo: true             # Generate kilo.md
  opencode: true         # Generate opencode.md
  codex: true            # Generate AGENTS.md

# Optional: customize output paths
paths:
  claude: CLAUDE.md
  copilot: .github/copilot-instructions.md
  kilo: .kilo/instructions.md
  opencode: opencode.md
  codex: AGENTS.md
```

### lock.yaml

```yaml
version: 1
resolved:
  - url: github.com/company/base-standards
    version: 1.2.0
    commit: a1b2c3d4e5f6g7h8
    integrity: sha256-abcdef...

  - url: github.com/company/frontend
    version: 2.3.1
    commit: b2c3d4e5f6g7h8i9
    integrity: sha256-123456...
    depends:
      - github.com/company/base-standards@1.2.0
```

## Context Creation

### Quick Start

```bash
# Create a new context repo
mkdir my-context && cd my-context
ctx create

# Creates:
# ├── context.yaml
# ├── index.md
# └── details/
#     └── .gitkeep
```

### Publishing

Just push to GitHub. No registry needed:

```bash
git init
git add .
git commit -m "Initial context"
gh repo create my-org/my-context --public
git push -u origin main
git tag v1.0.0
git push --tags

# Share: ctx add github.com/my-org/my-context
```

## Technical Implementation

### Technology Stack

- **Language**: TypeScript (Node.js)
- **Package Manager**: npm (published as `context-injector` or `ctx`)
- **Git Operations**: isomorphic-git or simple-git
- **CLI Framework**: Commander.js or oclif
- **Config Parsing**: yaml

### Installation

```bash
npm install -g context-injector
# or
npx context-injector init
```

## Future Considerations (Post-v1)

- [ ] Context search/discovery (optional registry)
- [ ] Private contexts with auth
- [ ] Context templates
- [ ] IDE extensions (VSCode, JetBrains)
- [ ] MCP server mode for dynamic context
- [ ] Context validation/linting
- [ ] AI-powered context suggestions
