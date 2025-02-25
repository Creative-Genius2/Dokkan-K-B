const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const source = path.join(process.env.APPDATA, 'Roaming', 'Claude', 'dokkan-mcp', 'server.js');
const target = path.join(process.env.APPDATA, 'Local', 'AnthropicClaude', 'app-0.7.9', 'server.js');

// Ensure target directory exists
const targetDir = path.dirname(target);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Create symbolic link using mklink command
const command = `mklink "${target}" "${source}"`;
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('Error creating link:', error);
    console.error('Try running as administrator');
    return;
  }
  console.log('Link created successfully');
});