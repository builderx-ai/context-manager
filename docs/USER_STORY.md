# User Story: Context Injector in Action

## Background

**Alex** is a senior developer at TechCorp. The company has 200+ developers across 50+ projects, all using AI coding assistants (Claude Code, Copilot, etc.).

**The Problem:**
- Each project has its own CLAUDE.md, many are outdated or inconsistent
- New developers spend days learning "how we do things here"
- Best practices discovered in one project don't spread to others
- When standards change, someone has to update 50+ repos manually

Alex decides to try **context-manager**.

---

## Chapter 1: Getting Started

### Installing the Tool

```bash
npm install -g context-manager
```

### Initializing a Project

Alex starts with the `payment-service` project:

```bash
cd payment-service
ctx init --detect
```

Output:
```
Detected project characteristics:
  ✓ TypeScript (tsconfig.json)
  ✓ Node.js/Express (package.json)
  ✓ Testing with Jest
  ✓ PostgreSQL (pg in dependencies)

Searching company contexts...

Recommended contexts based on [typescript, backend, express, testing]:
  github.com/techcorp/engineering-standards@2.3.0    [typescript, testing]
  github.com/techcorp/backend-standards@1.5.0       [backend, express, node]
  github.com/techcorp/database-patterns@1.2.0       [postgresql, database]

Add all recommended? (y/n) y

✓ Created .context/manifest.yaml
✓ Added 3 contexts to manifest
✓ Ready! Run 'ctx install' to download.
```

The tags system automatically matched project characteristics to relevant contexts.

---

## Chapter 2: Adding Company Contexts

TechCorp has a shared context repo. Alex adds it:

```bash
ctx add github.com/techcorp/engineering-standards
```

Output:
```
✓ Resolving github.com/techcorp/engineering-standards
✓ Found version: v2.3.0
✓ Added to manifest

Run 'ctx install' to download and generate config files.
```

The team also has backend-specific standards:

```bash
ctx add github.com/techcorp/backend-standards@v1.5
ctx install
```

Output:
```
Resolving dependencies...
  github.com/techcorp/engineering-standards@2.3.0
  └── github.com/techcorp/code-style@1.0.0 (dependency)
  github.com/techcorp/backend-standards@1.5.0
  └── github.com/techcorp/engineering-standards@^2.0 (satisfied by 2.3.0)

✓ Downloaded 3 contexts
✓ Generated CLAUDE.md
✓ Generated .github/copilot-instructions.md
✓ Generated AGENTS.md
✓ Generated kilo.md
✓ Generated opencode.md

Done! Your AI assistants are now configured.
```

---

## Chapter 3: The Generated Config

Alex opens the auto-generated `CLAUDE.md`:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code).

## Context Sources

This project uses [context-manager](https://github.com/user/context-manager).
Contexts are located in `.context/packages/`.

## Quick Reference

### Code Style (from engineering-standards)
- Use TypeScript strict mode
- Prefer functional programming patterns
- All functions must have JSDoc comments

### Backend Standards (from backend-standards)
- Use Express.js with async error handlers
- All APIs must return JSON with standard envelope
- Database queries must use parameterized statements

## Available Contexts

When you need detailed guidance, read these files:

| Topic | File | Description |
|-------|------|-------------|
| Code Style | `.context/packages/github.com/techcorp/code-style/index.md` | Formatting, naming |
| Error Handling | `.context/packages/github.com/techcorp/backend-standards/details/errors.md` | Error patterns |
| API Design | `.context/packages/github.com/techcorp/backend-standards/details/api.md` | REST conventions |
| Testing | `.context/packages/github.com/techcorp/engineering-standards/details/testing.md` | Test patterns |

## Context Contribution

These contexts are **editable**. If you notice outdated info, missing patterns,
or better practices, edit the relevant file in `.context/packages/`.
Run `ctx status` to see pending changes.

## Project-Specific Rules

(Add local overrides in ./context.md)
```

---

## Chapter 4: Daily Development with AI

Alex starts working with Claude Code:

```
Alex: Help me add a new endpoint for processing refunds.
```

Claude Code reads the Quick Reference, then dives into the API design context:

```
Claude: I'll read the API design guidelines first.

[Reads .context/packages/.../backend-standards/details/api.md]

Based on your backend standards, I'll create the endpoint following
your conventions:

- POST /api/v1/refunds (not /refund - plural as per your standard)
- Standard JSON envelope with { success, data, error }
- Async error handler wrapper
- Request validation with Zod schema

[Creates the endpoint code]
```

The code follows TechCorp's exact patterns because Claude read the detailed context.

---

## Chapter 5: Agent Discovers an Issue

While implementing, Claude notices something:

```
Claude: I implemented the refund endpoint. However, I noticed something:

Your API guidelines in `.context/packages/.../api.md` mention using
`express-validator`, but this project uses `zod` for validation.
I've updated the context to reflect the current practice:

Updated: .context/packages/github.com/techcorp/backend-standards/details/api.md
- Changed "Use express-validator" to "Use Zod for request validation"
- Added example of Zod schema pattern

Run `ctx status` to review this change.
```

Alex checks:

```bash
ctx status
```

Output:
```
Modified contexts:

  github.com/techcorp/backend-standards
    └── details/api.md (1 file changed)

Run 'ctx diff' to see changes, or 'ctx push' to submit.
```

```bash
ctx diff github.com/techcorp/backend-standards
```

Output:
```diff
--- a/details/api.md
+++ b/details/api.md
@@ -45,7 +45,7 @@
 ## Request Validation

-Use `express-validator` for all request validation:
+Use `zod` for request validation:

-```javascript
-const { body, validationResult } = require('express-validator');
+```typescript
+import { z } from 'zod';
+
+const RefundSchema = z.object({
+  orderId: z.string().uuid(),
+  amount: z.number().positive(),
+  reason: z.string().min(10)
+});
```

Alex reviews and agrees with the change.

---

## Chapter 6: Pushing Changes Back

Alex decides to contribute this improvement:

```bash
ctx push github.com/techcorp/backend-standards
```

Output:
```
Creating branch: ctx/payment-service/20240115-143022
Committing changes...
Pushing to github.com/techcorp/backend-standards...
Creating pull request...

✓ Pull request created!
  https://github.com/techcorp/backend-standards/pull/42

Title: [ctx] Updates from payment-service
```

The backend team reviews and merges the PR. Now all 50+ backend projects will get this update on their next `ctx upgrade`.

---

## Chapter 6.5: Finding New Contexts with Tags

Later, Alex needs to add payment processing. First, Alex checks the configured catalog:

```bash
cat ~/.config/ctx/config.yaml
```

```yaml
# Global config - search sources
registries:
  - github.com/techcorp/context-catalog    # Company catalog
```

TechCorp maintains a catalog repo that indexes all company contexts. Now Alex can search:

```bash
ctx search --tag payments
```

Output:
```
Searching github.com/techcorp/context-catalog...

Found 3 contexts matching [payments]:

  github.com/techcorp/payment-patterns@1.0.0
    Tags: [payments, fintech, backend, retry]
    "Payment processing patterns and best practices"

  github.com/stripe/stripe-integration@2.1.0
    Tags: [payments, stripe, api]
    "Official Stripe integration guidelines"

  github.com/techcorp/pci-compliance@1.0.0
    Tags: [payments, security, compliance]
    "PCI-DSS compliance requirements"
```

Alex adds the relevant ones:

```bash
ctx add github.com/techcorp/payment-patterns
ctx add github.com/techcorp/pci-compliance
ctx install
```

The generated config now includes a tags column:

```markdown
## Available Contexts

| Topic | Tags | File |
|-------|------|------|
| Backend Standards | `backend`, `express` | `.context/.../backend/index.md` |
| Payment Patterns | `payments`, `retry` | `.context/.../payment/index.md` |
| PCI Compliance | `payments`, `security` | `.context/.../pci/index.md` |
| Database Patterns | `postgresql` | `.context/.../database/index.md` |
```

When Claude works on payment code, it knows to prioritize contexts tagged `payments`.

---

## Chapter 7: A New Developer Joins

**Jordan** joins TechCorp and is assigned to the `inventory-service` project.

Day 1:

```bash
cd inventory-service
ctx install
```

That's it. Jordan's Claude Code now knows:
- TechCorp's coding standards
- Backend API patterns
- Testing conventions
- Error handling approaches

Jordan starts coding:

```
Jordan: How do we handle database errors here?

Claude: [Reads .context/packages/.../backend-standards/details/errors.md]

Based on TechCorp's error handling standards, database errors should be:

1. Wrapped in a custom DatabaseError class
2. Logged with correlation ID
3. Returned to client as 500 with generic message
4. Original error stored for debugging

Here's the pattern your team uses:

[Shows exact code pattern from context]
```

Jordan is productive from day one.

---

## Chapter 8: Upgrading Contexts

A month later, the engineering team releases new standards. Alex updates:

```bash
ctx outdated
```

Output:
```
Outdated contexts:

  github.com/techcorp/engineering-standards
    Current: 2.3.0
    Latest:  3.0.0

  github.com/techcorp/backend-standards
    Current: 1.5.0
    Latest:  1.6.0
```

```bash
ctx upgrade
```

Output:
```
Upgrading contexts...

  github.com/techcorp/engineering-standards: 2.3.0 → 3.0.0
  github.com/techcorp/backend-standards: 1.5.0 → 1.6.0

✓ Updated lock.yaml
✓ Regenerated CLAUDE.md
✓ Regenerated .github/copilot-instructions.md
✓ Regenerated AGENTS.md
✓ Regenerated kilo.md
✓ Regenerated opencode.md

Done! Review changes with 'git diff CLAUDE.md'
```

---

## Chapter 9: Creating a New Context

Alex's team develops a great pattern for handling payment retries. They want to share it.

```bash
mkdir payment-patterns && cd payment-patterns
ctx create
```

Output:
```
✓ Created context.yaml
✓ Created index.md
✓ Created details/.gitkeep

Edit index.md to add your context summary.
Add detailed docs in details/ folder.
```

Alex writes the content:

**context.yaml:**
```yaml
name: payment-patterns
version: 1.0.0
description: Payment processing patterns and best practices
depends:
  - github.com/techcorp/backend-standards@^1.0
tags:
  - payments
  - fintech
  - backend
```

**index.md:**
```markdown
# Payment Patterns

## Quick Reference

- Always use idempotency keys for payment operations
- Implement exponential backoff for gateway retries
- Store payment state machine transitions for audit
- Use decimal types for monetary amounts, never float
```

**details/retry-patterns.md:**
```markdown
# Payment Retry Patterns

## Exponential Backoff

[Detailed documentation...]
```

Publishing:

```bash
git init
git add .
git commit -m "Initial payment patterns context"
gh repo create techcorp/payment-patterns --public
git push -u origin main
git tag v1.0.0
git push --tags
```

Share with the company:

```
Hey team! I've created a payment patterns context.
Add it to your payment projects:

  ctx add github.com/techcorp/payment-patterns
```

---

## Chapter 10: The Ecosystem Grows

Six months later at TechCorp:

**Company-wide contexts:**
- `github.com/techcorp/engineering-standards` - Core standards
- `github.com/techcorp/security-guidelines` - Security practices
- `github.com/techcorp/observability` - Logging & monitoring

**Team contexts:**
- `github.com/techcorp/backend-standards` - Backend team
- `github.com/techcorp/frontend-standards` - Frontend team
- `github.com/techcorp/mobile-standards` - Mobile team

**Specialized contexts:**
- `github.com/techcorp/payment-patterns` - Payment systems
- `github.com/techcorp/ml-practices` - ML/AI projects
- `github.com/techcorp/data-pipelines` - Data engineering

Each project's manifest looks like:

```yaml
sources:
  - github.com/techcorp/engineering-standards@^3.0
  - github.com/techcorp/backend-standards@^2.0
  - github.com/techcorp/payment-patterns@^1.0
```

New developers are productive from day one.
Best practices spread automatically.
AI assistants give consistent, high-quality guidance.
The knowledge compounds.

---

## Summary

| Before | After |
|--------|-------|
| 50+ inconsistent CLAUDE.md files | Unified, versioned contexts |
| New devs take weeks to learn patterns | Productive from day one |
| Best practices stay in one project | Automatically shared |
| Manual updates across repos | `ctx upgrade` in seconds |
| AI gives generic advice | AI knows your exact standards |

**The End.**
