# 用户故事：Context Manager 实战

## 背景

**Alex** 是 TechCorp 的高级开发人员。公司有 200 多名开发人员分布在 50 多个项目中，所有人都在使用 AI 编码助手（Claude Code、Copilot 等）。

**问题所在：**
- 每个项目都有自己的 CLAUDE.md，很多都过时或不一致
- 新开发者需要花几天时间学习"我们这里是怎么做的"
- 在一个项目中发现的最佳实践不会传播到其他项目
- 当标准改变时，有人必须手动更新 50 多个仓库

Alex 决定尝试 **context-manager**。

---

## 第一章：开始使用

### 安装工具

```bash
npm install -g @builderx-ai/context-manager
```

### 初始化项目

Alex 从 `payment-service` 项目开始：

```bash
cd payment-service
ctx init --detect
```

输出：
```
检测到的项目特征：
  ✓ TypeScript (tsconfig.json)
  ✓ Node.js/Express (package.json)
  ✓ 使用 Jest 测试
  ✓ PostgreSQL (依赖中的 pg)

搜索公司 context...

基于 [typescript, backend, express, testing] 的推荐 context：
  github.com/techcorp/engineering-standards@2.3.0    [typescript, testing]
  github.com/techcorp/backend-standards@1.5.0       [backend, express, node]
  github.com/techcorp/database-patterns@1.2.0       [postgresql, database]

添加所有推荐的 context？(y/n) y

✓ 创建了 .context/manifest.yaml
✓ 向 manifest 添加了 3 个 context
✓ 准备就绪！运行 'ctx install' 来下载。
```

标签系统自动将项目特征匹配到相关的 context。

---

## 第二章：添加公司 Context

TechCorp 有一个共享的 context 仓库。Alex 添加它：

```bash
ctx add github.com/techcorp/engineering-standards
```

输出：
```
✓ 解析 github.com/techcorp/engineering-standards
✓ 找到版本：v2.3.0
✓ 已添加到 manifest

运行 'ctx install' 来下载并生成配置文件。
```

团队还有特定于后端的标准：

```bash
ctx add github.com/techcorp/backend-standards@v1.5
ctx install
```

输出：
```
解析依赖...
  github.com/techcorp/engineering-standards@2.3.0
  └── github.com/techcorp/code-style@1.0.0 (依赖)
  github.com/techcorp/backend-standards@1.5.0
  └── github.com/techcorp/engineering-standards@^2.0 (由 2.3.0 满足)

✓ 下载了 3 个 context
✓ 生成了 CLAUDE.md
✓ 生成了 .github/copilot-instructions.md
✓ 生成了 AGENTS.md
✓ 生成了 kilo.md
✓ 生成了 opencode.md

完成！您的 AI 助手现在已配置好。
```

---

## 第三章：生成的配置

Alex 打开自动生成的 `CLAUDE.md`：

```markdown
# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 提供指导。

## Context 源

此项目使用 [context-manager](https://github.com/user/context-manager)。
Context 位于 `.context/packages/` 中。

## 快速参考

### 代码风格（来自 engineering-standards）
- 使用 TypeScript 严格模式
- 优先使用函数式编程模式
- 所有函数必须有 JSDoc 注释

### 后端标准（来自 backend-standards）
- 使用 Express.js 与异步错误处理器
- 所有 API 必须返回标准信封格式的 JSON
- 数据库查询必须使用参数化语句

## 可用的 Context

当您需要详细指导时，读取这些文件：

| 主题 | 文件 | 描述 |
|------|------|------|
| 代码风格 | `.context/packages/github.com/techcorp/code-style/index.md` | 格式化、命名 |
| 错误处理 | `.context/packages/github.com/techcorp/backend-standards/details/errors.md` | 错误模式 |
| API 设计 | `.context/packages/github.com/techcorp/backend-standards/details/api.md` | REST 约定 |
| 测试 | `.context/packages/github.com/techcorp/engineering-standards/details/testing.md` | 测试模式 |

## Context 贡献

这些 context 是 **可编辑的**。如果您发现过时的信息、缺少的模式
或更好的实践，请编辑 `.context/packages/` 中的相关文件。
运行 `ctx status` 查看待处理的更改。

## 项目特定规则

(在 ./context.md 中添加本地覆盖)
```

---

## 第四章：使用 AI 进行日常开发

Alex 开始使用 Claude Code 工作：

```
Alex：帮我添加一个处理退款的新端点。
```

Claude Code 读取快速参考，然后深入到 API 设计 context：

```
Claude：我将首先阅读 API 设计指南。

[读取 .context/packages/.../backend-standards/details/api.md]

根据您的后端标准，我将遵循您的约定创建端点：

- POST /api/v1/refunds（不是 /refund - 根据您的标准使用复数）
- 标准 JSON 信封格式 { success, data, error }
- 异步错误处理器包装
- 使用 Zod schema 进行请求验证

[创建端点代码]
```

代码完全遵循 TechCorp 的模式，因为 Claude 读取了详细的 context。

---

## 第五章：Agent 发现问题

在实现过程中，Claude 注意到一些东西：

```
Claude：我实现了退款端点。但是，我注意到一些问题：

您在 `.context/packages/.../api.md` 中的 API 指南提到使用
`express-validator`，但此项目使用 `zod` 进行验证。
我已更新 context 以反映当前实践：

已更新：.context/packages/github.com/techcorp/backend-standards/details/api.md
- 将 "使用 express-validator" 改为 "使用 Zod 进行请求验证"
- 添加了 Zod schema 模式示例

运行 `ctx status` 审查此更改。
```

Alex 检查：

```bash
ctx status
```

输出：
```
修改的 context：

  github.com/techcorp/backend-standards
    └── details/api.md（1 个文件已更改）

运行 'ctx diff' 查看更改，或 'ctx push' 提交。
```

```bash
ctx diff github.com/techcorp/backend-standards
```

输出：
```diff
--- a/details/api.md
+++ b/details/api.md
@@ -45,7 +45,7 @@
 ## 请求验证

-使用 `express-validator` 进行所有请求验证：
+使用 `zod` 进行请求验证：

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

Alex 审查并同意这个更改。

---

## 第六章：推送更改

Alex 决定贡献这个改进：

```bash
ctx push github.com/techcorp/backend-standards
```

输出：
```
创建分支：ctx/payment-service/20240115-143022
提交更改...
推送到 github.com/techcorp/backend-standards...
创建 pull request...

✓ Pull request 已创建！
  https://github.com/techcorp/backend-standards/pull/42

标题：[ctx] 来自 payment-service 的更新
```

后端团队审查并合并 PR。现在所有 50 多个后端项目在下次 `ctx upgrade` 时都会获得此更新。

---

## 第 6.5 章：使用标签查找新的 Context

后来，Alex 需要添加支付处理。首先，Alex 检查配置的目录：

```bash
cat ~/.config/ctx/config.yaml
```

```yaml
# 全局配置 - 搜索源
registries:
  - github.com/techcorp/context-catalog    # 公司目录
```

TechCorp 维护一个索引所有公司 context 的目录仓库。现在 Alex 可以搜索：

```bash
ctx search --tag payments
```

输出：
```
搜索 github.com/techcorp/context-catalog...

找到 3 个匹配 [payments] 的 context：

  github.com/techcorp/payment-patterns@1.0.0
    标签：[payments, fintech, backend, retry]
    "支付处理模式和最佳实践"

  github.com/stripe/stripe-integration@2.1.0
    标签：[payments, stripe, api]
    "官方 Stripe 集成指南"

  github.com/techcorp/pci-compliance@1.0.0
    标签：[payments, security, compliance]
    "PCI-DSS 合规要求"
```

Alex 添加相关的：

```bash
ctx add github.com/techcorp/payment-patterns
ctx add github.com/techcorp/pci-compliance
ctx install
```

生成的配置现在包含标签列：

```markdown
## 可用的 Context

| 主题 | 标签 | 文件 |
|------|------|------|
| 后端标准 | `backend`, `express` | `.context/.../backend/index.md` |
| 支付模式 | `payments`, `retry` | `.context/.../payment/index.md` |
| PCI 合规 | `payments`, `security` | `.context/.../pci/index.md` |
| 数据库模式 | `postgresql` | `.context/.../database/index.md` |
```

当 Claude 处理支付代码时，它知道优先使用标记为 `payments` 的 context。

---

## 第七章：新开发者加入

**Jordan** 加入 TechCorp 并被分配到 `inventory-service` 项目。

第一天：

```bash
cd inventory-service
ctx install
```

就这样。Jordan 的 Claude Code 现在知道：
- TechCorp 的编码标准
- 后端 API 模式
- 测试约定
- 错误处理方法

Jordan 开始编码：

```
Jordan：我们这里如何处理数据库错误？

Claude：[读取 .context/packages/.../backend-standards/details/errors.md]

根据 TechCorp 的错误处理标准，数据库错误应该：

1. 包装在自定义 DatabaseError 类中
2. 使用关联 ID 记录日志
3. 作为 500 返回给客户端，使用通用消息
4. 原始错误存储用于调试

这是您团队使用的模式：

[显示来自 context 的确切代码模式]
```

Jordan 从第一天起就很有生产力。

---

## 第八章：升级 Context

一个月后，工程团队发布了新标准。Alex 更新：

```bash
ctx outdated
```

输出：
```
过时的 context：

  github.com/techcorp/engineering-standards
    当前：2.3.0
    最新：3.0.0

  github.com/techcorp/backend-standards
    当前：1.5.0
    最新：1.6.0
```

```bash
ctx upgrade
```

输出：
```
升级 context...

  github.com/techcorp/engineering-standards: 2.3.0 → 3.0.0
  github.com/techcorp/backend-standards: 1.5.0 → 1.6.0

✓ 更新了 lock.yaml
✓ 重新生成了 CLAUDE.md
✓ 重新生成了 .github/copilot-instructions.md
✓ 重新生成了 AGENTS.md
✓ 重新生成了 kilo.md
✓ 重新生成了 opencode.md

完成！使用 'git diff CLAUDE.md' 审查更改
```

---

## 第九章：创建新的 Context

Alex 的团队开发了一个很好的支付重试处理模式。他们想分享它。

```bash
mkdir payment-patterns && cd payment-patterns
ctx create
```

输出：
```
✓ 创建了 context.yaml
✓ 创建了 index.md
✓ 创建了 details/.gitkeep

编辑 index.md 添加您的 context 摘要。
在 details/ 文件夹中添加详细文档。
```

Alex 编写内容：

**context.yaml:**
```yaml
name: payment-patterns
version: 1.0.0
description: 支付处理模式和最佳实践
depends:
  - github.com/techcorp/backend-standards@^1.0
tags:
  - payments
  - fintech
  - backend
```

**index.md:**
```markdown
# 支付模式

## 快速参考

- 始终为支付操作使用幂等性密钥
- 为网关重试实现指数退避
- 存储支付状态机转换以供审计
- 使用 decimal 类型处理货币金额，永远不要使用 float
```

**details/retry-patterns.md:**
```markdown
# 支付重试模式

## 指数退避

[详细文档...]
```

发布：

```bash
git init
git add .
git commit -m "Initial payment patterns context"
gh repo create techcorp/payment-patterns --public
git push -u origin main
git tag v1.0.0
git push --tags
```

与公司分享：

```
嗨，团队！我创建了一个支付模式 context。
将它添加到您的支付项目：

  ctx add github.com/techcorp/payment-patterns
```

---

## 第十章：生态系统发展

六个月后在 TechCorp：

**公司范围的 context：**
- `github.com/techcorp/engineering-standards` - 核心标准
- `github.com/techcorp/security-guidelines` - 安全实践
- `github.com/techcorp/observability` - 日志和监控

**团队 context：**
- `github.com/techcorp/backend-standards` - 后端团队
- `github.com/techcorp/frontend-standards` - 前端团队
- `github.com/techcorp/mobile-standards` - 移动团队

**专业 context：**
- `github.com/techcorp/payment-patterns` - 支付系统
- `github.com/techcorp/ml-practices` - ML/AI 项目
- `github.com/techcorp/data-pipelines` - 数据工程

每个项目的 manifest 看起来像：

```yaml
sources:
  - github.com/techcorp/engineering-standards@^3.0
  - github.com/techcorp/backend-standards@^2.0
  - github.com/techcorp/payment-patterns@^1.0
```

新开发者从第一天起就很有生产力。
最佳实践自动传播。
AI 助手提供一致的高质量指导。
知识不断积累。

---

## 总结

| 之前 | 之后 |
|------|------|
| 50 多个不一致的 CLAUDE.md 文件 | 统一的、版本化的 context |
| 新开发者需要几周才能学会模式 | 从第一天起就很有生产力 |
| 最佳实践留在一个项目中 | 自动共享 |
| 跨仓库手动更新 | 几秒钟内 `ctx upgrade` |
| AI 给出通用建议 | AI 知道您的确切标准 |

**结束。**
