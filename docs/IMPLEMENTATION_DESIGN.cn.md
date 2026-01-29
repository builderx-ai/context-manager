# Context Injector - 实现设计

**状态**: ✅ 就绪可实现  
**最后更新**: 2026年1月29日

本文档整合了实现 Context Injector 产品的所有主要技术决策和设计要点。

---

## 目录

1. [架构概览](#架构概览)
2. [Git 仓库管理](#git-仓库管理)
3. [依赖解析](#依赖解析)
4. [跨工具支持](#跨工具支持)
5. [版本管理](#版本管理)
6. [安全策略](#安全策略)
7. [Agent 集成](#agent-集成)
8. [性能优化](#性能优化)
9. [用户体验](#用户体验)
10. [技术栈](#技术栈)

---

## 架构概览

### 核心概念

**单一真实来源 (Single Source of Truth):**
- Context 在 Git 仓库中维护
- 每个 context 是 `.context/packages/` 中的 Git submodule
- Lock 文件确保可重现的安装
- 生成的配置文件引用源 context

**目录结构:**
```
my-project/
├── .context/
│   ├── manifest.yaml           # 用户声明的依赖
│   ├── lock.yaml               # 解析的版本（自动生成）
│   ├── resolutions.yaml        # 冲突解决方案（自动生成）
│   └── packages/               # Git submodules
│       └── github.com/
│           └── company/
│               ├── base/                 # ← Git submodule
│               │   ├── .git/             # Git 历史
│               │   ├── context.yaml      # Context 元数据
│               │   ├── index.md          # 摘要（总是加载）
│               │   ├── details/          # 详细 context
│               │   │   ├── code-style.md
│               │   │   └── testing.md
│               │   └── tools/            # 工具特定覆盖
│               │       ├── claude.md
│               │       └── copilot.md
│               └── frontend/             # ← 另一个 Git submodule
│                   └── ...
├── CLAUDE.md                   # 自动生成（引用 .context/）
├── AGENTS.md                   # 自动生成（用于 Cursor/Aider/Codex）
├── .github/
│   └── copilot-instructions.md # 自动生成
└── context.md                  # 可选：项目特定覆盖
```

---

## Git 仓库管理

### 决策：Git Submodules + CLI 抽象

**原因:**
- 使用成熟的 Git 工具而不是重新发明
- Context 主要是 Markdown 文件（轻量级）
- CLI 为用户抽象复杂性
- Agent 可以检测并指导用户完成设置

### 实现

#### 1. 初始化
```bash
ctx init
# → 创建 .context/manifest.yaml
# → 创建 .context/.gitignore
# → 初始化 .gitmodules（如果需要）
```

#### 2. 添加 Context
```bash
ctx add github.com/company/base@^1.0
# → 添加到 manifest.yaml
# → 执行: git submodule add <url> .context/packages/github.com/company/base
# → 执行: git submodule update --init --depth=1
# → 更新 lock.yaml
# → 生成配置文件（CLAUDE.md 等）
```

#### 3. 安装依赖
```bash
ctx install
# → 读取 manifest.yaml
# → 对每个源: git submodule add（如果不存在）
# → 执行: git submodule update --init --recursive --depth=1
# → 生成配置文件

ctx install --frozen
# → 严格模式：使用精确的 lock.yaml 版本
# → 如果 lock.yaml 不存在则失败
# → 用于 CI/CD 环境
```

#### 4. 健康检查
```bash
ctx doctor
# 检查:
# ✅ Submodules 已初始化
# ✅ 所有包匹配 lock 文件
# ⚠️  2 个未审查的语义冲突
# ⚠️  Context 'base' 有可用更新

ctx doctor --fix
# 自动修复:
# → 初始化缺失的 submodules
# → 更新过期的 submodules（需要确认）
```

#### 5. 推送更改
```bash
ctx push github.com/company/base
# → cd 到 submodule 目录
# → git checkout -b ctx/<project-name>/<timestamp>
# → git add .
# → git commit -m "Update from <project-name>"
# → git push origin <branch>
# → 返回 PR 创建 URL
```

#### 6. 差异和状态
```bash
ctx diff github.com/company/base
# 等同于: cd .context/packages/.../base && git diff

ctx status
# 显示:
# 修改的 contexts:
#   • github.com/company/base（2 个文件已更改）
# 运行 'ctx diff <context>' 查看

ctx reset github.com/company/base
# 等同于: cd .context/packages/.../base && git checkout .
```

### Agent 检测和指导

**生成的 CLAUDE.md 包含:**
```markdown
## Context 健康检查

**重要**: 在工作之前，验证 context 是否可用。

如果你在 `.context/packages/` 中看到空目录:
1. 告诉用户: "我注意到 context 文件尚未初始化。"
2. 指导: "请运行: `ctx install` 或 `ctx doctor --fix`"
3. 等待用户完成后再继续。

检查方法: 从 `.context/packages/` 读取文件 - 如果失败，context 未加载。
```

---

## 依赖解析

### 双层冲突检测

#### 第一层：版本冲突（自动）

**策略: 基于 Semver 的解析，清晰的错误**

```yaml
# manifest.yaml
sources:
  - github.com/company/frontend@^2.0  # 需要 base@^1.0
  - github.com/company/backend@^3.0   # 需要 base@^1.2

# 解析:
# → base@^1.0 和 base@^1.2 兼容
# → 安装 base@1.2.3（范围内最新）
```

**冲突处理:**
```bash
# 不兼容的版本
ctx install

错误: github.com/company/base 的版本要求冲突
  - frontend@2.0 需要 base@^1.0
  - legacy@1.0 需要 base@^0.9

解决方案:
  1. 更新 legacy 以支持 base@^1.0
  2. 强制版本: ctx add github.com/company/base@1.0.0 --force
  3. 在 manifest.yaml 中添加覆盖
```

**手动覆盖:**
```yaml
# manifest.yaml
sources:
  - github.com/company/frontend@^2.0
  - github.com/company/legacy@^1.0

overrides:
  github.com/company/base: 1.0.0  # 强制特定版本
```

#### 第二层：语义冲突（Agent 辅助）

**Context 元数据包含规则声明:**

```yaml
# context.yaml
name: react-standards
version: 2.0.0

rules:
  - id: component-style
    category: react/components
    directive: "使用函数组件和 hooks"
    applies_when: "创建 React 组件"
    priority: recommended
    
  - id: state-management
    category: react/state
    directive: "使用 Redux Toolkit 管理全局状态"
    applies_when: "管理应用状态"
```

**冲突检测:**
```bash
ctx doctor --conflicts

# 语义冲突详情
# 
# [1] react/components（未审查）
# 
#   github.com/company/react-standards@2.0.0
#   "使用函数组件和 hooks"
#   
#   github.com/legacy/react-old@1.5.0
#   "优先使用类组件处理有状态逻辑"
# 
# 操作:
#   1. 移除一个 context: ctx remove github.com/legacy/react-old
#   2. 在 context.md 中添加覆盖
#   3. 标记为已审查: ctx doctor --resolve react/components
```

**解决方案跟踪:**
```yaml
# .context/resolutions.yaml（自动生成）
conflicts:
  react/components:
    status: reviewed
    resolution: "新代码使用 react-standards，react-old 仅用于遗留代码"
    reviewed_at: "2026-01-29T10:30:00Z"
```

**生成的配置包含冲突:**
```markdown
# CLAUDE.md

## ⚠️ 检测到的规则冲突

### 冲突: react/components
- **react-standards** 说: "使用函数组件和 hooks"
- **react-old** 说: "优先使用类组件处理有状态逻辑"

**解决方案**: 新代码遵循 react-standards。react-old 仅用于遗留维护。
```

---

## 跨工具支持

### 决策：单一真实来源 + 引用

**策略:**
- 在 `.context/packages/` 中维护一个主 context
- 工具特定的配置引用或嵌入此内容
- 通过 `tools/` 目录支持工具特定的添加

### 支持的工具和策略

| 工具 | 配置文件 | 策略 | 原因 |
|------|----------|------|------|
| Claude Code | `CLAUDE.md` | **引用** | 有文件读取工具 |
| Cursor / Aider | `AGENTS.md` | **引用** | 可以读取文件 |
| GitHub Copilot | `.github/copilot-instructions.md` | **混合** | 文件读取能力有限 |
| Windsurf | `AGENTS.md` 或自定义 | **引用** | 可以读取文件 |

### 引用策略（默认）

**CLAUDE.md 示例:**
```markdown
# CLAUDE.md

## Context 源

此项目使用 context-manager。Context 在 `.context/packages/` 中。

## 快速参考

<!-- 从所有 index.md 文件自动合并 -->
### 代码风格
- 所有新代码使用 TypeScript
- 优先使用函数式编程
...

## 详细 Context

| 主题 | 文件 | 描述 |
|------|------|------|
| 代码风格 | `.context/packages/github.com/company/base/details/code-style.md` | 完整指南 |
| 测试 | `.context/packages/github.com/company/base/details/testing.md` | 测试模式 |

**访问方式:** 需要时使用读取工具读取这些文件。

## 项目特定

<!-- 来自本地 context.md -->
...
```

### 混合策略（Copilot）

```markdown
# .github/copilot-instructions.md

## 摘要（嵌入）

<!-- 从 index.md 自动生成 -->
### 快速规则
...
<!-- 自动生成结束 -->

## 详细引用

详情见:
- 代码风格: `.context/packages/.../code-style.md`
- 测试: `.context/packages/.../testing.md`
```

### 工具特定添加

**目录结构:**
```
context/
├── index.md              # 所有工具通用
├── details/
│   └── code-style.md     # 通用详细指南
└── tools/                # 工具特定添加（可选）
    ├── claude.md         # Claude 特定注释
    └── copilot.md        # Copilot 特定注释
```

**生成逻辑:**
```typescript
function generateCLAUDE(contexts: Context[]): string {
  let content = "# CLAUDE.md\n\n";
  
  // 1. 合并通用内容
  content += mergeContent(contexts.map(c => c.index));
  
  // 2. 添加 Claude 特定内容
  const claudeSpecific = contexts
    .map(c => c.tools?.claude)
    .filter(Boolean);
  
  if (claudeSpecific.length > 0) {
    content += "\n## Claude 特定指导\n\n";
    content += mergeContent(claudeSpecific);
  }
  
  return content;
}
```

### 配置

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

## 版本管理

### 决策：使用 Semver 库 + Lock 文件

**技术:** npm `semver` 包（经过实战检验）

### 支持的版本格式

| 格式 | 示例 | 行为 |
|------|------|------|
| 精确 | `@1.2.3` | 精确版本 |
| 插入符 | `@^1.0.0` | 兼容更新（1.x.x）|
| 波浪号 | `@~1.2.0` | 仅补丁更新（1.2.x）|
| 范围 | `@>=1.0.0 <2.0.0` | 版本范围 |
| 最新 | `@latest` | 最新发布标签 |
| 分支 | `@main` | 分支 HEAD（在 lock 文件中锁定到 commit）|
| 提交 | `@a1b2c3d` | 特定提交 |

### 版本解析

```typescript
import semver from 'semver';

async function resolveVersion(
  repoUrl: string,
  versionSpec: string
): Promise<{ version: string; commit: string }> {
  
  // 1. 精确或 semver 范围
  if (semver.validRange(versionSpec)) {
    const tags = await git.listTags(repoUrl);
    const versions = tags
      .map(t => t.replace(/^v/, ''))
      .filter(t => semver.valid(t));
    
    const matched = semver.maxSatisfying(versions, versionSpec);
    const commit = await git.getTagCommit(repoUrl, `v${matched}`);
    return { version: matched, commit };
  }
  
  // 2. 最新
  if (versionSpec === 'latest') {
    const tags = await git.listTags(repoUrl);
    const versions = tags.map(t => t.replace(/^v/, '')).filter(semver.valid);
    const latest = semver.maxSatisfying(versions, '*');
    const commit = await git.getTagCommit(repoUrl, `v${latest}`);
    return { version: latest, commit };
  }
  
  // 3. 分支或提交
  return resolveBranchOrCommit(repoUrl, versionSpec);
}
```

### Lock 文件格式

```yaml
# lock.yaml
version: 1
resolved:
  - url: github.com/company/base
    ref: ^1.0                    # manifest 中的原始规范
    version: 1.2.3               # 解析的版本
    commit: a1b2c3d4e5f6         # Git commit SHA（完整性）
    resolved_at: "2026-01-29T10:30:00Z"
    
  - url: github.com/company/experimental
    ref: main                    # 分支引用
    version: null                # 无版本标签
    commit: b2c3d4e5f6g7         # 锁定的 commit
    resolved_at: "2026-01-29T10:35:00Z"
```

### Lock 文件更新策略

| 命令 | Lock 文件行为 |
|------|--------------|
| `ctx add <context>` | 添加新条目 |
| `ctx install` | 如果缺失则创建，否则使用现有 |
| `ctx install --frozen` | 需要 lock 文件，如果缺失则失败 |
| `ctx upgrade` | 更新到最新兼容版本 |
| `ctx upgrade --latest` | 忽略 semver 范围，使用最新版本 |

### 示例工作流

```bash
# 初始设置
ctx add github.com/company/base@^1.0
# manifest: ^1.0
# lock: 1.2.3（^1.0 范围内的当前最新）

# 几个月后，1.3.0 发布
ctx install
# → 使用 lock 文件中的 1.2.3（可重现）

ctx upgrade
# → 更新到 1.3.0
# → 更新 lock.yaml
# → 用户在 submodule 中看到 git diff
```

---

## 安全策略

### 五层安全模型

#### 第一层：Git 原生安全（基础）

**利用 Git 的内置安全性:**
- HTTPS/SSH 加密传输
- Commit SHA 完整性验证
- GitHub/GitLab 访问控制和 2FA

#### 第二层：Lock 文件完整性（核心）

**Lock 文件作为完整性保证:**
```yaml
# lock.yaml 记录 commit SHA
resolved:
  - url: github.com/company/base
    commit: a1b2c3d4e5f6  # ← 完整性哈希
```

**验证:**
```typescript
async function verifyIntegrity(context: Context) {
  const locked = lockFile.get(context.url);
  const actual = await git.getCurrentCommit(context.path);
  
  if (locked.commit !== actual) {
    throw new SecurityError(
      `${context.url} 的完整性检查失败\n` +
      `期望: ${locked.commit}\n` +
      `实际: ${actual}\n` +
      `可能检测到篡改。`
    );
  }
}
```

**在 ctx doctor 中自动检查:**
```bash
ctx doctor
# ✅ 所有 context 匹配 lock 文件
# ❌ Context 'base' 有意外的 commit（篡改？）
```

#### 第三层：内容扫描（可选）

**基本恶意内容检测:**
```typescript
function scanContext(contextPath: string): SecurityIssue[] {
  const issues = [];
  
  // 1. 检查文件类型（应该只有 .md、.yaml）
  const files = glob.sync(`${contextPath}/**/*`);
  const suspicious = files.filter(f => 
    !f.match(/\.(md|yaml|yml|txt|json)$/)
  );
  if (suspicious.length > 0) {
    issues.push({
      severity: 'warning',
      message: `意外的文件类型: ${suspicious.join(', ')}`
    });
  }
  
  // 2. 检查 Markdown 中的 <script> 标签
  const mdFiles = files.filter(f => f.endsWith('.md'));
  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('<script>')) {
      issues.push({
        severity: 'error',
        file,
        message: '包含 <script> 标签'
      });
    }
  }
  
  return issues;
}
```

#### 第四层：私有 Context 认证

**使用 Git 的原生认证机制:**
```bash
# SSH keys（推荐）
ctx add git@github.com:company/private-context.git

# HTTPS 与 Git credential helper
git config --global credential.helper store
ctx add https://github.com/company/private-context.git

# ctx 从不存储凭据 - 依赖 Git
```

#### 第五层：GPG 签名（可选，高级）

**用于高安全性 context:**
```yaml
# context.yaml
name: security-policies
security:
  require_signed_commits: true
  trusted_keys:
    - fingerprint: "ABCD1234..."
      owner: "security-team@company.com"
```

**安装时验证:**
```bash
ctx install
# 验证签名...
# ✅ security-policies: 由 security-team@company.com 签名
```

### 安全最佳实践

**对于用户:**
- ✅ 使用组织/团队维护的 context
- ✅ 在 PR 中审查 lock 文件更改
- ✅ 定期运行 `ctx doctor`
- ✅ 生产环境使用精确版本（`@1.2.3`）
- ❌ 避免来自未知来源的 context

**对于 Context 作者:**
- ✅ 只包含 Markdown/YAML 文件
- ✅ 使用 semver 标签发布
- ✅ 为关键 context 签名提交
- ❌ 从不包含脚本或可执行文件
- ❌ 避免频繁 force-push

---

## Agent 集成

### Agent 驱动的 Context 演化

**理念:** Agent 可以在正常工作中改进 context

#### Context 更新的触发器

| 触发器 | 示例 | Agent 操作 |
|--------|------|-----------|
| 过时信息 | Context 说 "React 17" 但项目使用 React 19 | 提议更新 |
| 缺少模式 | 发现有用的模式 | 添加到 context |
| 不正确的规则 | 规则导致问题 | 建议更正 |
| 新的最佳实践 | 从用户反馈中学习 | 捕获知识 |

#### Agent 工作流

**生成的 CLAUDE.md 包含:**
```markdown
## Context 贡献

这些 context 是 **可编辑的**。你可以在以下情况下更新它们:

✅ **可以编辑:**
- 用户明确要求更新 context
- 你发现过时的信息
- 出现有用的模式
- 你发现明显的错误

❌ **不要编辑:**
- 你不确定更改是否正确
- 它只是风格偏好
- Context 标记为 `editable: false`

**流程:**
1. 编辑 `.context/packages/<context>/` 中的文件
2. 告知用户更改了什么以及为什么
3. 用户使用以下命令审查: `ctx diff <context>`
4. 用户决定: 保留、修改或丢弃
```

#### Agent 通知模板

```markdown
**编辑时的模板:**
"我已更新 [context 名称] 到 [更改内容]。

**文件:** `.context/packages/[路径]`
**更改:** [简要描述]
**原因:** [为什么需要]

审查:
\`\`\`bash
ctx diff [context]
\`\`\`

接受并推送:
\`\`\`bash
ctx push [context]
\`\`\`

丢弃:
\`\`\`bash
ctx reset [context]
\`\`\`
"
```

#### 只读 Context

```yaml
# context.yaml
metadata:
  editable: false
  reason: "关键安全规则 - 联系安全团队"
```

**生成的指令:**
```markdown
## 只读 Context

- `github.com/company/security-rules` - 关键安全规则

即使过时也不要修改。要求用户联系维护者。
```

---

## 性能优化

### Git Submodule 优化

**Git 已提供:**
- ✅ 浅克隆支持（`--depth=1`）
- ✅ 按需克隆
- ✅ 增量更新
- ✅ 并行操作（`--jobs`）

### 实现

```bash
# 默认: 浅克隆
ctx install
# 内部: git submodule update --init --depth=1 --jobs=4

# 完整历史（如果需要）
ctx install --full-history
# 内部: git submodule update --init --recursive

# CI/CD 优化
ctx install --frozen
# 使用精确的 lock 文件，跳过版本解析
```

### 性能估计

**典型项目（5 个 context）:**
- 每个 context: ~50KB Markdown
- 每个 .git（浅）: ~200KB
- **总计: ~1.25MB**

对现代开发环境可接受。

---

## 用户体验

### CLI 命令参考

```bash
# 初始化
ctx init                          # 初始化项目

# 管理 context
ctx add <url>[@version]           # 添加 context
ctx remove <url>                  # 移除 context
ctx list                          # 列出已安装的 context
ctx tree                          # 显示依赖树

# 安装
ctx install                       # 安装所有依赖
ctx install --frozen              # CI 模式（严格 lock 文件）
ctx upgrade [url]                 # 升级到最新兼容版本
ctx upgrade --latest              # 升级忽略 semver

# 配置
ctx generate                      # 重新生成配置文件
ctx generate --target claude      # 仅 CLAUDE.md
ctx generate --target copilot     # 仅 copilot-instructions.md

# 健康和诊断
ctx doctor                        # 运行所有检查
ctx doctor --fix                  # 自动修复问题
ctx doctor --conflicts            # 显示语义冲突
ctx doctor --resolve <id>         # 解决特定冲突

# 审查更改
ctx status                        # 显示修改的 context
ctx diff [url]                    # 显示 context 中的更改
ctx reset <url>                   # 丢弃本地更改

# 回馈贡献
ctx push <url>                    # 推送更改并创建 PR

# 工具
ctx why <package>                 # 为什么安装包
ctx outdated                      # 显示可用更新
```

### 错误消息

**友好、可操作的错误（Rust 风格）:**

```bash
ctx install

错误: Submodule 'github.com/company/base' 未初始化

可能原因:
  1. 新克隆没有使用 --recurse-submodules
  2. git pull 后未更新 Submodules

解决方案:
  → 运行: ctx doctor --fix
  → 或手动: git submodule update --init --recursive

提示: 对于新克隆，使用:
  git clone --recurse-submodules <repo-url>
```

### 交互式工作流

```bash
ctx doctor --resolve react/components

你想如何解决这个冲突？

1. 保留两者（标记为已审查）
   新代码使用 react-standards，遗留代码使用 react-old

2. 移除 github.com/legacy/react-old
   卸载冲突的 context

3. 添加项目覆盖
   在 context.md 中记录解决方案

选择 [1-3]: _
```

---

## 技术栈

### 核心技术

**语言:** TypeScript (Node.js)

**为什么选择 TypeScript:**
- 复杂逻辑的类型安全
- 出色的工具和 IDE 支持
- 庞大的生态系统
- 通过 npm 轻松分发

**关键依赖:**

```json
{
  "dependencies": {
    "semver": "^7.5.0",           // 版本解析
    "simple-git": "^3.20.0",      // Git 操作
    "commander": "^11.0.0",       // CLI 框架
    "yaml": "^2.3.0",             // YAML 解析
    "chalk": "^5.3.0",            // 终端颜色
    "inquirer": "^9.2.0",         // 交互式提示
    "glob": "^10.3.0"             // 文件模式匹配
  }
}
```

**Git 库选择:**

| 库 | 优点 | 缺点 | 决策 |
|---|------|------|------|
| **simple-git** | 快速，全功能，小巧 | 需要系统 git | ✅ **使用这个** |
| isomorphic-git | 纯 JS，无需系统 git | 较慢，部分功能 | 后备选项 |

**决策:** 使用 `simple-git`（假设已安装 git）

### Node.js 版本支持

**最低:** Node.js 18（Active LTS）

### 项目结构

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
│   │   ├── git.ts              // Git 操作
│   │   ├── resolver.ts         // 版本解析
│   │   ├── installer.ts        // 安装逻辑
│   │   └── scanner.ts          // 安全扫描
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

### 分发

```bash
# 全局安装
npm install -g context-manager

# 使用
ctx init

# 或通过 npx（无需安装）
npx context-manager init
```

---

## 实现阶段

### 阶段 1：基础（MVP）

**目标:** 核心功能可用

- [x] 设计决策最终确定
- [ ] 项目设置（TypeScript，CLI 框架）
- [ ] 核心命令: `init`、`add`、`install`
- [ ] Git submodule 集成
- [ ] Lock 文件生成
- [ ] 基本配置生成（CLAUDE.md，AGENTS.md）
- [ ] 使用 semver 的版本解析
- [ ] 基本测试

**可交付成果:** 可以添加 context 并生成基本配置文件

### 阶段 2：高级功能

**目标:** 完整功能集

- [ ] 包含所有检查的 `ctx doctor`
- [ ] 冲突检测（版本 + 语义）
- [ ] `ctx push` 工作流
- [ ] `ctx diff`、`ctx status`、`ctx reset`
- [ ] 内容扫描（安全）
- [ ] 工具特定生成器（Copilot 等）
- [ ] 交互式提示
- [ ] 全面的错误消息

**可交付成果:** 完整的生产就绪 CLI

### 阶段 3：完善和生态系统

**目标:** 生产加固和社区

- [ ] 性能优化
- [ ] 跨平台测试（Windows、macOS、Linux）
- [ ] 文档站点
- [ ] 示例 context 仓库
- [ ] CI/CD 集成指南
- [ ] VS Code 扩展（可选）
- [ ] GPG 签名支持（可选）

**可交付成果:** 具有生态系统支持的精致产品

---

## 未决问题和未来考虑

### v1 范围（目前不在范围内）

- [ ] Context 发现/搜索注册表
- [ ] 动态 context 的 MCP 服务器模式
- [ ] IDE 扩展（VS Code，JetBrains）
- [ ] AI 驱动的 context 建议
- [ ] 超出基本安全性的 context 验证/linting
- [ ] Monorepo 支持（一个仓库中的多个 context）

### 待定

- **Context 市场?** 可能不需要 - GitHub 就是市场
- **私有注册表?** Git 已经处理私有仓库
- **破坏性更改的版本策略?** 遵循 semver，使用迁移指南
- **Context 组合?** 已通过依赖处理

---

## 参考

- [PRODUCT_DESIGN.md](./PRODUCT_DESIGN.md) - 原始产品规范
- [Semver 规范](https://semver.org/)
- [Git Submodules 文档](https://git-scm.com/book/en/v2/Git-Tools-Submodules)

---

## 变更日志

- **2026-01-29**: 从问题分析整合的初始实现设计
