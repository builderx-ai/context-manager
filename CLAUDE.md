# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context Injector - A CLI tool to manage and inject AI coding contexts across projects. See [docs/PRODUCT_DESIGN.md](docs/PRODUCT_DESIGN.md) for full product specification.

## Documentation Language Policy

**Primary Language:** English

All primary documentation files are written in English:
- `docs/PRODUCT_DESIGN.md` - Product specification
- `docs/IMPLEMENTATION_DESIGN.md` - Technical implementation guide
- `README.md` - Project overview
- Code comments and documentation

**Chinese Translations:** Shadow Files

For Chinese-speaking team members, we maintain shadow translation files with `.cn.md` suffix:
- `docs/PRODUCT_DESIGN.cn.md` - 产品设计文档（中文版）
- `docs/IMPLEMENTATION_DESIGN.cn.md` - 实现设计文档（中文版）
- `README.cn.md` - 项目概述（中文版）

### Rules for Working with Documentation

**When creating or updating documentation:**

1. **Always edit the English version first** (`.md` files)
   - This is the source of truth
   - All technical decisions are documented in English

2. **Update the Chinese shadow file** (`.cn.md` files)
   - After updating an English file, update its corresponding `.cn.md` file
   - Keep the structure and content synchronized
   - Translate technical terms consistently

3. **File naming convention:**
   - English (primary): `FILENAME.md`
   - Chinese (shadow): `FILENAME.cn.md`
   - Example: `PRODUCT_DESIGN.md` → `PRODUCT_DESIGN.cn.md`

4. **What to translate:**
   - ✅ Documentation prose and explanations
   - ✅ Section headings and titles
   - ✅ Examples and descriptions
   - ✅ Comments in code examples (when helpful)
   - ❌ Code itself (keep English for consistency)
   - ❌ File paths, URLs, command names
   - ❌ Technical identifiers (function names, variables)

5. **Consistency:**
   - Use consistent translations for technical terms
   - Maintain the same document structure
   - Keep code examples identical (except comments)

**Example workflow:**

When you update `docs/IMPLEMENTATION_DESIGN.md`:
1. Make changes to the English version
2. Update the corresponding section in `docs/IMPLEMENTATION_DESIGN.cn.md`
3. Tell the user: "I've updated both the English and Chinese versions"

**When to notify about missing translations:**

If you notice a `.md` file exists but no `.cn.md` shadow file:
- Inform the user: "I notice `FILENAME.md` doesn't have a Chinese translation yet. Should I create `FILENAME.cn.md`?"

## Development Commands

*To be added as the project develops.*

## Architecture

See [docs/IMPLEMENTATION_DESIGN.md](docs/IMPLEMENTATION_DESIGN.md) for complete technical design.


