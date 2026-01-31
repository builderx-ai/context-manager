# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### Features

- Initial CLI implementation with core modules, CLI commands, and tests
- Agent selection support for multiple AI coding tools (claude, agents, copilot, opencode, kilo)
- Comprehensive TDD-based E2E test suite
- Makefile with dockerized E2E testing
- GitHub Actions CI/CD workflows for automated testing and NPM publishing

### Chores

- Add project scaffolding and initial implementation
- Update .gitignore for tmp-e2e, tgz, coverage, caches
- Ensure e2e installs dependencies before build in CI
- Fix ctx init invocation (remove --name)
