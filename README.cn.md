# Context Injector

一个用于管理和注入 AI 编码上下文的 CLI 工具。

## 概述

Context Injector 是一个去中心化的工具，允许团队通过 Git 仓库共享和管理 AI 编码助手（Claude Code、GitHub Copilot、Cursor 等）的编码规范、最佳实践和项目上下文。

## 主要特性

- 📦 **基于 Git 的上下文管理** - 使用标准 Git 仓库分发上下文
- 🔄 **依赖解析** - 自动处理上下文依赖和版本
- 🤖 **多工具支持** - 为 Claude、Copilot、Cursor 等生成配置
- 🔒 **版本锁定** - 确保团队成员使用一致的上下文版本
- 🛡️ **安全性** - 内置完整性检查和内容扫描
- 📝 **Agent 协作** - AI 助手可以改进上下文并贡献回去

## 快速开始

```bash
# 安装
npm install -g @builderx-ai/context-manager

# 在项目中初始化
ctx init

# 添加上下文
ctx add github.com/your-org/coding-standards

# 安装所有依赖
ctx install

# 健康检查
ctx doctor
```

## 示例用例

### 公司级标准

跨所有项目共享编码标准：

```bash
# 添加公司基础标准
ctx add github.com/company/engineering-standards

# 添加框架特定标准
ctx add github.com/company/react-patterns
ctx add github.com/company/typescript-guide
```

### 团队最佳实践

捕获和分享团队知识：

```bash
# 添加团队特定模式
ctx add github.com/team/backend-patterns
ctx add github.com/team/database-migrations
```

### 创建自己的 Context

与团队或社区分享你的标准：

```bash
# 创建新的 context 仓库
mkdir my-standards && cd my-standards
ctx init --context

# 按照提示创建：
# - 个人 context（用于个人使用）
# - 组织 context（用于公司级标准）

# 发布到 GitHub 并分享
gh repo create my-org/my-standards --public
git push -u origin main
git tag v1.0.0 && git push --tags

# 现在其他人可以使用它
ctx add github.com/my-org/my-standards
```

## 文档

- [产品设计](docs/PRODUCT_DESIGN.cn.md) - 完整的产品规范
- [实现设计](docs/IMPLEMENTATION_DESIGN.cn.md) - 技术设计和决策
- [English Documentation](README.md) - 英文文档

## 项目状态

🚧 **开发中** - 该项目目前处于设计阶段。

## 许可证

MIT

## 贡献

欢迎贡献！请参阅贡献指南了解详情。
