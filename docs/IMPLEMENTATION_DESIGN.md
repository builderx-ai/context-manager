# Context Injector - Implementation Design

**Status**: ✅ Ready for Implementation  
**Last Updated**: January 29, 2026

This document consolidates all major technical decisions and design points for implementing the Context Injector product.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Git Repository Management](#git-repository-management)
3. [Dependency Resolution](#dependency-resolution)
4. [Cross-Tool Support](#cross-tool-support)
5. [Version Management](#version-management)
6. [Security Strategy](#security-strategy)
7. [Agent Integration](#agent-integration)
8. [Performance Optimization](#performance-optimization)
9. [User Experience](#user-experience)
10. [Technology Stack](#technology-stack)

---

## Architecture Overview

### Core Concepts

**Single Source of Truth:**
- Contexts are maintained in Git repositories
- Each context is a Git submodule in `.context/packages/`
- Lock file ensures reproducible installations
- Generated config files reference the source contexts

**Directory Structure:**
```
my-project/
├── .context/
│   ├── manifest.yaml           # User-declared dependencies
│   ├── lock.yaml               # Resolved versions (auto-generated)
│   ├── resolutions.yaml        # Conflict resolutions (auto-generated)
│   └── packages/               # Git submodules
│       └── github.com/
│           └── company/
│               ├── base/                 # ← Git submodule
│               │   ├── .git/             # Git history
│               │   ├── context.yaml      # Context metadata
│               │   ├── index.md          # Summary (always loaded)
│               │   ├── details/          # Detailed contexts
│               │   │   ├── code-style.md
│               │   │   └── testing.md
│               │   └── tools/            # Tool-specific overrides
│               │       ├── claude.md
│               │       └── copilot.md
│               └── frontend/             # ← Another Git submodule
│                   └── ...
├── CLAUDE.md                   # Auto-generated (references .context/)
├── AGENTS.md                   # Auto-generated (for Cursor/Aider/Codex)
├── .github/
│   └── copilot-instructions.md # Auto-generated
└── context.md                  # Optional: project-specific overrides
```

---

## Git Repository Management

### Decision: Git Submodules + CLI Abstraction

**Rationale:**
- Use mature Git tooling instead of reinventing
- Contexts are primarily Markdown files (lightweight)
- CLI abstracts complexity from users
- Agent can detect and guide users through setup

### Implementation

#### 1. Initialization
```bash
ctx init
# → Creates .context/manifest.yaml
# → Creates .context/.gitignore
# → Initializes .gitmodules (if needed)
```

#### 2. Adding Contexts
```bash
ctx add github.com/company/base@^1.0
# → Adds to manifest.yaml
# → Executes: git submodule add <url> .context/packages/github.com/company/base
# → Executes: git submodule update --init --depth=1
# → Updates lock.yaml
# → Generates config files (CLAUDE.md, etc.)
```

#### 3. Installing Dependencies
```bash
ctx install
# → Reads manifest.yaml
# → For each source: git submodule add (if not exists)
# → Executes: git submodule update --init --recursive --depth=1
# → Generates config files

ctx install --frozen
# → Strict mode: use exact lock.yaml versions
# → Fail if lock.yaml doesn't exist
# → For CI/CD environments
```

#### 4. Health Checks
```bash
ctx doctor
# Checks:
# ✅ Submodules initialized
# ✅ All packages match lock file
# ⚠️  2 unreviewed semantic conflicts
# ⚠️  Context 'base' has updates available

ctx doctor --fix
# Auto-fixes:
# → Initializes missing submodules
# → Updates outdated submodules (with confirmation)
```

#### 5. Pushing Changes
```bash
ctx push github.com/company/base
# → cd to submodule directory
# → git checkout -b ctx/<project-name>/<timestamp>
# → git add .
# → git commit -m "Update from <project-name>"
# → git push origin <branch>
# → Returns PR creation URL
```

#### 6. Diff and Status
```bash
ctx diff github.com/company/base
# Equivalent to: cd .context/packages/.../base && git diff

ctx status
# Shows:
# Modified contexts:
#   • github.com/company/base (2 files changed)
# Run 'ctx diff <context>' to review

ctx reset github.com/company/base
# Equivalent to: cd .context/packages/.../base && git checkout .
```

### Agent Detection and Guidance

**Generated CLAUDE.md includes:**
```markdown
## Context Health Check

**IMPORTANT**: Before working, verify contexts are available.

If you see empty directories in `.context/packages/`:
1. Tell the user: "I notice context files haven't been initialized."
2. Guide: "Please run: `ctx install` or `ctx doctor --fix`"
3. Wait for user to complete before proceeding.

To check: Read a file from `.context/packages/` - if it fails, contexts aren't loaded.
```

---

## Dependency Resolution

### Two-Layer Conflict Detection

#### Layer 1: Version Conflicts (Automatic)

**Strategy: Semver-based resolution with clear errors**

```yaml
# manifest.yaml
sources:
  - github.com/company/frontend@^2.0  # requires base@^1.0
  - github.com/company/backend@^3.0   # requires base@^1.2

# Resolution:
# → base@^1.0 and base@^1.2 are compatible
# → Install base@1.2.3 (latest in range)
```

**Conflict handling:**
```bash
# Incompatible versions
ctx install

Error: Conflicting version requirements for github.com/company/base
  - frontend@2.0 requires base@^1.0
  - legacy@1.0 requires base@^0.9

Solutions:
  1. Update legacy to support base@^1.0
  2. Force version: ctx add github.com/company/base@1.0.0 --force
  3. Add override in manifest.yaml
```

**Manual overrides:**
```yaml
# manifest.yaml
sources:
  - github.com/company/frontend@^2.0
  - github.com/company/legacy@^1.0

overrides:
  github.com/company/base: 1.0.0  # Force specific version
```

#### Layer 2: Semantic Conflicts (Agent-Assisted)

**Context metadata includes rule declarations:**

```yaml
# context.yaml
name: react-standards
version: 2.0.0

rules:
  - id: component-style
    category: react/components
    directive: "Use Function Components with hooks"
    applies_when: "Creating React components"
    priority: recommended
    
  - id: state-management
    category: react/state
    directive: "Use Redux Toolkit for global state"
    applies_when: "Managing application state"
```

**Conflict detection:**
```bash
ctx doctor --conflicts

# Semantic Conflict Details
# 
# [1] react/components (Unreviewed)
# 
#   github.com/company/react-standards@2.0.0
#   "Use Function Components with hooks"
#   
#   github.com/legacy/react-old@1.5.0
#   "Prefer Class Components for stateful logic"
# 
# Actions:
#   1. Remove one context: ctx remove github.com/legacy/react-old
#   2. Add override in context.md
#   3. Mark as reviewed: ctx doctor --resolve react/components
```

**Resolution tracking:**
```yaml
# .context/resolutions.yaml (auto-generated)
conflicts:
  react/components:
    status: reviewed
    resolution: "Use react-standards for new code, react-old for legacy only"
    reviewed_at: "2026-01-29T10:30:00Z"
```

**Generated config includes conflicts:**
```markdown
# CLAUDE.md

## ⚠️ Detected Rule Conflicts

### Conflict: react/components
- **react-standards** says: "Use Function Components with hooks"
- **react-old** says: "Prefer Class Components for stateful logic"

**Resolution**: Follow react-standards for new code. react-old is for legacy maintenance only.
```

---

## Cross-Tool Support

### Decision: Single Source of Truth + References

**Strategy:**
- Maintain one master context in `.context/packages/`
- Tool-specific configs reference or embed this content
- Support tool-specific additions via `tools/` directory

### Supported Tools and Strategies

| Tool | Config File | Strategy | Rationale |
|------|-------------|----------|-----------|
| Claude Code | `CLAUDE.md` | **Reference** | Has Read tool for files |
| Cursor / Aider | `AGENTS.md` | **Reference** | Can read files |
| GitHub Copilot | `.github/copilot-instructions.md` | **Hybrid** | Limited file reading |
| Windsurf | `AGENTS.md` or custom | **Reference** | Can read files |

### Reference Strategy (Default)

**CLAUDE.md example:**
```markdown
# CLAUDE.md

## Context Sources

This project uses context-manager. Contexts are in `.context/packages/`.

## Quick Reference

<!-- Auto-merged from all index.md files -->
### Code Style
- Use TypeScript for all new code
- Prefer functional programming
...

## Detailed Contexts

| Topic | File | Description |
|-------|------|-------------|
| Code Style | `.context/packages/github.com/company/base/details/code-style.md` | Full guide |
| Testing | `.context/packages/github.com/company/base/details/testing.md` | Test patterns |

**To access:** Use the Read tool to read these files when needed.

## Project-Specific

<!-- From local context.md -->
...
```

### Hybrid Strategy (Copilot)

```markdown
# .github/copilot-instructions.md

## Summary (Embedded)

<!-- AUTO-GENERATED from index.md -->
### Quick Rules
...
<!-- END AUTO-GENERATED -->

## Detailed References

For details, see:
- Code Style: `.context/packages/.../code-style.md`
- Testing: `.context/packages/.../testing.md`
```

### Tool-Specific Additions

**Directory structure:**
```
context/
├── index.md              # Common to all tools
├── details/
│   └── code-style.md     # Common detailed guide
└── tools/                # Tool-specific additions (optional)
    ├── claude.md         # Claude-specific notes
    └── copilot.md        # Copilot-specific notes
```

**Generation logic:**
```typescript
function generateCLAUDE(contexts: Context[]): string {
  let content = "# CLAUDE.md\n\n";
  
  // 1. Merge common content
  content += mergeContent(contexts.map(c => c.index));
  
  // 2. Add Claude-specific additions
  const claudeSpecific = contexts
    .map(c => c.tools?.claude)
    .filter(Boolean);
  
  if (claudeSpecific.length > 0) {
    content += "\n## Claude-Specific Guidance\n\n";
    content += mergeContent(claudeSpecific);
  }
  
  return content;
}
```

### Configuration

```yaml
# manifest.yaml
sources:
  - github.com/company/base@^1.0

generate:
  claude:
    enabled: true
    strategy: reference      # reference | embed | hybrid
    path: CLAUDE.md
    
  copilot:
    enabled: true
    strategy: hybrid
    path: .github/copilot-instructions.md
    
  agents:
    enabled: true
    strategy: reference
    path: AGENTS.md
```

---

## Version Management

### Decision: Use Semver Library + Lock File

**Technology:** npm `semver` package (battle-tested)

### Supported Version Formats

| Format | Example | Behavior |
|--------|---------|----------|
| Exact | `@1.2.3` | Exact version |
| Caret | `@^1.0.0` | Compatible updates (1.x.x) |
| Tilde | `@~1.2.0` | Patch updates only (1.2.x) |
| Range | `@>=1.0.0 <2.0.0` | Version range |
| Latest | `@latest` | Latest release tag |
| Branch | `@main` | Branch HEAD (locked to commit in lock file) |
| Commit | `@a1b2c3d` | Specific commit |

### Version Resolution

```typescript
import semver from 'semver';

async function resolveVersion(
  repoUrl: string,
  versionSpec: string
): Promise<{ version: string; commit: string }> {
  
  // 1. Exact or semver range
  if (semver.validRange(versionSpec)) {
    const tags = await git.listTags(repoUrl);
    const versions = tags
      .map(t => t.replace(/^v/, ''))
      .filter(t => semver.valid(t));
    
    const matched = semver.maxSatisfying(versions, versionSpec);
    const commit = await git.getTagCommit(repoUrl, `v${matched}`);
    return { version: matched, commit };
  }
  
  // 2. Latest
  if (versionSpec === 'latest') {
    const tags = await git.listTags(repoUrl);
    const versions = tags.map(t => t.replace(/^v/, '')).filter(semver.valid);
    const latest = semver.maxSatisfying(versions, '*');
    const commit = await git.getTagCommit(repoUrl, `v${latest}`);
    return { version: latest, commit };
  }
  
  // 3. Branch or commit
  return resolveBranchOrCommit(repoUrl, versionSpec);
}
```

### Lock File Format

```yaml
# lock.yaml
version: 1
resolved:
  - url: github.com/company/base
    ref: ^1.0                    # Original spec from manifest
    version: 1.2.3               # Resolved version
    commit: a1b2c3d4e5f6         # Git commit SHA (integrity)
    resolved_at: "2026-01-29T10:30:00Z"
    
  - url: github.com/company/experimental
    ref: main                    # Branch reference
    version: null                # No version tag
    commit: b2c3d4e5f6g7         # Locked commit
    resolved_at: "2026-01-29T10:35:00Z"
```

### Lock File Update Strategy

| Command | Lock File Behavior |
|---------|-------------------|
| `ctx add <context>` | Adds new entry |
| `ctx install` | Creates if missing, otherwise uses existing |
| `ctx install --frozen` | Requires lock file, fails if missing |
| `ctx upgrade` | Updates to latest compatible versions |
| `ctx upgrade --latest` | Ignores semver ranges, uses latest |

### Example Workflow

```bash
# Initial setup
ctx add github.com/company/base@^1.0
# manifest: ^1.0
# lock: 1.2.3 (current latest in ^1.0 range)

# Several months later, 1.3.0 is released
ctx install
# → Uses 1.2.3 from lock file (reproducible)

ctx upgrade
# → Updates to 1.3.0
# → Updates lock.yaml
# → User sees git diff in submodule
```

---

## Security Strategy

### Five-Layer Security Model

#### Layer 1: Git Native Security (Foundation)

**Leverage Git's built-in security:**
- HTTPS/SSH encrypted transport
- Commit SHA integrity verification
- GitHub/GitLab access controls and 2FA

#### Layer 2: Lock File Integrity (Core)

**Lock file as integrity guarantee:**
```yaml
# lock.yaml records commit SHA
resolved:
  - url: github.com/company/base
    commit: a1b2c3d4e5f6  # ← Integrity hash
```

**Verification:**
```typescript
async function verifyIntegrity(context: Context) {
  const locked = lockFile.get(context.url);
  const actual = await git.getCurrentCommit(context.path);
  
  if (locked.commit !== actual) {
    throw new SecurityError(
      `Integrity check failed for ${context.url}\n` +
      `Expected: ${locked.commit}\n` +
      `Actual:   ${actual}\n` +
      `Possible tampering detected.`
    );
  }
}
```

**Auto-check in ctx doctor:**
```bash
ctx doctor
# ✅ All contexts match lock file
# ❌ Context 'base' has unexpected commit (tampering?)
```

#### Layer 3: Content Scanning (Optional)

**Basic malicious content detection:**
```typescript
function scanContext(contextPath: string): SecurityIssue[] {
  const issues = [];
  
  // 1. Check file types (should only be .md, .yaml)
  const files = glob.sync(`${contextPath}/**/*`);
  const suspicious = files.filter(f => 
    !f.match(/\.(md|yaml|yml|txt|json)$/)
  );
  if (suspicious.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Unexpected file types: ${suspicious.join(', ')}`
    });
  }
  
  // 2. Check for <script> tags in Markdown
  const mdFiles = files.filter(f => f.endsWith('.md'));
  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('<script>')) {
      issues.push({
        severity: 'error',
        file,
        message: 'Contains <script> tags'
      });
    }
  }
  
  return issues;
}
```

#### Layer 4: Private Context Authentication

**Use Git's native auth mechanisms:**
```bash
# SSH keys (recommended)
ctx add git@github.com:company/private-context.git

# HTTPS with Git credential helper
git config --global credential.helper store
ctx add https://github.com/company/private-context.git

# ctx never stores credentials - relies on Git
```

#### Layer 5: GPG Signatures (Optional, Advanced)

**For high-security contexts:**
```yaml
# context.yaml
name: security-policies
security:
  require_signed_commits: true
  trusted_keys:
    - fingerprint: "ABCD1234..."
      owner: "security-team@company.com"
```

**Verification on install:**
```bash
ctx install
# Verifying signatures...
# ✅ security-policies: Signed by security-team@company.com
```

### Security Best Practices

**For Users:**
- ✅ Use org/team-maintained contexts
- ✅ Review lock file changes in PRs
- ✅ Run `ctx doctor` regularly
- ✅ Use exact versions in production (`@1.2.3`)
- ❌ Avoid contexts from unknown sources

**For Context Authors:**
- ✅ Only include Markdown/YAML files
- ✅ Use semver tags for releases
- ✅ Sign commits for critical contexts
- ❌ Never include scripts or executables
- ❌ Avoid frequent force-pushes

---

## Agent Integration

### Agent-Driven Context Evolution

**Philosophy:** Agents can improve contexts during normal work

#### Triggers for Context Updates

| Trigger | Example | Agent Action |
|---------|---------|--------------|
| Outdated info | Context says "React 17" but project uses React 19 | Propose update |
| Missing pattern | Useful pattern discovered | Add to context |
| Incorrect rule | Rule causes issues | Suggest correction |
| New best practice | Learn from user feedback | Capture knowledge |

#### Agent Workflow

**Generated CLAUDE.md includes:**
```markdown
## Context Contribution

These contexts are **editable**. You may update them when:

✅ **Do edit when:**
- User explicitly asks to update context
- You discover outdated information
- A useful pattern emerges
- You find a clear error

❌ **Don't edit when:**
- You're unsure if change is correct
- It's stylistic preference only
- Context is marked `editable: false`

**Process:**
1. Edit file in `.context/packages/<context>/`
2. Inform user what changed and why
3. User reviews with: `ctx diff <context>`
4. User decides: keep, modify, or discard
```

#### Agent Template for Notifications

```markdown
**Template when editing:**
"I've updated [context name] to [what changed].

**File:** `.context/packages/[path]`
**Change:** [brief description]
**Reason:** [why needed]

Review:
\`\`\`bash
ctx diff [context]
\`\`\`

Accept and push:
\`\`\`bash
ctx push [context]
\`\`\`

Discard:
\`\`\`bash
ctx reset [context]
\`\`\`
"
```

#### Read-Only Contexts

```yaml
# context.yaml
metadata:
  editable: false
  reason: "Critical security rules - contact security team"
```

**Generated instruction:**
```markdown
## Read-Only Contexts

- `github.com/company/security-rules` - Critical security rules

Do not modify even if outdated. Ask user to contact maintainers.
```

---

## Performance Optimization

### Git Submodule Optimizations

**Already provided by Git:**
- ✅ Shallow clone support (`--depth=1`)
- ✅ On-demand cloning
- ✅ Incremental updates
- ✅ Parallel operations (`--jobs`)

### Implementation

```bash
# Default: shallow clone
ctx install
# Internally: git submodule update --init --depth=1 --jobs=4

# Full history (if needed)
ctx install --full-history
# Internally: git submodule update --init --recursive

# CI/CD optimization
ctx install --frozen
# Uses exact lock file, skips version resolution
```

### Performance Estimates

**Typical project (5 contexts):**
- Each context: ~50KB Markdown
- Each .git (shallow): ~200KB
- **Total: ~1.25MB**

Acceptable for modern development environments.

---

## User Experience

### CLI Command Reference

```bash
# Initialization
ctx init                          # Initialize project

# Managing contexts
ctx add <url>[@version]           # Add context
ctx remove <url>                  # Remove context
ctx list                          # List installed contexts
ctx tree                          # Show dependency tree

# Installation
ctx install                       # Install all dependencies
ctx install --frozen              # CI mode (strict lock file)
ctx upgrade [url]                 # Upgrade to latest compatible
ctx upgrade --latest              # Upgrade ignoring semver

# Configuration
ctx generate                      # Regenerate config files
ctx generate --target claude      # Only CLAUDE.md
ctx generate --target copilot     # Only copilot-instructions.md

# Health and diagnostics
ctx doctor                        # Run all checks
ctx doctor --fix                  # Auto-fix issues
ctx doctor --conflicts            # Show semantic conflicts
ctx doctor --resolve <id>         # Resolve specific conflict

# Reviewing changes
ctx status                        # Show modified contexts
ctx diff [url]                    # Show changes in context
ctx reset <url>                   # Discard local changes

# Contributing back
ctx push <url>                    # Push changes and create PR

# Utilities
ctx why <package>                 # Why is package installed
ctx outdated                      # Show available updates
```

### Error Messages

**Friendly, actionable errors (Rust-style):**

```bash
ctx install

Error: Submodule 'github.com/company/base' not initialized

Possible causes:
  1. Fresh clone without --recurse-submodules
  2. Submodules not updated after git pull

Solutions:
  → Run: ctx doctor --fix
  → Or manually: git submodule update --init --recursive

Hint: For fresh clones, use:
  git clone --recurse-submodules <repo-url>
```

### Interactive Workflows

```bash
ctx doctor --resolve react/components

How do you want to resolve this conflict?

1. Keep both (mark as reviewed)
   Use react-standards for new code, react-old for legacy

2. Remove github.com/legacy/react-old
   Uninstall the conflicting context

3. Add project override
   Document resolution in context.md

Choice [1-3]: _
```

---

## Technology Stack

### Core Technologies

**Language:** TypeScript (Node.js)

**Why TypeScript:**
- Type safety for complex logic
- Great tooling and IDE support
- Large ecosystem
- Easy distribution via npm

**Key Dependencies:**

```json
{
  "dependencies": {
    "semver": "^7.5.0",           // Version resolution
    "simple-git": "^3.20.0",      // Git operations
    "commander": "^11.0.0",       // CLI framework
    "yaml": "^2.3.0",             // YAML parsing
    "chalk": "^5.3.0",            // Terminal colors
    "inquirer": "^9.2.0",         // Interactive prompts
    "glob": "^10.3.0"             // File pattern matching
  }
}
```

**Git Library Choice:**

| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| **simple-git** | Fast, full features, small | Requires system git | ✅ **Use this** |
| isomorphic-git | Pure JS, no system git | Slower, partial features | Fallback option |

**Decision:** Use `simple-git` (assumes git is installed)

### Node.js Version Support

**Minimum:** Node.js 18 (Active LTS)

### Project Structure

```
context-manager/
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── init.ts
│   │   │   ├── add.ts
│   │   │   ├── install.ts
│   │   │   ├── doctor.ts
│   │   │   └── ...
│   │   └── index.ts
│   ├── core/
│   │   ├── git.ts              // Git operations
│   │   ├── resolver.ts         // Version resolution
│   │   ├── installer.ts        // Installation logic
│   │   └── scanner.ts          // Security scanning
│   ├── generators/
│   │   ├── base.ts
│   │   ├── claude.ts
│   │   ├── copilot.ts
│   │   └── agents.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── config.ts
│       ├── logger.ts
│       └── errors.ts
├── tests/
├── docs/
├── package.json
└── tsconfig.json
```

### Distribution

```bash
# Global installation
npm install -g context-manager

# Usage
ctx init

# Or via npx (no install)
npx context-manager init
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)

**Goal:** Core functionality working

- [x] Design decisions finalized
- [ ] Project setup (TypeScript, CLI framework)
- [ ] Core commands: `init`, `add`, `install`
- [ ] Git submodule integration
- [ ] Lock file generation
- [ ] Basic config generation (CLAUDE.md, AGENTS.md)
- [ ] Version resolution with semver
- [ ] Basic tests

**Deliverable:** Can add contexts and generate basic config files

### Phase 2: Advanced Features

**Goal:** Complete feature set

- [ ] `ctx doctor` with all checks
- [ ] Conflict detection (version + semantic)
- [ ] `ctx push` workflow
- [ ] `ctx diff`, `ctx status`, `ctx reset`
- [ ] Content scanning (security)
- [ ] Tool-specific generators (Copilot, etc.)
- [ ] Interactive prompts
- [ ] Comprehensive error messages

**Deliverable:** Full production-ready CLI

### Phase 3: Polish & Ecosystem

**Goal:** Production hardening and community

- [ ] Performance optimization
- [ ] Cross-platform testing (Windows, macOS, Linux)
- [ ] Documentation site
- [ ] Example contexts repository
- [ ] CI/CD integration guides
- [ ] VS Code extension (optional)
- [ ] GPG signature support (optional)

**Deliverable:** Polished product with ecosystem support

---

## Open Questions & Future Considerations

### v1 Scope (Out of Scope for Now)

- [ ] Context discovery/search registry
- [ ] MCP server mode for dynamic context
- [ ] IDE extensions (VS Code, JetBrains)
- [ ] AI-powered context suggestions
- [ ] Context validation/linting beyond basic security
- [ ] Monorepo support (multiple contexts in one repo)

### To Be Determined

- **Context marketplace?** Probably not needed - GitHub is the marketplace
- **Private registry?** Git already handles private repos
- **Versioning strategy for breaking changes?** Follow semver, use migration guides
- **Context composition?** Already handled by dependencies

---

## References

- [PRODUCT_DESIGN.md](./PRODUCT_DESIGN.md) - Original product specification
- [Semver Specification](https://semver.org/)
- [Git Submodules Documentation](https://git-scm.com/book/en/v2/Git-Tools-Submodules)

---

## Changelog

- **2026-01-29**: Initial implementation design consolidated from issues analysis
