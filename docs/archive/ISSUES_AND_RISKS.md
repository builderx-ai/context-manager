# Context Injector - Issues and Risks

**Status**: 🔴 Needs Resolution  
**Last Updated**: January 29, 2026

This document tracks critical issues and risks that need to be addressed before implementation.

---

## 🔴 Critical Issues (Must Resolve)

### 1. Git 仓库嵌套的复杂性

**Problem:**
- `.context/packages/` 中每个 context 都是独立的 Git 仓库
- 这个目录又在主项目的 Git 仓库中
- 简单的 `.gitignore` 可能不够

**Risks:**
- Git submodule 的复杂性和学习曲线
- 跨平台兼容性问题（Windows vs Unix）
- 用户可能意外提交整个 packages 目录
- Git 操作性能问题

**Questions:**
- [ ] 使用 git submodule？
- [ ] 使用 git worktree？
- [ ] 还是完全自定义的方案（仅保留 .git 目录）？
- [ ] 如何处理嵌套 .git 目录的警告？

**Proposed Solutions:**
1. **Option A**: 使用 sparse checkout，不保留完整 .git 历史
2. **Option B**: 使用 git submodule，接受复杂性
3. **Option C**: 自定义方案：下载时创建 shallow clone，push 时临时重建

**Decision:** ✅ **使用 Git Submodule + ctx CLI 智能管理**

**Date:** 2026-01-29

**Rationale:**
- Context 主要是 Markdown 文件，submodule 的复杂性可接受
- 使用成熟的 Git 工具，而不是重新发明轮子
- `ctx` CLI 封装 submodule 操作，降低用户学习成本
- Agent 智能检测未初始化的 submodule 并给出提示

**Implementation Details:**

1. **ctx init - 初始化项目**
   ```bash
   ctx init
   # → 创建 .context/manifest.yaml
   # → 创建 .context/.gitignore
   # → 初始化 .gitmodules（如果需要）
   ```

2. **ctx add - 添加 context（自动处理 submodule）**
   ```bash
   ctx add github.com/company/base
   # → 添加到 manifest.yaml
   # → git submodule add <url> .context/packages/github.com/company/base
   # → git submodule update --init --recursive
   # → 更新 lock.yaml
   # → 生成配置文件（CLAUDE.md 等）
   ```

3. **ctx install - 安装所有依赖（自动 checkout submodules）**
   ```bash
   ctx install
   # → 读取 manifest.yaml
   # → 对每个 source 执行 git submodule add（如果不存在）
   # → git submodule update --init --recursive
   # → 生成配置文件
   ```

4. **ctx doctor - 诊断和修复**
   ```bash
   ctx doctor
   # 检查：
   # ✅ .context/manifest.yaml exists
   # ✅ .gitmodules exists
   # ❌ Submodule 'github.com/company/base' not initialized
   #    → Fix: git submodule update --init
   # ❌ Submodule 'github.com/company/frontend' is outdated
   #    → Fix: git submodule update --remote
   
   ctx doctor --fix  # 自动修复所有问题
   ```

5. **ctx push - 在 submodule 中推送更改**
   ```bash
   cd .context/packages/github.com/company/base
   # 用户编辑了文件
   
   ctx push github.com/company/base
   # → cd 到 submodule 目录
   # → git checkout -b ctx/<project-name>/<timestamp>
   # → git add .
   # → git commit -m "..."
   # → git push origin <branch>
   # → 提示创建 PR 的 URL
   ```

6. **生成的 CLAUDE.md 包含智能检测说明**
   ```markdown
   ## Context Sources
   
   This project uses context-injector with Git submodules.
   
   ### Context Health Check
   
   **IMPORTANT**: Before working, verify contexts are available:
   - Check if `.context/packages/` contains files (not empty directories)
   - If empty, run: `ctx doctor --fix` or `ctx install`
   
   **If you see empty directories:**
   Tell the user:
   "I notice the context files haven't been initialized yet. 
   Please run: `ctx install` or `ctx doctor --fix`"
   ```

**Trade-offs:**
- **Pro**: 使用标准 Git 工具，成熟稳定
- **Pro**: 完整的 Git 历史，支持所有 Git 操作
- **Pro**: Agent 可以访问所有文件（初始化后）
- **Pro**: `ctx` CLI 封装复杂性，用户无需了解 submodule 细节
- **Con**: 需要确保用户安装了 Git
- **Con**: Submodule 的一些边缘情况仍需处理

**Next Steps:**
- [x] 确定使用 Git Submodule
- [ ] 设计 `ctx` CLI 命令接口
- [ ] 实现 submodule 管理逻辑
- [ ] 实现 `ctx doctor` 诊断工具
- [ ] 在生成的配置中添加检测说明
- [ ] 编写用户文档和 troubleshooting 指南 

---

### 2. Push 权限和工作流的假设

**Problem:**
- `ctx push` 假设用户对远程仓库有某种访问权限
- Fork 工作流增加了复杂度
- 需要处理各种认证方式

**Risks:**
- 公司内部 context 需要团队权限管理
- Fork 后的同步问题
- 认证失败时的用户体验差

**Questions:**
- [ ] 如何检测用户是否有 push 权限？
- [ ] 自动 fork 还是手动 fork？
- [ ] 如何处理 SSH keys vs Personal Access Tokens？
- [ ] 如何处理 GitHub vs GitLab vs 其他 Git 托管服务？
- [ ] PR 创建需要额外的 API 权限，如何处理？

**Proposed Solutions:**
1. 先尝试 push，失败后提示用户 fork
2. 提供 `ctx fork <context>` 命令显式管理
3. 支持配置文件中指定认证方式
4. 对于 PR 创建，使用 git push 后返回 PR 创建 URL 让用户手动创建

**Decision:** ✅ **直接在 Submodule 中操作 Git**

**Date:** 2026-01-29

**Rationale:**
- 利用 Git Submodule 的原生能力
- `ctx push` 只是封装，实际操作在 submodule 目录中进行
- 权限问题由 Git 本身处理（SSH keys, credentials）

**Implementation:**

```bash
ctx push github.com/company/base
# 等价于：
# cd .context/packages/github.com/company/base
# git checkout -b ctx/my-project/20260129-103000
# git add .
# git commit -m "Update from my-project"
# git push origin ctx/my-project/20260129-103000
# 返回 PR 创建 URL
```

**处理权限问题：**
1. 如果 push 失败（无权限），提示：
   ```
   Error: Permission denied to github.com/company/base
   
   Options:
   1. Request write access to the repository
   2. Fork the repository and update manifest.yaml:
      sources:
        - github.com/YOUR_USERNAME/base@^1.0  # Use your fork
   ```

2. 认证由 Git 自己处理：
   - SSH keys (~/.ssh/)
   - Git credentials (credential.helper)
   - 用户已配置的任何方式

**Trade-offs:**
- **Pro**: 简单直接，利用现有 Git 配置
- **Pro**: 支持所有 Git 托管服务（GitHub, GitLab, Bitbucket 等）
- **Con**: 用户需要配置好 Git 认证

**Next Steps:**
- [ ] 实现 `ctx push` 命令
- [ ] 处理 push 失败的友好错误提示
- [ ] 文档说明如何配置 Git 认证

---

### 3. 依赖冲突解决策略不明确

**Problem:**
冲突有**两个层次**：
1. **版本冲突**（技术层面）：`base@^1.0` vs `base@^0.9`
2. **语义冲突**（内容层面）：context A 说"用 Class"，context B 说"用 Function"

**Risks:**
- 用户不知道如何正确解决冲突
- 强制覆盖可能导致隐藏的兼容性问题
- 语义冲突更难自动检测

**Decision:** ✅ **两层检测机制**

**Date:** 2026-01-29

**Rationale:**
- 版本冲突可以用 semver 算法自动解决
- 语义冲突需要 Agent 参与检测
- `ctx doctor` 提供多层次的冲突诊断

---

## 解决方案设计

### Layer 1: 版本冲突解决（自动）

**策略：宽松模式 + 明确警告**

```bash
ctx install

# 场景 1: 兼容的版本范围
# frontend requires base@^1.0
# backend requires base@^1.2
# → 解析为 base@1.2.0 (最新兼容版本)
# ✅ 自动解决

# 场景 2: 不兼容的版本范围
# frontend requires base@^1.0
# legacy requires base@^0.9
# → ❌ 错误，需要手动干预

Error: Conflicting version requirements for github.com/company/base
  - github.com/company/frontend@2.0 requires base@^1.0
  - github.com/company/legacy@1.0 requires base@^0.9

Solutions:
  1. Update legacy to support base@^1.0
  2. Force a specific version: ctx add github.com/company/base@1.0.0 --force
  3. Use override in manifest.yaml (see docs)
```

**manifest.yaml 支持版本覆盖：**

```yaml
sources:
  - github.com/company/frontend@^2.0
  - github.com/company/legacy@^1.0

# 手动解决冲突
overrides:
  github.com/company/base: 1.0.0  # 强制使用特定版本
```

---

### Layer 2: 语义冲突检测（Agent 辅助）

**核心思路：Context 包含结构化的规则摘要**

#### 2.1 Context 标准格式

每个 context 的 `context.yaml` 包含结构化的规则声明：

```yaml
name: react-standards
version: 2.0.0

# 新增：规则声明（用于冲突检测）
rules:
  - id: component-style
    category: react/components
    directive: "Use Function Components with hooks"
    applies_when: "Creating React components"
    
  - id: state-management
    category: react/state
    directive: "Use Redux Toolkit for global state"
    applies_when: "Managing application state"
    
  - id: styling
    category: styling
    directive: "Use Tailwind CSS for styling"
    applies_when: "Styling components"
```

#### 2.2 ctx doctor 检测语义冲突

```bash
ctx doctor

# 输出：
# Running diagnostics...
# 
# ✅ Submodules initialized
# ✅ All packages up to date
# ⚠️  2 potential semantic conflicts detected
# 
# Conflict 1: react/components
#   • react-standards: "Use Function Components with hooks"
#   • react-old: "Prefer Class Components for stateful logic"
#   Status: Unreviewed
#   
# Conflict 2: styling
#   • tailwind-guide: "Use Tailwind CSS"
#   • css-modules: "Use CSS Modules"
#   Status: Reviewed ✓ (project uses Tailwind)
# 
# Actions:
#   Review conflicts: ctx doctor --conflicts
#   Mark as reviewed: ctx doctor --resolve react/components
#   Auto-fix issues: ctx doctor --fix
```

**Detailed conflict view:**

```bash
ctx doctor --conflicts

# Semantic Conflict Details
# 
# [1] react/components (Unreviewed)
# 
#   github.com/company/react-standards@2.0.0
#   Rule: component-style
#   "Use Function Components with hooks"
#   Applies when: Creating React components
#   
#   github.com/legacy/react-old@1.5.0
#   Rule: component-style  
#   "Prefer Class Components for stateful logic"
#   Applies when: Creating React components
# 
#   Recommendations:
#   1. Remove react-old if not needed:
#      ctx remove github.com/legacy/react-old
#   
#   2. Add override in project context.md:
#      "This project follows react-standards for new code"
#   
#   3. Mark as reviewed (accept both):
#      ctx doctor --resolve react/components
# 
# [2] styling (Reviewed ✓)
#   Resolution: Project uses Tailwind CSS
#   ...
```

#### 2.3 生成的 CLAUDE.md 包含冲突信息

```markdown
# CLAUDE.md

## ⚠️ Detected Rule Conflicts

The following contexts have potentially conflicting rules:

### Conflict: react/components
- **react-standards** says: "Use Function Components with hooks"
- **react-old** says: "Prefer Class Components for stateful logic"

**Resolution**: This project follows **react-standards**. The react-old context
is included for legacy code maintenance only. When creating NEW components,
always use Function Components.

---

## Context Sources
...
```

#### 2.4 本地项目可以声明优先级

在项目根目录的 `context.md` 中：

```markdown
# Project-Specific Context

## Rule Overrides

This project overrides the following rules from installed contexts:

### Component Style (react/components)
**Override:** Use Function Components (from react-standards)
**Rationale:** We're migrating from Class Components. New code should use hooks.
**Legacy:** Class Components exist in `src/legacy/` only.
```

#### 2.5 Agent 使用冲突信息

生成的 CLAUDE.md 包含指导：

```markdown
## How to Handle Rule Conflicts

When you encounter conflicting guidance:
1. Check the "Detected Rule Conflicts" section above
2. Follow the stated resolution/override
3. If unclear, ask the user which approach to follow
4. Document the decision in your response

Example:
"I see two different approaches for component styling. The project 
has marked react-standards as the primary approach. I'll use Function 
Components with hooks for this new feature."
```

---

### Layer 3: 人工审查和标记

```bash
# 用户可以审查并标记冲突为"已知且接受"
ctx doctor --resolve react/components

# 交互式提示：
# How do you want to resolve this conflict?
# 
# 1. Keep both contexts (mark as reviewed)
#    Use react-standards for new code, react-old for legacy
# 
# 2. Remove github.com/legacy/react-old
#    Uninstall the conflicting context
# 
# 3. Add project override
#    Document the resolution in context.md
# 
# Choice [1-3]: 1
# 
# ✓ Conflict marked as reviewed
# ✓ Added to .context/resolutions.yaml

# 标记后，ctx doctor 只显示摘要，不再警告
```

---

## 完整的冲突检测流程

### 安装时

### 日常使用

```bash
ctx doctor

# ✅ Submodules initialized
# ✅ All packages up to date
# ⚠️  2 unreviewed semantic conflicts
#    → Run: ctx doctor --conflicts
# ⚠️  Context 'github.com/company/base' has updates available
#    → Run: ctx upgrade
```bash
ctx doctor

# ✅ Submodules initialized
# ✅ All packages up to date
# ⚠️  2 unreviewed semantic conflicts
#    → Run: ctx conflicts list
# ⚠️  Context 'github.com/company/base' has updates available
#    → Run: ctx upgrade
```

### Agent 检测

生成的 CLAUDE.md 包含：

```markdown
## Context Conflict Awareness

**Known conflicts:**
- react/components: Multiple approaches exist (see above)
- styling: Tailwind vs CSS Modules (project uses Tailwind)

**When working:**
- If rules seem contradictory, check the "Rule Conflicts" section
- Follow the marked resolution/override
- When in doubt, ask the user
```

---

## Implementation Details

### context.yaml Schema 扩展

```yaml
name: react-standards
version: 2.0.0
description: React best practices

# 新增：规则声明
rules:
  - id: component-style        # 唯一 ID
    category: react/components  # 分类（用于检测同类冲突）
    directive: "Use Function Components with hooks"
    applies_when: "Creating React components"
    priority: recommended       # recommended | required | optional
    
  - id: no-inline-styles
    category: styling
    directive: "Avoid inline styles, use Tailwind classes"
    applies_when: "Styling components"
    priority: required

# 可选：声明与其他 contexts 的关系
conflicts_with:
  - context: github.com/legacy/react-old
    reason: "Different component paradigms"
    resolution: "This context supersedes react-old for new code"
```

### 冲突检测算法

```typescript
function detectConflicts(contexts: Context[]): Conflict[] {
  const conflicts = [];
  const rulesByCategory = groupBy(
    contexts.flatMap(ctx => ctx.rules),
    'category'
  );
  
  for (const [category, rules] of rulesByCategory) {
    if (rules.length > 1) {
      // 检查 directives 是否相似
      const directives = rules.map(r => r.directive);
      if (!areSemanticallyCompatible(directives)) {
        conflicts.push({
          category,
          rules,
          severity: detectSeverity(rules)
        });
      }
    }
  }
  
  return conflicts;
}
```

---

## Trade-offs

**Pro:**
- ✅ 自动处理简单的版本冲突
- ✅ 检测语义冲突，防止混乱的指导
- ✅ Agent 能理解并处理冲突
- ✅ 用户有最终控制权（overrides）

**Con:**
- ❌ 需要 context 作者编写 rules 声明
- ❌ 语义冲突检测不能 100% 准确
**Next Steps:**
- [ ] 设计 context.yaml rules schema
- [ ] 实现版本冲突解析算法
- [ ] 扩展 `ctx doctor` 支持冲突检测和解析
- [ ] 实现语义冲突检测算法
- [ ] 实现 resolutions.yaml 持久化
- [ ] 在生成的配置中包含冲突信息
- [ ] 编写 context 作者指南（如何声明 rules）
---

**Next Steps:**
- [ ] 设计 context.yaml rules schema
- [ ] 实现版本冲突解析算法
- [ ] 实现 `ctx conflicts` 命令
- [ ] 实现语义冲突检测
- [ ] 在生成的配置中包含冲突信息
- [ ] 编写 context 作者指南（如何声明 rules）

---

## 🟡 High Priority Issues (Should Resolve)

### 4. 性能和规模问题

**Problem:**
- 每个 context 保留完整 `.git/` 历史可能占用大量空间
- 大量依赖时的下载和解析性能
- 初始安装可能很慢

**Impact:**
- 在 CI/CD 环境中可能超时
- 磁盘空间占用大
- 用户体验差

**Decision:** ✅ **部分由 Issue #1 解决，额外优化措施**

**Date:** 2026-01-29

**Status:** 
- ✅ Git Submodule 自带的性能特性已覆盖大部分场景
- 🔄 额外优化措施作为后续改进

**Rationale:**

Git Submodule 本身已经提供了很多性能优化：

1. **Shallow Clone（已支持）**
   ```bash
   git submodule update --init --depth=1
   # ctx install 可以内部使用这个
   ```

2. **按需克隆**
   - 只有被依赖的 context 才会被克隆
   - 不需要的 submodule 不会下载

3. **Git 的增量更新**
   - `git submodule update` 只拉取变更
   - 不需要重新下载整个仓库

**额外优化措施（按需实现）:**

```bash
# 1. ctx install 使用 shallow clone
ctx install --depth=1  # 或默认就是 shallow

# 2. CI/CD 优化模式
ctx install --frozen   # 使用 lock.yaml 的精确版本，跳过解析

# 3. 并行初始化（利用 Git 的并行特性）
git submodule update --init --recursive --jobs=4
# ctx install 内部使用
```

**实际占用估算：**

假设一个项目有 5 个 context dependencies：
- 每个 context ~50KB Markdown 文件
- 每个 .git/ 目录（shallow）~200KB
- 总计：~1.25MB

这对于现代开发环境是完全可接受的。

**Trade-offs:**
- **Pro**: Git Submodule 自带优化，无需重新实现
- **Pro**: Shallow clone 足够应对大部分场景
- **Pro**: Context 主要是 Markdown，体积小
- **Con**: 深度历史克隆在某些场景下可能较慢（但可选）

**Next Steps:**
- [x] 确认使用 Git Submodule（已在 Issue #1 决定）
- [ ] ctx install 默认使用 `--depth=1`
- [ ] 实现 `--frozen` 模式用于 CI/CD
- [ ] 监控实际使用中的性能，按需优化

---

### 5. Agent 自动更新 Context 的安全性

**Problem:**
- Agent 可能产生不准确或有偏见的更新
- 需要明确的 review 流程
- 可能需要权限控制

**Risks:**
- 质量下降（agent 错误理解）
- 安全问题（注入恶意内容）
- 版本混乱（多个 agent 同时编辑）

**Decision:** ✅ **Git 原生的 Review 工作流 + 明确的 Agent 指引**

**Date:** 2026-01-29

**Rationale:**
- 利用 Git 的 diff 和 review 能力，无需重新发明
- Agent 编辑 context 本质上就是编辑 submodule 中的文件
- Git 提供完整的审查、回滚机制
- 清晰的指引让 Agent 知道何时编辑 context

---

## 实现方案

### 1. Agent 编辑 Context 的触发条件

在生成的 CLAUDE.md 中明确说明：

```markdown
## Context Contribution

These contexts are **editable**. You may update them when:

✅ **Do edit when:**
- User explicitly asks to update context/rules
- You discover outdated information (e.g., "context says React 17, but project uses React 19")
- A useful pattern emerges that should be documented
- You find a clear error or typo in the context

❌ **Don't edit when:**
- You're unsure if the change is correct
- It's a stylistic preference, not a rule violation
- The context is marked as `editable: false` in context.yaml

**Process:**
1. Edit the file in `.context/packages/<context>/`
2. Inform the user what you changed and why
3. User reviews with: `ctx diff <context>` or `git diff`
4. User decides to keep, modify, or discard the change
```

### 2. Review 工作流

**查看所有更改：**
```bash
# 查看特定 context 的更改
ctx diff github.com/company/base
# 等价于：
# cd .context/packages/github.com/company/base && git diff

# 查看所有 contexts 的更改
ctx diff --all
# 遍历所有 submodules 并显示 git diff
```

**查看哪些 contexts 被修改了：**
```bash
ctx status
# 输出：
# Modified contexts:
#   • github.com/company/base (2 files changed)
#   • github.com/company/frontend (1 file changed)
# 
# Run 'ctx diff <context>' to review changes
# Run 'ctx push <context>' to contribute back
# Run 'ctx reset <context>' to discard changes
```

**接受更改并推送：**
```bash
# 用户审查后觉得 OK
ctx push github.com/company/base
# → 在 submodule 中创建 commit
# → 推送到远程
# → 创建 PR（或返回 PR URL）
```

**拒绝更改：**
```bash
# 用户觉得 agent 改错了
ctx reset github.com/company/base
# 等价于：
# cd .context/packages/github.com/company/base && git checkout .
```

### 3. Agent 编辑时的提示模板

在生成的配置中提供给 Agent：

```markdown
## When You Edit a Context

After editing a context file, inform the user:

**Template:**
"I've updated the [context name] to [what you changed].

**File:** `.context/packages/[context]/[file]`
**Change:** [brief description]
**Reason:** [why this change is needed]

You can review the change with:
\`\`\`bash
ctx diff [context]
\`\`\`

To accept and contribute back:
\`\`\`bash
ctx push [context]
\`\`\`

To discard:
\`\`\`bash
ctx reset [context]
\`\`\`
"
```

### 4. 防止意外覆盖（可选的锁定机制）

Context 作者可以在 `context.yaml` 中设置：

```yaml
name: critical-security-rules
version: 1.0.0

# 防止 agent 自动编辑
metadata:
  editable: false  # Agent 不应编辑这个 context
  reason: "Critical security rules - must be reviewed by security team"
```

生成的配置中会包含：

```markdown
## Read-Only Contexts

The following contexts are marked as non-editable:
- `github.com/company/security-rules` - Critical security rules

Do not modify these contexts even if they seem outdated. 
Ask the user to contact the context maintainers instead.
```

### 5. 多项目编辑同一个 Context

这是 Git 的正常工作流：

```bash
# 项目 A 的 Agent 编辑了 base context
# 用户在项目 A 中：
ctx push github.com/company/base
# → 创建 branch: ctx/project-a/20260129-100000
# → 创建 PR #123

# 项目 B 的 Agent 也编辑了 base context
# 用户在项目 B 中：
ctx push github.com/company/base
# → 创建 branch: ctx/project-b/20260129-110000
# → 创建 PR #124

# Context 维护者审查两个 PR，决定合并哪个或合并两者
```

### 6. Commit Message 标记

Agent 编辑的 commit 使用特殊前缀：

```bash
ctx push github.com/company/base
# 生成的 commit message：
# [ctx-agent] Update React component guidelines
# 
# Context: project-name
# Changed by: AI coding assistant
# Reason: Discovered outdated React version reference
# 
# Files changed:
# - details/react-patterns.md
```

这样维护者可以识别哪些是 agent 提交的。

---

## Safety Guardrails

1. **用户可见性**
   - Agent 必须明确告知用户编辑了什么
   - 使用标准化的提示模板

2. **Git 的原生保护**
   - 所有更改都在 Git 中
   - 可以轻松 diff、revert
   - 有完整的历史记录

3. **远程审查**
   - Push 后创建 PR
   - Context 维护者 review 后才合并
   - 不影响其他项目

4. **本地控制**
   - 更改在本地，用户决定是否 push
   - 可以随时 `ctx reset` 撤销

5. **可选锁定**
   - 重要的 context 可以标记为 `editable: false`
   - Agent 看到标记后不会编辑

---

**Trade-offs:**
- **Pro**: 利用成熟的 Git 工作流，无需重新实现
- **Pro**: 完整的审查和历史记录
- **Pro**: 用户有最终控制权
- **Pro**: 多项目的并发编辑通过 PR 自然解决
- **Con**: 依赖用户主动 review（但这是合理的）

**Next Steps:**
- [ ] 在生成的配置中添加 Agent 编辑指引
- [ ] 实现 `ctx diff` 和 `ctx status` 命令
- [ ] 实现 `ctx reset` 命令（封装 git checkout）
- [ ] 支持 `editable: false` 标记
- [ ] 设计 commit message 模板
- [ ] 文档说明最佳实践

**Priority:** High → ✅ Resolved

---

### 6. 跨工具一致性和差异处理

**Problem:**
- 支持 5 种不同工具，能力和限制各不相同
- 配置文件格式差异大
- `tools/` 目录的使用需要更详细说明

**Decision:** ✅ **Master File + Tool-Specific References**

**Date:** 2026-01-29

**Rationale:**
- 维护一份主 context 内容，避免重复和不同步
- 各工具的配置文件通过"引用"或"包含"指向主 context
- 利用各工具已有的文件包含/引用机制

---

## 方案设计

### 核心思路

**Single Source of Truth:**
```
.context/packages/github.com/company/base/
├── index.md              # 主内容（单一真实来源）
├── details/
│   ├── code-style.md
│   └── testing.md
└── tools/                # 工具特定的补充（可选）
    ├── claude.md         # Claude 特有的补充说明
    └── copilot.md        # Copilot 特有的补充说明
```

**生成的配置文件通过引用机制包含主内容：**

### 方案 A: 文件路径引用（最简单）

#### CLAUDE.md
```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code).

## Context Sources

This project uses [context-injector](https://github.com/user/context-injector).

**Main contexts are in:** `.context/packages/`

---

<!-- BEGIN: Auto-generated content -->

## Quick Reference

[从所有 index.md 合并的内容]

## Available Detailed Contexts

| Topic | File | Description |
|-------|------|-------------|
| Code Style | `.context/packages/.../code-style.md` | Formatting rules |
| Testing | `.context/packages/.../testing.md` | Test patterns |

**To access detailed guidance:** Use the Read tool to read the files above.

<!-- END: Auto-generated content -->

## Project-Specific Rules

[本地 context.md 的内容]
```

#### AGENTS.md (OpenAI Codex / Cursor / Aider)
```markdown
# AGENTS.md

## Context Sources

This project uses context-injector for managing coding contexts.

**Location:** `.context/packages/`

---

## Quick Reference

[从所有 index.md 合并的内容]

## Available Tools & Skills

- Code Style Guide: `.context/packages/.../code-style.md`
- Testing Guide: `.context/packages/.../testing.md`

**Usage:** Read these files when working on relevant tasks.

---

## Project Context

[本地 context.md 的内容]
```

#### .github/copilot-instructions.md
```markdown
# GitHub Copilot Instructions

## Context Files

The following files contain coding standards and patterns for this project:

- Code Style: `.context/packages/github.com/company/base/details/code-style.md`
- Testing: `.context/packages/github.com/company/base/details/testing.md`

## Quick Reference

[从所有 index.md 合并的内容]

## Project-Specific

[本地 context.md 的内容]
```

---

### 方案 B: 内容嵌入（适用于不支持文件引用的工具）

如果某些工具不支持读取其他文件，可以直接嵌入内容：

```markdown
# CLAUDE.md

## Quick Reference

<!-- AUTO-GENERATED: Do not edit manually -->
<!-- Source: .context/packages/github.com/company/base/index.md -->

### Code Style Rules
- Use TypeScript for all new code
- Prefer functional components
...

<!-- END AUTO-GENERATED -->

## Detailed Contexts

For more details, read:
- `.context/packages/.../code-style.md`
```

**重新生成时更新嵌入内容：**
```bash
ctx generate
# → 重新读取所有 index.md
# → 更新 CLAUDE.md 中的嵌入内容
```

---

### 工具特定的补充内容

**Context 结构支持工具特定覆盖：**

```
context/
├── index.md              # 通用内容（所有工具）
├── details/
│   └── code-style.md     # 通用详细内容
└── tools/                # 工具特定补充
    ├── claude.md         # Claude 特有说明
    ├── copilot.md        # Copilot 特有说明
    └── cursor.md         # Cursor 特有说明
```

**tools/ 的使用场景：**
- Claude 支持的功能 Copilot 不支持
- 不同工具的命令或界面引用方式不同
- 工具特定的最佳实践

**生成逻辑：**
```typescript
function generateCLAUDE() {
  const contexts = loadAllContexts();
  
  let content = "# CLAUDE.md\n\n";
  
  // 1. 合并所有通用内容
  content += mergeContent(contexts.map(c => c.index));
  
  // 2. 添加 Claude 特定的补充
  const claudeAdditions = contexts
    .map(c => c.tools?.claude)
    .filter(Boolean);
  
  if (claudeAdditions.length > 0) {
    content += "\n## Claude-Specific Guidance\n\n";
    content += mergeContent(claudeAdditions);
  }
  
  return content;
}
```

**示例 tools/claude.md：**
```markdown
## Claude-Specific Notes

When using the Edit tool, prefer using multi_replace_string_in_file
for multiple independent edits instead of sequential replace_string_in_file calls.

## Claude Features

You have access to:
- Read tool for reading context files
- Grep tool for searching
- Semantic search for finding relevant code
```

---

## 工具对比与策略

| Tool | Config File | File Reading | Strategy |
|------|-------------|--------------|----------|
| Claude Code | `CLAUDE.md` | ✅ Read tool | **Reference** - 指向 .context/ 文件 |
| Cursor | `AGENTS.md` | ✅ Can read | **Reference** - 指向 .context/ 文件 |
| Copilot | `.github/copilot-instructions.md` | ⚠️ Limited | **Hybrid** - 嵌入 summary + 引用详细 |
| Aider | `AGENTS.md` | ✅ Can read | **Reference** - 指向 .context/ 文件 |
| Windsurf | Uses `AGENTS.md` or custom | ✅ Can read | **Reference** - 指向 .context/ 文件 |

---

## 生成配置的统一接口

### manifest.yaml 配置生成选项

```yaml
sources:
  - github.com/company/base@^1.0

generate:
  # 为每个工具指定策略
  claude:
    enabled: true
    strategy: reference      # reference | embed | hybrid
    path: CLAUDE.md
    
  copilot:
    enabled: true
    strategy: hybrid         # 嵌入 summary，引用详细
    path: .github/copilot-instructions.md
    
  agents:                    # AGENTS.md (通用)
    enabled: true
    strategy: reference
    path: AGENTS.md
    
  # 可以添加自定义工具
  custom:
    - name: windsurf
      path: .windsurf/instructions.md
      strategy: reference
```

---

## Drawbacks & Trade-offs

### ✅ Pros:
1. **Single Source of Truth**
   - Context 内容只维护一份
   - 所有工具自动同步
   - 避免不一致

2. **工具无关**
   - 新工具只需要新的生成模板
   - Context 作者不需要关心工具差异

3. **灵活性**
   - 支持 reference（轻量）和 embed（自包含）
   - tools/ 目录允许工具特定定制

### ❌ Cons & Mitigations:

1. **Con: 依赖工具的文件读取能力**
   - Mitigation: 提供 hybrid 和 embed 策略
   - Mitigation: 大部分现代 AI 工具都支持文件读取

2. **Con: 嵌入策略需要重新生成**
   ```bash
   # Context 更新后需要重新生成
   ctx upgrade
   ctx generate  # 更新嵌入的内容
   ```
   - Mitigation: `ctx upgrade` 自动调用 `ctx generate`
   - Mitigation: 在 git hooks 中提示

3. **Con: 工具特定的 tools/ 增加维护负担**
   - Mitigation: tools/ 是可选的
   - Mitigation: 大部分情况下不需要

4. **Con: 不同工具的格式差异**
   - Mitigation: 使用模板系统处理
   - Mitigation: Context 内容使用通用 Markdown

---

**Implementation Plan:**

```typescript
// 生成器架构
interface Generator {
  name: string;
  strategy: 'reference' | 'embed' | 'hybrid';
  generate(contexts: Context[]): string;
}

class ClaudeGenerator implements Generator {
  strategy = 'reference';
  
  generate(contexts: Context[]) {
    return `
# CLAUDE.md

## Quick Reference
${this.mergeSummaries(contexts)}

## Available Contexts
${this.buildFileIndex(contexts)}

## Tool-Specific
${this.mergeToolSpecific(contexts, 'claude')}
    `;
  }
}

class CopilotGenerator implements Generator {
  strategy = 'hybrid';
  
  generate(contexts: Context[]) {
    return `
# GitHub Copilot Instructions

## Summary (Embedded)
${this.mergeSummaries(contexts)}

## Detailed Guides (Reference)
${this.buildFileIndex(contexts)}
    `;
  }
}
```

---

**Next Steps:**
- [ ] 确认各工具的文件读取能力
- [ ] 设计通用的 Context → Config 生成器接口
- [ ] 实现 reference 策略（优先）
- [ ] 实现 embed 策略（fallback）
- [ ] 实现 tools/ 特定补充逻辑
- [ ] 为常见工具提供默认模板
- [ ] 文档说明如何添加新工具支持

**Priority:** High → ✅ Resolved

---

## 🟢 Medium Priority Issues (Good to Resolve)

### 7. 版本管理细节

**Problem:**
- Semver 解析需要准确（^1.0, ~1.0, >=1.0 等）
- Branch 和 commit 作为版本的稳定性问题
- Lock file 的更新时机

**Decision:** ✅ **使用成熟的 semver 库 + 明确的版本策略**

**Date:** 2026-01-29

**Rationale:**
- 不要重新发明轮子，使用经过测试的 semver 实现
- 提供明确的版本引用规则
- Lock file 确保可重现性

---

## 实现方案

### 1. 使用 semver 库

**选择：** 使用 npm 的 `semver` 包（Node.js 生态最成熟的实现）

```typescript
import semver from 'semver';

// 版本范围解析
semver.satisfies('1.2.3', '^1.0.0');  // true
semver.satisfies('2.0.0', '^1.0.0');  // false

// 找到最新兼容版本
const versions = ['1.0.0', '1.2.0', '1.2.3', '2.0.0'];
const compatible = versions.filter(v => semver.satisfies(v, '^1.0.0'));
const latest = semver.maxSatisfying(compatible, '^1.0.0'); // '1.2.3'
```

### 2. 版本引用规则

**支持的版本格式：**

| 格式 | 示例 | 行为 | 用途 |
|------|------|------|------|
| **Exact** | `@1.2.3` | 精确版本 | 生产环境稳定性 |
| **Caret** | `@^1.0.0` | 1.x.x (兼容性更新) | 推荐：自动获取补丁和小版本 |
| **Tilde** | `@~1.2.0` | 1.2.x (补丁更新) | 谨慎：只接受补丁 |
| **Range** | `@>=1.0.0 <2.0.0` | 范围 | 高级用法 |
| **Latest** | `@latest` | 最新 release tag | 开发/试验 |
| **Branch** | `@main` | 分支的 HEAD | 开发中的 context |
| **Commit** | `@a1b2c3d` | 特定 commit | 调试/临时固定 |

**默认行为（未指定版本）：**
```bash
ctx add github.com/company/base
# 等价于：
ctx add github.com/company/base@latest
# → 查找最新的 release tag
# → 如果没有 tag，使用 @main
```

### 3. Git Tag 与 Semver 的映射

**Git Tag 命名规范：**
```bash
# 推荐格式（自动识别为 semver）
v1.2.3
v1.0.0-beta.1
v2.0.0-rc.2

# 也支持无 v 前缀
1.2.3
```

**Tag 发现和解析：**
```typescript
async function findVersions(repoUrl: string): Promise<string[]> {
  // 1. 获取所有 tags
  const tags = await git.listTags(repoUrl);
  
  // 2. 过滤出符合 semver 的 tags
  const versions = tags
    .map(tag => tag.replace(/^v/, ''))  // 移除 v 前缀
    .filter(tag => semver.valid(tag));   // 只保留有效的 semver
  
  return versions;
}

async function resolveVersion(
  repoUrl: string, 
  versionSpec: string
): Promise<{ version: string; commit: string }> {
  
  if (semver.valid(versionSpec)) {
    // 精确版本
    return findTagCommit(repoUrl, `v${versionSpec}`);
  }
  
  if (semver.validRange(versionSpec)) {
    // Semver 范围
    const versions = await findVersions(repoUrl);
    const matched = semver.maxSatisfying(versions, versionSpec);
    return findTagCommit(repoUrl, `v${matched}`);
  }
  
  if (versionSpec === 'latest') {
    // 最新 release
    const versions = await findVersions(repoUrl);
    const latest = semver.maxSatisfying(versions, '*');
    return findTagCommit(repoUrl, `v${latest}`);
  }
  
  // Branch 或 commit
  return resolveBranchOrCommit(repoUrl, versionSpec);
}
```

### 4. Branch 引用的处理

**问题：** Branch 是移动的，会导致不确定性

**解决方案：** Lock file 记录 commit SHA

```yaml
# manifest.yaml (用户编写)
sources:
  - github.com/company/experimental@main

# lock.yaml (自动生成)
resolved:
  - url: github.com/company/experimental
    ref: main
    commit: a1b2c3d4e5f6  # ← 锁定具体 commit
    resolved_at: "2026-01-29T10:30:00Z"
```

**更新策略：**
```bash
# 安装时：使用 lock file 的 commit
ctx install
# → 检出 a1b2c3d4e5f6

# 升级时：获取最新的 main
ctx upgrade github.com/company/experimental
# → 获取 main 的最新 commit
# → 更新 lock.yaml
# → 用户看到 git diff（submodule 更新）
```

### 5. Lock File 更新时机

**自动更新 lock.yaml 的时机：**

| 命令 | Lock file 行为 |
|------|---------------|
| `ctx add <context>` | 添加新条目到 lock.yaml |
| `ctx install` | 如果 lock.yaml 不存在，创建它<br>如果存在，使用它（不更新） |
| `ctx install --frozen` | 严格使用 lock.yaml，如果不存在则报错 |
| `ctx upgrade` | 更新 lock.yaml 到最新兼容版本 |
| `ctx upgrade --latest` | 更新到最新版本（忽略 semver 范围） |

**示例：**
```bash
# 初始安装
ctx add github.com/company/base@^1.0
# manifest.yaml: ^1.0
# lock.yaml: 1.2.3 (当时的最新兼容版本)

# 几个月后，1.3.0 发布
ctx install
# → 仍然使用 1.2.3 (来自 lock.yaml)

ctx upgrade
# → 更新到 1.3.0
# → 更新 lock.yaml
```

### 6. 处理被删除的 Tag/Branch

**场景：** Lock file 引用的 tag 或 commit 被删除

```bash
ctx install
# Error: Commit a1b2c3d not found in github.com/company/base
# 
# Possible causes:
# 1. The commit was force-pushed over
# 2. The tag was deleted
# 3. The repository was rebased
# 
# Solutions:
# 1. Update to latest: ctx upgrade github.com/company/base
# 2. Specify a different version: ctx add github.com/company/base@^2.0 --force
```

**防护措施：**
- 推荐使用 release tags（不应该被删除）
- 文档中强调 tag 的不可变性
- 提供友好的错误消息和恢复选项

---

## 完整的版本解析流程

```typescript
async function resolveAndInstall(source: string) {
  // 1. 解析 URL 和版本
  const { url, versionSpec } = parseSource(source);
  // "github.com/company/base@^1.0" 
  //   → url: "github.com/company/base"
  //   → versionSpec: "^1.0"
  
  // 2. 检查 lock file
  const locked = lockFile.get(url);
  if (locked && !isUpgrade) {
    // 使用 locked 版本
    return installVersion(url, locked.commit);
  }
  
  // 3. 解析版本
  const resolved = await resolveVersion(url, versionSpec);
  // versionSpec: "^1.0"
  //   → 获取所有 tags: [1.0.0, 1.2.0, 1.2.3, 2.0.0]
  //   → 过滤兼容: [1.0.0, 1.2.0, 1.2.3]
  //   → 选择最新: 1.2.3
  //   → 获取 commit: b2c3d4e5
  
  // 4. 更新 lock file
  lockFile.set(url, {
    version: resolved.version,
    commit: resolved.commit,
    resolved_at: new Date().toISOString()
  });
  
  // 5. 安装（git submodule add）
  return installVersion(url, resolved.commit);
}
```

---

**Trade-offs:**
- **Pro**: 使用成熟的 semver 库，避免 bug
- **Pro**: 与 npm/yarn 等工具一致的行为
- **Pro**: Lock file 确保可重现性
- **Con**: 需要理解 semver 语义（但这是行业标准）

**Next Steps:**
- [x] 选择 semver 库（npm `semver` package）
- [ ] 实现版本解析逻辑
- [ ] 实现 lock file 生成和读取
- [ ] 处理边界情况（删除的 tag 等）
- [ ] 文档说明版本引用规则
- [ ] 添加 `ctx upgrade` 命令

**Priority:** Medium → ✅ Resolved

---

### 8. 安全性考虑

**Problem:**
- 从 Git URL 下载代码存在安全风险
- Integrity 检查提到但未详细说明
- 恶意 context 可能注入危险内容

**Risks:**
- Supply chain attacks
- 恶意代码注入到 AI 提示中
- 私有数据泄露

**Decision:** ✅ **分层安全策略：Git 安全 + Lock File Integrity + 可选验证**

**Date:** 2026-01-29

**Rationale:**
- Context 主要是 Markdown，风险相对较低（不是可执行代码）
- 利用 Git 的内置安全机制
- Lock file 提供 integrity 保证
- 可选的额外验证层级

---

## 安全策略

### Layer 1: Git 原生安全（基础）

**Git 已提供的安全机制：**

1. **HTTPS/SSH 传输加密**
   ```bash
   # HTTPS with TLS
   git clone https://github.com/company/context.git
   
   # SSH with keys
   git clone git@github.com:company/context.git
   ```

2. **Commit SHA 验证**
   - Git 的 SHA-1 (或 SHA-256) 保证内容完整性
   - 任何篡改都会改变 SHA

3. **Git 托管平台的安全**
   - GitHub/GitLab 的访问控制
   - 2FA, access tokens
   - Audit logs

**我们的利用：**
- 使用 Git 的正常克隆机制
- Lock file 记录 commit SHA
- 依赖 Git 托管平台的安全

---

### Layer 2: Lock File Integrity（核心）

**Lock file 作为 integrity 检查：**

```yaml
# lock.yaml
resolved:
  - url: github.com/company/base
    version: 1.2.3
    commit: a1b2c3d4e5f6g7h8  # ← 这就是 integrity hash
    resolved_at: "2026-01-29T10:30:00Z"
```

**验证流程：**
```typescript
async function verifyIntegrity(context: Context) {
  const locked = lockFile.get(context.url);
  const actual = await git.getCurrentCommit(context.path);
  
  if (locked.commit !== actual) {
    throw new Error(
      `Integrity check failed for ${context.url}\n` +
      `Expected commit: ${locked.commit}\n` +
      `Actual commit:   ${actual}\n` +
      `Possible tampering or unexpected update detected.`
    );
  }
}
```

**安装时自动验证：**
```bash
ctx install
# → 检出 lock file 中的 commit
# → Git 自动验证 SHA
# → 如果 SHA 不匹配，Git 会报错

ctx doctor
# → 验证所有 submodules 的 commit 与 lock file 一致
# ✅ All contexts match lock file
# ❌ Context 'base' has unexpected commit (tampering?)
```

---

### Layer 3: 可选的内容验证

#### 3.1 基本内容扫描

**检测明显的恶意内容：**
```typescript
function scanContext(contextPath: string): SecurityIssue[] {
  const issues = [];
  
  // 1. 检查文件类型（应该只有 .md, .yaml）
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
  
  // 2. 检查 Markdown 中的可疑内容
  const mdFiles = files.filter(f => f.endsWith('.md'));
  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    // 检查内联脚本
    if (content.includes('<script>')) {
      issues.push({
        severity: 'error',
        file,
        message: 'Contains <script> tags'
      });
    }
    
    // 检查可疑链接
    if (content.match(/https?:\/\/[^\s]+\.(exe|sh|bat|ps1)/)) {
      issues.push({
        severity: 'warning',
        file,
        message: 'Contains links to executable files'
      });
    }
  }
  
  return issues;
}
```

**集成到安装流程：**
```bash
ctx install

# Auto-scan for security issues...
# ⚠️  Warning in github.com/company/base:
#    - details/guide.md contains external executable link
# 
# Continue? [y/N]
```

#### 3.2 可信来源白名单（可选）

**manifest.yaml 支持白名单配置：**
```yaml
sources:
  - github.com/company/base@^1.0
  - github.com/untrusted/sketchy@^2.0

# 可选：信任配置
trust:
  # 自动信任这些来源（跳过扫描）
  trusted_sources:
    - github.com/company/*
    - github.com/myorg/*
  
  # 总是扫描（即使在 trusted_sources 中）
  always_scan: false
```

**配置优先级：**
```bash
# 全局配置
~/.config/ctx/config.yaml
trust:
  trusted_sources:
    - github.com/mycompany/*

# 项目配置覆盖
.context/manifest.yaml
trust:
  trusted_sources:
    - github.com/external/verified-context
```

---

### Layer 4: 私有 Context 的认证

**问题：** 私有仓库需要认证

**解决方案：** 利用 Git 的认证机制

**1. SSH Keys（推荐）**
```bash
# 用户配置 SSH key
ssh-add ~/.ssh/id_rsa

# ctx 使用 SSH URL
ctx add git@github.com:company/private-context.git
# Git 自动使用用户的 SSH key
```

**2. HTTPS + Token**
```bash
# 方法 1: Git credential helper（推荐）
git config --global credential.helper store
# 用户第一次输入 token 后会被存储

# 方法 2: 在 URL 中（不推荐，仅测试）
ctx add https://TOKEN@github.com/company/private-context.git

# 方法 3: 环境变量
export GIT_ASKPASS=/path/to/askpass-script
```

**ctx 不存储任何认证信息，完全依赖 Git**

---

### Layer 5: GPG 签名验证（可选，高级）

**对于高安全需求的场景：**

Context 维护者可以对 Git commits 签名：

```bash
# Context 作者签名 commits
git config user.signingkey <key-id>
git commit -S -m "Update security rules"
git tag -s v1.2.3 -m "Release 1.2.3"
```

**ctx 验证签名：**
```yaml
# context.yaml
name: security-policies
version: 1.0.0

# 要求 GPG 签名
security:
  require_signed_commits: true
  trusted_keys:
    - fingerprint: "ABCD1234..."
      owner: "security-team@company.com"
```

**安装时验证：**
```bash
ctx install

# Verifying signatures...
# ✅ github.com/company/security-policies
#    Signed by: security-team@company.com
#    Key: ABCD1234...
# 
# ❌ github.com/untrusted/context
#    Required signature not found
#    Error: This context requires GPG signatures
```

**实现（可选，v2 特性）：**
```typescript
async function verifySignature(context: Context): Promise<boolean> {
  if (!context.security?.require_signed_commits) {
    return true; // 不需要验证
  }
  
  const commit = await git.getCommit(context.commit);
  if (!commit.signature) {
    throw new Error('Commit signature required but not found');
  }
  
  const isValid = await gpg.verify(
    commit.signature,
    context.security.trusted_keys
  );
  
  if (!isValid) {
    throw new Error('Invalid GPG signature');
  }
  
  return true;
}
```

---

## 安全最佳实践（文档）

### For Context Users

**推荐做法：**
1. ✅ 使用组织/团队维护的 contexts
2. ✅ Review lock file changes in PRs
3. ✅ Run `ctx doctor` 定期检查
4. ✅ 使用具体版本（`@1.2.3`）而不是 `@latest` 在生产环境
5. ✅ 将 lock.yaml 提交到 Git

**避免：**
❌ 从未知来源添加 contexts
❌ 忽略 `ctx doctor` 的安全警告
❌ 使用 `--force` 跳过验证

### For Context Authors

**推荐做法：**
1. ✅ 只包含 Markdown/YAML 文件
2. ✅ 使用 semver 标签发布
3. ✅ 避免外部链接到可执行文件
4. ✅ 为关键 contexts 启用 GPG 签名（可选）
5. ✅ 在 README 中说明安全策略

**避免：**
❌ 包含脚本或可执行文件
❌ 嵌入 `<script>` 标签
❌ 频繁 force-push（破坏 SHA 验证）

---

## 实际风险评估

**Context 的安全风险相对较低：**

| 风险类型 | 可执行代码 | Markdown Context | 理由 |
|---------|----------|------------------|------|
| 代码执行 | 🔴 高 | 🟢 无 | Markdown 不可执行 |
| 数据泄露 | 🟡 中 | 🟡 中 | 可能包含敏感信息 |
| Supply Chain | 🔴 高 | 🟡 中 | 影响 AI 行为，但不直接执行 |
| 篡改 | 🔴 高 | 🟢 低 | Git SHA + Lock file 防护 |

**最大的风险：影响 AI 行为**
- 恶意 context 可能误导 AI 生成有问题的代码
- **缓解：** 用户仍然 review AI 生成的代码
- **缓解：** Context 更改在 git diff 中可见

---

**Trade-offs:**

**Pro:**
- ✅ 利用 Git 成熟的安全机制
- ✅ Lock file 提供 integrity 保证
- ✅ 分层验证，可选复杂度
- ✅ Context 本身风险较低（Markdown）

**Con:**
- ⚠️ 依赖用户 review lock file 变更
- ⚠️ 高级功能（GPG）增加复杂度
- ⚠️ 内容扫描可能有误报

**Mitigation:**
- 清晰的文档说明安全最佳实践
- `ctx doctor` 自动检查常见问题
- 将 GPG 签名作为可选高级特性

---

**Next Steps:**
- [ ] 实现 lock file integrity 验证
- [ ] 实现基本内容扫描（检测可疑文件）
- [ ] 添加 `ctx doctor --security` 安全检查
- [ ] 编写安全最佳实践文档
- [ ] （可选）实现 GPG 签名验证（v2）
- [ ] 支持可信来源白名单配置

**Priority:** Medium → ✅ Resolved (基础安全已覆盖，高级特性可选)

---

### 9. 用户体验和学习曲线

**Problem:**
- "Context package" 概念对新用户可能陌生
- 错误消息需要清晰友好
- 需要详细的文档和示例

**Questions:**
- [ ] 是否需要交互式 `ctx init` wizard？
- [ ] 如何提供有用的错误消息和建议？
- [ ] 需要什么样的示例 contexts？
- [ ] 是否提供 context templates？

**Proposed Solutions:**
1. 创建详细的 getting started guide
2. 提供官方 context 示例仓库
3. 实现友好的错误消息（类似 Rust 编译器）
4. 添加 `ctx doctor` 命令诊断常见问题

**Priority:** Medium  
**Decision:** _TBD_

---

### 10. 技术实现选择

**Problem:**
- isomorphic-git vs simple-git 的选择影响功能和性能
- 跨平台兼容性测试
- Node.js 版本支持策略

**Questions:**
- [ ] isomorphic-git (纯 JS) vs simple-git (依赖系统 git)？
- [ ] 最低 Node.js 版本？（14? 16? 18?）
- [ ] 如何在 CI/CD 环境中测试？
- [ ] 是否需要支持 Deno/Bun？

**Comparison:**
| Feature | isomorphic-git | simple-git |
|---------|---------------|------------|
| 无需系统 git | ✅ | ❌ |
| 性能 | 🟡 慢 | ✅ 快 |
| 功能完整性 | 🟡 部分 | ✅ 完整 |
| Bundle size | 🟡 大 | ✅ 小 |

**Proposed Solutions:**
1. 从 simple-git 开始（假设用户有 git）
2. 后续考虑 isomorphic-git 作为 fallback
3. 支持 Node.js 18+ (active LTS)

**Priority:** Medium  
**Decision:** _TBD_

---

## 📋 Resolution Process

### How to Resolve Issues

1. **Research**: 收集更多信息和社区最佳实践
2. **Prototype**: 快速验证可行性
3. **Decide**: 在本文档中记录决策和理由
4. **Update**: 更新 PRODUCT_DESIGN.md
5. **Implement**: 开始编码

### Decision Template

```markdown
**Decision:** [Solution Option]
**Date:** YYYY-MM-DD
**Rationale:** 
- Reason 1
- Reason 2
**Trade-offs:**
- Pro: ...
- Con: ...
**Next Steps:**
- [ ] Action 1
- [ ] Action 2
```

---

## 🎯 Recommended Resolution Order

### Phase 1: Foundation (Critical Path)
1. Issue #1: Git 仓库嵌套策略
2. Issue #3: 依赖冲突解决
3. Issue #10: 技术栈选择

### Phase 2: Core Functionality
4. Issue #4: 性能优化
5. Issue #2: Push 权限处理
6. Issue #7: 版本管理

### Phase 3: Polish
7. Issue #6: 跨工具支持
8. Issue #8: 安全性
9. Issue #5: Agent 编辑
10. Issue #9: 用户体验

---

## 📝 Notes

- 这个文档是活文档，随着问题解决会持续更新
- 每个问题解决后，将状态改为 ✅ 并添加决策记录
- 新发现的问题应该添加到相应的优先级分类中


# Risks

1. The "Edit-in-Vendor" Pattern (High Risk)
In Chapter 5, the story encourages modifying files directly inside .context/packages/.

The Issue: This folder acts like a dependency folder (similar to node_modules or vendor). Developers are trained to treat these folders as disposable and read-only.
The Risk: If a user runs ctx install --force or deletes the .context folder to troubleshoot (a common habit), they will lose all their unpushed work.
Suggestion: Instead of direct editing, a safer flow would be ctx edit <package>, which could check out the package to a temporary workspace or "dev" mode, making it clear that this package is now in a mutable state.
2. The Abstraction "Drop-off" in Chapter 9 (Not Smooth)
In Chapter 9, the user flow suddenly abandons the tool's abstraction.

The Issue: The story relies on high-level ctx commands for everything (install, add, upgrade) until it comes to publishing. Then, it dumps the user into raw, complex git commands (git init, gh repo create, git tag, etc.).
The Friction: This breaks the promise of "ease of use." A developer who enjoys the simplicity of ctx init might struggle with the specific git incantations needed to publish correctly.
Suggestion: Introduce a ctx publish command that wraps these steps (initializing the repo, tagging the version, and pushing), keeping the experience consistent.
3. Missing Authentication Steps (Logical Gap)
The Issue: The story uses private company repositories (github.com/techcorp/...) starting in Chapter 2, but Chapter 1 (Getting Started) never mentions authentication.
The Friction: A real user following this story would hit a "Permission Denied" error immediately upon running ctx add.
Suggestion: Add a ctx login step or explicitly mention that it uses the existing gh CLI credentials to make the story technically accurate.
4. "Magic" PR Creation (Usability Concern)
In Chapter 6, ctx push does too much at once: creates branch -> commits -> pushes -> opens PR.

The Issue: Developers rarely want to "fire and forget" a Pull Request without reviewing the commit message or the final diff one last time.
The Friction: It assumes the commit message "[ctx] Updates from payment-service" is sufficient. Most teams require specific commit formats (e.g., "fix: update validation logic").
Suggestion: The command should likely be interactive or allow flags (e.g., ctx push --message "..." --draft), or be split into ctx commit and ctx pr.
5. Optimistic Major Upgrades
In Chapter 8, the user upgrades from v2.3.0 to v3.0.0 with a single command.

The Issue: Semantic Versioning implies v3.0.0 contains breaking changes.
The Friction: In reality, simply running ctx upgrade for a major version might break the project (e.g., rules referenced in CLAUDE.md might no longer exist). The story makes this look too safe.
Suggestion: The tool should probably warn the user about major version upgrades or require a confirmation flag.