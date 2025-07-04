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

echo "✅ GitHub repository setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add repository secrets (see EXTERNAL_INTEGRATIONS_SETUP.md)"
echo "2. Set up branch protection rules manually in GitHub UI"
echo "3. Configure external services (Vercel, Sentry, Database)"
echo ""
echo "🔗 Repository: https://github.com/$REPO"