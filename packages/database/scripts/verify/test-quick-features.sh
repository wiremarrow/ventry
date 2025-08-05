#!/bin/bash
# Quick test of new WHERE clause features

echo "🧪 Quick Test of Enhanced WHERE Features"
echo "======================================"
echo ""

# Test IN clause with enum
echo "1. Testing IN clause with enum values:"
pnpm db:verify count order --where "status IN ('PENDING', 'CONFIRMED')" --format count

# Test LIKE pattern
echo ""
echo "2. Testing LIKE pattern matching:"
pnpm db:verify count item --where "name LIKE '%Pro%'" --format count

# Test IS NULL
echo ""
echo "3. Testing IS NULL:"
pnpm db:verify count customer --where "phone IS NULL" --format count

# Test date comparison
echo ""
echo "4. Testing date comparison:"
pnpm db:verify count order --where "orderDate > NOW() - INTERVAL '30 days'" --format count

# Test complex AND
echo ""
echo "5. Testing complex AND conditions:"
pnpm db:verify count order --where "status IN ('PENDING', 'CONFIRMED') AND grandTotal > 1000" --format count

# Test cross-table comparison
echo ""
echo "6. Testing cross-table comparison:"
pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint" --format count

echo ""
echo "✅ All features tested!"