# Semantic Versioning Guide

This project follows [Semantic Versioning 2.0.0](https://semver.org/).

## Version Format

Given a version number `MAJOR.MINOR.PATCH`, increment the:

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backward compatible manner
- **PATCH** version when you make backward compatible bug fixes

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature (triggers MINOR version bump)
- **fix**: A bug fix (triggers PATCH version bump)
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools
- **ci**: Changes to CI configuration files and scripts

### Breaking Changes

Add `BREAKING CHANGE:` in the commit footer or append `!` after the type to trigger a MAJOR version bump:

```
feat!: remove support for Node 16

BREAKING CHANGE: Node 18 or higher is now required
```

## Release Workflow

### 1. Development

Make changes and commit using conventional commit messages:

```bash
git add .
git commit -m "feat: add new command for listing contexts"
```

### 2. Create a Release

Use npm scripts to create a new release:

```bash
# Automatic version bump based on commits
npm run release

# Or specify version type explicitly
npm run release:patch   # 0.1.0 → 0.1.1 (bug fixes)
npm run release:minor   # 0.1.0 → 0.2.0 (new features)
npm run release:major   # 0.1.0 → 1.0.0 (breaking changes)

# First release (doesn't bump version)
npm run release:first
```

This will:
- ✅ Analyze commits since last release
- ✅ Determine appropriate version bump
- ✅ Update `package.json` version
- ✅ Generate/update `CHANGELOG.md`
- ✅ Create a git commit: `chore(release): x.y.z`
- ✅ Create a git tag: `vx.y.z`

### 3. Push to Trigger Publish

```bash
# Push commits and tags
git push --follow-tags origin main
```

This triggers GitHub Actions to:
- ✅ Run E2E tests
- ✅ Verify version matches tag
- ✅ Publish to NPM
- ✅ Create GitHub Release with changelog

## Examples

### Patch Release (Bug Fix)

```bash
# Make fixes
git commit -m "fix: resolve context installation race condition"
git commit -m "fix: handle missing manifest.yaml gracefully"

# Create patch release
npm run release:patch
# Creates v0.1.1

# Push
git push --follow-tags origin main
```

### Minor Release (New Feature)

```bash
# Add features
git commit -m "feat: add search command for finding contexts"
git commit -m "feat: support context tags for discovery"

# Create minor release
npm run release:minor
# Creates v0.2.0

# Push
git push --follow-tags origin main
```

### Major Release (Breaking Change)

```bash
# Breaking change
git commit -m "feat!: redesign manifest schema

BREAKING CHANGE: The manifest.yaml format has changed.
Migration guide: see docs/MIGRATION.md"

# Create major release
npm run release:major
# Creates v1.0.0

# Push
git push --follow-tags origin main
```

## Changelog Format

The `CHANGELOG.md` is automatically generated and organized by type:

```markdown
## [0.2.0] - 2026-01-31

### Features
- add search command for finding contexts
- support context tags for discovery

### Bug Fixes
- resolve context installation race condition
- handle missing manifest.yaml gracefully

### Documentation
- update installation guide
```

## Pre-release Versions

For alpha/beta releases:

```bash
# Create pre-release
npm run release -- --prerelease alpha
# Creates v0.2.0-alpha.0

npm run release -- --prerelease beta
# Creates v0.2.0-beta.0
```

## Dry Run

Test the release process without making changes:

```bash
npm run release -- --dry-run
```

This shows what would happen without:
- Bumping version
- Writing to CHANGELOG.md
- Creating commit/tag

## Manual Release (Not Recommended)

If you need to manually create a release:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "chore(release): x.y.z"`
4. Tag: `git tag vx.y.z`
5. Push: `git push --follow-tags origin main`

## Troubleshooting

### "Version already exists on NPM"
- You pushed a tag that was already published
- Create a new version with a higher number

### "Version in package.json doesn't match tag"
- Run `npm run release` again
- Make sure you pushed the commit created by standard-version

### "CHANGELOG.md conflicts"
- Pull latest changes before running `npm run release`
- Resolve conflicts manually if needed

## Best Practices

1. **Commit Often**: Make small, focused commits with clear messages
2. **Use Conventional Commits**: Always follow the commit message format
3. **Test Before Release**: Run `npm test` and `make e2e` before releasing
4. **Review CHANGELOG**: Check the generated changelog before pushing
5. **Semantic Bumps**: Let standard-version determine the version bump automatically
6. **Follow-tags**: Always use `git push --follow-tags` to push tags with commits

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version](https://github.com/conventional-changelog/standard-version)
