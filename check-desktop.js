const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('\n=== Claude Desktop Diagnostic Tool ===\n');

// 1. Check if running on Windows
console.log('SYSTEM CHECK:');
const isWindows = process.platform === 'win32';
console.log(`Operating System: ${isWindows ? 'Windows' : process.platform}`);

// 2. Check if port 3000 is accessible
function checkPort() {
  return new Promise((resolve) => {
    const req = http.request({
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      timeout: 2000
    }, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: 'success',
            code: res.statusCode,
            response
          });
        } catch (e) {
          resolve({
            status: 'error',
            message: 'Invalid JSON response',
            data
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 'error',
        message: err.message
      });
    });

    req.end();
  });
}

// 3. Check config file
function checkConfig() {
  const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  
  if (!fs.existsSync(configPath)) {
    return {
      status: 'error',
      message: 'Config file not found',
      path: configPath
    };
  }
  
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    return {
      status: 'success',
      config,
      path: configPath
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message,
      path: configPath
    };
  }
}

// 4. Check for proper MCP configuration
function checkMCPConfig(config) {
  if (!config || !config.mcpServers) {
    return {
      status: 'error',
      message: 'No MCP servers configured'
    };
  }
  
  if (!config.mcpServers['dokkan-mcp']) {
    return {
      status: 'error',
      message: 'dokkan-mcp not configured'
    };
  }
  
  const mcpConfig = config.mcpServers['dokkan-mcp'];
  
  if (mcpConfig.port !== 3000) {
    return {
      status: 'warning',
      message: `Port configured to ${mcpConfig.port} but should be 3000`,
      config: mcpConfig
    };
  }
  
  return {
    status: 'success',
    config: mcpConfig
  };
}

// Run all checks
async function runDiagnostics() {
  console.log('\nPORT CHECK:');
  const portResult = await checkPort();
  
  if (portResult.status === 'success') {
    console.log('✅ Port 3000 accessible');
    console.log('✅ Server health check passed');
    console.log(`Server info: ${JSON.stringify(portResult.response)}`);
  } else {
    console.log('❌ Port 3000 not accessible');
    console.log(`Error: ${portResult.message}`);
    console.log('\n[FIX] Make sure server.js is running on port 3000');
    console.log('[FIX] Run restart.js first to clear port conflicts');
  }
  
  if (isWindows) {
    console.log('\nCONFIG CHECK:');
    const configResult = checkConfig();
    
    if (configResult.status === 'success') {
      console.log('✅ Config file found');
      console.log(`Config path: ${configResult.path}`);
      
      const mcpResult = checkMCPConfig(configResult.config);
      
      if (mcpResult.status === 'success') {
        console.log('✅ dokkan-mcp properly configured');
      } else if (mcpResult.status === 'warning') {
        console.log(`⚠️ ${mcpResult.message}`);
        console.log('[FIX] Edit config file to set port to 3000');
      } else {
        console.log(`❌ ${mcpResult.message}`);
        console.log('[FIX] Add dokkan-mcp configuration to config file');
      }
    } else {
      console.log('❌ Config issue detected');
      console.log(`Error: ${configResult.message}`);
      console.log(`Expected path: ${configResult.path}`);
      console.log('\n[FIX] Create config file with proper structure');
    }
  }
  
  console.log('\n=== RECOMMENDED STEPS ===');
  if (portResult.status !== 'success') {
    console.log('1. Run "node restart.js" to clear port 3000');
    console.log('2. Start the server with "node server.js"');
    console.log('3. Launch Claude Desktop');
  } else if (isWindows && configResult && configResult.status !== 'success') {
    console.log('1. Fix config file issues');
    console.log('2. Restart Claude Desktop');
  } else {
    console.log('✅ Basic diagnostics passed. If Claude Desktop still shows a blank screen:');
    console.log('1. Check server logs for any errors');
    console.log('2. Try restarting both the server and Claude Desktop');
    console.log('3. Check if any security software is blocking connections');
  }
}

runDiagnostics();