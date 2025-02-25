/**
 * cardAnalysis.js - Combined module for Dokkan Battle card analysis
 * 
 * Combines functionality from:
 * - cardStatCalculations.js: ATK/DEF calculation with proper order of operations
 * - customCardComparison.js: Compare custom cards against the meta
 * - metaAnalysis.js: Analysis of current meta trends
 */

const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');

// Local data cache
let metaCardsCache = null;
let metaTrendsCache = null;

//=============================================================================
// CARD STAT CALCULATIONS SECTION
//=============================================================================

// Order of Operations for DEF:
// 1. Leader Skill
// 2. Start of Turn + Support
// 3. Links
// 4. Support memory
// 5. Items
// 6. Active Skills / Intros
// 7. On SA Passive/Mid-Turn Buffs
// 8. SA effect

// Order of Operations for ATK:
// 1. Leader Skill
// 2. Start of Turn + Support
// 3. Links
// 4. Support memory
// 5. Items
// 6. Active Skills / Intros
// 7. Ki multiplier: related to how much ki you have
// 8. On SA passive/Mid-Turn Buffs
// 9. SA multiplier and effect: SA multiplier takes into account the SA Boost level

/**
 * Calculate DEF stat following official order of operations
 * 
 * @param {Object} card - The card data containing base stats
 * @param {Object} buffs - Object containing all applicable buffs
 * @returns {Number} Final calculated DEF value
 */
function calculateDEF(card, buffs = {}) {
  // Get base DEF stat
  let def = card.def || 0;
  
  // 1. Apply Leader Skill buff
  const leaderSkillBuff = (buffs.leaderSkill1 || 0) + (buffs.leaderSkill2 || 0);
  def *= (1 + leaderSkillBuff);
  
  // 2. Apply Start of Turn + Support buffs
  const sotBuff = (buffs.startOfTurn || 0) + (buffs.support || 0);
  def *= (1 + sotBuff);
  
  // 3. Apply Link Skill buffs
  const linkBuff = buffs.links || 0;
  def *= (1 + linkBuff);
  
  // 4. Apply Support Memory buffs
  const supportMemoryBuff = buffs.supportMemory || 0;
  def *= (1 + supportMemoryBuff);
  
  // 5. Apply Item buffs
  const itemBuff = buffs.items || 0;
  def *= (1 + itemBuff);
  
  // 6. Apply Active Skills / Intros
  const activeSkillBuff = buffs.activeSkill || 0;
  def *= (1 + activeSkillBuff);
  
  // 7. Apply On SA Passive/Mid-Turn Buffs
  const midTurnBuff = buffs.midTurn || 0;
  def *= (1 + midTurnBuff);
  
  // 8. Apply SA Effect
  const saEffectBuff = buffs.saEffect || 0;
  const stackBuff = (buffs.stacks || 0) * (buffs.stackValue || 0.2);
  def *= (1 + saEffectBuff + stackBuff);
  
  return Math.floor(def);
}

/**
 * Calculate ATK stat following official order of operations
 * 
 * @param {Object} card - The card data containing base stats
 * @param {Object} buffs - Object containing all applicable buffs
 * @param {Number} ki - Current ki value for ki multiplier calculation
 * @returns {Number} Final calculated ATK value
 */
function calculateATK(card, buffs = {}, ki = 12) {
  // Get base ATK stat
  let atk = card.atk || 0;
  
  // 1. Apply Leader Skill buff
  const leaderSkillBuff = (buffs.leaderSkill1 || 0) + (buffs.leaderSkill2 || 0);
  atk *= (1 + leaderSkillBuff);
  
  // 2. Apply Start of Turn + Support buffs
  const sotBuff = (buffs.startOfTurn || 0) + (buffs.support || 0);
  atk *= (1 + sotBuff);
  
  // 3. Apply Link Skill buffs
  const linkBuff = buffs.links || 0;
  atk *= (1 + linkBuff);
  
  // 4. Apply Support Memory buffs
  const supportMemoryBuff = buffs.supportMemory || 0;
  atk *= (1 + supportMemoryBuff);
  
  // 5. Apply Item buffs
  const itemBuff = buffs.items || 0;
  atk *= (1 + itemBuff);
  
  // 6. Apply Active Skills / Intros
  const activeSkillBuff = buffs.activeSkill || 0;
  atk *= (1 + activeSkillBuff);
  
  // 7. Apply Ki Multiplier
  // Use card-specific multiplier if provided, otherwise use defaults
  let kiMultiplier = getKiMultiplier(card, ki, buffs.isLR);
  atk *= (1 + kiMultiplier);
  
  // 8. Apply On SA passive/Mid-Turn Buffs
  const midTurnBuff = buffs.midTurn || 0;
  atk *= (1 + midTurnBuff);
  
  // 9. Apply SA Multiplier and effect
  const saMultiplier = getSAMultiplier(card, ki, buffs);
  const saEffectBuff = buffs.saEffect || 0;
  const stackBuff = (buffs.stacks || 0) * (buffs.stackValue || 0.2);
  atk *= (1 + saMultiplier + saEffectBuff + stackBuff);
  
  return Math.floor(atk);
}

/**
 * Calculate Ki Multiplier based on card type and ki level
 * 
 * @param {Object} card - Card data object
 * @param {Number} ki - Current ki amount
 * @param {Boolean} isLR - Whether the card is an LR
 * @returns {Number} Ki multiplier value (without the +1)
 */
function getKiMultiplier(card, ki, isLR = false) {
  // If card has a custom ki multiplier function, use it
  if (card.kiMultiplier) {
    return card.kiMultiplier(ki);
  }
  
  // Default ki multipliers
  if (isLR) {
    // LR cards
    if (ki >= 24) return 2.0; // 200% at 24 ki
    return 1.0 + ((ki - 12) * (1.0 / 12)); // Linear scale from 100% to 200%
  } else {
    // DFE/TUR cards - typically 150% at 12 ki
    return 1.5;
  }
}

/**
 * Calculate SA Multiplier based on card type, SA level, and ki
 * 
 * @param {Object} card - Card data object
 * @param {Number} ki - Current ki amount
 * @param {Object} buffs - Buff information including SA boost levels
 * @returns {Number} SA Multiplier value (without the +1)
 */
function getSAMultiplier(card, ki, buffs) {
  const saLevel = buffs.saLevel || 10;
  const saBoost = Math.min((buffs.saBoost || 0), 75) / 100; // Max 75% without equips
  
  // If card has a custom SA multiplier function, use it
  if (card.saMultiplier) {
    return card.saMultiplier(ki, saLevel) + saBoost;
  }
  
  let baseMultiplier = 0;
  
  if (buffs.isLR) {
    // LR SA multipliers
    if (saLevel >= 20) {
      if (buffs.isEZA && saLevel >= 25) {
        // EZA LR at SA 25
        baseMultiplier = (ki >= 24) ? 6.2 : 4.5; // 620% at 24 ki, 450% at 12-18 ki
      } else {
        // Non-EZA LR at SA 20
        baseMultiplier = (ki >= 24) ? 5.7 : 4.25; // 570% at 24 ki, 425% at 12-18 ki
      }
    }
  } else {
    // DFE/TUR SA multipliers
    if (buffs.isEZA && saLevel >= 15) {
      baseMultiplier = 6.3; // 630% for EZA at SA 15
    } else {
      baseMultiplier = 5.05; // 505% for non-EZA at SA 10
    }
  }
  
  // Add SA boost level
  return baseMultiplier + saBoost;
}

/**
 * Example function to calculate DEF for TEQ Gods with example values
 * Matching the example in the guide
 */
function exampleTEQGodsDefCalculation() {
  const teqGods = {
    def: 13169
  };
  
  const buffs = {
    leaderSkill1: 2.0,
    leaderSkill2: 2.0,
    startOfTurn: 1.77,
    support: 0.4,
    links: 0.05,
    saEffect: 1.1,
    stacks: 5,
    stackValue: 0.2,
    midTurn: 0.5
  };
  
  const result = calculateDEF(teqGods, buffs);
  console.log(`TEQ Gods DEF calculation: ${result}`);
  
  // Expected result: approximately 767,074
  return result;
}

/**
 * Example function to calculate ATK for LR INT SSJ Trio with example values
 * Matching the example in the guide
 */
function exampleLRSSJTrioAtkCalculation() {
  const ssJTrio = {
    atk: 17555
  };
  
  const buffs = {
    leaderSkill1: 2.0,
    leaderSkill2: 2.0,
    startOfTurn: 1.8,
    support: 0.8,
    links: 0.37,
    activeSkill: 1.3,
    midTurn: 0.0,
    saEffect: 0.5,
    stacks: 5,
    stackValue: 0.5,
    isLR: true,
    saLevel: 20,
    saBoost: 75
  };
  
  // Calculate with 24 ki (LR with max ki)
  const result = calculateATK(ssJTrio, buffs, 24);
  console.log(`LR INT SSJ Trio ATK calculation: ${result}`);
  
  // Expected result: approximately 45-46 million
  return result;
}

//=============================================================================
// CUSTOM CARD COMPARISON SECTION
//=============================================================================

/**
 * Compare a custom card to the current meta
 * @param {Object} customCard - Custom card data provided by the user
 * @param {Object} options - Comparison options
 * @returns {Object} Comparison results and analysis
 */
async function compareCardToMeta(customCard, options = {}) {
  // Get meta cards for comparison
  const metaCards = await getMetaCards(options.category || 'all');
  
  // Calculate custom card's stats with provided buffs
  const customCardStats = {
    atk: calculateATK(customCard, options.buffs || {}, options.ki || 12),
    def: calculateDEF(customCard, options.buffs || {})
  };
  
  // Compare the custom card to each meta card
  const comparisons = metaCards.map(metaCard => {
    // Calculate meta card's stats with same buff conditions
    const metaCardStats = {
      atk: calculateATK(metaCard, options.buffs || {}, options.ki || 12),
      def: calculateDEF(metaCard, options.buffs || {})
    };
    
    // Calculate percentage differences
    const atkDiff = ((customCardStats.atk / metaCardStats.atk) - 1) * 100;
    const defDiff = ((customCardStats.def / metaCardStats.def) - 1) * 100;
    
    return {
      metaCard: metaCard.name,
      atkComparison: {
        customAtk: customCardStats.atk,
        metaAtk: metaCardStats.atk,
        percentDifference: atkDiff.toFixed(2) + '%',
        isStronger: atkDiff > 0
      },
      defComparison: {
        customDef: customCardStats.def,
        metaDef: metaCardStats.def,
        percentDifference: defDiff.toFixed(2) + '%',
        isStronger: defDiff > 0
      }
    };
  });
  
  // Analyze the overall positioning
  const atkRanking = calculateRanking(customCardStats.atk, metaCards.map(card => 
    calculateATK(card, options.buffs || {}, options.ki || 12)));
  
  const defRanking = calculateRanking(customCardStats.def, metaCards.map(card => 
    calculateDEF(card, options.buffs || {})));
  
  // Estimate which year/meta this card would belong to
  const estimatedYear = estimateCardYear(customCardStats, options);
  
  return {
    customCard: customCard.name,
    stats: customCardStats,
    comparisons,
    atkRanking,
    defRanking,
    estimatedYear,
    totalMetaCards: metaCards.length
  };
}

/**
 * Calculate percentile ranking of a stat among comparable stats
 * @param {Number} stat - The stat value to rank
 * @param {Array} comparisonStats - Array of stat values to compare against
 * @returns {Object} Ranking information
 */
function calculateRanking(stat, comparisonStats) {
  // Sort stats from highest to lowest
  const sortedStats = [...comparisonStats].sort((a, b) => b - a);
  
  // Find position of our stat in the sorted list
  let position = 0;
  while (position < sortedStats.length && stat < sortedStats[position]) {
    position++;
  }
  
  // Calculate percentile (higher is better)
  const percentile = ((sortedStats.length - position) / sortedStats.length) * 100;
  
  return {
    position: position + 1, // 1-based position
    totalCards: sortedStats.length + 1, // +1 for our card
    percentile: percentile.toFixed(2) + '%',
    tier: getTierFromPercentile(percentile)
  };
}

/**
 * Get tier classification based on percentile
 * @param {Number} percentile - Percentile value
 * @returns {String} Tier classification
 */
function getTierFromPercentile(percentile) {
  if (percentile >= 95) return 'Z+ Tier (Top of Meta)';
  if (percentile >= 90) return 'Z Tier (Meta Defining)';
  if (percentile >= 80) return 'S+ Tier (Excellent)';
  if (percentile >= 70) return 'S Tier (Very Strong)';
  if (percentile >= 60) return 'A+ Tier (Strong)';
  if (percentile >= 50) return 'A Tier (Good)';
  if (percentile >= 40) return 'B+ Tier (Above Average)';
  if (percentile >= 30) return 'B Tier (Average)';
  if (percentile >= 20) return 'C+ Tier (Below Average)';
  if (percentile >= 10) return 'C Tier (Weak)';
  return 'D Tier (Very Weak)';
}

/**
 * Estimate which year/meta this card would belong to based on stats
 * @param {Object} stats - ATK and DEF stats
 * @param {Object} options - Additional options
 * @returns {Object} Estimated year and meta information
 */
function estimateCardYear(stats, options) {
  // Stats benchmarks for different years (simplified)
  const yearBenchmarks = [
    { year: 9, atk: 20000000, def: 700000 }, // Year 9 (2024)
    { year: 8, atk: 15000000, def: 600000 }, // Year 8 (2023)
    { year: 7, atk: 10000000, def: 500000 }, // Year 7 (2022)
    { year: 6, atk: 7000000, def: 400000 },  // Year 6 (2021)
    { year: 5, atk: 5000000, def: 300000 },  // Year 5 (2020)
    { year: 4, atk: 3000000, def: 200000 },  // Year 4 (2019)
    { year: 3, atk: 2000000, def: 150000 }   // Year 3 (2018)
  ];
  
  // Calculate a score based on both ATK and DEF
  const atkScore = stats.atk / 1000000; // Weight in millions
  const defScore = stats.def / 100000;  // Weight in hundred thousands
  const totalScore = (atkScore * 0.6) + (defScore * 0.4); // 60% ATK, 40% DEF weighting
  
  // Find the appropriate year
  for (const benchmark of yearBenchmarks) {
    const benchmarkScore = (benchmark.atk / 1000000 * 0.6) + (benchmark.def / 100000 * 0.4);
    if (totalScore >= benchmarkScore * 0.85) { // Allow for some flexibility
      return {
        year: benchmark.year,
        meta: `Year ${benchmark.year} Meta (${2015 + benchmark.year})`,
        description: getYearDescription(benchmark.year)
      };
    }
  }
  
  // If below all benchmarks, return Year 2 or earlier
  return {
    year: 2,
    meta: 'Year 2 Meta or earlier (2017 or earlier)',
    description: 'This card would be considered outdated by today\'s standards.'
  };
}

/**
 * Get description of the Dokkan meta for a specific year
 * @param {Number} year - Game year number
 * @returns {String} Meta description
 */
function getYearDescription(year) {
  const descriptions = {
    9: 'Ultra Modern Meta: Top-tier cards are very powerful in both offense and defense with various built-in mechanics like dodge, guard, and damage reduction.',
    8: 'Modern Meta: Cards are expected to have high ATK and DEF with multiple additional abilities.',
    7: 'Red Zone Era: Defense became increasingly important with 500k+ DEF often needed for difficult content.',
    6: 'Post-Anniversary Meta: Cards started having significantly higher stats and more complex passives.',
    5: 'Category Meta Evolution: Leader skills for categories became more powerful.',
    4: 'Category Meta Establishment: Category teams became the standard.',
    3: 'Early Category Meta: Introduction of category-based teams.'
  };
  
  return descriptions[year] || 'Early Dokkan Meta';
}

/**
 * Parse custom card data from text format into structured object
 * @param {String} cardText - Raw text representation of the card
 * @returns {Object} Structured card data object
 */
function parseCustomCard(cardText) {
  const lines = cardText.split('\n');
  const card = { links: [], categories: [] };
  
  lines.forEach(line => {
    // Skip empty lines
    if (!line.trim()) return;
    
    if (line.includes(':')) {
      const [key, value] = line.split(':').map(part => part.trim());
      
      switch (key.toLowerCase()) {
        case 'name':
          card.name = value;
          break;
        case 'type':
          card.type = value.toUpperCase();
          break;
        case 'rarity':
          card.rarity = value.toUpperCase();
          card.isLR = value.toUpperCase() === 'LR';
          break;
        case 'leader skill':
          card.leaderSkill = value;
          break;
        case 'passive skill':
          card.passiveSkill = value;
          break;
        case 'super attack':
          card.superAttack = value;
          break;
        case 'links':
          card.links = value.split(',').map(link => link.trim());
          break;
        case 'categories':
          card.categories = value.split(',').map(category => category.trim());
          break;
        case 'hp':
          card.hp = parseInt(value, 10);
          break;
        case 'atk':
          card.atk = parseInt(value, 10);
          break;
        case 'def':
          card.def = parseInt(value, 10);
          break;
      }
    }
  });
  
  return card;
}

//=============================================================================
// META ANALYSIS SECTION
//=============================================================================

/**
 * Get meta cards for a specific category or 'all' categories
 * @param {String} category - Category name or 'all'
 * @returns {Array} Array of meta card data objects
 */
async function getMetaCards(category = 'all') {
  // Load cache if not already loaded
  if (!metaCardsCache) {
    await loadMetaCardsData();
  }
  
  // Return all meta cards if no specific category requested
  if (category === 'all') {
    return metaCardsCache;
  }
  
  // Filter by category
  return metaCardsCache.filter(card => 
    card.categories && card.categories.some(cat => 
      cat.toLowerCase() === category.toLowerCase()
    )
  );
}

/**
 * Get current meta trends analysis
 * @returns {Object} Meta trend analysis
 */
async function getMetaTrends() {
  // Load trends data if not already loaded
  if (!metaTrendsCache) {
    await loadMetaTrendsData();
  }
  
  return metaTrendsCache;
}

/**
 * Load meta cards data from local file or API
 * @returns {Promise<void>}
 */
async function loadMetaCardsData() {
  try {
    // Check if we have a local cache file
    const dataPath = path.join(__dirname, '..', 'data', 'meta-cards.json');
    
    if (fsSync.existsSync(dataPath)) {
      const fileData = await fs.readFile(dataPath, 'utf8');
      metaCardsCache = JSON.parse(fileData);
    } else {
      // If no local data, use default sample data
      metaCardsCache = getDefaultMetaCards();
      
      // Ensure data directory exists
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fsSync.existsSync(dataDir)) {
        await fs.mkdir(dataDir, { recursive: true });
      }
      
      // Save default data for future use
      await fs.writeFile(dataPath, JSON.stringify(metaCardsCache, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error loading meta cards data:', error);
    // Fall back to default data
    metaCardsCache = getDefaultMetaCards();
  }
}

/**
 * Load meta trends data from local file or API
 * @returns {Promise<void>}
 */
async function loadMetaTrendsData() {
  try {
    // Check if we have a local cache file
    const dataPath = path.join(__dirname, '..', 'data', 'meta-trends.json');
    
    if (fsSync.existsSync(dataPath)) {
      const fileData = await fs.readFile(dataPath, 'utf8');
      metaTrendsCache = JSON.parse(fileData);
    } else {
      // If no local data, use default sample data
      metaTrendsCache = getDefaultMetaTrends();
      
      // Ensure data directory exists
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fsSync.existsSync(dataDir)) {
        await fs.mkdir(dataDir, { recursive: true });
      }
      
      // Save default data for future use
      await fs.writeFile(dataPath, JSON.stringify(metaTrendsCache, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error loading meta trends data:', error);
    // Fall back to default data
    metaTrendsCache = getDefaultMetaTrends();
  }
}

/**
 * Provides default meta card data if no external data is available
 * @returns {Array} Array of meta card data objects
 */
function getDefaultMetaCards() {
  return [
    {
      name: "LR Beast Gohan",
      type: "TEQ",
      rarity: "LR",
      isLR: true,
      hp: 23455,
      atk: 22675,
      def: 13398,
      categories: ["Hybrid Saiyans", "Movie Heroes", "Bond of Master and Disciple"],
      saLevel: 25,
      isEZA: true,
      links: ["Saiyan Lineage", "Shocking Speed", "Fierce Battle", "Legendary Power"]
    },
    {
      name: "LR Super Saiyan Blue Gogeta",
      type: "STR",
      rarity: "LR",
      isLR: true,
      hp: 24568,
      atk: 23742,
      def: 12734,
      categories: ["Fusion", "Movie Heroes", "Realm of Gods", "Potara"],
      saLevel: 20,
      isEZA: false,
      links: ["Super Saiyan", "Fused Fighter", "Prepared for Battle", "Legendary Power"]
    },
    {
      name: "TEQ Gods (Goku & Vegeta)",
      type: "TEQ",
      rarity: "LR",
      isLR: true,
      hp: 23850,
      atk: 22135,
      def: 13169,
      categories: ["Movie Heroes", "Pure Saiyans", "Joined Forces"],
      saLevel: 20,
      isEZA: false,
      links: ["Godly Power", "Warrior Gods", "Prepared for Battle", "Legendary Power"]
    },
    {
      name: "LR INT SSJ Trio",
      type: "INT",
      rarity: "LR",
      isLR: true,
      hp: 21984,
      atk: 17555,
      def: 12321,
      categories: ["Pure Saiyans", "Movie Heroes", "Joined Forces"],
      saLevel: 20,
      isEZA: false,
      links: ["Super Saiyan", "Kamehameha", "Prepared for Battle", "Legendary Power"]
    },
    {
      name: "LR STR Super Vegito",
      type: "STR",
      rarity: "LR",
      isLR: true,
      hp: 23546,
      atk: 19875,
      def: 10987,
      categories: ["Potara", "Final Trump Card", "Battle of Wits"],
      saLevel: 25,
      isEZA: true,
      links: ["Power Bestowed by God", "Fused Fighter", "Fierce Battle", "Legendary Power"]
    }
  ];
}

/**
 * Provides default meta trends data if no external data is available
 * @returns {Object} Meta trend analysis data
 */
function getDefaultMetaTrends() {
  return {
    currentYear: 9,
    averageStats: {
      year9: { atk: 18500000, def: 700000 },
      year8: { atk: 15000000, def: 600000 },
      year7: { atk: 10000000, def: 500000 },
      year6: { atk: 7000000, def: 400000 }
    },
    metaFeatures: {
      year9: ["Guard", "Damage Reduction", "Dodge", "Multi-Stage Transformations"],
      year8: ["High DEF Stacking", "Super Type Advantage", "Built-in Additional Supers"],
      year7: ["DEF Stacking", "Active Skill Attack", "Revival Skills"],
      year6: ["Unit Super Attacks", "Exchange Mechanics", "Transformation Conditions"]
    }
  };
}

/**
 * Analyze a custom card against the current meta
 * @param {Object} customCard - Custom card data
 * @param {Object} calculatedStats - Stats from calculations
 * @returns {Object} Analysis results
 */
async function analyzeCard(customCard, calculatedStats) {
  // Ensure meta data is loaded
  if (!metaCardsCache) {
    await loadMetaCardsData();
  }
  
  if (!metaTrendsCache) {
    await loadMetaTrendsData();
  }
  
  // Get current year meta averages
  const currentYearKey = `year${metaTrendsCache.currentYear}`;
  const currentMeta = metaTrendsCache.averageStats[currentYearKey];
  
  // Calculate percentages against current meta
  const atkPercentage = (calculatedStats.atk / currentMeta.atk) * 100;
  const defPercentage = (calculatedStats.def / currentMeta.def) * 100;
  
  // Determine which features the card has
  const currentMetaFeatures = metaTrendsCache.metaFeatures[currentYearKey];
  const hasFeatures = currentMetaFeatures.filter(feature => 
    customCard.passiveSkill && customCard.passiveSkill.toLowerCase().includes(feature.toLowerCase()) ||
    customCard.superAttack && customCard.superAttack.toLowerCase().includes(feature.toLowerCase())
  );
  
  return {
    atkAnalysis: {
      value: calculatedStats.atk,
      currentMetaAverage: currentMeta.atk,
      percentageOfMeta: atkPercentage.toFixed(2) + '%',
      status: getStatusFromPercentage(atkPercentage)
    },
    defAnalysis: {
      value: calculatedStats.def,
      currentMetaAverage: currentMeta.def,
      percentageOfMeta: defPercentage.toFixed(2) + '%',
      status: getStatusFromPercentage(defPercentage)
    },
    featureAnalysis: {
      currentMetaFeatures,
      presentFeatures: hasFeatures,
      missingFeatures: currentMetaFeatures.filter(f => !hasFeatures.includes(f)),
      featuresScore: (hasFeatures.length / currentMetaFeatures.length) * 100
    },
    overallAssessment: getOverallAssessment(atkPercentage, defPercentage, hasFeatures.length / currentMetaFeatures.length)
  };
}

/**
 * Get status description based on percentage of meta average
 * @param {Number} percentage - Percentage value
 * @returns {String} Status description
 */
function getStatusFromPercentage(percentage) {
  if (percentage >= 120) return 'Exceptional (Above Meta)';
  if (percentage >= 100) return 'Strong (Meta Level)';
  if (percentage >= 80) return 'Good (Slightly Below Meta)';
  if (percentage >= 60) return 'Average (Below Meta)';
  if (percentage >= 40) return 'Weak (Significantly Below Meta)';
  return 'Poor (Outdated)';
}

/**
 * Get overall assessment of a card
 * @param {Number} atkPercentage - ATK percentage of meta
 * @param {Number} defPercentage - DEF percentage of meta
 * @param {Number} featureRatio - Ratio of meta features present
 * @returns {String} Overall assessment
 */
function getOverallAssessment(atkPercentage, defPercentage, featureRatio) {
  // Weight the factors (adjust as needed)
  const weightedScore = (atkPercentage * 0.4) + (defPercentage * 0.4) + (featureRatio * 100 * 0.2);
  
  if (weightedScore >= 120) return 'This card would be considered meta-defining in the current game state.';
  if (weightedScore >= 100) return 'This card would perform very well in the current meta.';
  if (weightedScore >= 80) return 'This card would be viable in the current meta but not top-tier.';
  if (weightedScore >= 60) return 'This card would struggle in difficult content in the current meta.';
  return 'This card would be considered outdated in the current meta.';
}

/**
 * Update meta data with latest information from wiki
 * @param {Object} wikiUpdater - WikiUpdater instance
 * @returns {Promise<Object>} Update status
 */
async function updateMetaData(wikiUpdater) {
  try {
    // Get latest cards from wiki
    const latestCards = await wikiUpdater.getLatestCardsFromBestSource();
    
    if (!latestCards || latestCards.length === 0) {
      return {
        success: false,
        message: 'No card data received from wiki'
      };
    }
    
    // Process cards to extract meta cards
    const metaCards = latestCards
      .filter(card => card.isMetaRelevant || card.rarity === 'LR' || (card.rarity === 'UR' && card.isEZA))
      .map(card => ({
        name: card.name,
        type: card.type,
        rarity: card.rarity,
        isLR: card.rarity === 'LR',
        hp: parseInt(card.hp || 0),
        atk: parseInt(card.atk || 0),
        def: parseInt(card.def || 0),
        categories: card.categories || [],
        saLevel: card.isLR ? (card.isEZA ? 25 : 20) : (card.isEZA ? 15 : 10),
        isEZA: !!card.isEZA,
        links: card.links || []
      }))
      .slice(0, 50); // Just take top 50 meta cards
    
    // Save to cache file
    const dataPath = path.join(__dirname, '..', 'data', 'meta-cards.json');
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fsSync.existsSync(dataDir)) {
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    // Save updated data
    await fs.writeFile(dataPath, JSON.stringify(metaCards, null, 2), 'utf8');
    
    // Update in-memory cache
    metaCardsCache = metaCards;
    
    return {
      success: true,
      message: `Updated meta cards data with ${metaCards.length} cards`,
      count: metaCards.length
    };
  } catch (error) {
    console.error('Error updating meta data:', error);
    return {
      success: false,
      message: `Error updating meta data: ${error.message}`
    };
  }
}

//=============================================================================
// Example Functions
//=============================================================================

/**
 * Example function to demonstrate custom card comparison
 */
async function exampleCustomCardComparison() {
  const customCardText = `
name: Super Saiyan Goku
type: AGL
rarity: LR
leader skill: "Pure Saiyans" Ki +3, HP, ATK & DEF +170%
passive skill: ATK & DEF +159%; plus an additional ATK +59% as 1st attacker
super attack: Raises ATK & DEF for 1 turn and causes mega-colossal damage
links: Super Saiyan, Kamehameha, Prepared for Battle, Legendary Power
categories: Pure Saiyans, Kamehameha, Goku's Family
stats:
hp: 22000
atk: 20000
def: 10000
  `;
  
  const customCard = parseCustomCard(customCardText);
  
  // Default buffs for a fair comparison
  const buffs = {
    leaderSkill1: 1.7,
    leaderSkill2: 1.7,
    startOfTurn: 1.59, // From passive
    links: 0.25,       // Approximate link buff
    isLR: true,
    saLevel: 20,
    saBoost: 0,
    saEffect: 0.3,     // Raises ATK & DEF
  };
  
  return await compareCardToMeta(customCard, { buffs, ki: 24 });
}

//=============================================================================
// Module Exports
//=============================================================================

module.exports = {
  // Card Calculation Functions
  calculateDEF,
  calculateATK,
  getKiMultiplier,
  getSAMultiplier,
  exampleTEQGodsDefCalculation,
  exampleLRSSJTrioAtkCalculation,
  
  // Card Comparison Functions
  compareCardToMeta,
  parseCustomCard,
  exampleCustomCardComparison,
  
  // Meta Analysis Functions
  getMetaCards,
  getMetaTrends,
  analyzeCard,
  updateMetaData
};