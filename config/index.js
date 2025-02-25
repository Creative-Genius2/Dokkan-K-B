// config/index.js
module.exports = {
  server: {
    port: process.env.PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  
  cache: {
    ttl: 3600000 // 1 hour in milliseconds
  },
  
  apis: {
    dokkan: {
      baseUrl: 'https://dokkaninfo.com'
    },
    
    fandom: {
      baseUrl: 'https://dbz-dokkanbattle.fandom.com'
    }
  }
};