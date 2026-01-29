# Context Injector - 产品设计

## 愿景

一个用于跨项目管理和注入 AI 编程上下文的 CLI 工具。开源、去中心化，使用 Git URL 进行分享。

## 支持的工具 (v1)

| 工具 | 配置文件 | 位置 |
|------|-------------|----------|
| Claude Code | `CLAUDE.md` | 项目根目录 |
| GitHub Copilot | `copilot-instructions.md` | `.github/` |
| Kilo Code | `kilo.md` | 项目根目录或 `.kilo/` |
| OpenCode | `opencode.md` | 项目根目录 |
| OpenAI Codex | `AGENTS.md` | 项目根目录 |

## 核心概念

### 1. 上下文源

任何包含上下文文件的 Git 仓库。通过 URL 识别：

```
github.com/org/repo
github.com/org/monorepo/path/to/context
gitlab.com/team/rules
```

### 2. 上下文包结构

```
my-context/
├── context.yaml          # 元数据和依赖
├── index.md              # 摘要（始终加载）
├── details/              # 详细上下文（按需加载）
│   ├── code-style.md
│   ├── architecture.md
│   └── testing.md
└── tools/                # 工具特定覆盖（可选）
    ├── claude.md         # Claude 特定补充
    └── copilot.md        # Copilot 特定补充
```

### 3. context.yaml 模式

```yaml
name: frontend-standards
version: 2.1.0
description: Frontend development standards

# 对其他上下文的依赖
depends:
  - github.com/company/base-standards@^1.0
  - github.com/company/typescript-rules@^2.0

# 摘要中包含的内容（index.md 始终包含）
summary:
  - details/code-style.md#quick-reference    # 特定章节

# 用于发现和智能加载的标签
tags:
  - frontend
  - react
  - typescript
```

## 标签系统

标签能够实现发现、智能推荐和智能上下文加载。

### 标签分类

| 分类 | 示例标签 | 用途 |
|----------|--------------|---------|
| **平台** | `frontend`, `backend`, `mobile`, `devops` | 广泛分类 |
| **框架** | `react`, `vue`, `express`, `django`, `spring` | 框架特定 |
| **语言** | `typescript`, `python`, `go`, `rust` | 语言特定 |
| **领域** | `payments`, `auth`, `ml`, `data-pipeline` | 业务领域 |
| **实践** | `testing`, `security`, `performance`, `accessibility` | 跨领域关注点 |

### 用法 1：搜索和发现

**搜索需要配置源。** 没有中央注册表 - 你需要配置搜索位置。

**配置搜索源（全局或每个项目）：**

```yaml
# ~/.config/ctx/config.yaml (全局)
# 或 .context/manifest.yaml (每个项目)

registries:
  - github.com/techcorp/context-catalog       # 公司目录
  - github.com/awesome-contexts/community     # 社区目录
```

**目录仓库结构：**

目录只是一个包含 `index.yaml` 的仓库：

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

**搜索命令：**

```bash
# 搜索已配置的注册表
ctx search --tag react
ctx search --tag backend --tag typescript

# 搜索特定注册表
ctx search --tag payments --registry github.com/techcorp/context-catalog

# 按标签列出已安装的上下文（始终有效，不需要注册表）
ctx list --tag frontend
```

**替代方案：GitHub Topics（可选）**

上下文可以使用 GitHub topics 进行发现：

```bash
# 在 GitHub 上搜索带有 'ctx-context' topic 和你的标签的仓库
ctx search --github --tag react
```

需要上下文仓库有 `ctx-context` GitHub topic。

### 用法 2：智能推荐

初始化项目时，`ctx` 可以分析并建议：

```bash
ctx init --detect
```

输出：
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

### 用法 3：智能体智能加载

在生成的配置中，标签帮助智能体决定读取什么：

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

### 用法 4：清单标签过滤

项目可以声明其类型以过滤不相关的上下文：

```yaml
# manifest.yaml
project:
  tags:
    - frontend
    - react
    - typescript

sources:
  - github.com/techcorp/engineering-standards@^2.0
  - github.com/techcorp/fullstack-patterns@^1.0   # 同时包含前端和后端

# 生成时，仅包含带有项目标签的内容
generate:
  filter_by_project_tags: true  # 忽略仅与后端相关的章节
```

### 用法 5：上下文兼容性

警告潜在的不匹配：

```bash
ctx add github.com/techcorp/ios-patterns
```

输出：
```
⚠ Warning: This context is tagged [ios, swift, mobile]
  Your project appears to be [web, react, typescript]

Add anyway? (y/n)
```

### 标签继承

上下文可以从依赖继承标签：

```yaml
# frontend-standards/context.yaml
name: frontend-standards
tags:
  - frontend
  - web
depends:
  - github.com/techcorp/engineering-standards  # 也继承其标签
```

加载时，有效标签 = 自己的标签 + 依赖标签。

## 依赖解析

### 去重策略

```
项目依赖于：
  ├── github.com/company/frontend@2.0
  │   └── depends: github.com/company/base@^1.0  → 解析为 1.2.0
  └── github.com/company/backend@3.0
      └── depends: github.com/company/base@^1.0  → 重用 1.2.0

结果：base@1.2.0 只安装一次
```

### 版本解析规则

1. 精确匹配：`@1.2.3` → 使用确切的 1.2.3
2. Semver 范围：`@^1.0` → 最新兼容版本 (1.x.x)
3. 分支：`@main` → main 分支上的最新提交
4. 提交：`@a1b2c3d` → 确切提交
5. 无版本：→ 最新发布标签，或如果没有标签则使用 main

### 冲突处理

```yaml
# 如果需要不兼容的版本：
# frontend 需要 base@^1.0
# legacy-tool 需要 base@^0.9

# 错误及解决选项：
ctx install
# Error: Conflicting versions for github.com/company/base
#   - frontend@2.0 requires base@^1.0
#   - legacy-tool@1.0 requires base@^0.9
#
# Solutions:
#   1. ctx add github.com/company/base@1.0 --force
#   2. Update legacy-tool to support base@^1.0
```

## 渐进式上下文加载

### 设计原则

**不要将所有内容都转储到配置文件中。** 相反：
1. 提供带有基本规则的**摘要**
2. 提供可用详细上下文的**索引**
3. 让智能体**按需获取详细信息**

### 生成的 CLAUDE.md 结构

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

### 智能体如何使用

1. **始终加载**：快速参考部分
2. **按需加载**：智能体在以下情况下读取特定文件：
   - 处理 React 组件时 → 读取 `react.md`
   - 设计 API 时 → 读取 `api.md`
   - 编写测试时 → 读取 `testing.md`

### 智能体驱动的上下文演进

智能体可以在正常工作流程中**自动改进上下文**：

**上下文更新的触发器：**

| 触发器 | 示例 | 操作 |
|---------|---------|--------|
| **过时信息** | 上下文说"使用 React 17"但项目使用 React 19 | 智能体提议更新 |
| **缺少模式** | 智能体发现了一个未记录的有用模式 | 智能体添加到上下文 |
| **不正确的规则** | 规则在实践中导致问题 | 智能体建议更正 |
| **新的最佳实践** | 智能体从用户反馈中学到了一些东西 | 智能体捕获知识 |

**智能体指令（包含在生成的配置中）：**

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

**工作流集成：**

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

**自动感知上下文更新：**

当智能体完成某些任务时，应考虑上下文更新：

| 任务类型 | 上下文检查 |
|-----------|---------------|
| Bug 修复 | "错误处理文档是否应该更新？" |
| 新功能 | "这里是否有值得记录的模式？" |
| 重构 | "我们是否建立了新的约定？" |
| 代码审查 | "编码标准是否仍然准确？" |

**安全护栏：**

1. **用户可见性** - 始终告诉用户更改了什么
2. **无自动推送** - 更改保持在本地，直到用户运行 `ctx push`
3. **差异审查** - 用户可以在推送前执行 `ctx diff`
4. **易于恢复** - `ctx reset <package>` 放弃本地更改

### 对智能体的指令

生成的配置包含：

```markdown
## How to Use Contexts

When working on specific areas, read the relevant context files listed above.
For example:
- Before refactoring React code, read the React Patterns context
- Before designing APIs, read the API Design context
- When unsure about conventions, check the Code Style context

You have full access to these files via the Read tool.
```

## CLI 命令

### 初始化

```bash
ctx init
# 创建：
#   .context/
#   ├── manifest.yaml
#   └── .gitignore
```

### 添加上下文

```bash
ctx add github.com/company/standards
ctx add github.com/company/frontend@v2.0
ctx add github.com/company/monorepo/contexts/react
```

### 安装

```bash
ctx install                  # 安装所有依赖
ctx install --frozen         # 使用锁文件中的确切版本

# 过程：
# 1. 解析依赖树
# 2. 去重
# 3. 下载到 .context/packages/
# 4. 生成配置文件（CLAUDE.md 等）
```

### 升级

```bash
ctx upgrade                           # 升级全部
ctx upgrade github.com/company/base   # 升级特定包
ctx upgrade --latest                  # 忽略 semver，获取最新版本
```

### 生成

```bash
ctx generate                 # 重新生成所有配置文件
ctx generate --target claude # 仅生成 CLAUDE.md
ctx generate --target copilot
ctx generate --target kilo
ctx generate --target opencode
ctx generate --target codex  # 仅生成 AGENTS.md
```

### 同步（推送更改回源）

**核心原则：** 原生利用 Git。`.context/packages/` 中的每个上下文都是一个 Git 仓库（或稀疏检出）。

**本地编辑：**

用户直接在 `.context/packages/` 中编辑文件：
```bash
# 直接编辑上下文文件
vim .context/packages/github.com/company/base/details/code-style.md
```

**查看更改（使用 Git）：**

```bash
ctx diff                                 # 显示所有本地更改（git diff）
ctx diff github.com/company/base        # 显示特定上下文的更改
ctx status                               # 显示已修改的上下文（git status）
```

**推送到远程：**

```bash
ctx push github.com/company/base
# → 创建分支：ctx/<project-name>/<timestamp>
# → 推送更改
# → 创建 PR
# → 返回 PR URL

# 使用自定义分支名称
ctx push github.com/company/base --branch fix-typo

# 推送所有修改的上下文
ctx push --all
```

**推送流程：**

```
ctx push github.com/company/base
│
├─→ 1. 创建本地分支：ctx/my-webapp/20240115-103000
│
├─→ 2. 提交本地更改
│
├─→ 3. 尝试推送
│      ├─ 成功 → 创建 PR → 返回 PR URL
│      └─ 失败  → "Error: No push access to github.com/company/base.
│                    Fork the repo first, then update manifest to use your fork."
│
└─→ 完成
```

**分支命名约定：**

```
ctx/<project-name>/<timestamp>

示例：
- ctx/my-webapp/20240115-103000
- ctx/backend-api/20240120-142530
```

### 其他命令

```bash
ctx list                     # 列出已安装的上下文
ctx tree                     # 显示依赖树
ctx why <package>            # 为什么安装了这个包
ctx outdated                 # 显示可用更新
ctx reset <package>          # 放弃本地更改（git checkout）
ctx reset --all              # 放弃所有本地更改
ctx cache clean              # 清除下载缓存
```

## 项目中的文件结构

```
my-project/
├── .context/
│   ├── manifest.yaml           # 用户声明的依赖
│   ├── lock.yaml               # 解析的版本（自动生成）
│   └── packages/               # Git 仓库（每个都是完整/稀疏检出）
│       └── github.com/
│           └── company/
│               ├── base/                 # ← 这是一个 git 仓库
│               │   ├── .git/             # Git 历史已保留
│               │   ├── context.yaml
│               │   ├── index.md
│               │   └── details/
│               └── frontend/             # ← 这是一个 git 仓库
│                   ├── .git/
│                   ├── context.yaml
│                   ├── index.md
│                   └── details/
├── CLAUDE.md                   # 自动生成
├── AGENTS.md                   # 自动生成（OpenAI Codex）
├── .github/
│   └── copilot-instructions.md # 自动生成
├── kilo.md                     # 自动生成
├── opencode.md                 # 自动生成
└── context.md                  # 可选：项目特定覆盖
```

**注意：** `.context/packages/` 在主项目中被 gitignore，但里面的每个包都是其自己的 Git 仓库，具有完整的历史记录。

### manifest.yaml

```yaml
sources:
  - github.com/company/base-standards@^1.0
  - github.com/company/frontend@^2.0
  - github.com/myteam/react-patterns@main

# 输出配置
generate:
  claude: true           # 生成 CLAUDE.md
  copilot: true          # 生成 .github/copilot-instructions.md
  kilo: true             # 生成 kilo.md
  opencode: true         # 生成 opencode.md
  codex: true            # 生成 AGENTS.md

# 可选：自定义输出路径
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

## 上下文创建

### 快速开始

```bash
# 创建一个新的上下文仓库
mkdir my-context && cd my-context
ctx create

# 创建：
# ├── context.yaml
# ├── index.md
# └── details/
#     └── .gitkeep
```

### 发布

只需推送到 GitHub。不需要注册表：

```bash
git init
git add .
git commit -m "Initial context"
gh repo create my-org/my-context --public
git push -u origin main
git tag v1.0.0
git push --tags

# 分享：ctx add github.com/my-org/my-context
```

## 技术实现

### 技术栈

- **语言**：TypeScript (Node.js)
- **包管理器**：npm（发布为 `context-injector` 或 `ctx`）
- **Git 操作**：isomorphic-git 或 simple-git
- **CLI 框架**：Commander.js 或 oclif
- **配置解析**：yaml

### 安装

```bash
npm install -g context-injector
# 或
npx context-injector init
```

## 未来考虑（v1 后）

- [ ] 上下文搜索/发现（可选注册表）
- [ ] 带认证的私有上下文
- [ ] 上下文模板
- [ ] IDE 扩展（VSCode、JetBrains）
- [ ] 用于动态上下文的 MCP 服务器模式
- [ ] 上下文验证/linting
- [ ] AI 驱动的上下文建议
