#!/bin/bash

# Kill processes on common development ports
# Usage: ./kill-ports.sh [port1] [port2] ...
# Default: kills processes on ports 6060 (backend) and 6061 (web)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default ports if none provided
if [ $# -eq 0 ]; then
    PORTS=(6060 6061)
else
    PORTS=("$@")
fi

echo -e "${YELLOW}🔍 Checking for processes on ports: ${PORTS[*]}${NC}"

for PORT in "${PORTS[@]}"; do
    echo -e "\n${YELLOW}Checking port $PORT...${NC}"
    
    # Find PIDs using the port
    PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
    
    if [ -z "$PIDS" ]; then
        echo -e "${GREEN}✓ No process found on port $PORT${NC}"
    else
        echo -e "${RED}⚠️  Found processes on port $PORT:${NC}"
        lsof -i :$PORT
        
        # Kill each PID
        for PID in $PIDS; do
            echo -e "${YELLOW}Attempting to kill PID $PID...${NC}"
            
            # Try graceful termination first
            if kill -TERM $PID 2>/dev/null; then
                echo -e "${GREEN}✓ Sent SIGTERM to PID $PID${NC}"
                
                # Give it a moment to terminate
                sleep 1
                
                # Check if still running
                if kill -0 $PID 2>/dev/null; then
                    echo -e "${YELLOW}Process still running, sending SIGKILL...${NC}"
                    kill -9 $PID 2>/dev/null || true
                    echo -e "${GREEN}✓ Force killed PID $PID${NC}"
                fi
            else
                echo -e "${RED}✗ Failed to kill PID $PID (may already be dead)${NC}"
            fi
        done
    fi
done

echo -e "\n${GREEN}✓ Port cleanup complete!${NC}"

# Final verification
echo -e "\n${YELLOW}Final port status:${NC}"
for PORT in "${PORTS[@]}"; do
    if lsof -i :$PORT >/dev/null 2>&1; then
        echo -e "${RED}✗ Port $PORT still in use${NC}"
        lsof -i :$PORT
    else
        echo -e "${GREEN}✓ Port $PORT is free${NC}"
    fi
done