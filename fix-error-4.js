/**
 * fix-error-4.js - Specific fix for Claude Desktop Error 4
 * This script applies all necessary fixes to resolve the Error 4 issue
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

console.log(`${colors.bold}${colors.blue}===== Claude Desktop Error 4 Fix =====\n${colors.reset}`);
console.log('This utility will apply all fixes needed to resolve Error 4 in Claude Desktop\n');

// 1. Find server.js
const serverPath = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error(`${colors.red}[ERROR] server.js not found in current directory: ${process.cwd()}${colors.reset}`);
  console.error(`Please run this script from the dokkan-mcp directory`);
  process.exit(1);
}

console.log(`${colors.green}[✓] Found server.js${colors.reset}`);

// Create a backup of server.js
const backupPath = path.join(process.cwd(), 'server.js.bak');
fs.copyFileSync(serverPath, backupPath);
console.log(`${colors.green}[✓] Created backup at ${backupPath}${colors.reset}\n`);

// 2. Read server.js
console.log(`Reading server.js...`);
let serverContent = fs.readFileSync(serverPath, 'utf8');
console.log(`${colors.green}[✓] Read ${serverContent.length} bytes${colors.reset}\n`);

// 3. Fix all potential Error 4 issues
console.log(`${colors.bold}Applying fixes:${colors.reset}`);

// 3.1 Fix the initialize method
console.log(`Fixing initialize method...`);
let initializeFixed = false;
const initializePattern = /initialize:\s*\(\)\s*=>\s*\{[^}]*\}/s;
const initializeMatch = serverContent.match(initializePattern);

if (initializeMatch) {
  const newInitialize = `initialize: () => {
      console.log('[DEBUG] Claude Desktop initialize request received');
      const response = {
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
        serverInfo: { 
          name: 'dokkan-mcp', 
          version: '1.0.0',
          status: 'ready'
        }
      };
      console.log('[DEBUG] Sending initialize response:', JSON.stringify(response));
      return response;
    }`;
    
  serverContent = serverContent.replace(initializePattern, newInitialize);
  initializeFixed = true;
  console.log(`${colors.green}[✓] Initialize method fixed${colors.reset}`);
} else {
  console.log(`${colors.yellow}[!] Could not find initialize method to fix${colors.reset}`);
}

// 3.2 Add proper CORS headers
console.log(`Adding CORS headers...`);
let corsFixed = false;
const corsPattern = /app\.use\(express\.json\([^)]*\)\);/;
const corsMatch = serverContent.match(corsPattern);

if (corsMatch) {
  const newCors = `app.use(express.json({
  // Error code 4 fix: More lenient JSON parsing
  strict: false,
  limit: '1mb'
}));

// Fix for Error Code 4: Add proper CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.header('Content-Type', 'application/json');
  next();
});`;

  serverContent = serverContent.replace(corsPattern, newCors);
  corsFixed = true;
  console.log(`${colors.green}[✓] CORS headers added${colors.reset}`);
} else {
  console.log(`${colors.yellow}[!] Could not find location to add CORS headers${colors.reset}`);
}

// 3.3 Improve health check
console.log(`Enhancing health check endpoint...`);
let healthFixed = false;
const healthPattern = /app\.get\('\/health',\s*\([^)]*\)\s*=>\s*res\.json\(\{[^}]*\}\)\)/;
const healthMatch = serverContent.match(healthPattern);

if (healthMatch) {
  const newHealth = `app.get('/health', (_, res) => {
  // Error code 4 fix: More detailed health check response
  const healthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    protocol: '2024-02-24',
    uptime: process.uptime(),
    connections: activeConnections.size
  };
  console.log('[DEBUG] Health check requested, responding with:', JSON.stringify(healthResponse));
  return res.json(healthResponse);
})`;

  serverContent = serverContent.replace(healthPattern, newHealth);
  healthFixed = true;
  console.log(`${colors.green}[✓] Health check enhanced${colors.reset}`);
} else {
  console.log(`${colors.yellow}[!] Could not find health check endpoint to improve${colors.reset}`);
}

// 3.4 Fix JSON-RPC request validation
console.log(`Adding JSON-RPC validation...`);
let rpcFixed = false;
const rpcPattern = /app\.post\('\/',\s*\(req,\s*res\)\s*=>\s*\{/;
const rpcMatch = serverContent.match(rpcPattern);

if (rpcMatch) {
  const newRpc = `app.post('/', (req, res) => {
  console.log(\`[DEBUG] Received request: \${JSON.stringify(req.body)}\`);
  
  // Error code 4 fix: Validate JSON-RPC format explicitly
  if (!req.body || !req.body.jsonrpc || req.body.jsonrpc !== '2.0' || !req.body.method) {
    console.error('[ERROR] Invalid JSON-RPC request format');
    return res.status(200).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: req.body?.id || null
    });
  }`;

  serverContent = serverContent.replace(rpcPattern, newRpc);
  rpcFixed = true;
  console.log(`${colors.green}[✓] JSON-RPC validation added${colors.reset}`);
} else {
  console.log(`${colors.yellow}[!] Could not find location to add JSON-RPC validation${colors.reset}`);
}

// 3.5 Fix response handling
console.log(`Fixing response handling...`);
let responseFixed = false;
const responsePattern = /Promise\.resolve\(handler\(params\)\)[\s\S]*?\.then\(result\s*=>\s*\{[\s\S]*?res\.json\(\{[\s\S]*?\}\);[\s\S]*?\}\)/s;
const responseMatch = serverContent.match(responsePattern);

if (responseMatch) {
  const newResponse = `Promise.resolve(handler(params))
      .then(result => {
        const response = {
          jsonrpc: '2.0',
          result,
          id
        };
        console.log(\`[DEBUG] Sending response: \${JSON.stringify(response)}\`);
        res.json(response);
      })`;

  serverContent = serverContent.replace(responsePattern, newResponse);
  responseFixed = true;
  console.log(`${colors.green}[✓] Response handling fixed${colors.reset}`);
} else {
  console.log(`${colors.yellow}[!] Could not find response handling to fix${colors.reset}`);
}

// 4. Write updated server.js
fs.writeFileSync(serverPath, serverContent);
console.log(`\n${colors.green}[✓] Updated server.js written${colors.reset}`);

// 5. Check if port 3000 is currently in use
console.log(`\nChecking if port 3000 is in use...`);
exec('netstat -ano | findstr :3000', (error, stdout, stderr) => {
  if (!error && stdout) {
    console.log(`${colors.yellow}[!] Port 3000 is currently in use${colors.reset}`);
    console.log(`To complete the fix, please run these commands:`);
    console.log(`  1. node restart.js   (to clear port 3000)`);
    console.log(`  2. node server.js    (to start with fixes)`);
  } else {
    console.log(`${colors.green}[✓] Port 3000 is free${colors.reset}`);
    console.log(`To complete the fix, please run: node server.js`);
  }

  console.log(`\n${colors.green}Then restart Claude Desktop.${colors.reset}`);
  console.log(`\n${colors.bold}${colors.blue}===== Fix Complete =====\n${colors.reset}`);
});