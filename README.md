# Context Injector

A CLI tool for managing and injecting AI coding contexts across projects.

## Overview

Context Injector is a decentralized tool that enables teams to share and manage coding standards, best practices, and project context for AI coding assistants (Claude Code, GitHub Copilot, Cursor, etc.) through Git repositories.

## Key Features

- 📦 **Git-based Context Management** - Distribute contexts using standard Git repositories
- 🔄 **Dependency Resolution** - Automatically handle context dependencies and versions
- 🤖 **Multi-tool Support** - Generate configurations for Claude, Copilot, Cursor, and more
- 🔒 **Version Locking** - Ensure team members use consistent context versions
- 🛡️ **Security** - Built-in integrity checks and content scanning
- 📝 **Agent Collaboration** - AI assistants can improve contexts and contribute back

## Quick Start

```bash
# Install
npm install -g context-manager

# Initialize in your project
ctx init

# Add contexts
ctx add github.com/your-org/coding-standards

# Install all dependencies
ctx install

# Health check
ctx doctor
```

## Documentation

- [Product Design](docs/PRODUCT_DESIGN.md) - Complete product specification
- [Implementation Design](docs/IMPLEMENTATION_DESIGN.md) - Technical design and decisions
- [User Stories](docs/USER_STORY.md) - Usage examples and scenarios
- [中文文档](README.cn.md) - Chinese documentation

## How It Works

### 1. Define Contexts in Git Repos

Create a context repository with standardized structure:

```
my-context/
├── context.yaml          # Metadata & dependencies
├── index.md              # Summary (always loaded)
├── details/              # Detailed contexts (loaded on demand)
│   ├── code-style.md
│   ├── architecture.md
│   └── testing.md
└── tools/                # Tool-specific overrides (optional)
    ├── claude.md
    └── copilot.md
```

### 2. Add to Your Project

```bash
ctx add github.com/company/engineering-standards
ctx add github.com/company/frontend-standards
ctx install
```

### 3. Auto-generated Configurations

The tool automatically generates configuration files for all supported AI assistants:
- `CLAUDE.md` - Claude Code
- `.github/copilot-instructions.md` - GitHub Copilot
- `kilo.md` - Kilo Code
- `opencode.md` - OpenCode
- `AGENTS.md` - OpenAI Codex

## Example Use Cases

### Company-wide Standards

Share coding standards across all projects:

```bash
# Add company base standards
ctx add github.com/company/engineering-standards

# Add framework-specific standards
ctx add github.com/company/react-patterns
ctx add github.com/company/typescript-guide
```

### Team Best Practices

Capture and share team knowledge:

```bash
# Add team-specific patterns
ctx add github.com/team/backend-patterns
ctx add github.com/team/database-migrations
```

### Open Source Conventions

Use community best practices:

```bash
# Add open source guidelines
ctx add github.com/awesome-contexts/python-best-practices
ctx add github.com/awesome-contexts/security-patterns
```

### Create Your Own Context

Share your standards with your team or the community:

```bash
# Create a new context repository
mkdir my-standards && cd my-standards
ctx init --context

# Follow the prompts to create:
# - Personal context for individual use
# - Organizational context for company-wide standards

# Publish to GitHub and share
gh repo create my-org/my-standards --public
git push -u origin main
git tag v1.0.0 && git push --tags

# Now others can use it
ctx add github.com/my-org/my-standards
```

## Project Status

🚧 **In Development** - This project is currently in the design phase.

## Contributing

Contributions are welcome! Please see our contributing guidelines for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/context-manager.git
cd context-manager

# Install dependencies
npm install

# Run tests
npm test
```

## License

MIT

## Acknowledgments

This tool is designed to work seamlessly with:
- [Claude Code](https://claude.ai/code) by Anthropic
- [GitHub Copilot](https://github.com/features/copilot) by GitHub
- [Cursor](https://cursor.sh/) by Cursor
- [Kilo Code](https://www.kilo.dev/) by Kilo
- And other AI coding assistants

---

**Note:** English is the primary language for this project's documentation. For Chinese speakers, see [README.cn.md](README.cn.md).
