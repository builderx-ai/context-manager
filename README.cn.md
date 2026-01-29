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
npm install -g context-manager

# 在项目中初始化
ctx init

# 添加上下文
ctx add github.com/your-org/coding-standards

# 安装所有依赖
ctx install

# 健康检查
ctx doctor
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
