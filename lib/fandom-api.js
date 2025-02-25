// lib/fandom-api.js
const fetch = require('node-fetch');

class FandomAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.endpoint = '/wikia.php';
    this.format = 'json';
  }

  async getData(controller, method, params = {}) {
    try {
      const queryParams = new URLSearchParams({
        controller: controller.endsWith('Controller') ? controller : `${controller}Controller`,
        method,
        format: this.format,
        ...params
      });

      const url = `${this.baseUrl}${this.endpoint}?${queryParams}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Fandom API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Fandom API error:', error);
      throw error;
    }
  }

  async getCardDetails(cardId) {
    return this.getData('Articles', 'asJson', { id: cardId });
  }

  async searchCards(query) {
    return this.getData('SearchApi', 'search', { 
      query,
      namespaces: '0',
      limit: '25'
    });
  }

  async getCategories() {
    return this.getData('ArticlesApi', 'getList', {
      category: 'Cards',
      limit: '50'
    });
  }

  async getControllerHelp(controller) {
    return this.getData(controller, 'help');
  }
}

module.exports = FandomAPI;