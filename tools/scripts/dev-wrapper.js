#!/usr/bin/env node

/**
 * Development Process Wrapper
 * 
 * This wrapper ensures proper signal handling and process cleanup for the development environment.
 * It prevents orphaned processes by properly forwarding signals to all child processes.
 * 
 * Usage: node tools/scripts/dev-wrapper.js <command>
 * Example: node tools/scripts/dev-wrapper.js turbo dev
 */

const { spawn } = require('child_process');
const os = require('os');

// Track all spawned processes
const childProcesses = new Set();

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}[dev-wrapper] ${message}${colors.reset}`);
}

// Get command and arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  log('Error: No command provided', 'red');
  log('Usage: node tools/scripts/dev-wrapper.js <command>', 'yellow');
  process.exit(1);
}

const command = args[0];
const commandArgs = args.slice(1);

log(`Starting: ${command} ${commandArgs.join(' ')}`, 'blue');

// Spawn the main process
const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true,
  detached: false,
  env: { ...process.env }
});

childProcesses.add(child);

// Handle child process events
child.on('error', (error) => {
  log(`Error spawning process: ${error.message}`, 'red');
  cleanup();
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    log(`Process exited due to signal: ${signal}`, 'yellow');
  } else if (code !== 0) {
    log(`Process exited with code: ${code}`, 'red');
  } else {
    log('Process exited successfully', 'green');
  }
  
  childProcesses.delete(child);
  
  // Exit with the same code as the child
  process.exit(code || 0);
});

// Cleanup function to kill all child processes
function cleanup() {
  log('Cleaning up child processes...', 'yellow');
  
  childProcesses.forEach((proc) => {
    if (!proc.killed) {
      try {
        // On Windows, use taskkill to kill the entire process tree
        if (os.platform() === 'win32') {
          spawn('taskkill', ['/pid', proc.pid, '/f', '/t'], { shell: true });
        } else {
          // On Unix-like systems, kill the process group
          process.kill(-proc.pid, 'SIGTERM');
          
          // Give it a moment to terminate gracefully
          setTimeout(() => {
            if (!proc.killed) {
              log(`Force killing process ${proc.pid}`, 'yellow');
              process.kill(-proc.pid, 'SIGKILL');
            }
          }, 2000);
        }
      } catch (err) {
        // Process may have already exited
        if (err.code !== 'ESRCH') {
          log(`Error killing process: ${err.message}`, 'red');
        }
      }
    }
  });
  
  log('Cleanup complete', 'green');
}

// Signal handlers
const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];

signals.forEach((signal) => {
  process.on(signal, () => {
    log(`Received ${signal}, cleaning up...`, 'yellow');
    cleanup();
    
    // Give cleanup time to complete
    setTimeout(() => {
      process.exit(0);
    }, 3000);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'red');
  cleanup();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at: ${promise}, reason: ${reason}`, 'red');
  cleanup();
  process.exit(1);
});

// Periodic check for orphaned processes (every 30 seconds)
setInterval(() => {
  childProcesses.forEach((proc) => {
    try {
      // Check if process is still alive
      process.kill(proc.pid, 0);
    } catch (err) {
      // Process is dead, remove from set
      childProcesses.delete(proc);
    }
  });
}, 30000);

log('Process wrapper initialized. Press Ctrl+C to stop all services cleanly.', 'green');