// vscode-fix.js - Resolves VS Code file locks and saving issues
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the dokkan-mcp directory
const baseDir = process.env.APPDATA ? 
  path.join(process.env.APPDATA, 'Claude', 'dokkan-mcp') : 
  path.join(require('os').homedir(), '.claude', 'dokkan-mcp');

const libDir = path.join(baseDir, 'lib');
const wikiUpdaterPath = path.join(libDir, 'wiki-updater.js');
const backupPath = path.join(baseDir, 'wiki-updater.js.bak');
const vscodeDir = path.join(baseDir, '.vscode');
const vscodeCache = path.join(baseDir, '.vscode', 'cache');

// Function to check if a process is using a file
function checkProcessesUsingFile(filePath) {
  try {
    // Windows-specific command to check file locks
    const output = execSync(`powershell -command "Get-Process | Where-Object {$_.Modules.FileName -contains '${filePath}'}"`, { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    // If the command fails or no processes are found
    return null;
  }
}

// Main function
async function fix() {
  console.log('Starting VS Code file lock resolution...');
  
  // Step 1: Check if VS Code is running and using the file
  console.log('Checking for processes using the file...');
  const processes = checkProcessesUsingFile(wikiUpdaterPath);
  if (processes && processes.length > 0) {
    console.log('WARNING: Processes are still using the file:');
    console.log(processes);
    console.log('Please close VS Code completely before continuing.');
    console.log('Press Ctrl+C to abort this script, then try again after closing VS Code.');
    // Wait for user to see the message
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Step 2: Create backup if file exists
  console.log('Creating backup of wiki-updater.js...');
  if (fs.existsSync(wikiUpdaterPath)) {
    try {
      fs.copyFileSync(wikiUpdaterPath, backupPath);
      console.log(`Backup created at: ${backupPath}`);
    } catch (error) {
      console.error(`Failed to create backup: ${error.message}`);
      console.log('Continuing without backup...');
    }
  } else {
    console.log('Original file not found, no backup needed.');
  }
  
  // Step 3: Clean VS Code cache
  console.log('Cleaning VS Code cache...');
  if (fs.existsSync(vscodeCache)) {
    try {
      // Recursively delete the .vscode/cache directory
      fs.rmSync(vscodeCache, { recursive: true, force: true });
      console.log('VS Code cache deleted successfully.');
    } catch (error) {
      console.error(`Failed to delete VS Code cache: ${error.message}`);
    }
  } else {
    console.log('No VS Code cache found.');
  }
  
  // Step 4: Delete any temporary or lock files
  console.log('Checking for temporary or lock files...');
  const tmpFiles = [
    `${wikiUpdaterPath}.git`,
    `${wikiUpdaterPath}.swp`,
    `${wikiUpdaterPath}.tmp`,
    `${wikiUpdaterPath}.lock`
  ];
  
  tmpFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`Deleted temporary file: ${file}`);
      } catch (error) {
        console.error(`Failed to delete ${file}: ${error.message}`);
      }
    }
  });
  
  // Step 5: Write the clean file
  console.log('Writing clean wiki-updater.js file...');
  try {
    // Delete the original file
    if (fs.existsSync(wikiUpdaterPath)) {
      fs.unlinkSync(wikiUpdaterPath);
      console.log('Original file deleted successfully.');
    }
    
    // Make sure the lib directory exists
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
      console.log('Created lib directory.');
    }
    
    // Write the correct content
    const content = fs.readFileSync(path.join(__dirname, 'wiki-updater-content.js'), 'utf8');
    fs.writeFileSync(wikiUpdaterPath, content, 'utf8');
    console.log('Successfully wrote clean wiki-updater.js file.');
  } catch (error) {
    console.error(`Failed to write clean file: ${error.message}`);
    console.log('Try the manual steps below:');
    console.log('1. Close VS Code completely');
    console.log('2. Use another text editor like Notepad to edit the file');
    console.log(`3. Create/replace the file at: ${wikiUpdaterPath}`);
    console.log('4. Copy the content from wiki-updater-content.js into the file');
    return;
  }
  
  console.log('\nFile lock resolution complete!');
  console.log('Recommendations:');
  console.log('1. Start VS Code fresh (not from recent files list)');
  console.log('2. Open the dokkan-mcp folder as a workspace');
  console.log('3. If VS Code asks to "Resolve file differences", choose "Accept Local"');
  console.log('4. If you still have issues, try using a different text editor like Notepad++');
}

// Run the fix function
fix().catch(console.error);