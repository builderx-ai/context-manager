# Automated Release Setup Guide

## ✅ What's Been Done

### 1. Package Name Updated
- Changed from `context-manager` to `@builderx-ai/context-manager`
- Updated all documentation references
- Added repository info and keywords to package.json

### 2. Automated Release Workflow Created
- **File**: `.github/workflows/release.yml`
- **Trigger**: Push to `main` branch (excluding doc-only changes)
- **Actions**:
  1. Run E2E tests
  2. Build project
  3. Create version bump (based on conventional commits)
  4. Generate CHANGELOG
  5. Create git tag
  6. Push tag back to repository
  7. Publish to NPM
  8. Create GitHub Release

### 3. Documentation Updated
- `docs/VERSIONING.md` - Added automated release workflow
- `.github/ACTIONS.md` - Updated with new workflow details
- Both now emphasize the fully automated approach

### 4. Initial Release Created
- Version: `0.0.0`
- Tag: `v0.0.0`
- CHANGELOG generated with all features

## 🚀 How to Use

### Simple Workflow (Recommended)

Just commit and push to main:

```bash
git add .
git commit -m "feat: add new search command"
git push origin main
```

**That's it!** GitHub Actions will automatically:
- Run tests
- Determine version bump from commit type
- Update version and CHANGELOG
- Create and push tag
- Publish to NPM
- Create GitHub Release

### Version Bump Logic

Commits are analyzed to determine version bumps:

- `feat: ...` → **MINOR** version bump (0.0.0 → 0.1.0)
- `fix: ...` → **PATCH** version bump (0.1.0 → 0.1.1)
- `feat!: ...` or `BREAKING CHANGE:` → **MAJOR** version bump (0.1.0 → 1.0.0)
- `docs:`, `chore:`, etc. → No version bump (but still released on next feat/fix)

### Manual Control (Optional)

If you want to control release timing:

```bash
# Create release locally
npm run release              # Auto-determine version
npm run release:patch        # Force patch bump
npm run release:minor        # Force minor bump
npm run release:major        # Force major bump

# Push to trigger publish
git push origin main
```

## 📋 Next Steps

### 1. Configure NPM Access Token

To enable NPM publishing, add your NPM token to GitHub secrets:

1. **Generate NPM Token**:
   ```bash
   # Visit: https://www.npmjs.com/
   # Login → Profile → Access Tokens → Generate New Token
   # Choose "Automation" type
   ```

2. **Add to GitHub Secrets**:
   ```bash
   # Go to: https://github.com/builderx-ai/context-manager/settings/secrets/actions
   # Click "New repository secret"
   # Name: NPM_TOKEN
   # Value: <paste your token>
   ```

3. **Verify Organization Access**:
   ```bash
   # Make sure you have publish rights to @builderx-ai scope
   # Visit: https://www.npmjs.com/settings/builderx-ai/packages
   ```

### 2. Test the Workflow

Push the changes to trigger the first automated release:

```bash
# Commit all the changes made
git add .
git commit -m "feat: setup automated release workflow and rename package"
git push origin main
```

This will trigger the workflow and:
- Run E2E tests
- Create v0.1.0 (since we have new feat commits)
- Publish to NPM as @builderx-ai/context-manager
- Create GitHub Release

### 3. Monitor the Release

Watch the GitHub Actions:
- URL: https://github.com/builderx-ai/context-manager/actions
- Workflow: "Release"
- Check for any errors

### 4. Verify Publication

After successful workflow:
- NPM: https://www.npmjs.com/package/@builderx-ai/context-manager
- GitHub Releases: https://github.com/builderx-ai/context-manager/releases

## 🔧 Troubleshooting

### NPM Token Issues

**Error**: `npm ERR! 403 Forbidden`

**Solution**:
1. Verify NPM_TOKEN secret is set correctly
2. Ensure token is "Automation" type
3. Check @builderx-ai organization permissions

### Version Conflicts

**Error**: `version already exists on NPM`

**Solution**:
- The version was already published
- Create a new commit to trigger next version bump
- Or manually bump version with `npm run release`

### Tests Fail in CI

**Error**: E2E tests fail

**Solution**:
1. Run tests locally first: `make e2e`
2. Check GitHub Actions logs for details
3. Fix issues and push again

## 📝 Important Notes

1. **Only main branch triggers releases** - pushes to other branches won't publish

2. **Documentation changes don't trigger releases** - changes to `*.md`, `docs/**`, `.github/**` are ignored

3. **Conventional Commits are required** - use proper commit format for auto-versioning:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `chore:` for maintenance
   - `docs:` for documentation

4. **Tags are created automatically** - no need to manually create or push tags

5. **CHANGELOG is auto-generated** - based on conventional commits since last release

## 🎯 Quick Reference

```bash
# Regular development workflow
git add .
git commit -m "feat: add something"
git push origin main
# → Automated release happens

# Check release status
open https://github.com/builderx-ai/context-manager/actions

# View published package
open https://www.npmjs.com/package/@builderx-ai/context-manager

# View GitHub releases
open https://github.com/builderx-ai/context-manager/releases
```

## 📚 Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version](https://github.com/conventional-changelog/standard-version)
- [Project Versioning Guide](../docs/VERSIONING.md)
