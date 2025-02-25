// lib/data-manager.js
const fs = require('fs').promises;
const path = require('path');

class DataManager {
  constructor(basePath) {
    this.basePath = basePath;
    this.cachePath = path.join(basePath, 'data', 'cache');
  }

  async init() {
    await fs.mkdir(this.cachePath, { recursive: true });
  }

  async cacheData(key, data) {
    const filepath = path.join(this.cachePath, `${key}.json`);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  async getCachedData(key) {
    try {
      const filepath = path.join(this.cachePath, `${key}.json`);
      const data = await fs.readFile(filepath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async clearCache() {
    const files = await fs.readdir(this.cachePath);
    await Promise.all(
      files.map(file => fs.unlink(path.join(this.cachePath, file)))
    );
  }
}

module.exports = DataManager;