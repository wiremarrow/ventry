#!/bin/bash

# GitHub Repository Setup Script for Ventry
# This script configures branch protection, environments, and other settings

set -e

REPO="wiremarrow/ventry"

echo "🚀 Setting up GitHub repository: $REPO"

# Enable vulnerability alerts
echo "📊 Enabling vulnerability alerts..."
gh api --method PUT repos/$REPO/vulnerability-alerts

# Enable automated security fixes
echo "🔒 Enabling automated security fixes..."
gh api --method PUT repos/$REPO/automated-security-fixes

# Create environments
echo "🌍 Creating environments..."

# Staging environment
gh api --method PUT repos/$REPO/environments/staging --input - <<EOF
{
  "wait_timer": 0,
  "reviewers": [],
  "deployment_branch_policy": null
}
EOF

# Production environment with protection
gh api --method PUT repos/$REPO/environments/production --input - <<EOF
{
  "wait_timer": 0,
  "reviewers": [
    {
      "type": "User",
      "id": $(gh api user --jq '.id')
    }
  ],
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
EOF

# Configure branch protection rules
echo "🔐 Configuring branch protection rules..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if main branch exists
if gh api repos/$REPO/branches/main >/dev/null 2>&1; then
  echo "Setting up branch protection for main branch..."
  
  # Apply branch protection rules from JSON file
  if [ -f "$SCRIPT_DIR/branch-protection.json" ]; then
    gh api --method PUT repos/$REPO/branches/main/protection \
      --input "$SCRIPT_DIR/branch-protection.json"
    echo "✅ Branch protection rules applied successfully"
  else
    echo "⚠️  Warning: branch-protection.json not found. Skipping branch protection setup."
  fi
else
  echo "⚠️  Warning: main branch not found. Please push code first, then re-run this script."
fi

# Enable Dependabot security updates
echo "🤖 Enabling Dependabot security updates..."
gh api --method PUT repos/$REPO/vulnerability-alerts
gh api --method PATCH repos/$REPO \
  --field security_and_analysis[dependabot_security_updates][status]=enabled \
  --silent || echo "⚠️  Note: Dependabot security updates may require GitHub Pro/Teams"

# Enable Dependabot version updates
echo "📦 Creating Dependabot configuration..."
mkdir -p .github
cat > .github/dependabot.yml << 'EOF'
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      development-dependencies:
        dependency-type: "development"
      production-dependencies:
        dependency-type: "production"
    open-pull-requests-limit: 10
EOF

if [ ! -f .github/dependabot.yml ]; then
  echo "✅ Created .github/dependabot.yml"
else
  echo "ℹ️  .github/dependabot.yml already exists"
fi

# Enable secret scanning
echo "🔍 Enabling secret scanning..."
gh api --method PATCH repos/$REPO \
  --field security_and_analysis[secret_scanning][status]=enabled \
  --field security_and_analysis[secret_scanning_push_protection][status]=enabled \
  --silent || echo "⚠️  Note: Secret scanning may require GitHub Advanced Security"

echo "✅ GitHub repository setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add repository secrets using ./setup-ci-secrets.sh"
echo "2. Configure external services (Vercel, Sentry, Database)"
echo "3. Push code to main branch if not already done"
echo "4. Verify all 12 CI checks are running on your first PR"
echo ""
echo "🔗 Repository: https://github.com/$REPO"