/**
 * cleanup.js - Utility to clean up temporary files from the project directory
 */

const fs = require('fs');
const path = require('path');

// Base directory
const baseDir = process.env.APPDATA ? 
  path.join(process.env.APPDATA, 'Claude', 'dokkan-mcp') : 
  path.join(require('os').homedir(), '.claude', 'dokkan-mcp');

// Files to clean up
const temporaryFiles = [
  // Backup and temporary files from wiki-updater fixes
  'wiki-updater.js.bak',
  'wiki-updater-content.js',
  'vscode-fix.js',
  'fix-conflict.js',
  'fix-dokkan-mcp.js',
  
  // Temporary PowerShell scripts
  'check-link.ps1',
  'fix-mcp.ps1',
  'manage-mcp.ps1',
  'symlink.ps1',
  
  // Logs and temporary outputs
  'setup-log.txt'
];

// Delete a file if it exists
function deleteIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✓ Deleted: ${path.basename(filePath)}`);
      return true;
    } catch (error) {
      console.error(`✗ Error deleting ${path.basename(filePath)}: ${error.message}`);
      return false;
    }
  } else {
    console.log(`○ File not found: ${path.basename(filePath)}`);
    return false;
  }
}

// Main cleanup function
function cleanup() {
  console.log('Starting cleanup of temporary files...');
  
  let deleted = 0;
  let notFound = 0;
  let failed = 0;
  
  // Process each file in the list
  temporaryFiles.forEach(file => {
    const filePath = path.join(baseDir, file);
    
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`✓ Deleted: ${file}`);
        deleted++;
      } catch (error) {
        console.error(`✗ Error deleting ${file}: ${error.message}`);
        failed++;
      }
    } else {
      console.log(`○ File not found: ${file}`);
      notFound++;
    }
  });
  
  console.log('\nCleanup Summary:');
  console.log(`- ${deleted} files deleted`);
  console.log(`- ${notFound} files not found`);
  console.log(`- ${failed} files failed to delete`);
  
  if (failed > 0) {
    console.log('\nSome files could not be deleted. They may be in use by another process.');
    console.log('Try closing all related applications and run this script again.');
  } else {
    console.log('\nCleanup completed successfully!');
  }
}

// Run cleanup if executed directly
if (require.main === module) {
  cleanup();
}

module.exports = { cleanup };