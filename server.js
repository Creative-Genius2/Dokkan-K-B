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
app.use(express.json({
  // Error code 4 fix: More lenient JSON parsing
  strict: false,
  limit: '1mb'
}));

// Fix for Error Code 4: Add proper CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.header('Content-Type', 'application/json');
  next();
});

// Fix for Error Code 4: Add proper CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.header('Content-Type', 'application/json');
  next();
});

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
  console.log(`[DEBUG] Received request: ${JSON.stringify(req.body)}`);
  
  // Error code 4 fix: Validate JSON-RPC format explicitly
  if (!req.body || !req.body.jsonrpc || req.body.jsonrpc !== '2.0' || !req.body.method) {
    console.error('[ERROR] Invalid JSON-RPC request format');
    return res.status(200).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: req.body?.id || null
    });
  }
  console.log(`[DEBUG] Received request: ${JSON.stringify(req.body)}`);
  
  // Error code 4 fix: Validate JSON-RPC format explicitly
  if (!req.body || !req.body.jsonrpc || req.body.jsonrpc !== '2.0' || !req.body.method) {
    console.error('[ERROR] Invalid JSON-RPC request format');
    return res.status(200).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: req.body?.id || null
    });
  }
  
  const { method, params, id } = req.body;
  activeConnections.add(res);

  res.on('close', () => {
    activeConnections.delete(res);
    console.log('[DEBUG] Connection closed');
  });

  // Required MCP methods
  const handlers = {
    initialize: () => {
      console.log('[DEBUG] Claude Desktop initialize request received');
      const response = {
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
        serverInfo: { 
          name: 'dokkan-mcp', 
          version: '1.0.0',
          status: 'ready'
        }
      };
      console.log('[DEBUG] Sending initialize response:', JSON.stringify(response));
      return response;
    }
        },
        serverInfo: { 
          name: 'dokkan-mcp', 
          version: '1.0.0',
          status: 'ready'
        }
      };
      
      console.log('[DEBUG] Sending initialize response:', JSON.stringify(response));
      return response;
    },
    
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
      if (cachedData && Date.now() - cachedData.timestamp < 3600000) return cachedData.data;
      
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
        const response = {
          jsonrpc: '2.0',
          result,
          id
        };
        console.log(`[DEBUG] Sending response: ${JSON.stringify(response)}`);
        res.json(response);
      })
      .catch(error => {
        console.error('[ERROR] Handler failed:', error);
        console.error('[ERROR] Connection handling error:', error);
        const errorResponse = {
          jsonrpc: '2.0',
          error: { code: -32000, message: error.message },
          id
        };
        console.log(`[DEBUG] Sending error response: ${JSON.stringify(errorResponse)}`);
        res.json(errorResponse);
      });
  } catch (error) {
    console.error('[ERROR] Request processing failed:', error);
    console.error('[ERROR] Connection handling error:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      error: { code: -32000, message: error.message },
      id
    };
    console.log(`[DEBUG] Sending error response: ${JSON.stringify(errorResponse)}`);
    res.json(errorResponse);
  }
});

// Health check (required for MCP protocol)
app.get('/health', (_, res) => {
  // Error code 4 fix: More detailed health check response
  const healthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    protocol: '2024-02-24',
    uptime: process.uptime(),
    connections: activeConnections.size
  };
  console.log('[DEBUG] Health check requested, responding with:', JSON.stringify(healthResponse));
  return res.json(healthResponse);
});

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

// Function to check if port is in use
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

// Function to find available port
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

// Get port configuration from shared config
const portConfig = require('./port-config');

// Start server with strict port requirement (Claude Desktop needs exactly port 3000)
async function startServer() {
  const port = mcpConfig?.port || portConfig.CLAUDE_DESKTOP_PORT;
  
  try {
    // Check if port is in use
    const inUse = await isPortInUse(port);
    if (inUse) {
      console.error('\x1b[31m%s\x1b[0m', '='.repeat(80));
      console.error('\x1b[31m%s\x1b[0m', `[CRITICAL ERROR] Port ${port} is already in use!`);
      console.error('\x1b[31m%s\x1b[0m', 'Claude Desktop requires this exact port to function properly.');
      console.error('\x1b[31m%s\x1b[0m', '');
      console.error('\x1b[31m%s\x1b[0m', 'Please run "node restart.js" first to clear any processes using port 3000');
      console.error('\x1b[31m%s\x1b[0m', 'Then try starting this server again.');
      console.error('\x1b[31m%s\x1b[0m', '='.repeat(80));
      process.exit(1);
    }
    
    const server = app.listen(port, () => {
      console.log('\x1b[32m%s\x1b[0m', '='.repeat(80));
      console.log('\x1b[32m%s\x1b[0m', `[SUCCESS] Server started on port ${port}`);
      console.log('\x1b[32m%s\x1b[0m', 'Claude Desktop should now be able to connect properly.');
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
    console.error('[ERROR] Try running restart.js first to clear port conflicts.');
    process.exit(1);
  }
}

// Start the server
startServer();