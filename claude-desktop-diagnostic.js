const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

console.log('\n=== Claude Desktop Diagnostic Tool - Advanced Version ===\n');

// 1. Check system environment
function checkSystem() {
  return {
    platform: process.platform,
    isWindows: process.platform === 'win32',
    nodeVersion: process.version,
    username: os.userInfo().username
  };
}

// 2. Check if port 3000 is in use and by what process
function checkPortProcess() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('netstat -ano | findstr :3000', (error, stdout, stderr) => {
        if (error || !stdout) {
          resolve({
            inUse: false,
            processes: []
          });
          return;
        }

        const lines = stdout.trim().split('\n');
        const processes = [];
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[4];
            
            // Get process name for each PID
            exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (err, taskOutput) => {
              if (!err && taskOutput) {
                // Parse CSV format output
                const match = taskOutput.match(/"([^"]+)"/);
                if (match && match[1]) {
                  processes.push({
                    pid,
                    name: match[1]
                  });
                }
              }
            });
          }
        }

        // Give some time for the process name lookup to complete
        setTimeout(() => {
          resolve({
            inUse: processes.length > 0,
            processes
          });
        }, 500);
      });
    } else {
      // Unix version
      exec('lsof -i :3000', (error, stdout, stderr) => {
        if (error || !stdout) {
          resolve({
            inUse: false,
            processes: []
          });
          return;
        }

        const lines = stdout.trim().split('\n');
        const processes = [];
        
        // Skip header line
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 2) {
            processes.push({
              name: parts[0],
              pid: parts[1]
            });
          }
        }

        resolve({
          inUse: processes.length > 0,
          processes
        });
      });
    }
  });
}

// 3. Test MCP endpoint
function testMCPEndpoint() {
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      hostname: 'localhost',
      port: 3000,
      path: '/',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: 'success',
            statusCode: res.statusCode,
            headers: res.headers,
            response: data
          });
        } catch (e) {
          resolve({
            status: 'error',
            message: 'Invalid response format',
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

    // Send an initialize request that Claude Desktop would send
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {},
      id: 1
    });

    req.write(requestData);
    req.end();
  });
}

// 4. Test health endpoint
function testHealthEndpoint() {
  return new Promise((resolve) => {
    const options = {
      method: 'GET',
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            status: 'success',
            statusCode: res.statusCode,
            response: json
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

// 5. Check Claude Desktop config
function checkClaudeConfig() {
  if (process.platform !== 'win32') {
    return {
      status: 'skipped',
      message: 'Config check only available on Windows'
    };
  }
  
  const username = os.userInfo().username;
  const configPath = path.join('C:\\Users', username, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  
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

// 6. Check if dokkan-mcp directory exists and has required files
function checkFiles() {
  if (process.platform !== 'win32') {
    return {
      status: 'skipped',
      message: 'File check only available on Windows'
    };
  }
  
  const username = os.userInfo().username;
  const dirPath = path.join('C:\\Users', username, 'AppData', 'Roaming', 'Claude', 'dokkan-mcp');
  
  if (!fs.existsSync(dirPath)) {
    return {
      status: 'error',
      message: 'dokkan-mcp directory not found',
      path: dirPath
    };
  }
  
  const requiredFiles = ['server.js', 'setup.js', 'restart.js', 'port-config.js'];
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(dirPath, file))) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    return {
      status: 'warning',
      message: 'Some required files are missing',
      missingFiles,
      path: dirPath
    };
  }
  
  return {
    status: 'success',
    message: 'All required files present',
    path: dirPath
  };
}

// 7. Check file permissions
function checkPermissions() {
  if (process.platform !== 'win32') {
    return {
      status: 'skipped',
      message: 'Permission check only available on Windows'
    };
  }
  
  const username = os.userInfo().username;
  const dirPath = path.join('C:\\Users', username, 'AppData', 'Roaming', 'Claude', 'dokkan-mcp');
  
  try {
    // Try writing a test file to check write permissions
    const testPath = path.join(dirPath, '.permission_test');
    fs.writeFileSync(testPath, 'test', { flag: 'w' });
    fs.unlinkSync(testPath);
    
    return {
      status: 'success',
      message: 'Write permissions OK'
    };
  } catch (err) {
    return {
      status: 'error',
      message: `Permission issue: ${err.message}`
    };
  }
}

// 8. Check for firewall blocks
function checkFirewall() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('netsh advfirewall firewall show rule name=all | findstr "Node.js" /C:"node.exe"', (error, stdout) => {
        if (error) {
          resolve({
            status: 'unknown',
            message: 'Could not check firewall rules'
          });
          return;
        }
        
        if (stdout.includes('Block')) {
          resolve({
            status: 'warning',
            message: 'Possible firewall block for Node.js',
            details: stdout.trim()
          });
        } else {
          resolve({
            status: 'success',
            message: 'No obvious firewall blocks detected'
          });
        }
      });
    } else {
      resolve({
        status: 'skipped',
        message: 'Firewall check only available on Windows'
      });
    }
  });
}

// 9. Generate fix script
function generateFixScript(results) {
  const fixScript = `@echo off
echo ===== Claude Desktop Connection Fix =====
echo Running comprehensive fixes based on diagnostic results...
echo.

echo Step 1: Killing any processes using port 3000...
FOR /F "tokens=5" %%P IN ('netstat -a -n -o ^| findstr :3000') DO TaskKill /PID %%P /F
echo.

echo Step 2: Verifying configuration file...
set CONFIG_PATH=%APPDATA%\\Claude\\claude_desktop_config.json
if not exist "%CONFIG_PATH%" (
  echo Creating missing config file...
  echo { > "%CONFIG_PATH%"
  echo   "mcpServers": { >> "%CONFIG_PATH%"
  echo     "dokkan-mcp": { >> "%CONFIG_PATH%"
  echo       "port": 3000, >> "%CONFIG_PATH%"
  echo       "name": "dokkan-mcp", >> "%CONFIG_PATH%"
  echo       "cmdLine": "node", >> "%CONFIG_PATH%"
  echo       "args": ["server.js"], >> "%CONFIG_PATH%"
  echo       "autoStart": true, >> "%CONFIG_PATH%"
  echo       "workingDir": "${appData}/Claude/dokkan-mcp" >> "%CONFIG_PATH%"
  echo     } >> "%CONFIG_PATH%"
  echo   }, >> "%CONFIG_PATH%"
  echo   "version": "1.0.0", >> "%CONFIG_PATH%"
  echo   "lastUsed": { >> "%CONFIG_PATH%"
  echo     "server": "dokkan-mcp" >> "%CONFIG_PATH%"
  echo   }, >> "%CONFIG_PATH%"
  echo   "theme": "light" >> "%CONFIG_PATH%"
  echo } >> "%CONFIG_PATH%"
)
echo.

echo Step 3: Verifying server files...
cd %APPDATA%\\Claude\\dokkan-mcp
echo.

echo Step 4: Starting clean server...
node server.js
`;

  const fixPath = path.join(os.tmpdir(), 'claude-desktop-fix.bat');
  fs.writeFileSync(fixPath, fixScript);
  return fixPath;
}

// Main diagnostic function
async function runDiagnostics() {
  const results = {};
  
  console.log('SYSTEM CHECK:');
  results.system = checkSystem();
  console.log(`Operating System: ${results.system.platform}`);
  console.log(`Node.js Version: ${results.system.nodeVersion}`);
  console.log(`Username: ${results.system.username}`);
  console.log();
  
  console.log('PORT CHECK:');
  results.port = await checkPortProcess();
  if (results.port.inUse) {
    console.log('❌ Port 3000 is in use by:');
    results.port.processes.forEach(proc => {
      console.log(`   - Process: ${proc.name} (PID: ${proc.pid})`);
    });
  } else {
    console.log('❌ Port 3000 is not in use - server.js is not running');
  }
  console.log();
  
  console.log('ENDPOINT TESTS:');
  results.health = await testHealthEndpoint();
  if (results.health.status === 'success') {
    console.log('✅ Health endpoint responded successfully');
    console.log(`   - Status: ${results.health.response.status}`);
    console.log(`   - Version: ${results.health.response.version}`);
  } else {
    console.log('❌ Health endpoint test failed');
    console.log(`   - Error: ${results.health.message}`);
  }
  
  results.mcp = await testMCPEndpoint();
  if (results.mcp.status === 'success') {
    console.log('✅ MCP endpoint responded');
    console.log(`   - Status code: ${results.mcp.statusCode}`);
  } else {
    console.log('❌ MCP endpoint test failed');
    console.log(`   - Error: ${results.mcp.message}`);
  }
  console.log();
  
  if (results.system.isWindows) {
    console.log('CONFIG CHECK:');
    results.config = checkClaudeConfig();
    if (results.config.status === 'success') {
      console.log('✅ Config file found');
      console.log(`   - Path: ${results.config.path}`);
      
      if (results.config.config.mcpServers && results.config.config.mcpServers['dokkan-mcp']) {
        console.log('✅ dokkan-mcp configured in config file');
        const mcpConfig = results.config.config.mcpServers['dokkan-mcp'];
        
        if (mcpConfig.port === 3000) {
          console.log('✅ Port correctly set to 3000');
        } else {
          console.log(`❌ Port incorrectly set to ${mcpConfig.port} (should be 3000)`);
        }
      } else {
        console.log('❌ dokkan-mcp not found in config');
      }
    } else {
      console.log(`❌ Config issue: ${results.config.message}`);
      console.log(`   - Expected path: ${results.config.path}`);
    }
    console.log();
    
    console.log('FILE CHECK:');
    results.files = checkFiles();
    if (results.files.status === 'success') {
      console.log('✅ All required files present');
    } else if (results.files.status === 'warning') {
      console.log('⚠️ Some files are missing:');
      results.files.missingFiles.forEach(file => {
        console.log(`   - Missing: ${file}`);
      });
    } else {
      console.log(`❌ ${results.files.message}`);
    }
    console.log();
    
    console.log('PERMISSION CHECK:');
    results.permissions = checkPermissions();
    if (results.permissions.status === 'success') {
      console.log('✅ File permissions OK');
    } else {
      console.log(`❌ ${results.permissions.message}`);
    }
    console.log();
  }
  
  console.log('FIREWALL CHECK:');
  results.firewall = await checkFirewall();
  if (results.firewall.status === 'success') {
    console.log('✅ No firewall blocks detected');
  } else if (results.firewall.status === 'warning') {
    console.log(`⚠️ ${results.firewall.message}`);
  } else {
    console.log(`ℹ️ ${results.firewall.message}`);
  }
  console.log();
  
  console.log('=== DIAGNOSIS SUMMARY ===');
  
  let majorIssues = false;
  
  if (!results.port.inUse) {
    console.log('❌ CRITICAL: server.js is not running on port 3000');
    majorIssues = true;
  }
  
  if (results.health.status !== 'success' || results.mcp.status !== 'success') {
    console.log('❌ CRITICAL: Server endpoints not responding correctly');
    majorIssues = true;
  }
  
  if (results.system.isWindows && 
      results.config.status === 'success' && 
      (!results.config.config.mcpServers || !results.config.config.mcpServers['dokkan-mcp'])) {
    console.log('❌ CRITICAL: dokkan-mcp not properly configured in Claude Desktop');
    majorIssues = true;
  }
  
  if (!majorIssues) {
    console.log('⚠️ No critical issues found, but Claude Desktop still cannot connect.');
    console.log('   This suggests a more complex issue with the Claude Desktop application itself.');
  }
  
  console.log();
  console.log('=== RECOMMENDED ACTIONS ===');
  
  const fixPath = generateFixScript(results);
  
  if (majorIssues) {
    console.log('1. Run the auto-fix script:');
    console.log(`   ${fixPath}`);
    console.log('2. Restart Claude Desktop');
    console.log('3. If issues persist, manually check:');
    console.log('   - If server.js was modified correctly');
    console.log('   - If there are any errors in the server console');
  } else {
    console.log('Since no critical connection issues were found, try these advanced steps:');
    console.log('1. Close Claude Desktop completely');
    console.log('2. Run restart.js to clear port 3000');
    console.log('3. Start server.js manually and check for any errors');
    console.log('4. Start Claude Desktop and immediately check the developer console (F12)');
    console.log('5. Look for any network errors or connection issues in the console');
  }
  
  console.log();
  console.log('=== FULL LOG CAPTURE ===');
  console.log(`A detailed diagnostic log has been saved to:`);
  
  // Save diagnostic results to log file
  const logData = JSON.stringify(results, null, 2);
  const logPath = path.join(os.tmpdir(), 'claude-desktop-diagnostic.log');
  fs.writeFileSync(logPath, logData);
  
  console.log(logPath);
}

// Run the diagnostics
runDiagnostics();