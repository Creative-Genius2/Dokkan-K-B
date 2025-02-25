# Dokkan MCP

A Model Context Protocol server for Dokkan Battle data that connects Desktop Claude to both wiki sources.

## Quick Start

```bash
# Navigate to your dokkan-mcp directory
cd C:\Users\your-username\AppData\Roaming\Claude\dokkan-mcp

# Option 1: Run both servers simultaneously (recommended)
run-both.bat

# Option 2: Manual startup
# Clear any processes using port 3000 (required for Claude Desktop)
node restart.js

# Start the server for Claude Desktop
node server.js

# Optional: In a separate terminal, run setup in parallel
# This will automatically use port 3001 to avoid conflicts
node setup.js
```

## Features

- **Wiki Integration**: Pulls data from dokkaninfo.com and dbz-dokkanbattle.fandom.com
- **Card Comparison**: Compare custom cards against the meta
- **Desktop Connection**: Checks and fixes Desktop Claude connection
- **Auto-Update**: Detects new mechanics and format changes
- **Port Conflict Resolution**: Manages port usage between different servers
- **Detailed Debugging**: Comprehensive logging and diagnostic tools
- **Parallel Operation**: Ability to run both server.js and setup.js simultaneously

## Usage

### Compare Custom Cards

```javascript
// Compare a custom card to the meta
const result = await wikiComparison.compareCardToMeta(cardData);
console.log(`This card is from Year ${result.estimatedYear}`);
```

### Custom Card Format

```
name: Super Saiyan Goku
type: AGL
rarity: LR
leader skill: "Pure Saiyans" Ki +3, HP, ATK & DEF +170%
passive skill: ATK & DEF +159%; plus an additional ATK +59% as 1st attacker
super attack: Raises ATK & DEF for 1 turn and causes mega-colossal damage
links: Super Saiyan, Kamehameha, Prepared for Battle, Legendary Power
categories: Pure Saiyans, Kamehameha, Goku's Family
stats:
hp: 22000
atk: 20000
def: 10000
```

## Methods

- `initialize` - Get server information
- `getCardData` - Get specific card data
- `searchCards` - Search for cards
- `compareCardToMeta` - Compare custom card
- `analyzeCard` - Analyze mechanics
- `calculateStats` - Calculate ATK/DEF

## Project Files

- **server.js** - Main server for Claude Desktop connection (port 3000)
- **setup.js** - Setup and maintenance server (port 3001+)
- **restart.js** - Utility to clear processes using port 3000
- **port-config.js** - Shared port configuration management
- **claude-desktop-diagnostic.js** - Advanced connection diagnostics
- **fix-initialize.js** - Fixes protocol initialization errors
- **check-desktop.js** - Basic connection troubleshooting
- **run-both.bat** - Batch script to run both servers simultaneously

## Additional Tools

- **Port Management**: `node restart.js` to clear port 3000 for Claude Desktop
- **Basic Diagnostics**: `node check-desktop.js` to troubleshoot basic connection issues
- **Advanced Diagnostics**: `node claude-desktop-diagnostic.js` for comprehensive troubleshooting
- **Initialize Fix**: `node fix-initialize.js` to fix error code 4 issues
- **Auto-Updater**: `node wiki-updater.js` to update for new content
- **Connection Check**: `node connection-utils.js check` to verify Desktop connection
- **Run Both Servers**: `run-both.bat` to start server.js and setup.js simultaneously

## Troubleshooting

### Server Disconnected Error

If Claude can't connect to the server:

1. Run the advanced diagnostic tool:
   ```bash
   node claude-desktop-diagnostic.js
   ```

2. Clear port 3000 (Claude Desktop requires this exact port):
   ```bash
   node restart.js
   ```

3. If connection issues persist, run the initialize method fix:
   ```bash
   node fix-initialize.js
   ```

4. Start the server:
   ```bash
   node server.js
   ```

5. If Claude Desktop still shows a blank screen, check configuration:
   - Verify `C:\Users\your-username\AppData\Roaming\Claude\claude_desktop_config.json` exists and has the correct structure
   - Ensure dokkan-mcp is configured to use port 3000

### Common Connection Issues (Error Code 4)

The following are common reasons why dokkan-mcp fails to connect to Claude Desktop:

1. **Protocol Version Mismatch**
   - Claude Desktop expects the exact protocol version "2024-02-24"
   - Fix: Update the initialize() method to return the correct version

2. **JSON-RPC Format Errors**
   - The "4" error code in Claude Desktop indicates a JSON-RPC format error
   - Fix: Ensure all responses follow the exact format: 
     ```json
     {
       "jsonrpc": "2.0",
       "result": { ... },
       "id": 1
     }
     ```

3. **Capabilities Mismatch**
   - Claude Desktop requires specific capabilities to be defined
   - Fix: Include all required capabilities in the initialize response

4. **Port Binding Problems**
   - Even when server.js appears to be running, there might be binding issues
   - Fix: Run `netstat -ano | findstr :3000` to verify proper port binding

5. **Response Timeouts**
   - Claude Desktop has strict timeout requirements
   - Fix: Ensure quick responses to all requests

### Running Both Servers

To run both `server.js` (for Claude Desktop) and `setup.js` simultaneously:
1. Start `server.js` first on port 3000 (required for Claude)
2. Start `setup.js` in a separate terminal (will automatically use port 3001+)

### Format Issues

Run `node wiki-updater.js` to automatically detect and fix format differences between wiki sources.

### Desktop Claude Issues

If Desktop Claude doesn't connect:
1. Check port in Dokkan MCP is set to 3000 (this is required)
2. Verify Desktop Claude config shows MCP as enabled
3. Use diagnostics to identify and fix issues:
   ```bash
   node check-desktop.js
   ```