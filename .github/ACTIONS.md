# GitHub Actions CI/CD

This repository uses GitHub Actions for continuous integration and deployment.

## Workflows

### 1. E2E Tests (`e2e.yml`)
- **Trigger**: Every push to `main` or `develop` branches, and all pull requests
- **Actions**:
  - Checkout code
  - Setup Node.js 18
  - Install dependencies
  - Build project
  - Run E2E tests in Docker
  - Upload test artifacts on failure

### 2. Automated Release (`release.yml`) ⭐ NEW
- **Trigger**: Every push to `main` branch (excluding documentation-only changes)
- **Actions**:
  - Run E2E tests
  - Build project
  - Create version bump (based on conventional commits)
  - Generate CHANGELOG
  - Create git tag
  - Push tag back to repository
  - Publish to NPM as `@builderx-ai/context-manager`
  - Create GitHub Release

### 3. Publish to NPM (`publish.yml`) - DEPRECATED
- **Note**: This workflow is deprecated in favor of the automated release workflow
- Previously triggered when tags were pushed manually

## Setup Instructions

### Required Secrets

To enable NPM publishing, you need to configure the `NPM_TOKEN` secret:

1. **Generate NPM Access Token**:
   - Go to https://www.npmjs.com/
   - Login to your account
   - Click on your profile → "Access Tokens"
   - Click "Generate New Token" → "Classic Token"
   - Select "Automation" type
   - Copy the generated token

2. **Add Secret to GitHub Repository**:
   - Go to your repository on GitHub
   - Click "Settings" → "Secrets and variables" → "Actions"
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste the NPM token you generated
   - Click "Add secret"

### Publishing a New Version

**This project uses FULLY AUTOMATED releases.**

#### Automated Release (Recommended) ⭐

Simply commit using conventional commits and push to main:

```bash
# Make changes and commit
git add .
git commit -m "feat: add new search command"

# Push to main - this triggers EVERYTHING automatically
git push origin main
```

**GitHub Actions will automatically:**
1. ✅ Run E2E tests
2. ✅ Analyze commits since last release
3. ✅ Determine version bump (feat→MINOR, fix→PATCH, feat!→MAJOR)
4. ✅ Update package.json version
5. ✅ Generate/update CHANGELOG.md
6. ✅ Create release commit and tag
7. ✅ Push tag back to repo
8. ✅ Publish to NPM as `@builderx-ai/context-manager`
9. ✅ Create GitHub Release with notes

**Important:**
- Only commits to `main` branch trigger releases
- Documentation-only changes (*.md, docs/**, .github/**) are ignored
- Use conventional commits (feat:, fix:, etc.) for proper version bumping

#### Manual Release (Advanced)

If you need control over release timing:

#### Manual Release (Advanced)

If you need control over release timing:

```bash
# 1. Create release locally
npm run release              # Auto-detect bump
npm run release:patch        # Force patch
npm run release:minor        # Force minor
npm run release:major        # Force major

# 2. Push to main
git push --follow-tags origin main

# GitHub Actions will handle NPM publish + GitHub Release
```

**Note:** The automated workflow on main will detect the existing version bump and skip re-creating it.

### Example Release Workflow

**Automated (Recommended):**
```bash
# Just commit and push
git add .
git commit -m "feat: add context search command"
git commit -m "fix: handle missing manifest gracefully"
git push origin main

# That's it! GitHub Actions does everything else.
```

**Manual control:**
```bash
# Create release locally
npm run release

# Push to trigger publish
git push --follow-tags origin main
```

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

- **PATCH** (`npm run release:patch`) - Bug fixes: 0.1.0 → 0.1.1
- **MINOR** (`npm run release:minor`) - New features: 0.1.0 → 0.2.0
- **MAJOR** (`npm run release:major`) - Breaking changes: 0.1.0 → 1.0.0

Version bumps are **automatically determined** from conventional commits when you run `npm run release`.

## Troubleshooting

### Publish fails with "version already exists"
- Make sure you bumped the version in package.json
- Check that the tag version matches package.json version

### Tests fail in CI but pass locally
- Check the E2E test logs in the Actions tab
- Download the test artifacts for debugging

### NPM token expired
- Generate a new token on npmjs.com
- Update the `NPM_TOKEN` secret in GitHub
