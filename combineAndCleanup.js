/**
 * combineAndCleanup.js - Combines separate JS modules into one and cleans up old files
 */

const fs = require('fs');
const path = require('path');

// Base directory for the project
const baseDir = process.env.APPDATA ? 
  path.join(process.env.APPDATA, 'Claude', 'dokkan-mcp') : 
  path.join(require('os').homedir(), '.claude', 'dokkan-mcp');

// Lib directory where the JS files are located
const libDir = path.join(baseDir, 'lib');

// Source and destination file paths
const sourceFiles = [
  path.join(libDir, 'cardStatCalculations.js'),
  path.join(libDir, 'customCardComparison.js'),
  path.join(libDir, 'metaAnalysis.js')
];

const destinationFile = path.join(libDir, 'cardAnalysis.js');

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Main function to combine files and clean up
async function combineAndCleanup() {
  console.log('Starting to combine files and clean up...');
  
  try {
    // Make sure lib directory exists
    if (!fileExists(libDir)) {
      console.log(`Creating lib directory at ${libDir}`);
      fs.mkdirSync(libDir, { recursive: true });
    }
    
    // Read the combined file content from the source
    const combinedContent = fs.readFileSync(path.join(baseDir, 'cardAnalysis.js'), 'utf8');
    
    // Write the combined content to the destination
    fs.writeFileSync(destinationFile, combinedContent, 'utf8');
    console.log(`Successfully created combined file: ${destinationFile}`);
    
    // Delete the original source files
    let deletedCount = 0;
    for (const file of sourceFiles) {
      if (fileExists(file)) {
        fs.unlinkSync(file);
        console.log(`Deleted original file: ${path.basename(file)}`);
        deletedCount++;
      } else {
        console.log(`File not found, skipping: ${path.basename(file)}`);
      }
    }
    
    // Delete the temporary combined file
    const tempFile = path.join(baseDir, 'cardAnalysis.js');
    if (fileExists(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log(`Deleted temporary file: cardAnalysis.js`);
    }
    
    console.log('\nCombination and cleanup complete!');
    console.log(`- Created combined file: cardAnalysis.js`);
    console.log(`- Deleted ${deletedCount} original files`);
    
    return {
      success: true,
      message: 'Files combined and cleanup completed successfully',
      combinedFile: destinationFile,
      deletedFiles: deletedCount
    };
  } catch (error) {
    console.error('Error during combine and cleanup:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  combineAndCleanup()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { combineAndCleanup };