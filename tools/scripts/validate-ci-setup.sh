#!/bin/bash

# CI/CD Setup Validation Script
# This script verifies that all CI/CD components are properly configured

set -e

REPO="wiremarrow/ventry"
ERRORS=0
WARNINGS=0

echo "🔍 Ventry CI/CD Setup Validator"
echo "==============================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

# Check if gh CLI is installed and authenticated
echo "📌 Checking prerequisites..."
if ! command -v gh &> /dev/null; then
    check_fail "GitHub CLI (gh) is not installed"
    echo "   Install from: https://cli.github.com/"
    exit 1
else
    check_pass "GitHub CLI is installed"
fi

if ! gh auth status &> /dev/null; then
    check_fail "Not authenticated with GitHub CLI"
    echo "   Run: gh auth login"
    exit 1
else
    check_pass "GitHub CLI is authenticated"
fi

# Check repository exists
echo ""
echo "📌 Checking repository configuration..."
if gh api repos/$REPO >/dev/null 2>&1; then
    check_pass "Repository $REPO exists and is accessible"
else
    check_fail "Repository $REPO not found or not accessible"
    exit 1
fi

# Check branch protection
echo ""
echo "📌 Checking branch protection..."
if gh api repos/$REPO/branches/main/protection >/dev/null 2>&1; then
    check_pass "Branch protection is enabled for main branch"
    
    # Check required status checks
    CONTEXTS=$(gh api repos/$REPO/branches/main/protection/required_status_checks --jq '.contexts[]' 2>/dev/null || echo "")
    EXPECTED_CHECKS=(
        "Documentation Check"
        "Lint and Type Check"
        "Unit Tests"
        "PostgreSQL Integration Tests"
        "E2E Tests - chromium (1)"
        "E2E Tests - chromium (2)"
        "E2E Tests - firefox (1)"
        "E2E Tests - firefox (2)"
        "E2E Tests - webkit (1)"
        "E2E Tests - webkit (2)"
        "Build"
        "Coverage Gate"
    )
    
    echo "   Checking required status checks..."
    for check in "${EXPECTED_CHECKS[@]}"; do
        if echo "$CONTEXTS" | grep -q "^$check$"; then
            echo -e "   ${GREEN}✓${NC} $check"
        else
            echo -e "   ${RED}✗${NC} $check"
            ((ERRORS++))
        fi
    done
else
    check_warn "Branch protection not enabled (main branch may not exist yet)"
fi

# Check GitHub Secrets
echo ""
echo "📌 Checking GitHub Secrets..."
SECRETS=$(gh api repos/$REPO/actions/secrets --jq '.secrets[].name' 2>/dev/null || echo "")

REQUIRED_SECRETS=(
    "TURBO_TOKEN"
    "TURBO_TEAM"
    "VERCEL_TOKEN"
    "VERCEL_ORG_ID"
    "VERCEL_PROJECT_ID"
    "SENTRY_DSN"
    "SENTRY_AUTH_TOKEN"
)

OPTIONAL_SECRETS=(
    "CODECOV_TOKEN"
    "SNYK_TOKEN"
    "SLACK_WEBHOOK"
    "DATABASE_URL"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
    if echo "$SECRETS" | grep -q "^$secret$"; then
        check_pass "$secret is configured"
    else
        check_fail "$secret is missing (required)"
    fi
done

for secret in "${OPTIONAL_SECRETS[@]}"; do
    if echo "$SECRETS" | grep -q "^$secret$"; then
        check_pass "$secret is configured"
    else
        check_warn "$secret is not configured (optional)"
    fi
done

# Check Environments
echo ""
echo "📌 Checking Environments..."
ENVIRONMENTS=$(gh api repos/$REPO/environments --jq '.environments[].name' 2>/dev/null || echo "")

for env in "staging" "production"; do
    if echo "$ENVIRONMENTS" | grep -q "^$env$"; then
        check_pass "$env environment exists"
        
        # Check environment protection for production
        if [ "$env" = "production" ]; then
            PROTECTION=$(gh api repos/$REPO/environments/production --jq '.protection_rules' 2>/dev/null || echo "[]")
            if [ "$PROTECTION" != "[]" ]; then
                check_pass "Production environment has protection rules"
            else
                check_warn "Production environment lacks protection rules"
            fi
        fi
    else
        check_fail "$env environment is missing"
    fi
done

# Check Security Features
echo ""
echo "📌 Checking Security Features..."

# Vulnerability alerts
if gh api repos/$REPO | jq -e '.security_and_analysis.vulnerability_alerts.status == "enabled"' >/dev/null 2>&1; then
    check_pass "Vulnerability alerts are enabled"
else
    check_warn "Vulnerability alerts are not enabled"
fi

# Dependabot
if [ -f ".github/dependabot.yml" ]; then
    check_pass "Dependabot configuration exists"
else
    check_warn "Dependabot configuration not found (.github/dependabot.yml)"
fi

# Check CI Workflow
echo ""
echo "📌 Checking CI Workflow..."
if [ -f ".github/workflows/ci.yml" ]; then
    check_pass "CI workflow exists"
    
    # Check if workflow is valid
    if gh workflow list | grep -q "CI"; then
        check_pass "CI workflow is valid"
    else
        check_fail "CI workflow has syntax errors"
    fi
else
    check_fail "CI workflow not found (.github/workflows/ci.yml)"
fi

# Check Recent Workflow Runs
echo ""
echo "📌 Checking Recent Workflow Runs..."
RECENT_RUNS=$(gh run list --limit 5 --json conclusion,status,name 2>/dev/null || echo "[]")
if [ "$RECENT_RUNS" != "[]" ]; then
    echo "   Recent CI runs:"
    echo "$RECENT_RUNS" | jq -r '.[] | select(.name == "CI") | "   - \(.status): \(.conclusion // "in progress")"' | head -5
else
    check_warn "No recent workflow runs found"
fi

# Summary
echo ""
echo "==============================="
echo "📊 Validation Summary"
echo "==============================="
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! Your CI/CD setup is complete.${NC}"
    else
        echo -e "${GREEN}✅ Setup is functional with $WARNINGS warnings.${NC}"
        echo "   Review warnings above for optional improvements."
    fi
else
    echo -e "${RED}❌ Found $ERRORS errors and $WARNINGS warnings.${NC}"
    echo "   Please fix the errors before proceeding."
    exit 1
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Create a test PR to verify all checks are running"
echo "2. Monitor the Actions tab for any failing workflows"
echo "3. Check external service integrations (Vercel, Sentry)"