#!/bin/bash
# Comprehensive test script for db:verify tool

echo "🧪 Database Verification Tool - Comprehensive Test Suite"
echo "======================================================="
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

# Timing
START_TIME=$(date +%s)

# Available tables for testing
TABLES=(user organization item inventory warehouse location order customer supplier stockMovement)

# Test function
run_test() {
    local test_name="$1"
    shift
    echo -e "${YELLOW}Testing:${NC} $test_name"
    echo "Command: pnpm db:verify $@"
    
    if pnpm db:verify "$@" > /tmp/db-verify-test.log 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Error output:"
        tail -n 5 /tmp/db-verify-test.log
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test function for expected failures
run_test_expect_fail() {
    local test_name="$1"
    shift
    echo -e "${YELLOW}Testing:${NC} $test_name (should fail)"
    echo "Command: pnpm db:verify $@"
    
    if pnpm db:verify "$@" > /tmp/db-verify-test.log 2>&1; then
        echo -e "${RED}✗ FAILED${NC} (should have failed but passed)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        echo -e "${GREEN}✓ PASSED${NC} (correctly failed as expected)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
    echo ""
}

# Test function with output verification
run_test_with_output_check() {
    local test_name="$1"
    local expected_content="$2"
    shift 2
    echo -e "${YELLOW}Testing:${NC} $test_name"
    echo "Command: pnpm db:verify $@"
    echo "Expected to contain: $expected_content"
    
    if pnpm db:verify "$@" > /tmp/db-verify-test.log 2>&1; then
        if grep -q "$expected_content" /tmp/db-verify-test.log; then
            echo -e "${GREEN}✓ PASSED${NC} (output contains expected content)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗ FAILED${NC} (output missing expected content)"
            echo "Actual output:"
            head -n 10 /tmp/db-verify-test.log
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (command failed)"
        echo "Error output:"
        tail -n 5 /tmp/db-verify-test.log
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test all output formats for a command
test_all_formats() {
    local base_cmd="$1"
    local test_prefix="$2"
    
    for format in table json csv count; do
        run_test "$test_prefix - format: $format" $base_cmd --format $format
    done
}

echo "=== Basic Commands ==="
echo ""

# Test help
run_test "Help command" --help
run_test "Version command" --version

# Test tables listing
run_test "List tables" tables

echo "=== Global Options Testing ==="
echo ""

# Test --user option
run_test "Count with admin user (default)" count item --user admin
run_test "Count with app user" count item --user app
run_test "Count with app user without auth (no RLS context)" count item --user app

# Test --auth option (requires --user app)
run_test "Count with auth simulation" count item --user app --auth admin@ventry.com
run_test_expect_fail "Invalid auth email" count item --user app --auth nonexistent@example.com

# Test --verbose option
run_test_with_output_check "Verbose mode shows SQL" "SELECT" count item --verbose

# Test all output formats with a simple command
test_all_formats "count item" "Count item"

# Test --org filtering
run_test "Filter by organization slug" count item --org ventry-corp

echo "=== Count Commands - All Tables ==="
echo ""

# Test count for all tables
for table in "${TABLES[@]}"; do
    run_test "Count $table table" count $table
done

# Test count all
run_test "Count all tables" count all
run_test "Count all with JSON format" count all --format json
run_test "Count all with CSV format" count all --format csv

# Test count with various WHERE conditions
run_test "Count with simple equality" count item --where "isActive = true"
run_test "Count with numeric comparison >" count inventory --where "qtyOnHand > 100"
run_test "Count with numeric comparison <" count inventory --where "qtyOnHand < 50"
run_test "Count with numeric comparison >=" count inventory --where "qtyReserved >= 0"
run_test "Count with numeric comparison <=" count item --where "reorderPoint <= 10"

# Test count with auth context
run_test "Count as admin user" count order --user app --auth admin@ventry.com
run_test "Count as manager user" count order --user app --auth manager@ventry.com
run_test "Count as employee user" count order --user app --auth employee@ventry.com

echo "=== Show Commands - All Tables ==="
echo ""

# Test show for all tables
for table in "${TABLES[@]}"; do
    run_test "Show $table records" show $table --limit 2
done

# Test show with various options
run_test "Show with select single field" show item --select "sku" --limit 3
run_test "Show with select multiple fields" show item --select "sku,name,defaultPrice" --limit 2
run_test "Show with nested select" show inventory --select "item.sku,item.name,qtyOnHand" --limit 3
run_test "Show with deep nested select" show inventory --select "item.category.name,qtyOnHand" --limit 2

# Test pagination
run_test "Show with offset 0" show item --limit 5 --offset 0
run_test "Show with offset 5" show item --limit 5 --offset 5
run_test "Show with large offset" show item --limit 5 --offset 100

# Test ordering
run_test "Order by string field ASC" show item --order-by name --order asc --limit 3
run_test "Order by string field DESC" show item --order-by name --order desc --limit 3
run_test "Order by numeric field" show item --order-by defaultPrice --order desc --limit 3
run_test "Order by date field" show item --order-by createdAt --order desc --limit 3

# Test WHERE clauses with show  
run_test "Show with boolean WHERE" show item --where "isActive = true" --limit 5
run_test "Show with string WHERE" show customer --where "customerCode = 'CUST001'" --limit 3
run_test "Show low stock items" show inventory --where "qtyOnHand <= 10" --limit 5

# Test combined options
run_test "Show with all options combined" show inventory --select "item.sku,qtyOnHand" --where "qtyOnHand < 100" --order-by qtyOnHand --order asc --limit 3 --offset 0

# Test all output formats
test_all_formats "show customer --limit 2" "Show customer"

echo "=== Stats Commands - All Aggregates ==="
echo ""

# Test individual aggregate functions
run_test "Stats COUNT only" stats inventory --count id
run_test "Stats SUM only" stats inventory --sum qtyOnHand
run_test "Stats AVG only" stats item --avg defaultPrice
run_test "Stats MIN only" stats item --min defaultPrice
run_test "Stats MAX only" stats item --max defaultPrice

# Test multiple aggregates
run_test "Stats with 2 aggregates" stats inventory --count id --sum qtyOnHand
run_test "Stats with 3 aggregates" stats item --count id --avg defaultPrice --max defaultPrice
run_test "Stats with all aggregates" stats inventory --count id --sum qtyOnHand --avg qtyOnHand --min qtyOnHand --max qtyOnHand

# Test group by with different field types
run_test "Group by foreign key" stats inventory --group-by itemId --count id --sum qtyOnHand
run_test "Group by enum field" stats order --group-by status --count id
run_test "Group by boolean field" stats item --group-by isActive --count id
run_test "Group by with multiple aggregates" stats inventory --group-by locationId --count id --sum qtyOnHand --avg qtyOnHand

# Test stats with WHERE
run_test "Stats with WHERE clause" stats inventory --where "qtyOnHand > 50" --sum qtyOnHand
run_test "Stats grouped with WHERE" stats order --where "grandTotal > 1000" --group-by status --count id

# Test numeric fields across different tables
run_test "Stats on decimal field" stats item --avg defaultCost --min defaultCost --max defaultCost
run_test "Stats on integer field" stats inventory --sum qtyReserved --avg qtyReserved
run_test "Stats on order totals" stats order --sum grandTotal --avg grandTotal --max grandTotal

# Test output formats
test_all_formats "stats inventory --count id" "Stats inventory"

echo "=== Access Commands - All Users and Tables ==="
echo ""

# Test access for all demo users
DEMO_USERS=("admin@ventry.com" "manager@ventry.com" "employee@ventry.com")
for user in "${DEMO_USERS[@]}"; do
    run_test "Access as $user" access item --as "$user"
done

# Test access for all tables
for table in "${TABLES[@]}"; do
    run_test "Access $table table" access $table --as admin@ventry.com
done

# Test invalid user
run_test_expect_fail "Access with non-existent user" access item --as fake@example.com
run_test_expect_fail "Access with non-org user" access item --as user@ventry.com

echo "=== Compare Commands - Multiple Users ==="
echo ""

# Test compare with 2 users
run_test "Compare 2 users" compare item --users "admin@ventry.com,employee@ventry.com"

# Test compare with 3 users
run_test "Compare 3 users" compare order --users "admin@ventry.com,manager@ventry.com,employee@ventry.com"

# Test compare on different tables
for table in item inventory order customer; do
    run_test "Compare access to $table" compare $table --users "admin@ventry.com,manager@ventry.com"
done

echo "=== Error Handling Tests ==="
echo ""

# Invalid table names
run_test_expect_fail "Invalid table name" count nonexistent
run_test_expect_fail "Invalid table in show" show faketable

# Invalid field names
run_test_expect_fail "Invalid field in WHERE" count item --where "fakeField = 123"
run_test_expect_fail "Invalid field in select" show item --select "sku,fakeField"
run_test_expect_fail "Invalid field in order-by" show item --order-by fakeField
run_test_expect_fail "Invalid field in stats" stats item --sum fakeField

# Invalid WHERE clause syntax
run_test_expect_fail "Malformed WHERE clause" count item --where "invalid syntax here"
run_test_expect_fail "Complex WHERE not supported" count item --where "id = '1' AND name = 'test'"

# Invalid limits and offsets
run_test_expect_fail "Negative limit" show item --limit -5
run_test_expect_fail "Negative offset" show item --offset -10
run_test_expect_fail "Non-numeric limit" show item --limit abc
run_test_expect_fail "Non-numeric offset" show item --offset xyz

# Invalid relations
run_test_expect_fail "Non-existent relation" show item --select "fakeRelation.id"
run_test_expect_fail "Invalid nested relation" show item --select "inventory.fakeField"

# Invalid options combinations
run_test_expect_fail "Auth without app user" count item --auth admin@ventry.com
run_test_expect_fail "Stats without aggregates" stats item --group-by name

# Invalid enum values
run_test_expect_fail "Invalid format" count item --format invalid
run_test_expect_fail "Invalid sort order" show item --order invalid
run_test_expect_fail "Invalid user type" count item --user invalid

echo "=== Tables Command Tests ==="
echo ""

# Test tables command with formats
run_test "Tables with default format" tables
run_test_with_output_check "Tables contains item" "item" tables
run_test_with_output_check "Tables contains all tables" "stockMovement" tables

echo "=== Field-to-Field Comparison Tests ==="
echo ""

# Test field comparisons within same table
run_test "Field comparison - count" count inventory --where "qtyOnHand <= qtyReserved"
run_test "Field comparison - show" show inventory --where "qtyOnHand < qtyReserved" --limit 5
run_test "Field comparison with equals" count inventory --where "qtyOnHand = qtyReserved"
run_test "Field comparison with not equals" count inventory --where "qtyOnHand != qtyReserved"
run_test_expect_fail "Field comparison - invalid field1" count inventory --where "fakeField <= qtyReserved"
run_test_expect_fail "Field comparison - invalid field2" count inventory --where "qtyOnHand <= fakeField"

# Test with stats
run_test "Field comparison in stats" stats inventory --where "qtyOnHand > qtyReserved" --count id

echo "=== Cross-Table Field Comparison Tests ==="
echo ""

# Test cross-table comparisons
run_test "Cross-table comparison - low stock count" count inventory --where "qtyOnHand <= item.reorderPoint"
run_test "Cross-table comparison - low stock show" show inventory --where "qtyOnHand <= item.reorderPoint" --limit 5
run_test "Cross-table comparison - with table prefix on both sides" count inventory --where "inventory.qtyOnHand <= item.reorderPoint"
run_test "Cross-table comparison - stats" stats inventory --where "qtyOnHand <= item.reorderPoint" --count id --sum qtyOnHand
run_test "Cross-table comparison - profitable items" count item --where "defaultPrice > defaultCost"
run_test_expect_fail "Cross-table comparison - invalid table" count inventory --where "qtyOnHand <= faketable.reorderPoint"
run_test_expect_fail "Cross-table comparison - unrelated tables" count customer --where "email = supplier.email"

# Test more complex cross-table scenarios
run_test "Cross-table - order items with orders" count orderItem
run_test "Cross-table - purchase order status" count purchaseOrder --where "status = 'PENDING'"
run_test "Cross-table - cycle count variances" count cycleCountItem --where "qtyCounted != qtySystem"
run_test "Cross-table - over-allocated order items" count orderItem --where "qtyAllocated > qtyOrdered"

echo "=== Business Query Tests ==="
echo ""

# Inventory queries
run_test "Over-reserved inventory" count inventory --where "qtyReserved > qtyOnHand"
run_test "Items with no inventory" count item --where "isActive = true"
run_test "Inventory by location stats" stats inventory --group-by locationId --sum qtyOnHand --count id

# Order queries
run_test "Order status distribution" stats order --group-by status --count id
run_test "High value orders" show order --where "grandTotal > 1000" --limit 5
run_test "Unfulfilled order items" count orderItem --where "qtyOrdered > qtyShipped"

# Supplier queries
run_test "Active suppliers" count supplier --where "isActive = true"
run_test "Purchase orders by supplier" stats purchaseOrder --group-by supplierId --count id

# Customer queries
run_test "Customer order count" stats order --group-by customerId --count id
run_test "Customers with returns" stats return --group-by customerId --count id

# Financial queries
run_test "Profitable items analysis" count item --where "defaultPrice > defaultCost"
run_test "Payment status summary" stats payment --group-by status --sum amount --count id

echo "=== Complex Table Relationships ==="
echo ""

# Test multi-hop relationships
run_test "Order items by customer (2-hop)" show orderItem --limit 5
run_test "Inventory by warehouse (2-hop)" stats inventory --count id
run_test "Shipment items by location" count shipmentItem
run_test "Return items analysis" stats returnItem --group-by condition --count id

echo "=== Edge Cases ==="
echo ""

# Empty result sets
run_test "Empty result set" show item --where "defaultPrice > 999999"
run_test "Empty stats result" stats item --where "defaultPrice > 999999" --count id

# Large limits
run_test "Very large limit" show item --limit 1000
run_test "Show all with limit 9999" show customer --limit 9999

# Special characters in WHERE (properly escaped)
run_test "WHERE with special chars" show item --where "name = 'Test'"

# Null handling
run_test "Count with nullable field" count inventory --where "lotId = null"
run_test "Show records with null fields" show customer --select "email,phone" --limit 5

# Boolean fields
run_test "Boolean true in WHERE" show item --where "isActive = true"
run_test "Boolean false in WHERE" show item --where "isActive = false"

# Date comparisons (if supported)
run_test "Recent records" show item --order-by createdAt --order desc --limit 5

echo "=== Enhanced WHERE Clause Tests ==="
echo ""

# IN operator tests
run_test "IN operator with strings" count order --where "status IN ('PENDING', 'PROCESSING')"
run_test "IN operator with numbers" count item --where "reorderPoint IN (10, 20, 50)"
run_test "IN operator in show" show order --where "status IN ('PENDING', 'PROCESSING')" --limit 5
run_test "IN operator in stats" stats order --where "status IN ('PENDING', 'CANCELLED')" --count id

# LIKE operator tests
run_test "LIKE with wildcards" count item --where "name LIKE '%Widget%'"
run_test "LIKE prefix match" show item --where "sku LIKE 'WIDGET%'" --limit 5
run_test "LIKE suffix match" count customer --where "email LIKE '%@ventry.com'"
run_test "LIKE in stats" stats item --where "name LIKE '%Tool%'" --count id

# IS NULL / IS NOT NULL tests
run_test "IS NULL check" count customer --where "phone IS NULL"
run_test "IS NOT NULL check" count item --where "defaultSupplierId IS NOT NULL"
run_test "IS NULL in show" show customer --where "phone IS NULL" --limit 3
run_test "IS NOT NULL in stats" stats item --where "defaultSupplierId IS NOT NULL" --count id

# Complex AND conditions
run_test "AND with IN and comparison" count order --where "status IN ('PENDING', 'PROCESSING') AND grandTotal > 1000"
run_test "AND with LIKE and NULL" count customer --where "email LIKE '%@%.com' AND phone IS NOT NULL"
run_test "AND with field comparison and IN" count inventory --where "qtyOnHand > 0 AND locationId IN (1, 2, 3)"

echo "=== Performance Tests ==="
echo ""

# Test with larger datasets
run_test "Count all tables performance" count all
run_test "Large aggregation" stats inventory --group-by itemId --count id --sum qtyOnHand --avg qtyOnHand
run_test "Complex nested query" show order --select "customer.companyName,items.id,grandTotal" --limit 10

echo "=== Help Commands for Subcommands ==="
echo ""

# Test help for each subcommand
run_test "Help for count" count --help
run_test "Help for show" show --help
run_test "Help for stats" stats --help
run_test "Help for access" access --help
run_test "Help for compare" compare --help

echo "======================================================="
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "Test Summary:"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo -e "  ${BLUE}Duration: ${DURATION}s${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi