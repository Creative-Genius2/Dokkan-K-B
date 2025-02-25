const { exec } = require('child_process');
const readline = require('readline');

console.log('[INFO] Dokkan MCP Server Restart Utility');
console.log('[INFO] Searching for processes using port 3000...');

// For Windows, use netstat
if (process.platform === 'win32') {
  exec('netstat -ano | findstr :3000', (error, stdout, stderr) => {
    if (error) {
      console.log('[INFO] No processes found using port 3000');
      process.exit(0);
    }

    const lines = stdout.trim().split('\n');
    if (lines.length === 0) {
      console.log('[INFO] No processes found using port 3000');
      process.exit(0);
    }

    // Extract PIDs
    const pids = new Set();
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parts[4];
        pids.add(pid);
      }
    });

    if (pids.size === 0) {
      console.log('[INFO] No processes found to terminate');
      process.exit(0);
    }

    console.log(`[INFO] Found ${pids.size} process(es) using port 3000: ${[...pids].join(', ')}`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('[INFO] Do you want to terminate these processes? (y/n): ', (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        pids.forEach(pid => {
          console.log(`[INFO] Terminating process with PID: ${pid}`);
          exec(`taskkill /F /PID ${pid}`, (error, stdout, stderr) => {
            if (error) {
              console.error(`[ERROR] Failed to terminate process ${pid}: ${error.message}`);
              return;
            }
            console.log(`[INFO] Successfully terminated process ${pid}`);
          });
        });
      } else {
        console.log('[INFO] Operation cancelled');
      }
    });
  });
} 
// For Unix-based systems, use lsof
else {
  exec('lsof -i :3000', (error, stdout, stderr) => {
    if (error) {
      console.log('[INFO] No processes found using port 3000');
      process.exit(0);
    }

    const lines = stdout.trim().split('\n');
    if (lines.length <= 1) {  // Skip header line
      console.log('[INFO] No processes found using port 3000');
      process.exit(0);
    }

    // Extract PIDs (skip header line)
    const pids = new Set();
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 2) {
        const pid = parts[1];
        pids.add(pid);
      }
    }

    if (pids.size === 0) {
      console.log('[INFO] No processes found to terminate');
      process.exit(0);
    }

    console.log(`[INFO] Found ${pids.size} process(es) using port 3000: ${[...pids].join(', ')}`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('[INFO] Do you want to terminate these processes? (y/n): ', (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        pids.forEach(pid => {
          console.log(`[INFO] Terminating process with PID: ${pid}`);
          exec(`kill -9 ${pid}`, (error, stdout, stderr) => {
            if (error) {
              console.error(`[ERROR] Failed to terminate process ${pid}: ${error.message}`);
              return;
            }
            console.log(`[INFO] Successfully terminated process ${pid}`);
          });
        });
      } else {
        console.log('[INFO] Operation cancelled');
      }
    });
  });
}