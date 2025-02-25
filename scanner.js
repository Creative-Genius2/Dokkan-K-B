// scanner.js
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs').promises;

class DokkanSiteScanner {
  constructor(config) {
    this.config = config;
    this.visited = new Set();
    this.updates = new Map();
    this.baseUrls = {
      dokkanInfo: 'https://dokkaninfo.com',
      wiki: 'https://dbz-dokkanbattle.fandom.com'
    };
    this.scanInterval = 30 * 60 * 1000; // 30 minutes
  }

  async start() {
    try {
      await this.scan();
      setInterval(() => this.scan(), this.scanInterval);
    } catch (error) {
      console.error('Scanner error:', error);
      throw error;
    }
  }

  async scan() {
    try {
      const results = await Promise.all([
        this.scanSite(this.baseUrls.dokkanInfo),
        this.scanSite(this.baseUrls.wiki)
      ]);
      return results;
    } catch (error) {
      console.error('Scan error:', error);
      throw error;
    }
  }

  async scanSite(baseUrl) {
    try {
      const response = await fetch(baseUrl);
      const html = await response.text();
      const $ = cheerio.load(html);

      // Parse based on site type
      const data = baseUrl.includes('dokkaninfo') ? 
        this.parseDokkanInfo($) : 
        this.parseWiki($);

      await this.saveData(baseUrl, data);
      return data;
    } catch (error) {
      console.error(`Error scanning ${baseUrl}:`, error);
      throw error;
    }
  }

  parseDokkanInfo($) {
    return {
      cards: $('.card-container').map((_, el) => ({
        name: $(el).find('.card-name').text().trim(),
        type: $(el).find('.card-type').text().trim(),
        category: $(el).find('.card-category').text().trim(),
        timestamp: new Date()
      })).get(),
      events: $('.event-container').map((_, el) => ({
        name: $(el).find('.event-name').text().trim(),
        date: $(el).find('.event-date').text().trim(),
        timestamp: new Date()
      })).get()
    };
  }

  parseWiki($) {
    return {
      cards: $('.card-article').map((_, el) => ({
        name: $(el).find('.card-title').text().trim(),
        passive: $(el).find('.passive-skill').text().trim(),
        leader: $(el).find('.leader-skill').text().trim(),
        timestamp: new Date()
      })).get(),
      categories: $('.category-page').map((_, el) => ({
        name: $(el).find('.category-name').text().trim(),
        units: $(el).find('.category-units').text().trim(),
        timestamp: new Date()
      })).get()
    };
  }

  async saveData(baseUrl, data) {
    try {
      const filename = this.getDataFilename(baseUrl);
      const filepath = path.join(process.env.APPDATA, 'Claude', 'dokkan-mcp', 'data', filename);
      
      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Save data
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      
      // Update scan status
      await this.updateScanStatus();
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  async updateScanStatus() {
    try {
      const statusPath = path.join(process.env.APPDATA, 'Claude', 'dokkan-mcp', 'status.json');
      await fs.writeFile(statusPath, JSON.stringify({
        lastScan: new Date(),
        sitesScanned: Array.from(this.visited),
        updateCount: this.updates.size
      }, null, 2));
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  }

  getDataFilename(url) {
    const parsed = new URL(url);
    return `${parsed.hostname}.json`;
  }
}

module.exports = DokkanSiteScanner;
