// start.js
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;

async function ensureDirectoryExists(directory) {
  try {
    await fs.mkdir(directory, { recursive: true });
    console.log(`Directory ensured: ${directory}`);
  } catch (error) {
    console.error(`Failed to create directory ${directory}:`, error);
    throw error;
  }
}

async function start() {
  try {
    // Ensure required directories exist
    const dataDir = path.join(process.cwd(), 'data');
    const cacheDir = path.join(dataDir, 'cache');
    
    await ensureDirectoryExists(dataDir);
    await ensureDirectoryExists(cacheDir);
    
    // Start the server
    console.log('Starting Dokkan MCP server...');
    const server = spawn('node', ['server.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production'
      }
    });
    
    server.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      process.exit(code);
    });
    
    server.on('error', (err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
    
    // Handle process signals
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, () => {
        console.log(`Received ${signal}, shutting down...`);
        server.kill(signal);
      });
    });
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
}

start();