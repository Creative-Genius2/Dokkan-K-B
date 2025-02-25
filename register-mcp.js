const fs = require('fs').promises;
const path = require('path');

// Base paths
const CLAUDE_BASE = path.join(process.env.APPDATA, 'Claude');
const DOKKAN_MCP = path.join(CLAUDE_BASE, 'dokkan-mcp');
const CONFIG_PATH = path.join(CLAUDE_BASE, 'claude_desktop_config.json');

async function registerMCP() {
  try {
    console.log('Starting MCP registration...');
    
    // Check if the config file exists
    let config;
    try {
      const configData = await fs.readFile(CONFIG_PATH, 'utf8');
      config = JSON.parse(configData);
      console.log('Loaded existing config file');
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No existing config, creating new one');
        config = {};
      } else {
        throw err;
      }
    }

    // Create dokkan-mcp directory if it doesn't exist
    await fs.mkdir(DOKKAN_MCP, { recursive: true });
    await fs.mkdir(path.join(DOKKAN_MCP, 'data', 'cache'), { recursive: true });
    console.log('Ensured dokkan-mcp directories exist');

    // Prepare MCP configuration
    config.mcpServers = config.mcpServers || {};
    config.mcpServers['dokkan-mcp'] = {
      "command": "node",
      "args": ["server.js"],
      "cwd": DOKKAN_MCP,
      "enabled": true,
      "port": 3000,
      "paths": {
        "base": DOKKAN_MCP,
        "cache": path.join(DOKKAN_MCP, 'data', 'cache')
      }
    };
    
    // Save updated config
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('Updated Claude config with dokkan-mcp registration');
    
    // Copy server.js to the correct location
    const serverSource = path.join(process.cwd(), 'server.js');
    const serverDest = path.join(DOKKAN_MCP, 'server.js');
    
    await fs.copyFile(serverSource, serverDest);
    console.log('Copied server.js to', serverDest);
    
    // Ensure lib directory exists and copy library files
    const libDir = path.join(DOKKAN_MCP, 'lib');
    await fs.mkdir(libDir, { recursive: true });
    
    const libFiles = ['data-manager.js', 'dokkan-scraper.js', 'fandom-api.js'];
    for (const file of libFiles) {
      const sourcePath = path.join(process.cwd(), 'lib', file);
      const destPath = path.join(libDir, file);
      
      try {
        await fs.copyFile(sourcePath, destPath);
        console.log(`Copied ${file} to lib directory`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.warn(`Warning: ${file} not found in current directory`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('\nRegistration complete!');
    console.log('Next steps:');
    console.log('1. Restart Claude Desktop');
    console.log('2. The dokkan-mcp service should now be automatically detected');
    console.log('3. If issues persist, check logs in Settings > Developer > MCP Servers');
  } catch (error) {
    console.error('Registration failed:', error);
  }
}

// Run the registration
registerMCP();