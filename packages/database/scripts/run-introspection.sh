#!/bin/bash
# Script to run RLS introspection against the database

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== RLS Database Introspection ==="
echo

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    echo "Please set it to your PostgreSQL connection string"
    echo "Example: DATABASE_URL=postgresql://user:password@localhost:5432/dbname"
    exit 1
fi

# Extract database name from DATABASE_URL for display
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
echo -e "${GREEN}Running introspection on database:${NC} $DB_NAME"
echo

# Create output directory
OUTPUT_DIR="./introspection-results"
mkdir -p "$OUTPUT_DIR"

# Generate timestamp for the output file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$OUTPUT_DIR/rls_introspection_${TIMESTAMP}.txt"

# Run the introspection script
echo -e "${YELLOW}Executing introspection queries...${NC}"
psql "$DATABASE_URL" -f ./introspect-rls-state.sql > "$OUTPUT_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Introspection completed successfully${NC}"
    echo -e "Results saved to: ${OUTPUT_FILE}"
    echo
    echo "=== Key Findings Summary ==="
    
    # Extract some key information
    echo
    echo "Tables with RLS enabled:"
    grep -A 20 "rowsecurity" "$OUTPUT_FILE" | grep " t " | awk '{print "  - " $2}' | head -20
    
    echo
    echo "Tables missing expected columns:"
    grep -A 10 "MISSING" "$OUTPUT_FILE" | grep "MISSING" | awk '{print "  - " $1 "." $2}' | sort -u
    
    echo
    echo "RLS Functions found:"
    grep -E "current_user_id|current_organization_id|set_rls_context" "$OUTPUT_FILE" | grep -v "SELECT" | awk '{print "  - " $1}' | sort -u | head -10
    
    echo
    echo -e "${YELLOW}Full results are in: $OUTPUT_FILE${NC}"
else
    echo -e "${RED}✗ Introspection failed${NC}"
    echo "Check error messages in: $OUTPUT_FILE"
    exit 1
fi

# Optional: Open the file in the default text editor
# Uncomment the line below if you want to automatically open the results
# open "$OUTPUT_FILE" 2>/dev/null || xdg-open "$OUTPUT_FILE" 2>/dev/null || echo "View the file manually"