// lib/dokkan-scraper.js
const cheerio = require('cheerio');
const fetch = require('node-fetch');

class DokkanScraper {
  constructor(baseUrl = 'https://dokkaninfo.com') {
    this.baseUrl = baseUrl;
  }

  async fetchPage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return response.text();
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  async scrapeCardData(cardId) {
    const html = await this.fetchPage(`${this.baseUrl}/cards/${cardId}`);
    const $ = cheerio.load(html);

    return {
      name: $('.card-name').text().trim(),
      type: $('.card-type').text().trim(),
      rarity: $('.card-rarity').text().trim(),
      cost: $('.card-cost').text().trim(),
      category: $('.card-category').text().trim(),
      leader_skill: {
        name: $('.leader-skill-name').text().trim(),
        description: $('.leader-skill-desc').text().trim()
      },
      passive_skill: {
        name: $('.passive-skill-name').text().trim(),
        description: $('.passive-skill-desc').text().trim()
      },
      super_attack: {
        name: $('.super-attack-name').text().trim(),
        description: $('.super-attack-desc').text().trim()
      },
      links: $('.link-skill').map((_, el) => $(el).text().trim()).get(),
      categories: $('.category').map((_, el) => $(el).text().trim()).get(),
      stats: {
        hp: $('.stat-hp').text().trim(),
        atk: $('.stat-atk').text().trim(),
        def: $('.stat-def').text().trim()
      }
    };
  }

  async getLatestCards() {
    const html = await this.fetchPage(`${this.baseUrl}/cards`);
    const $ = cheerio.load(html);

    return $('.card-preview').map((_, el) => ({
      id: $(el).data('card-id'),
      name: $(el).find('.preview-name').text().trim(),
      type: $(el).find('.preview-type').text().trim()
    })).get();
  }

  async getEvents() {
    const html = await this.fetchPage(`${this.baseUrl}/events`);
    const $ = cheerio.load(html);

    return $('.event-item').map((_, el) => ({
      name: $(el).find('.event-name').text().trim(),
      date: $(el).find('.event-date').text().trim(),
      description: $(el).find('.event-desc').text().trim()
    })).get();
  }
}

module.exports = DokkanScraper;