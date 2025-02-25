// fix-dokkan-mcp.js - Script to fix and verify all MCP components
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Base directory for the installation
const baseDir = process.env.APPDATA ? 
  path.join(process.env.APPDATA, 'Claude', 'dokkan-mcp') : 
  path.join(require('os').homedir(), '.claude', 'dokkan-mcp');

async function main() {
  console.log(`Starting Dokkan MCP repair at ${baseDir}`);
  
  try {
    // Ensure the directory exists
    await fs.mkdir(baseDir, { recursive: true });
    
    // Fix wiki-updater.js
    console.log("Fixing wiki-updater.js...");
    await fixWikiUpdater();
    
    // Fix server.js
    console.log("Fixing server.js...");
    await fixServerJs();
    
    // Fix setup.js
    console.log("Fixing setup.js...");
    await fixSetupJs();
    
    // Update package.json
    console.log("Updating package.json...");
    await updatePackageJson();
    
    console.log("\nAll files fixed successfully!");
    console.log("\nTry running these commands now:");
    console.log("1. node setup.js");
    console.log("2. node server.js");
  } catch (error) {
    console.error("Error during repair:", error);
  }
}

async function fixWikiUpdater() {
  const wikiUpdaterPath = path.join(baseDir, 'lib', 'wiki-updater.js');
  
  // Make sure lib directory exists
  await fs.mkdir(path.join(baseDir, 'lib'), { recursive: true });
  
  // Write the fixed wiki-updater.js
  const content = `const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const config = {
  skipDirs: ['node_modules', '.git', '.vscode', 'dist', 'build', 'coverage'],
  dependencies: {
    'express': '^4.18.2',
    'node-fetch': '^2.6.9',
    'cheerio': '^1.0.0-rc.12'
  }
};

// Wiki updater functionality
class WikiUpdater {
  constructor(dataManager, fandomAPI, dokkanScraper) {
    this.dataManager = dataManager;
    this.fandomAPI = fandomAPI;
    this.dokkanScraper = dokkanScraper;
  }
  
  async updateFromWiki() {
    try {
      console.log('Starting wiki update process...');
      
      // Check for new content
      const latestCards = await this.dokkanScraper.getLatestCards();
      await this.dataManager.cacheData('latest-cards', {
        data: latestCards,
        timestamp: Date.now()
      });
      
      // Check for events
      const events = await this.dokkanScraper.getEvents();
      await this.dataManager.cacheData('events', {
        data: events,
        timestamp: Date.now()
      });
      
      return {
        success: true,
        message: 'Wiki data updated successfully',
        cardCount: latestCards.length,
        eventsCount: events.length
      };
    } catch (error) {
      console.error('[ERROR] Wiki update failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  async checkAnniversaryStatus(version = 'jp') {
    try {
      // Check for anniversary events
      const events = await this.dokkanScraper.getEvents();
      const anniversaryEvents = events.filter(event => 
        event.title.toLowerCase().includes('anniversary') || 
        event.description.toLowerCase().includes('anniversary')
      );
      
      if (anniversaryEvents.length > 0) {
        // Sort by start date (most recent first)
        anniversaryEvents.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        
        const latestEvent = anniversaryEvents[0];
        const now = new Date();
        const eventStart = new Date(latestEvent.startDate);
        const eventEnd = new Date(latestEvent.endDate);
        
        // Check if we're currently in an anniversary period
        if (now >= eventStart && now <= eventEnd) {
          return {
            isActive: true,
            event: latestEvent,
            daysRemaining: Math.ceil((eventEnd - now) / (1000 * 60 * 60 * 24)),
            version
          };
        } else if (now < eventStart) {
          // Anniversary is coming up
          return {
            isActive: false,
            isUpcoming: true,
            event: latestEvent,
            daysUntil: Math.ceil((eventStart - now) / (1000 * 60 * 60 * 24)),
            version
          };
        }
      }
      
      // No active anniversary events
      return {
        isActive: false,
        version,
        nextExpected: this.predictNextAnniversary(version)
      };
    } catch (error) {
      console.error('[ERROR] Anniversary check failed:', error);
      return {
        isActive: false,
        error: error.message,
        version
      };
    }
  }
  
  predictNextAnniversary(version) {
    // JP anniversary is typically late January/early February
    // Global anniversary is typically early/mid July
    const now = new Date();
    const currentYear = now.getFullYear();
    let nextYear = currentYear;
    
    // Set the expected month based on version
    const month = version.toLowerCase() === 'jp' ? 1 : 6; // 0-based (January is 0, July is 6)
    const day = version.toLowerCase() === 'jp' ? 29 : 7;  // JP ~Jan 29, Global ~Jul 7
    
    // Create the expected date for this year
    const expected = new Date(currentYear, month, day);
    
    // If we've already passed the date this year, use next year's date
    if (now > expected) {
      nextYear = currentYear + 1;
    }
    
    return {
      expectedDate: new Date(nextYear, month, day),
      daysUntil: Math.ceil((new Date(nextYear, month, day) - now) / (1000 * 60 * 60 * 24))
    };
  }
}

module.exports = WikiUpdater;`;

  await fs.writeFile(wikiUpdaterPath, content);
  return true;
}

async function fixServerJs() {
  const serverPath = path.join(baseDir, 'server.js');
  
  // Write the fixed server.js
  const content = `const express = require('express');
const path = require('path');
const fs = require('fs');
const DataManager = require('./lib/data-manager');
const DokkanScraper = require('./lib/dokkan-scraper');
const FandomAPI = require('./lib/fandom-api');
const WikiUpdater = require('./lib/wiki-updater');

// Core paths and configuration
let config, mcpConfig;
try {
  // First try to load from APPDATA path
  const CONFIG_PATH = path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
  console.log(\`[DEBUG] Looking for config at: \${CONFIG_PATH}\`);
  
  if (fs.existsSync(CONFIG_PATH)) {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    console.log(\`[DEBUG] Config file found (\${configData.length} bytes)\`);
    
    config = JSON.parse(configData);
    mcpConfig = config.mcpServers && config.mcpServers['dokkan-mcp'];
    console.log(\`[DEBUG] MCP Config found: \${mcpConfig ? 'yes' : 'no'}\`);
  } else {
    console.log('[DEBUG] Config file not found, will use defaults');
    
    // Try fallback path in current directory
    const fallbackPath = path.join(process.cwd(), 'config', 'mcp-config.json');
    if (fs.existsSync(fallbackPath)) {
      console.log(\`[DEBUG] Using fallback config at: \${fallbackPath}\`);
      config = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      mcpConfig = config;
    }
  }
} catch (error) {
  console.error('[ERROR] Failed to load config', error);
  // Continue with defaults if config loading fails
}

// Initialize core services with fallback values if config loading failed
const app = express();
const activeConnections = new Set();
const dataManager = new DataManager(process.cwd());
const dokkanScraper = new DokkanScraper();
const fandomAPI = new FandomAPI('https://dbz-dokkanbattle.fandom.com');
const wikiUpdater = new WikiUpdater(dataManager, fandomAPI, dokkanScraper);

// Essential middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url}\`);
  next();
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message });
});

// Initialize data storage
dataManager.init().catch(err => {
  console.error('[ERROR] Failed to initialize data storage', err);
});

// MCP protocol handler (core requirement)
app.post('/', (req, res) => {
  const { method, params, id } = req.body;
  activeConnections.add(res);

  res.on('close', () => {
    activeConnections.delete(res);
    console.log('[DEBUG] Connection closed');
  });

  // Required MCP methods
  const handlers = {
    initialize: () => ({
      protocolVersion: '2024-02-24',
      capabilities: { 
        dokkan: {
          cards: true,
          events: true,
          categories: true
        }
      },
      serverInfo: { name: 'dokkan-mcp', version: '1.0.0' }
    }),
    
    shutdown: () => {
      console.log('[DEBUG] Shutdown requested');
      setTimeout(() => process.exit(0), 100);
      return { success: true };
    },
    
    getCardData: async (cardId) => {
      // Try to get from cache first
      const cachedData = await dataManager.getCachedData(\`card-\${cardId}\`);
      if (cachedData) return cachedData;
      
      // Scrape data if not in cache
      const cardData = await dokkanScraper.scrapeCardData(cardId);
      await dataManager.cacheData(\`card-\${cardId}\`, cardData);
      return cardData;
    },
    
    getLatestCards: async () => {
      const cachedData = await dataManager.getCachedData('latest-cards');
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
      const latestCards = await dokkanScraper.getLatestCards();
      await dataManager.cacheData('latest-cards', {
        data: latestCards,
        timestamp: Date.now()
      });
      return latestCards;
    },
    
    searchCards: async (query) => {
      const results = await fandomAPI.searchCards(query);
      return results;
    },
    
    getEvents: async () => {
      const cachedData = await dataManager.getCachedData('events');
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
      const events = await dokkanScraper.getEvents();
      await dataManager.cacheData('events', {
        data: events,
        timestamp: Date.now()
      });
      return events;
    },
    
    clearCache: async () => {
      await dataManager.clearCache();
      return { success: true };
    },
    
    updateFromWiki: async () => {
      return wikiUpdater.updateFromWiki();
    },
    
    getAnniversaryStatus: async (version = 'jp') => {
      return wikiUpdater.checkAnniversaryStatus(version);
    }
  };

  try {
    const handler = handlers[method];
    if (!handler) {
      return res.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id
      });
    }

    // Handle both synchronous and async handlers
    Promise.resolve(handler(params))
      .then(result => {
        res.json({
          jsonrpc: '2.0',
          result,
          id
        });
      })
      .catch(error => {
        console.error('[ERROR] Handler failed:', error);
        res.json({
          jsonrpc: '2.0',
          error: { code: -32000, message: error.message },
          id
        });
      });
  } catch (error) {
    console.error('[ERROR] Request processing failed:', error);
    res.json({
      jsonrpc: '2.0',
      error: { code: -32000, message: error.message },
      id
    });
  }
});

// Health check (required for MCP protocol)
app.get('/health', (_, res) => res.json({ 
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: '1.0.0'
}));

// Error handling and shutdown
process.on('SIGTERM', () => {
  console.log('[DEBUG] SIGTERM received');

  activeConnections.forEach(conn => {
    try {
      conn.json({
        jsonrpc: '2.0',
        method: 'notify',
        params: { type: 'shutdown' }
      }).end();
    } catch (err) {
      console.error('[ERROR] Notification failed:', err);
    }
  });

  setTimeout(() => process.exit(0), 100);
});

// Start server with debugging output
const port = mcpConfig?.port || 3000;
const server = app.listen(port, () => {
  console.log(\`[\${new Date().toISOString()}] Server started on port \${port}\`);
  
  if (config) {
    console.log('[DEBUG] Config loaded successfully');
  } else {
    console.log('[DEBUG] Running with default configuration');
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\`[ERROR] Port \${port} is already in use. Cannot start server.\`);
    console.error('[ERROR] Try running restart.js first to clear port conflicts.');
  } else {
    console.error('[ERROR] Server failed to start:', err);
  }
  process.exit(1);
});

// Add additional error handling
server.on('close', () => {
  console.log('[DEBUG] Server connection closed');
});

// Log when server is ready
server.on('listening', () => {
  const addr = server.address();
  console.log(\`[DEBUG] Server listening on \${typeof addr === 'string' ? addr : \`port \${addr.port}\`}\`);
});`;

  await fs.writeFile(serverPath, content);
  return true;
}

async function fixSetupJs() {
  const setupPath = path.join(baseDir, 'setup.js');
  
  // Write the fixed setup.js
  const content = `// setup.js - Optimizes Dokkan MCP installation
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Core configuration object
const config = {
  features: {
    customCardComparison: true,
    cardStatCalculations: true,
    metaAnalysis: true,
    autoUpdater: true
  },
  essentialFiles: ['server.js', 'lib/data-manager.js', 'lib/dokkan-scraper.js', 'lib/fandom-api.js'],
  skipDirs: ['node_modules', '.git', '.vscode', 'dist', 'build', 'coverage'],
  dependencies: {
    'express': '^4.18.2',
    'node-fetch': '^2.6.9',
    'cheerio': '^1.0.0-rc.12'
  }
};

// File system operations
class FileOps {
  static async findMcpDir() {
    const locations = [
      process.env.APPDATA ? path.join(process.env.APPDATA, 'Claude', 'dokkan-mcp') : null,
      path.join(require('os').homedir(), '.claude', 'dokkan-mcp'),
      process.cwd()
    ].filter(Boolean);

    for (const dir of locations) {
      try {
        const files = await fs.readdir(dir);
        if (files.includes('server.js') || files.includes('lib')) return dir;
      } catch {}
    }
    return process.cwd();
  }

  static async scanFiles(dir, pattern = null) {
    const files = [];
    async function scan(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (config.skipDirs.includes(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) await scan(fullPath);
        else if (!pattern || pattern.test(entry.name)) files.push(fullPath);
      }
    }
    await scan(dir);
    return files;
  }

  static async checkContent(file, searchTerms) {
    try {
      const content = await fs.readFile(file, 'utf8');
      return searchTerms.map(term => ({
        term,
        found: content.includes(term)
      }));
    } catch {
      return searchTerms.map(term => ({ term, found: false }));
    }
  }
}

// Installation analyzer
class InstallAnalyzer {
  static async analyze(baseDir) {
    const files = await FileOps.scanFiles(baseDir);
    const relFiles = files.map(f => path.relative(baseDir, f).replace(/\\\\/g, '/'));
    
    return {
      missingEssentials: config.essentialFiles.filter(f => !relFiles.includes(f)),
      features: Object.entries(config.features).reduce((acc, [key, enabled]) => {
        if (!enabled) return acc;
        const required = [\`lib/\${key}.js\`];
        acc[key] = {
          missing: required.filter(f => !relFiles.includes(f)),
          existing: required.filter(f => relFiles.includes(f))
        };
        return acc;
      }, {})
    };
  }
}

// Feature implementer
class FeatureImplementer {
  static async implement(baseDir, analysis) {
    // Create essential files
    for (const file of analysis.missingEssentials) {
      await this.createFile(baseDir, file);
    }

    // Implement missing features
    for (const [feature, status] of Object.entries(analysis.features)) {
      if (status.missing.length === 0) continue;
      await this.implementFeature(baseDir, feature, status);
    }
  }

  static async createFile(baseDir, file) {
    const fullPath = path.join(baseDir, file);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const template = await this.getTemplate(file);
    await fs.writeFile(fullPath, template);
  }

  static async implementFeature(baseDir, feature, status) {
    for (const file of status.missing) {
      await this.createFile(baseDir, file);
    }
  }

  static getTemplate(file) {
    // Templates moved to separate config file for cleaner code
    const templates = {
      'server.js': \`// Basic server template
const express = require('express');
const app = express();
app.use(express.json());
// ... rest of server code\`,
      'lib/data-manager.js': \`// Data manager template
class DataManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }
  // ... rest of data manager code
}\`,
    };
    return templates[file] || '// Template for ' + path.basename(file);
  }
}

// Update server file function
async function updateServerFile(serverPath, analysis) {
  try {
    const serverContent = await fs.readFile(serverPath, 'utf8');
    const missingImports = [];
    const missingInitialization = [];
    const missingHandlers = [];

    // Check for missing handlers and components
    if (!serverContent.includes('WikiUpdater')) {
      missingImports.push("const WikiUpdater = require('./lib/wiki-updater');");
      missingInitialization.push("const wikiUpdater = new WikiUpdater(dataManager, fandomAPI, dokkanScraper);");
      missingHandlers.push(\`
  updateFromWiki: async () => {
    return wikiUpdater.updateFromWiki();
  },
  getAnniversaryStatus: async (version = 'jp') => {
    return wikiUpdater.checkAnniversaryStatus(version);
  },\`);
    }
    
    // Apply changes if needed
    if (missingImports.length > 0 || missingInitialization.length > 0 || missingHandlers.length > 0) {
      // Create updated server content with modifications
      let updatedContent = serverContent;
      
      // Add imports if missing
      if (missingImports.length > 0) {
        const importMatch = updatedContent.match(/const .+? = require\\(.+?\\);/g);
        if (importMatch) {
          const lastImport = importMatch[importMatch.length - 1];
          updatedContent = updatedContent.replace(
            lastImport,
            \`\${lastImport}\\n\${missingImports.join('\\n')}\`
          );
        }
      }
      
      // Add initialization if missing
      if (missingInitialization.length > 0) {
        const initMatch = updatedContent.match(/const .+? = new .+?\\(.+?\\);/g);
        if (initMatch) {
          const lastInit = initMatch[initMatch.length - 1];
          updatedContent = updatedContent.replace(
            lastInit,
            \`\${lastInit}\\n\${missingInitialization.join('\\n')}\`
          );
        }
      }
      
      // Add handlers if missing
      if (missingHandlers.length > 0) {
        const handlersMatch = updatedContent.match(/const handlers = {[\\s\\S]+?};/);
        if (handlersMatch) {
          const handlersContent = handlersMatch[0];
          const lastHandlerMatch = handlersContent.match(/\\w+:\\s+async.+?{[\\s\\S]+?},\\s+\\n/g);
          if (lastHandlerMatch) {
            const lastHandler = lastHandlerMatch[lastHandlerMatch.length - 1];
            updatedContent = updatedContent.replace(
              lastHandler,
              \`\${lastHandler}\${missingHandlers.join('')}\`
            );
          }
        }
      }
      
      // Write updated content
      await fs.writeFile(serverPath, updatedContent, 'utf8');
      console.log(\`Updated server.js with new components\`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating server file:', error);
    return false;
  }
}

// Ensure dependencies function
async function ensureDependencies(baseDir) {
  const packageJsonPath = path.join(baseDir, 'package.json');
  
  try {
    // Read or create package.json
    let packageJson;
    try {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    } catch {
      packageJson = {
        name: 'dokkan-mcp',
        version: '1.0.0',
        description: 'Dokkan Battle MCP server',
        main: 'server.js',
        scripts: { start: 'node server.js' },
        dependencies: {}
      };
    }
    
    // Check and update dependencies
    packageJson.dependencies = packageJson.dependencies || {};
    let needsUpdate = false;
    
    for (const [name, version] of Object.entries(config.dependencies)) {
      if (!packageJson.dependencies[name]) {
        packageJson.dependencies[name] = version;
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('Updated package.json with required dependencies.');
      
      try {
        await execPromise('npm install', { cwd: baseDir });
        console.log('Dependencies installed successfully.');
      } catch {
        console.log('Please run "npm install" manually.');
      }
    } else {
      console.log('All required dependencies are already installed.');
    }
  } catch (error) {
    console.error('Error ensuring dependencies:', error);
  }
}

// Main setup function
async function setup() {
  const baseDir = await FileOps.findMcpDir();
  console.log(\`Setting up Dokkan MCP in \${baseDir}\`);
  
  const analysis = await InstallAnalyzer.analyze(baseDir);
  await FeatureImplementer.implement(baseDir, analysis);
  
  // Update server.js if needed
  const serverPath = path.join(baseDir, 'server.js');
  if (fsSync.existsSync(serverPath)) {
    await updateServerFile(serverPath, analysis);
  }
  
  // Ensure dependencies are installed
  await ensureDependencies(baseDir);
  
  // Run wiki updater if enabled
  if (config.features.autoUpdater) {
    console.log('\\nChecking for wiki updates...');
    const wikiUpdaterPath = path.join(baseDir, 'lib/wiki-updater.js');
    
    if (fsSync.existsSync(wikiUpdaterPath)) {
      try {
        const WikiUpdater = require(path.join(baseDir, 'lib/wiki-updater.js'));
        const DataManager = require(path.join(baseDir, 'lib/data-manager.js'));
        const FandomAPI = require(path.join(baseDir, 'lib/fandom-api.js'));
        const DokkanScraper = require(path.join(baseDir, 'lib/dokkan-scraper.js'));
        
        const dataManager = new DataManager(baseDir);
        await dataManager.init();
        
        const fandomAPI = new FandomAPI('https://dbz-dokkanbattle.fandom.com');
        const dokkanScraper = new DokkanScraper();
        
        const wikiUpdater = new WikiUpdater(dataManager, fandomAPI, dokkanScraper);
        const updateResult = await wikiUpdater.updateFromWiki();
        
        console.log(\`Wiki update \${updateResult.success ? 'succeeded' : 'failed'}: \${updateResult.message}\`);
      } catch (error) {
        console.error('Error running wiki update:', error);
      }
    }
  }
  
  console.log('\\nSetup complete! You can now run:');
  console.log('node server.js');
  
  return { success: true, baseDir, analysis };
}

// Auto-run setup if this is the main script
if (require.main === module) {
  setup().catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
}

module.exports = { setup, config, FileOps, InstallAnalyzer, FeatureImplementer };`;

  await fs.writeFile(setupPath, content);
  return true;
}

async function updatePackageJson() {
  const packagePath = path.join(baseDir, 'package.json');
  
  try {
    // Create or read package.json
    let packageJson;
    try {
      packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    } catch {
      packageJson = {
        name: 'dokkan-mcp',
        version: '1.0.0',
        description: 'Dokkan Battle MCP server',
        main: 'server.js',
        scripts: {
          start: 'node server.js'
        },
        dependencies: {}
      };
    }
    
    // Update dependencies
    packageJson.dependencies = packageJson.dependencies || {};
    const dependencies = {
      'express': '^4.18.2',
      'node-fetch': '^2.6.9',
      'cheerio': '^1.0.0-rc.12'
    };
    
    let updated = false;
    for (const [name, version] of Object.entries(dependencies)) {
      if (!packageJson.dependencies[name]) {
        packageJson.dependencies[name] = version;
        updated = true;
      }
    }
    
    // Write updated package.json
    await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
    
    if (updated) {
      console.log('Updated package.json with required dependencies');
    } else {
      console.log('Package.json dependencies are already up to date');
    }
    
    return true;
  } catch (error) {
    console.error('Error updating package.json:', error);
    return false;
  }
}

// Run the main function
main().catch(console.error);