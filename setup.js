const express = require('express');
const path = require('path');
const fs = require('fs');
const DataManager = require('./lib/data-manager');
const DokkanScraper = require('./lib/dokkan-scraper');
const FandomAPI = require('./lib/fandom-api');
const WikiUpdater = require('./lib/wiki-updater');
const net = require('net');

// Core paths and configuration
let config, mcpConfig;
try {
  // First try to load from APPDATA path
  const CONFIG_PATH = path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
  console.log(`[DEBUG] Looking for config at: ${CONFIG_PATH}`);
  
  if (fs.existsSync(CONFIG_PATH)) {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    console.log(`[DEBUG] Config file found (${configData.length} bytes)`);
    
    config = JSON.parse(configData);
    mcpConfig = config.mcpServers && config.mcpServers['dokkan-mcp'];
    console.log(`[DEBUG] MCP Config found: ${mcpConfig ? 'yes' : 'no'}`);
  } else {
    console.log('[DEBUG] Config file not found, will use defaults');
    
    // Try fallback path in current directory
    const fallbackPath = path.join(process.cwd(), 'config', 'mcp-config.json');
    if (fs.existsSync(fallbackPath)) {
      console.log(`[DEBUG] Using fallback config at: ${fallbackPath}`);
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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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
          categories: true,
          ezas: true,
          dokkanEvents: true,
          storyEvents: true,
          missions: true,
          items: true
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
      const cachedData = await dataManager.getCachedData(`card-${cardId}`);
      if (cachedData) return cachedData;
      
      // Use WikiUpdater to get from best source
      const cardData = await wikiUpdater.getDataFromPrioritizedSources('cards', async (source) => {
        if (source === 'fandom') {
          return await fandomAPI.getCardData(cardId);
        } else {
          return await dokkanScraper.scrapeCardData(cardId);
        }
      });
      
      await dataManager.cacheData(`card-${cardId}`, cardData);
      return cardData;
    },
    
    getLatestCards: async () => {
      const cachedData = await dataManager.getCachedData('cards');
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
      const latestCards = await wikiUpdater.getLatestCardsFromBestSource();
      await dataManager.cacheData('cards', {
        data: latestCards,
        timestamp: Date.now()
      });
      return latestCards;
    },
    
    searchCards: async (query) => {
      // Use WikiUpdater to search from best source
      return await wikiUpdater.getDataFromPrioritizedSources('cards', async (source) => {
        if (source === 'fandom') {
          return await fandomAPI.searchCards(query);
        } else {
          return await dokkanScraper.searchCards(query);
        }
      });
    },
    
    getEvents: async () => {
      const cachedData = await dataManager.getCachedData('events');
      if (cachedData && Date.now() - cachedData.timestamp < 1800000) return cachedData.data;
      
      const events = await wikiUpdater.getEventsFromBestSource();
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
    
    updateFromWiki: async (dataTypes) => {
      return wikiUpdater.updateFromWiki(dataTypes);
    },
    
    getAnniversaryStatus: async (version = 'jp') => {
      return wikiUpdater.checkAnniversaryStatus(version);
    },
    
    getEZAs: async () => {
      const cachedData = await dataManager.getCachedData('ezas');
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
      const ezas = await wikiUpdater.getEZAsFromBestSource();
      await dataManager.cacheData('ezas', {
        data: ezas,
        timestamp: Date.now()
      });
      return ezas;
    },
    
    getDokkanEvents: async () => {
      const cachedData = await dataManager.getCachedData('dokkanEvents');
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
      const dokkanEvents = await wikiUpdater.getDokkanEventsFromBestSource();
      await dataManager.cacheData('dokkanEvents', {
        data: dokkanEvents,
        timestamp: Date.now()
      });
      return dokkanEvents;
    },
    
    getStoryEvents: async () => {
      const cachedData = await dataManager.getCachedData('storyEvents');
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
      const storyEvents = await wikiUpdater.getStoryEventsFromBestSource();
      await dataManager.cacheData('storyEvents', {
        data: storyEvents,
        timestamp: Date.now()
      });
      return storyEvents;
    },
    
    getMissions: async () => {
      const cachedData = await dataManager.getCachedData('missions');
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
      const missions = await wikiUpdater.getMissionsFromBestSource();
      await dataManager.cacheData('missions', {
        data: missions,
        timestamp: Date.now()
      });
      return missions;
    },
    
    getItems: async () => {
      const cachedData = await dataManager.getCachedData('items');
      if (cachedData && Date.now() - cachedData.timestamp < 7200000) return cachedData.data;
      
      const items = await wikiUpdater.getItemsFromBestSource();
      await dataManager.cacheData('items', {
        data: items,
        timestamp: Date.now()
      });
      return items;
    },
    
    updateSourcePriorities: async () => {
      await wikiUpdater.updateSourcePriorities();
      return { success: true, message: 'Source priorities updated' };
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

// Check if port is in use
function isPortInUse(port) {
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
}

// Find available port
async function findAvailablePort(startPort, maxAttempts = 10) {
  let port = startPort;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
    console.log(`[DEBUG] Port ${port} is in use, trying next port`);
    port++;
    attempts++;
  }
  
  throw new Error(`Could not find available port after ${maxAttempts} attempts`);
}

// Start server with port conflict handling (SETUP USES ALTERNATIVE PORT)
async function startServer() {
  // For setup.js, we use port 3001 by default instead of 3000 to avoid conflict
  // with server.js which needs to run on port 3000 for Claude Desktop
  const basePort = mcpConfig?.port || 3001;
  
  try {
    // Check if port 3000 is in use (Claude Desktop server might be running)
    const port3000InUse = await isPortInUse(3000);
    if (port3000InUse) {
      console.log('[INFO] Port 3000 is in use (likely Claude Desktop server)');
    }
    
    // Find an available port starting from basePort
    let port = await findAvailablePort(basePort);
    
    const server = app.listen(port, () => {
      console.log('\x1b[32m%s\x1b[0m', '='.repeat(80));
      console.log('\x1b[32m%s\x1b[0m', `[SUCCESS] Setup server started on port ${port}`);
      console.log('\x1b[32m%s\x1b[0m', '');
      console.log('\x1b[32m%s\x1b[0m', `Note: This setup.js instance is running on port ${port},`);
      console.log('\x1b[32m%s\x1b[0m', 'leaving port 3000 free for Claude Desktop server.js');
      console.log('\x1b[32m%s\x1b[0m', '='.repeat(80));
      
      if (config) {
        console.log('[DEBUG] Config loaded successfully');
      } else {
        console.log('[DEBUG] Running with default configuration');
      }
    }).on('error', (err) => {
      console.error('[ERROR] Server failed to start:', err);
      process.exit(1);
    });

    // Add additional error handling
    server.on('close', () => {
      console.log('[DEBUG] Server connection closed');
    });

    // Log when server is ready
    server.on('listening', () => {
      const addr = server.address();
      console.log(`[DEBUG] Server listening on ${typeof addr === 'string' ? addr : `port ${addr.port}`}`);
    });
    
    return server;
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  }
}

// Start the server
startServer();