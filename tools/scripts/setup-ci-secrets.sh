#!/bin/bash

# CI/CD External Configuration Helper Script
set -e

echo "🔐 GitHub CI/CD Configuration Helper"
echo "===================================="
echo ""
echo "This script will help you configure GitHub secrets for CI/CD"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

echo "📝 Setting up GitHub Secrets..."
echo ""

# Function to set secret
set_secret() {
    local name=$1
    local prompt=$2
    local required=${3:-true}
    
    echo -n "$prompt"
    if [ "$required" = "false" ]; then
        echo -n " (optional, press Enter to skip): "
    else
        echo -n ": "
    fi
    
    read -s value
    echo ""
    
    if [ -n "$value" ]; then
        gh secret set "$name" --body "$value"
        echo "✅ Set $name"
    elif [ "$required" = "true" ]; then
        echo "❌ $name is required!"
        exit 1
    else
        echo "⏭️  Skipped $name"
    fi
}

# Required secrets
echo "🔑 Required Secrets:"
set_secret "TURBO_TOKEN" "Turbo token (from turbo.build)"
set_secret "TURBO_TEAM" "Turbo team name"

# Deployment secrets
echo ""
echo "🚀 Deployment Secrets:"
set_secret "VERCEL_TOKEN" "Vercel token (from account settings)"
set_secret "VERCEL_ORG_ID" "Vercel organization ID"
set_secret "VERCEL_PROJECT_ID" "Vercel project ID"

# Monitoring secrets
echo ""
echo "📊 Monitoring Secrets:"
set_secret "SENTRY_DSN" "Sentry DSN (from project settings)"
set_secret "SENTRY_AUTH_TOKEN" "Sentry auth token"

# Optional secrets
echo ""
echo "🔑 Optional Secrets:"
set_secret "CODECOV_TOKEN" "Codecov token" false
set_secret "SNYK_TOKEN" "Snyk token" false
set_secret "SLACK_WEBHOOK" "Slack webhook URL" false

# Environment-specific secrets
echo ""
echo "🌍 Environment Configuration:"
echo "Would you like to set up environment-specific secrets? (y/N): "
read -n 1 setup_env
echo ""

if [[ $setup_env =~ ^[Yy]$ ]]; then
    for env in staging production; do
        echo ""
        echo "📦 Setting up $env environment..."
        
        # Create environment if it doesn't exist
        gh api --method PUT "repos/{owner}/{repo}/environments/$env" &> /dev/null || true
        
        # Set environment secrets
        echo "DATABASE_URL for $env: "
        read -s db_url
        if [ -n "$db_url" ]; then
            gh secret set DATABASE_URL --env "$env" --body "$db_url"
            echo "✅ Set DATABASE_URL for $env"
        fi
    done
fi

echo ""
echo "🎉 CI/CD secrets configuration complete!"
echo ""
echo "Next steps:"
echo "1. Run ./setup-github-repo.sh to configure branch protection automatically"
echo "2. Create a test PR to verify the CI pipeline"
echo "3. Set up external services (Vercel project, Sentry project)"
echo ""
echo "For detailed instructions, see: docs/CI_SETUP.md"