#!/bin/bash

# Complete development environment cleanup
# Kills all Node.js/Next.js processes and frees up ports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Ventry Development Environment Cleanup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Kill all Next.js dev servers
echo -e "${YELLOW}1. Killing Next.js development servers...${NC}"
NEXT_PIDS=$(pgrep -f "next-server|next dev" 2>/dev/null || true)
if [ -n "$NEXT_PIDS" ]; then
    echo -e "${RED}Found Next.js processes:${NC}"
    ps aux | grep -E "(next-server|next dev)" | grep -v grep || true
    
    for PID in $NEXT_PIDS; do
        if kill -TERM $PID 2>/dev/null; then
            echo -e "${GREEN}✓ Killed Next.js process $PID${NC}"
        fi
    done
else
    echo -e "${GREEN}✓ No Next.js processes found${NC}"
fi

# Step 2: Kill Node.js processes related to ventry
echo -e "\n${YELLOW}2. Killing Ventry-related Node.js processes...${NC}"
VENTRY_PIDS=$(pgrep -f "node.*ventry" 2>/dev/null || true)
if [ -n "$VENTRY_PIDS" ]; then
    echo -e "${RED}Found Ventry Node.js processes:${NC}"
    ps aux | grep "node.*ventry" | grep -v grep || true
    
    for PID in $VENTRY_PIDS; do
        # Skip if it's the current script
        if [ $PID -ne $$ ]; then
            if kill -TERM $PID 2>/dev/null; then
                echo -e "${GREEN}✓ Killed Node.js process $PID${NC}"
            fi
        fi
    done
else
    echo -e "${GREEN}✓ No Ventry Node.js processes found${NC}"
fi

# Step 3: Kill processes on development ports
echo -e "\n${YELLOW}3. Cleaning up development ports...${NC}"
# Primary development ports
./tools/scripts/kill-ports.sh 6060 6061 5558 5487 5050 6379 3001

# Step 4: Kill any turbo processes
echo -e "\n${YELLOW}4. Killing Turbo processes...${NC}"
TURBO_PIDS=$(pgrep -f "turbo" 2>/dev/null || true)
if [ -n "$TURBO_PIDS" ]; then
    echo -e "${RED}Found Turbo processes:${NC}"
    ps aux | grep turbo | grep -v grep || true
    
    for PID in $TURBO_PIDS; do
        if kill -TERM $PID 2>/dev/null; then
            echo -e "${GREEN}✓ Killed Turbo process $PID${NC}"
        fi
    done
else
    echo -e "${GREEN}✓ No Turbo processes found${NC}"
fi

# Step 5: Clean TypeScript watch processes
echo -e "\n${YELLOW}5. Killing TypeScript watch processes...${NC}"
TSC_PIDS=$(pgrep -f "tsc.*--watch" 2>/dev/null || true)
if [ -n "$TSC_PIDS" ]; then
    echo -e "${RED}Found TypeScript watch processes:${NC}"
    ps aux | grep "tsc.*--watch" | grep -v grep || true
    
    for PID in $TSC_PIDS; do
        if kill -TERM $PID 2>/dev/null; then
            echo -e "${GREEN}✓ Killed TypeScript watch process $PID${NC}"
        fi
    done
else
    echo -e "${GREEN}✓ No TypeScript watch processes found${NC}"
fi

# Step 6: Final verification
echo -e "\n${YELLOW}6. Final verification...${NC}"

# Check for any remaining Node processes
REMAINING=$(ps aux | grep -E "(node|next|turbo|tsx)" | grep -v grep | grep ventry || true)
if [ -n "$REMAINING" ]; then
    echo -e "${RED}⚠️  Some processes may still be running:${NC}"
    echo "$REMAINING"
    echo -e "${YELLOW}You may need to manually kill these processes${NC}"
else
    echo -e "${GREEN}✓ All Ventry development processes cleaned up${NC}"
fi

# Check port status
echo -e "\n${YELLOW}Port status:${NC}"
PORTS_TO_CHECK=(6060 6061 5558 5487 5050 6379 3001)
for PORT in "${PORTS_TO_CHECK[@]}"; do
    if lsof -i :$PORT >/dev/null 2>&1; then
        echo -e "${RED}✗ Port $PORT still in use${NC}"
    else
        echo -e "${GREEN}✓ Port $PORT is free${NC}"
    fi
done

echo -e "\n${GREEN}✅ Development environment cleanup complete!${NC}"
echo -e "${BLUE}You can now safely run 'pnpm dev' again.${NC}"