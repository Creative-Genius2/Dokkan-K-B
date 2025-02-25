const fsSync = require('fs');
const fs = require('fs').promises;
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
  },
  wikiSources: {
    fandom: {
      baseUrl: 'https://dbz-dokkanbattle.fandom.com',
      priority: 1, // Lower number = higher priority
      rateLimitMs: 1000 // Min milliseconds between requests
    },
    dokkanInfo: {
      baseUrl: 'https://dokkaninfo.com',
      priority: 2,
      rateLimitMs: 1500
    }
  },
  dataTypes: {
    cards: { cacheTtl: 3600000 }, // 1 hour in ms
    events: { cacheTtl: 1800000 }, // 30 mins
    ezas: { cacheTtl: 3600000 },
    dokkanEvents: { cacheTtl: 3600000 },
    storyEvents: { cacheTtl: 3600000 },
    missions: { cacheTtl: 3600000 },
    items: { cacheTtl: 7200000 }, // 2 hours
    // When new data types are discovered, they'll be added here
  },
  // Parsers for each data type - structure expected in wiki data
  parsers: {
    cards: {
      requiredFields: ['name', 'id', 'type', 'rarity'],
      transformations: {
        'name': value => String(value).trim(),
        'id': value => String(value),
        'atk': value => parseInt(value) || 0,
        'def': value => parseInt(value) || 0,
        'hp': value => parseInt(value) || 0
      }
    },
    events: {
      requiredFields: ['title', 'startDate', 'endDate'],
      transformations: {
        'startDate': value => new Date(value),
        'endDate': value => new Date(value)
      }
    },
    ezas: {
      requiredFields: ['name', 'card_id'],
      transformations: {
        'stages': value => Array.isArray(value) ? value : []
      }
    },
    // Default parser for newly discovered types
    default: {
      requiredFields: [],
      transformations: {}
    }
  }
};

// Wiki updater functionality
class WikiUpdater {
  constructor(dataManager, fandomAPI, dokkanScraper) {
    this.dataManager = dataManager;
    this.fandomAPI = fandomAPI;
    this.dokkanScraper = dokkanScraper;
    
    // Track last request time per source to respect rate limits
    this.lastRequestTime = {
      fandom: 0,
      dokkanInfo: 0
    };
    
    // Default source priorities (can be dynamically adjusted)
    this.sourcePriorities = { 
      cards: ['fandom', 'dokkanInfo'],
      events: ['dokkanInfo', 'fandom'],
      ezas: ['fandom', 'dokkanInfo'],
      dokkanEvents: ['dokkanInfo', 'fandom'],
      storyEvents: ['fandom', 'dokkanInfo'],
      missions: ['dokkanInfo', 'fandom'],
      items: ['fandom', 'dokkanInfo']
    };
  }
  
  async updateFromWiki(dataTypes = null) {
    try {
      console.log('Starting wiki update process...');
      
      // Run parser discovery first
      await this.discoverAndCreateParsers();
      
      // Default to all data types if none specified
      const typesToUpdate = dataTypes || Object.keys(config.dataTypes);
      console.log(`Updating data types: ${typesToUpdate.join(', ')}`);
      
      const results = {};
      
      // Process each data type
      for (const dataType of typesToUpdate) {
        console.log(`Updating ${dataType}...`);
        
        // Check if cached data exists and is still valid
        const cachedData = await this.dataManager.getCachedData(dataType);
        const cacheTtl = config.dataTypes[dataType]?.cacheTtl || 3600000; // Default 1 hour
        
        if (cachedData && Date.now() - cachedData.timestamp < cacheTtl) {
          console.log(`Using cached ${dataType} data (age: ${Math.round((Date.now() - cachedData.timestamp)/1000)}s)`);
          results[dataType] = {
            count: cachedData.data.length,
            fromCache: true
          };
          continue;
        }
        
        // Get fresh data using appropriate method
        let data;
        switch (dataType) {
          case 'cards':
            data = await this.getLatestCardsFromBestSource();
            break;
          case 'events':
            data = await this.getEventsFromBestSource();
            break;
          case 'ezas':
            data = await this.getEZAsFromBestSource();
            break;
          case 'dokkanEvents':
            data = await this.getDokkanEventsFromBestSource();
            break;
          case 'storyEvents':
            data = await this.getStoryEventsFromBestSource();
            break;
          case 'missions':
            data = await this.getMissionsFromBestSource();
            break;
          case 'items':
            data = await this.getItemsFromBestSource();
            break;
          default:
            // For newly discovered types, use a generic fetching method
            data = await this.getGenericDataFromBestSource(dataType);
        }
        
        // Cache the fresh data
        if (data && data.length > 0) {
          await this.dataManager.cacheData(dataType, {
            data,
            timestamp: Date.now(),
            source: data.source || 'unknown'
          });
          
          results[dataType] = {
            count: data.length,
            fromCache: false,
            source: data.source || 'unknown'
          };
        } else {
          console.warn(`No ${dataType} data found`);
          results[dataType] = {
            count: 0,
            fromCache: false,
            error: 'No data found'
          };
        }
      }
      
      return {
        success: true,
        message: 'Wiki data updated successfully',
        results
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
      // Check for anniversary events using the best source
      const events = await this.getEventsFromBestSource();
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
  
  // Helper methods for each data type
  
  async getLatestCardsFromBestSource() {
    return await this.getDataFromPrioritizedSources('cards', async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getLatestCards();
      } else {
        return await this.dokkanScraper.getLatestCards();
      }
    });
  }
  
  async getEventsFromBestSource() {
    return await this.getDataFromPrioritizedSources('events', async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getEvents();
      } else {
        return await this.dokkanScraper.getEvents();
      }
    });
  }
  
  async getEZAsFromBestSource() {
    return await this.getDataFromPrioritizedSources('ezas', async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getEZAs();
      } else {
        return await this.dokkanScraper.getEZAs();
      }
    });
  }
  
  async getDokkanEventsFromBestSource() {
    return await this.getDataFromPrioritizedSources('dokkanEvents', async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getDokkanEvents();
      } else {
        return await this.dokkanScraper.getDokkanEvents();
      }
    });
  }
  
  async getStoryEventsFromBestSource() {
    return await this.getDataFromPrioritizedSources('storyEvents', async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getStoryEvents();
      } else {
        return await this.dokkanScraper.getStoryEvents();
      }
    });
  }
  
  async getMissionsFromBestSource() {
    return await this.getDataFromPrioritizedSources('missions', async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getMissions();
      } else {
        return await this.dokkanScraper.getMissions();
      }
    });
  }
  
  async getItemsFromBestSource() {
    return await this.getDataFromPrioritizedSources('items', async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getItems();
      } else {
        return await this.dokkanScraper.getItems();
      }
    });
  }
  
  // Generic method for new data types
  async getGenericDataFromBestSource(dataType) {
    return await this.getDataFromPrioritizedSources(dataType, async (source) => {
      if (source === 'fandom') {
        return await this.fandomAPI.getGenericData(dataType);
      } else {
        return await this.dokkanScraper.getGenericData(dataType);
      }
    });
  }
  
  // Generic method to get data from prioritized sources with fallback
  async getDataFromPrioritizedSources(dataType, fetchFn) {
    // Get the priority order for this data type
    const priorities = this.sourcePriorities[dataType];
    if (!priorities || priorities.length === 0) {
      throw new Error(`No source priorities defined for data type: ${dataType}`);
    }
    
    // Try each source in priority order
    let lastError = null;
    for (const source of priorities) {
      try {
        // Respect rate limiting
        await this.respectRateLimit(source);
        
        // Fetch data from this source
        console.log(`Fetching ${dataType} from ${source}...`);
        const rawData = await fetchFn(source);
        
        // Update last request time
        this.lastRequestTime[source] = Date.now();
        
        if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
          console.log(`No ${dataType} data found from ${source}, trying next source`);
          continue;
        }
        
        // Parse the data according to the data type
        const parsedData = this.parseData(dataType, rawData, source);
        
        // Add source metadata
        parsedData.source = source;
        parsedData.fetchTime = Date.now();
        
        return parsedData;
      } catch (error) {
        console.error(`Error fetching ${dataType} from ${source}:`, error);
        lastError = error;
        // Continue to next source as fallback
      }
    }
    
    // If we got here, all sources failed
    if (lastError) {
      throw new Error(`Failed to fetch ${dataType} from all sources: ${lastError.message}`);
    } else {
      throw new Error(`Failed to fetch ${dataType} from all sources`);
    }
  }
  
  // Parse data according to data type
  parseData(dataType, rawData, source) {
    // Get parser configuration for this data type
    const parserConfig = config.parsers[dataType] || config.parsers.default;
    
    // If raw data is not an array, wrap it
    const dataArray = Array.isArray(rawData) ? rawData : [rawData];
    
    // Apply parser to each item
    const parsedItems = dataArray.map(item => {
      // Check required fields
      if (parserConfig.requiredFields) {
        for (const field of parserConfig.requiredFields) {
          if (item[field] === undefined) {
            console.warn(`Missing required field '${field}' in ${dataType} item from ${source}`);
            // Add default value
            item[field] = this.getDefaultValueForField(field);
          }
        }
      }
      
      // Apply transformations
      if (parserConfig.transformations) {
        for (const [field, transform] of Object.entries(parserConfig.transformations)) {
          if (item[field] !== undefined) {
            try {
              item[field] = transform(item[field]);
            } catch (error) {
              console.warn(`Error transforming field '${field}' in ${dataType} item:`, error);
            }
          }
        }
      }
      
      return item;
    });
    
    return parsedItems;
  }
  
  // Get default value for a field based on common field types
  getDefaultValueForField(field) {
    // Common field names and their default values
    const defaults = {
      'id': '0',
      'name': 'Unknown',
      'title': 'Unknown',
      'description': '',
      'startDate': new Date(),
      'endDate': new Date(),
      'type': 'Unknown',
      'rarity': 'N',
      'card_id': '0',
      'atk': 0,
      'def': 0,
      'hp': 0,
      'stages': [],
      'missions': [],
      'items': []
    };
    
    // Return default value for known field or empty string
    return defaults[field] !== undefined ? defaults[field] : '';
  }
  
  // Learn and generate parser for new data type
  async learnParserForNewDataType(dataType, sampleData) {
    if (!sampleData || sampleData.length === 0) {
      console.warn(`Cannot learn parser for ${dataType}: no sample data provided`);
      return config.parsers.default;
    }
    
    console.log(`Learning parser for new data type: ${dataType}`);
    
    // Extract fields present in all items (potential required fields)
    const allFields = new Set();
    const commonFields = {};
    const fieldTypes = {};
    
    // First pass: collect all fields
    sampleData.forEach(item => {
      Object.keys(item).forEach(field => allFields.add(field));
    });
    
    // Initialize commonFields with all fields
    allFields.forEach(field => {
      commonFields[field] = 0;
    });
    
    // Count field occurrence and infer types
    sampleData.forEach(item => {
      allFields.forEach(field => {
        if (item[field] !== undefined) {
          commonFields[field]++;
          
          // Infer type if not already known
          if (!fieldTypes[field]) {
            const value = item[field];
            if (typeof value === 'number') {
              fieldTypes[field] = 'number';
            } else if (typeof value === 'boolean') {
              fieldTypes[field] = 'boolean';
            } else if (value instanceof Date) {
              fieldTypes[field] = 'date';
            } else if (Array.isArray(value)) {
              fieldTypes[field] = 'array';
            } else if (typeof value === 'string') {
              // Check if string can be parsed as date
              if (!isNaN(Date.parse(value))) {
                fieldTypes[field] = 'date';
              } else {
                fieldTypes[field] = 'string';
              }
            } else if (typeof value === 'object' && value !== null) {
              fieldTypes[field] = 'object';
            } else {
              fieldTypes[field] = 'string';
            }
          }
        }
      });
    });
    
    // Fields present in at least 75% of items are considered required
    const requiredFields = Object.entries(commonFields)
      .filter(([_, count]) => count >= sampleData.length * 0.75)
      .map(([field]) => field);
    
    // Create transformations based on inferred types
    const transformations = {};
    Object.entries(fieldTypes).forEach(([field, type]) => {
      switch (type) {
        case 'number':
          transformations[field] = value => {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
          };
          break;
        case 'boolean':
          transformations[field] = value => Boolean(value);
          break;
        case 'date':
          transformations[field] = value => {
            const date = new Date(value);
            return isNaN(date.getTime()) ? new Date() : date;
          };
          break;
        case 'array':
          transformations[field] = value => Array.isArray(value) ? value : [];
          break;
        case 'object':
          transformations[field] = value => (typeof value === 'object' && value !== null) ? value : {};
          break;
        default:
          transformations[field] = value => String(value || '');
      }
    });
    
    // Create new parser
    const newParser = {
      requiredFields,
      transformations
    };
    
    // Update config with new parser
    config.parsers[dataType] = newParser;
    
    console.log(`Created parser for ${dataType} with ${requiredFields.length} required fields`);
    return newParser;
  }
  
  // Discover new data types and create parsers for them
  async discoverAndCreateParsers() {
    console.log('Discovering and creating parsers for new data types...');
    
    try {
      // Get all available data types from both sources
      const fandomTypes = await this.fandomAPI.getAvailableDataTypes().catch(() => []);
      const dokkanInfoTypes = await this.dokkanScraper.getAvailableDataTypes().catch(() => []);
      
      // Combine and deduplicate
      const allTypes = [...new Set([...fandomTypes, ...dokkanInfoTypes])];
      
      // Find types without parsers
      const newTypes = allTypes.filter(type => !config.parsers[type]);
      
      console.log(`Discovered ${newTypes.length} new data types without parsers`);
      
      // Learn parsers for new types
      for (const type of newTypes) {
        try {
          // Get sample data for this type
          const sampleData = await this.getDataFromPrioritizedSources(type, async (source) => {
            if (source === 'fandom') {
              return await this.fandomAPI.getSample(type, 10);
            } else {
              return await this.dokkanScraper.getSample(type, 10);
            }
          });
          
          // Learn parser from sample data
          await this.learnParserForNewDataType(type, sampleData);
          
          // Add to data types config if not present
          if (!config.dataTypes[type]) {
            config.dataTypes[type] = { cacheTtl: 3600000 }; // Default 1 hour TTL
          }
        } catch (error) {
          console.error(`Error creating parser for ${type}:`, error);
        }
      }
      
      return newTypes;
    } catch (error) {
      console.error('Error discovering new data types:', error);
      return [];
    }
  }
  
  // Respect rate limits for each source
  async respectRateLimit(source) {
    const sourceConfig = config.wikiSources[source];
    if (!sourceConfig) return; // No config for this source, no rate limiting
    
    const lastRequest = this.lastRequestTime[source] || 0;
    const elapsed = Date.now() - lastRequest;
    const delay = sourceConfig.rateLimitMs - elapsed;
    
    if (delay > 0) {
      console.log(`Rate limiting: Waiting ${delay}ms before requesting from ${source}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Dynamic source prioritization based on data freshness
  async updateSourcePriorities() {
    console.log('Updating source priorities based on data freshness...');
    
    // For each data type, check sample data from each source and compare freshness
    for (const dataType of Object.keys(config.dataTypes)) {
      try {
        const freshness = {};
        
        // Check each source
        for (const source of Object.keys(config.wikiSources)) {
          try {
            await this.respectRateLimit(source);
            
            // Get a small sample of data to check freshness
            let sampleData;
            if (source === 'fandom') {
              sampleData = await this.fandomAPI.getSample(dataType, 5);
            } else {
              sampleData = await this.dokkanScraper.getSample(dataType, 5);
            }
            
            this.lastRequestTime[source] = Date.now();
            
            // Calculate freshness score based on update timestamps, version numbers, etc.
            const freshnessScore = this.calculateFreshnessScore(sampleData);
            freshness[source] = freshnessScore;
          } catch (error) {
            console.error(`Error checking freshness for ${dataType} from ${source}:`, error);
            freshness[source] = -1; // Error, lowest priority
          }
        }
        
        // Update priority order based on freshness scores (highest score = highest priority)
        const newPriorities = Object.entries(freshness)
          .filter(([key1, score]) => score >= 0) // Filter out error cases
          .sort(([key1, scoreA], [key2, scoreB]) => scoreB - scoreA) // Sort by descending score
          .map(([source, score]) => source); // Extract just the source names
        
        if (newPriorities.length > 0) {
          this.sourcePriorities[dataType] = newPriorities;
          console.log(`Updated priority for ${dataType}: ${newPriorities.join(' > ')}`);
        }
      } catch (error) {
        console.error(`Error updating priorities for ${dataType}:`, error);
        // Keep existing priorities
      }
    }
  }
  
  // Calculate a "freshness" score for data to determine the most up-to-date source
  calculateFreshnessScore(data) {
    if (!data || data.length === 0) return 0;
    
    let score = 0;
    
    // Check for update timestamps
    const timestamps = data
      .filter(item => item.updatedAt || item.lastModified)
      .map(item => new Date(item.updatedAt || item.lastModified).getTime());
    
    if (timestamps.length > 0) {
      // Average update time as a score component
      const avgTimestamp = timestamps.reduce((sum, ts) => sum + ts, 0) / timestamps.length;
      score += avgTimestamp / 1000000; // Scale down to reasonable number
    }
    
    // Check for version numbers
    const versions = data
      .filter(item => item.version)
      .map(item => parseFloat(item.version));
    
    if (versions.length > 0) {
      // Average version number as a score component
      const avgVersion = versions.reduce((sum, v) => sum + v, 0) / versions.length;
      score += avgVersion * 1000; // Weight versions heavily
    }
    
    // Check for data completeness (more fields = better score)
    const completeness = data
      .map(item => Object.keys(item).length)
      .reduce((sum, count) => sum + count, 0) / data.length;
    
    score += completeness * 10;
    
    return score;
  }
}

module.exports = WikiUpdater;