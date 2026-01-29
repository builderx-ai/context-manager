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

#### 1. 项目初始化
```bash
ctx init
# → 创建 .context/manifest.yaml
# → 创建 .context/.gitignore
# → 初始化 .gitmodules（如果需要）
```

#### 1b. Context 仓库创建

```bash
ctx init --context [选项]
```

**实现步骤：**

1. **提示 Context 类型**（如果未指定）：
   ```typescript
   enum ContextType {
     Personal = 'personal',
     Organizational = 'organizational'
   }
   
   interface ContextConfig {
     type: ContextType;
     name: string;
     description: string;
     owner?: string;           // 用于组织类型
     author?: string;          // 用于个人类型
     tags: string[];
     license: string;
     dependencies: string[];
     initGit: boolean;
     addGitHubTopic: boolean;
   }
   ```

2. **交互式提示**：
   ```typescript
   async function promptContextConfig(): Promise<ContextConfig> {
     const answers = await inquirer.prompt([
       {
         type: 'list',
         name: 'type',
         message: 'Context 类型:',
         choices: [
           { name: '个人 - 用于个人使用或小团队', value: 'personal' },
           { name: '组织 - 用于公司级标准', value: 'organizational' }
         ]
       },
       {
         type: 'input',
         name: 'name',
         message: 'Context 名称:',
         validate: (input) => {
           if (!/^[a-z0-9-]+$/.test(input)) {
             return '名称必须是小写字母数字和连字符';
           }
           return true;
         }
       },
       {
         type: 'input',
         name: 'description',
         message: '描述:'
       },
       {
         type: 'input',
         name: 'owner',
         message: '组织/所有者:',
         when: (answers) => answers.type === 'organizational'
       },
       {
         type: 'input',
         name: 'author',
         message: '作者名称:',
         when: (answers) => answers.type === 'personal',
         default: () => execSync('git config user.name').toString().trim()
       },
       {
         type: 'input',
         name: 'tags',
         message: '标签 (逗号分隔):',
         filter: (input) => input.split(',').map((s: string) => s.trim())
       },
       {
         type: 'list',
         name: 'license',
         message: '许可证:',
         choices: ['MIT', 'Apache-2.0', 'ISC', 'Unlicense', '专有']
       },
       {
         type: 'confirm',
         name: 'initGit',
         message: '初始化 Git 仓库?',
         default: true
       },
       {
         type: 'confirm',
         name: 'addGitHubTopic',
         message: '添加 GitHub topic "ctx-context" 以提高可发现性?',
         default: true,
         when: (answers) => answers.type === 'organizational'
       }
     ]);
     
     return answers;
   }
   ```

3. **生成目录结构**：
   ```typescript
   async function createContextRepo(config: ContextConfig): Promise<void> {
     const baseDir = process.cwd();
     
     // 创建目录
     await fs.mkdir(path.join(baseDir, 'details'), { recursive: true });
     await fs.mkdir(path.join(baseDir, 'tools'), { recursive: true });
     
     // 生成 context.yaml
     const contextYaml = generateContextYaml(config);
     await fs.writeFile(path.join(baseDir, 'context.yaml'), contextYaml);
     
     // 生成 index.md
     const indexMd = generateIndexMd(config);
     await fs.writeFile(path.join(baseDir, 'index.md'), indexMd);
     
     // 创建 .gitkeep 文件
     await fs.writeFile(path.join(baseDir, 'details', '.gitkeep'), '');
     await fs.writeFile(path.join(baseDir, 'tools', '.gitkeep'), '');
     
     // 生成 README.md
     const readmeMd = generateReadmeMd(config);
     await fs.writeFile(path.join(baseDir, 'README.md'), readmeMd);
     
     // 生成 LICENSE
     const license = await fetchLicenseText(config.license);
     await fs.writeFile(path.join(baseDir, 'LICENSE'), license);
     
     // 生成 .gitignore
     const gitignore = generateGitignore();
     await fs.writeFile(path.join(baseDir, '.gitignore'), gitignore);
     
     // 如果需要，初始化 Git
     if (config.initGit) {
       execSync('git init', { cwd: baseDir });
       
       // 在输出中添加 GitHub topic 指示
       if (config.addGitHubTopic) {
         console.log('\n别忘了在 GitHub 上添加 "ctx-context" topic!');
       }
     }
   }
   ```

4. **模板生成函数**：
   ```typescript
   function generateContextYaml(config: ContextConfig): string {
     const yaml: any = {
       name: config.name,
       version: '0.1.0',
       type: config.type,
       description: config.description,
       depends: [],
       summary: [],
       tags: config.tags,
       license: config.license
     };
     
     if (config.type === 'organizational') {
       yaml.organization = config.owner;
       yaml.maintainers = [{
         name: config.author || '你的名字',
         email: 'you@example.com',
         github: 'yourusername'
       }];
     } else {
       yaml.author = config.author;
     }
     
     return stringify(yaml);
   }
   
   function generateIndexMd(config: ContextConfig): string {
     return `# ${toTitleCase(config.name)}

> ${config.description}

## 快速参考

在这里添加应该总是加载的基本规则。

例如：
- 规则 1：简要指导
- 规则 2：另一个指导
- 规则 3：重要原则

## 详细指南

详细文档请查看：
- [主题 1](details/topic1.md) - 描述
- [主题 2](details/topic2.md) - 描述

在 \`details/\` 文件夹中添加更多文档。
`;
   }
   
   function generateReadmeMd(config: ContextConfig): string {
     const repoPath = config.type === 'organizational' 
       ? `github.com/${config.owner}/${config.name}`
       : `github.com/yourusername/${config.name}`;
     
     return `# ${toTitleCase(config.name)}

${config.description}

## 安装

将此 context 添加到你的项目：

\`\`\`bash
ctx add ${repoPath}
\`\`\`

## 内容

- **index.md** - 基本标准（总是加载）
- **details/** - 详细文档（按需加载）

## 使用

添加此 context 后，AI 助手将自动：
1. 对所有任务遵循 \`index.md\` 中的标准
2. 在处理特定区域时阅读详细指南

## 贡献

要建议改进：

1. Fork 此仓库
2. 进行修改
3. 提交 pull request

或者从你的项目使用 \`ctx push\`：

\`\`\`bash
# 在你的项目中本地编辑 context
vim .context/packages/${repoPath}/index.md

# 推送更改
ctx push ${repoPath}
\`\`\`

## 许可证

${config.license}
`;
   }
   
   function generateGitignore(): string {
     return `# 操作系统
.DS_Store
Thumbs.db

# 编辑器
.vscode/
.idea/
*.swp
*.swo
*~

# 临时文件
*.tmp
.cache/
`;
   }
   ```

5. **许可证获取**：
   ```typescript
   async function fetchLicenseText(licenseName: string): Promise<string> {
     const licenses: Record<string, string> = {
       'MIT': 'https://raw.githubusercontent.com/licenses/license-templates/master/templates/mit.txt',
       'Apache-2.0': 'https://raw.githubusercontent.com/licenses/license-templates/master/templates/apache-2.0.txt',
       // ... 其他许可证
     };
     
     if (licenseName === '专有') {
       return 'Copyright (c) All Rights Reserved.';
     }
     
     const url = licenses[licenseName];
     if (!url) {
       throw new Error(`未知许可证: ${licenseName}`);
     }
     
     const response = await fetch(url);
     return response.text();
   }
   ```

6. **CLI 集成**：
   ```typescript
   // 在 commands/init.ts 中
   program
     .command('init')
     .description('初始化新项目或 context 仓库')
     .option('--context', '创建新的 context 仓库')
     .option('--type <type>', 'Context 类型: personal 或 organizational')
     .option('--name <name>', 'Context 名称')
     .option('--description <desc>', 'Context 描述')
     .option('--org <org>', '组织名称（用于组织类型 context）')
     .option('--tags <tags>', '逗号分隔的标签')
     .option('--license <license>', '许可证类型')
     .option('--no-git', '跳过 git 初始化')
     .action(async (options) => {
       if (options.context) {
         await initContextRepo(options);
       } else {
         await initProject(options);
       }
     });
   ```

**命令行示例：**

```bash
# 交互式模式
ctx init --context

# 带所有选项的个人 context
ctx init --context \
  --type personal \
  --name my-standards \
  --description "我的个人编码标准" \
  --tags "personal,typescript" \
  --license MIT

# 组织 context
ctx init --context \
  --type organizational \
  --name engineering-standards \
  --description "公司级标准" \
  --org techcorp \
  --tags "general,typescript,testing" \
  --license MIT

# 快速个人 context（最少提示）
ctx init --context --type personal

# 快速组织 context（最少提示）
ctx init --context --type organizational
```

**成功输出：**

```
✓ 已创建 context.yaml
✓ 已创建 index.md  
✓ 已创建 details/.gitkeep
✓ 已创建 tools/.gitkeep
✓ 已创建 README.md
✓ 已创建 LICENSE
✓ 已创建 .gitignore
✓ 已初始化 Git 仓库

下一步：
  1. 编辑 index.md 添加你的基本标准
  2. 在 details/ 文件夹中添加详细文档
  3. 创建 GitHub 仓库：
     
     gh repo create techcorp/engineering-standards --public
     git remote add origin git@github.com:techcorp/engineering-standards.git
     git add .
     git commit -m "Initial context"
     git push -u origin main
     
  4. 标记你的第一个版本：
     
     git tag v0.1.0
     git push --tags
     
  5. 与你的团队分享：
     
     ctx add github.com/techcorp/engineering-standards

了解更多: https://github.com/context-manager/docs
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

## 自动注入系统

### 概述

Context Injector 自动生成 AI 编码工具在会话启动时读取的工具特定配置文件。这实现了**零命令上下文注入** - 用户只需安装一次包，所有支持的工具就会自动接收上下文。

### 架构流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Context Manager CLI                           │
│                   (真实来源)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ctx install / ctx add / ctx remove
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  .context/                                       │
│  ├── manifest.yaml    (已安装的包)                              │
│  ├── lock.yaml        (固定版本)                                │
│  └── packages/        (实际内容)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 生成 / 同步
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              自动读取文件（生成的输出）                          │
│  ├── CLAUDE.md           → Claude Code                          │
│  ├── .cursorrules        → Cursor                               │
│  ├── .windsurfrules      → Windsurf                             │
│  ├── .continuerules      → Continue.dev                         │
│  └── .github/copilot-instructions.md → GitHub Copilot           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 在会话启动时自动读取
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI 编码工具                                   │
│      (Claude Code, Cursor, Windsurf, Copilot, Continue)         │
└─────────────────────────────────────────────────────────────────┘
```

### 支持的工具和自动读取文件

| 工具 | 自动读取文件 | 位置 | 备注 |
|------|-------------|------|------|
| Claude Code | `CLAUDE.md` | 项目根目录 | 也会全局读取 `~/.claude/CLAUDE.md` |
| Cursor | `.cursorrules` | 项目根目录 | |
| Windsurf | `.windsurfrules` | 项目根目录 | |
| GitHub Copilot | `copilot-instructions.md` | `.github/` | |
| Continue.dev | `.continuerules` | 项目根目录 | |
| Aider | `.aider.conf.yml` | 项目根目录 | |

### CLI 命令和文件生成

每个修改已安装包的命令都会触发所有配置文件的自动重新生成：

| 命令 | 对自动读取文件的影响 |
|------|---------------------|
| `ctx init` | 创建初始自动读取文件 |
| `ctx add <pkg>` | 重新生成所有自动读取文件 |
| `ctx remove <pkg>` | 重新生成所有自动读取文件 |
| `ctx install` | 重新生成所有自动读取文件 |
| `ctx sync` | 仅重新生成自动读取文件（不修改包）|
| `ctx generate` | 显式重新生成特定或所有文件 |

### 内容策略：混合方法

自动读取文件使用混合策略，在令牌效率和完整性之间取得平衡：

#### 1. 关键规则（内联）

必须始终遵循的基本规则直接包含在生成的文件中：

```markdown
## 关键规则

- 永远不要在 TypeScript 中使用 `any` 类型
- 始终使用命名导出
- 错误处理：使用 Result 模式
- 所有 API 响应必须是类型化的
```

#### 2. 详细标准（引用）

全面的文档通过引用提供，供 AI 智能体按需加载：

```markdown
## 详细标准

如需全面指南，在处理相关任务时读取这些文件：

| 主题 | 文件 | 何时阅读 |
|------|------|---------|
| TypeScript | `.context/packages/typescript-standards/README.md` | 编写 TS 代码时 |
| React 模式 | `.context/packages/react-patterns/README.md` | 创建组件时 |
| API 设计 | `.context/packages/api-guidelines/README.md` | 构建端点时 |
```

### 生成算法

```typescript
interface GeneratorOptions {
  strategy: 'reference' | 'embed' | 'hybrid';
  maxInlineSize?: number;  // 字节，默认 2000
}

function generateAutoInjectFiles(manifest: Manifest): void {
  const packages = loadInstalledPackages(manifest);
  const config = manifest.generate || getDefaultGenerateConfig();

  // 为每个启用的工具生成
  if (config.claude?.enabled !== false) {
    generateFile('CLAUDE.md', packages, config.claude);
  }
  if (config.cursor?.enabled !== false) {
    generateFile('.cursorrules', packages, config.cursor);
  }
  if (config.windsurf?.enabled !== false) {
    generateFile('.windsurfrules', packages, config.windsurf);
  }
  if (config.copilot?.enabled !== false) {
    generateFile('.github/copilot-instructions.md', packages, config.copilot);
  }
  if (config.continue?.enabled !== false) {
    generateFile('.continuerules', packages, config.continue);
  }
}

function generateFile(
  path: string,
  packages: Package[],
  options: GeneratorOptions
): void {
  let content = getHeader(path);

  // 始终内联关键规则
  content += "## 关键规则\n\n";
  for (const pkg of packages) {
    const critical = pkg.getCriticalRules();
    if (critical) {
      content += `### ${pkg.name}\n${critical}\n\n`;
    }
  }

  // 根据策略处理详细内容
  if (options.strategy === 'embed') {
    // 完全内联 - 嵌入所有内容
    content += "## 完整标准\n\n";
    for (const pkg of packages) {
      content += `### ${pkg.name}\n`;
      content += pkg.getFullContent();
      content += "\n\n";
    }
  } else {
    // 引用或混合 - 指向文件
    content += "## 详细标准\n\n";
    content += "如需全面指南，请阅读以下内容：\n\n";
    for (const pkg of packages) {
      content += `- **${pkg.name}**: \`.context/packages/${pkg.name}/\`\n`;
    }
  }

  writeFileSync(path, content);
}
```

### Git 策略选项

生成文件的版本控制有两种有效方法：

#### 选项 A：Gitignore 生成的文件（推荐用于团队）

```gitignore
# .gitignore
# 由 ctx 生成 - 使用 `ctx install` 重新生成
CLAUDE.md
.cursorrules
.windsurfrules
.continuerules
.github/copilot-instructions.md
```

**优点：**
- 干净的 git 历史
- 生成的文件不会有合并冲突
- `.context/` 中的单一真实来源

**缺点：**
- 团队成员必须在克隆后运行 `ctx install`
- CI/CD 需要 `ctx install` 步骤

#### 选项 B：提交生成的文件（更简单的入门）

```gitignore
# .gitignore
# 仅忽略包内容（submodules 处理）
# 生成的文件会被提交
```

**优点：**
- 对新团队成员立即可用
- 不需要额外设置
- AI 工具无需运行任何命令即可工作

**缺点：**
- 生成的文件出现在 git diff 中
- 可能的合并冲突
- 必须记住在包更改后重新生成

### 设计原理

#### 为什么选择自动读取文件而不是钩子？

我们评估了三种注入机制：

| 方法 | 自动 | 跨工具 | 复杂度 |
|------|------|--------|--------|
| **钩子**（Python 脚本）| ✅ | ❌ 仅 Claude | 高 |
| **斜杠命令** | ❌ 手动 | ❌ 仅 Claude | 中 |
| **自动读取文件** | ✅ | ✅ 所有工具 | 低 |

**决策：** 选择自动读取文件，因为：

1. **通用兼容性** - 适用于任何支持配置文件的 AI 编码工具
2. **零摩擦** - 初始 `ctx install` 后无需命令
3. **简单实现** - 只是文件生成，没有运行时组件
4. **可预测行为** - 每次会话内容相同
5. **无供应商锁定** - 标准 markdown 文件，没有专有格式

#### 为什么选择混合内容策略？

1. **令牌效率** - 避免每次会话加载 10,000+ 个令牌
2. **关键规则始终可见** - 最重要的规则不会被遗漏
3. **按需详情** - 智能体在需要时加载全面文档
4. **渐进式披露** - 匹配开发者使用文档的方式

#### 考虑过的替代方案：Claude Code 钩子

Claude Code 支持可以动态注入上下文的钩子系统：

```python
# .claude/hooks/session-start.py
# 在每次会话启动时运行，打印到 stdout → 注入到对话中
```

**我们为什么没有选择这个作为主要方案：**
- 仅适用于 Claude Code
- 需要 Python 运行时
- 调试更复杂
- 用户无法轻松查看注入的内容

**潜在的未来增强：** 为想要高级功能（如基于任务的动态注入）的 Claude Code 用户提供 `ctx install --with-hooks`。

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
