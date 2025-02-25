/**
 * This script fixes specific issues with the 'initialize' method in server.js
 * It addresses a potential format mismatch between Claude Desktop and our server
 */

const fs = require('fs');
const path = require('path');

// Path to server.js
const serverPath = path.join(process.cwd(), 'server.js');

// Check if server.js exists
if (!fs.existsSync(serverPath)) {
  console.error('[ERROR] server.js not found in current directory');
  console.error(`Current directory: ${process.cwd()}`);
  console.error('Please run this script from the dokkan-mcp directory');
  process.exit(1);
}

console.log('[INFO] Reading server.js file...');
const serverCode = fs.readFileSync(serverPath, 'utf8');

// Find the initialize handler in the code
const initializeRegex = /initialize:\s*\(\)\s*=>\s*\(\{[^}]*}\)/;
const initializeMatch = serverCode.match(initializeRegex);

if (!initializeMatch) {
  console.error('[ERROR] Could not find initialize handler in server.js');
  process.exit(1);
}

// Get the current initialize handler code
const currentInitialize = initializeMatch[0];
console.log('[INFO] Found current initialize handler:');
console.log(currentInitialize);

// Create the new initialize handler with explicit Claude Desktop compatibility
const newInitialize = `initialize: () => ({
      protocolVersion: '2024-02-24',
      capabilities: { 
        dokkan: {
          cards: true,
          events: true,
          categories: true,
          ezas: true,
          dokkanEvents: true,
          storyEvents: true,
          missions: true,
          items: true
        }
      },
      serverInfo: { name: 'dokkan-mcp', version: '1.0.0' }
    })`;

// Replace the initialize handler in the code
const newServerCode = serverCode.replace(initializeRegex, newInitialize);

// Create a backup of the original file
const backupPath = path.join(process.cwd(), 'server.js.bak');
fs.writeFileSync(backupPath, serverCode);
console.log(`[INFO] Original server.js backed up to ${backupPath}`);

// Write the modified code back to server.js
fs.writeFileSync(serverPath, newServerCode);
console.log('[SUCCESS] server.js updated with fixed initialize handler');
console.log('[INFO] Please restart your server.js process');