#!/bin/bash
# Test script for enhanced WHERE clause features

echo "🧪 Testing Enhanced WHERE Clause Features"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name="$1"
    shift
    echo -e "${YELLOW}Testing:${NC} $test_name"
    echo "Command: pnpm db:verify $@"
    
    if pnpm db:verify "$@" > /tmp/db-verify-enhanced-test.log 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Error output:"
        tail -n 10 /tmp/db-verify-enhanced-test.log
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test function with output verification
run_test_with_output() {
    local test_name="$1"
    local expected_content="$2"
    shift 2
    echo -e "${YELLOW}Testing:${NC} $test_name"
    echo "Command: pnpm db:verify $@"
    echo "Expected to contain: $expected_content"
    
    if pnpm db:verify "$@" > /tmp/db-verify-enhanced-test.log 2>&1; then
        if grep -q "$expected_content" /tmp/db-verify-enhanced-test.log; then
            echo -e "${GREEN}✓ PASSED${NC} (output contains expected content)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗ FAILED${NC} (output missing expected content)"
            echo "Actual output:"
            head -n 20 /tmp/db-verify-enhanced-test.log
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (command failed)"
        echo "Error output:"
        tail -n 10 /tmp/db-verify-enhanced-test.log
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

echo "=== IN Operator Tests ==="
echo ""

# Test IN with string values
run_test "IN operator with string values" count order --where "status IN ('PENDING', 'PROCESSING')"
run_test "IN operator with show command" show order --where "status IN ('PENDING', 'PROCESSING')" --limit 5
run_test "IN operator with stats command" stats order --where "status IN ('PENDING', 'PROCESSING')" --count id

# Test IN with numeric values
run_test "IN operator with numeric values" count item --where "reorderPoint IN (10, 20, 50)"

# Test IN with single value
run_test "IN operator with single value" count order --where "status IN ('CANCELLED')"

# Test IN in AND clause
run_test "IN operator in AND clause" count order --where "status IN ('PENDING', 'PROCESSING') AND grandTotal > 1000"

echo "=== LIKE Operator Tests ==="
echo ""

# Test LIKE with different patterns
run_test "LIKE operator with % wildcard" count item --where "name LIKE '%Widget%'"
run_test "LIKE operator with prefix match" show item --where "sku LIKE 'WIDGET%'" --limit 5
run_test "LIKE operator with suffix match" show customer --where "email LIKE '%@ventry.com'"
run_test "LIKE operator with single character" count item --where "sku LIKE 'WIDG_T001'"

# Test LIKE with stats
run_test "LIKE operator in stats" stats item --where "name LIKE '%Tool%'" --count id

# Test LIKE in AND clause
run_test "LIKE in AND clause" count item --where "name LIKE '%Widget%' AND isActive = true"

echo "=== IS NULL / IS NOT NULL Tests ==="
echo ""

# Test IS NULL
run_test "IS NULL check" count customer --where "phone IS NULL"
run_test "IS NULL with show" show customer --where "phone IS NULL" --limit 5
run_test "IS NULL in stats" stats customer --where "phone IS NULL" --count id

# Test IS NOT NULL
run_test "IS NOT NULL check" count item --where "defaultSupplierId IS NOT NULL"
run_test "IS NOT NULL with show" show item --where "defaultSupplierId IS NOT NULL" --limit 5
run_test "IS NOT NULL in stats" stats item --where "defaultSupplierId IS NOT NULL" --count id

# Test NULL checks in AND clause
run_test "NULL check in AND clause" count customer --where "phone IS NULL AND email IS NOT NULL"

echo "=== Complex AND Clause Tests ==="
echo ""

# Test multiple conditions with AND
run_test "AND with multiple equals" count item --where "isActive = true AND reorderPoint > 0"
run_test "AND with IN and comparison" count order --where "status IN ('PENDING', 'PROCESSING') AND grandTotal > 1000"
run_test "AND with LIKE and NULL" count customer --where "email LIKE '%@%.com' AND phone IS NOT NULL"
run_test "AND with field comparison" count inventory --where "qtyOnHand > 0 AND qtyOnHand <= qtyReserved"

# Test three conditions
run_test "Three conditions with AND" count item --where "isActive = true AND defaultPrice > 100 AND reorderPoint <= 10"

echo "=== Date Comparison Tests ==="
echo ""

# Test date comparisons with NOW()
run_test "Date comparison with NOW()" count order --where "orderDate < NOW()"
run_test "Date with INTERVAL subtraction" count order --where "orderDate > NOW() - INTERVAL '7 days'"
run_test "Date with INTERVAL addition" count purchaseOrder --where "expectedDate <= NOW() + INTERVAL '30 days'"

# Test with CURRENT_DATE
run_test "Date comparison with CURRENT_DATE" count order --where "orderDate >= CURRENT_DATE"

# Test date in AND clause
run_test "Date in AND clause" count order --where "status = 'PENDING' AND orderDate > NOW() - INTERVAL '24 hours'"
run_test "Date with multiple conditions" count purchaseOrder --where "status = 'ORDERED' AND expectedDate < NOW()"

# Test different interval formats
run_test "Date with hour interval" count stockMovement --where "movedAt > NOW() - INTERVAL '24 hours'"
run_test "Date with month interval" count item --where "createdAt >= NOW() - INTERVAL '1 month'"
run_test "Date with year interval" count customer --where "createdAt >= NOW() - INTERVAL '1 year'"

echo "=== Mixed Feature Tests ==="
echo ""

# Test combinations of features
run_test "IN and field comparison" count order --where "status IN ('PENDING', 'PROCESSING')"
run_test "LIKE and numeric comparison" count item --where "name LIKE '%Tool%' AND defaultPrice < 50"
run_test "NULL check and IN operator" count customer --where "phone IS NOT NULL AND customerCode IN ('CUST001', 'CUST002')"

# Test with different commands
run_test "Enhanced WHERE with show" show item --where "categoryId IS NOT NULL" --limit 10
run_test "Enhanced WHERE with stats" stats order --where "status IN ('PENDING', 'PROCESSING')" --group-by customerId --count id

# Test with cross-table
run_test "Enhanced WHERE with cross-table" count inventory --where "qtyOnHand <= item.reorderPoint AND item.isActive = true"

echo "=== Edge Cases ==="
echo ""

# Test empty IN clause
run_test "IN with no values (should fail)" count order --where "status IN ()" || echo "Expected failure"

# Test malformed LIKE
run_test "LIKE without quotes (should fail)" count item --where "name LIKE Widget" || echo "Expected failure"

# Test multiple spaces
run_test "Multiple spaces in condition" count item --where "isActive   =   true   AND   defaultPrice  >  100"

# Test case sensitivity
run_test "Case insensitive operators" count customer --where "email like '%@VENTRY.COM'"
run_test "Mixed case NULL" count customer --where "phone is null"

echo "=== Performance Tests ==="
echo ""

# Test with larger datasets
run_test "IN with many values" count item --where "sku IN ('WIDGET001', 'WIDGET002', 'WIDGET003', 'WIDGET004', 'WIDGET005')"
run_test "Complex AND with multiple conditions" count inventory --where "qtyOnHand > 0 AND qtyReserved >= 0 AND locationId IS NOT NULL AND itemId IS NOT NULL"

echo "=== Output Format Tests ==="
echo ""

# Test different output formats with enhanced WHERE
run_test "JSON format with IN" count order --where "status IN ('PENDING', 'PROCESSING')" --format json
run_test "CSV format with LIKE" show item --where "name LIKE '%Widget%'" --limit 5 --format csv
run_test_with_output "Table format with NULL check" "│" show customer --where "phone IS NULL" --limit 3 --format table

echo "========================================"
echo "Test Summary:"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All enhanced WHERE clause tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi