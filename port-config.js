/**
 * Shared port configuration for dokkan-mcp servers
 * This file helps coordinate port usage between server.js and setup.js
 */

module.exports = {
  // Claude Desktop MUST use port 3000 - DO NOT CHANGE THIS
  CLAUDE_DESKTOP_PORT: 3000,
  
  // Setup server uses port 3001 by default
  SETUP_PORT: 3001,
  
  // Helper function to determine if port is in use
  isPortInUse: function(port) {
    const net = require('net');
    return new Promise((resolve) => {
      const server = net.createServer()
        .once('error', () => {
          // Port is in use
          resolve(true);
        })
        .once('listening', () => {
          // Port is free
          server.close();
          resolve(false);
        })
        .listen(port);
    });
  },

  // Find next available port starting from basePort
  findAvailablePort: async function(basePort, maxAttempts = 10) {
    let port = basePort;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const inUse = await this.isPortInUse(port);
      if (!inUse) {
        return port;
      }
      console.log(`[DEBUG] Port ${port} is in use, trying next port`);
      port++;
      attempts++;
    }
    
    throw new Error(`Could not find available port after ${maxAttempts} attempts`);
  }
};