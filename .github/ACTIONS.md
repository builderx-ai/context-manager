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

### 2. Publish to NPM (`publish.yml`)
- **Trigger**: When a tag starting with `v` is pushed (e.g., `v0.1.0`, `v1.2.3`)
- **Actions**:
  - Run full E2E test suite
  - Verify package.json version matches tag
  - Build and publish to NPM
  - Create GitHub Release

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

1. **Update version in package.json**:
   ```bash
   npm version patch  # or minor, or major
   ```

2. **Push the tag**:
   ```bash
   git push origin main --tags
   ```

3. **GitHub Actions will automatically**:
   - Run E2E tests
   - Publish to NPM if tests pass
   - Create a GitHub Release

### Example Release Workflow

```bash
# Make your changes
git add .
git commit -m "feat: add new feature"

# Bump version (this creates a git tag)
npm version patch  # 0.1.0 → 0.1.1

# Push changes and tags
git push origin main --tags

# GitHub Actions will handle the rest!
```

## Version Tagging Strategy

- `npm version patch` - Bug fixes (0.1.0 → 0.1.1)
- `npm version minor` - New features (0.1.0 → 0.2.0)
- `npm version major` - Breaking changes (0.1.0 → 1.0.0)

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
