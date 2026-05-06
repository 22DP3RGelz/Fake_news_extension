// 🌐 Service Worker / Background Script for Chrome Extension
// Handles all chrome.storage operations and message passing between popup and content scripts
// This file should be referenced in manifest.json under "background"

const ARTICLE_GATE_MODES = new Set(['strict', 'balanced', 'lenient']);
const DEFAULT_ARTICLE_GATE_MODE = 'strict';

// Initialize storage on extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 Fake News Detector Extension installed');
  
  // Initialize chrome.storage.local with default data
  chrome.storage.local.get(['clickbaitWords', 'trustedDomains', 'stopWords', 'articleGateMode'], (result) => {
    const defaultData = {};
    
    if (!result.clickbaitWords) {
      defaultData.clickbaitWords = getDefaultClickbaitWords();
    }
    if (!result.trustedDomains) {
      defaultData.trustedDomains = getDefaultTrustedDomains();
    }
    if (!result.stopWords) {
      defaultData.stopWords = getDefaultStopWords();
    }
    if (!ARTICLE_GATE_MODES.has(result.articleGateMode)) {
      defaultData.articleGateMode = DEFAULT_ARTICLE_GATE_MODE;
    }
    
    if (Object.keys(defaultData).length > 0) {
      chrome.storage.local.set(defaultData, () => {
        console.log('✅ Local storage initialized with defaults');
      });
    }
  });
  
  // Initialize chrome.storage.sync for user-approved domains
  chrome.storage.sync.get(['userApprovedDomains'], (result) => {
    if (!result.userApprovedDomains) {
      chrome.storage.sync.set({ userApprovedDomains: [] }, () => {
        console.log('✅ Sync storage initialized for user-approved domains');
      });
    }
  });
});

// ========================
// DEFAULT DATA FUNCTIONS
// ========================

function getDefaultClickbaitWords() {
  return [
    "SHOCKING", "BREAKING", "INSANE", "UNBELIEVABLE", "YOU WON'T BELIEVE",
    "REVEALED", "EXPOSED", "SCANDAL", "MUST SEE", "MUST WATCH", "TRENDING",
    "VIRAL", "INCREDIBLE", "AMAZING", "STUNNING", "BOMBSHELL", "LEAKED",
    "EXCLUSIVE", "JUST IN", "JUST HAPPENED", "BREAKING NEWS", "ALERT",
    "URGENT", "CENSORED", "BANNED", "CONSPIRACY", "PROOF", "EVIDENCE",
    "TRUTH", "FINALLY", "AT LAST", "DOCTORS HATE HER", "HATE HIM",
    "HATE THIS ONE TRICK", "ONE TRICK", "HATE THIS TRICK", "THIS WILL SHOCK YOU",
    "SHOCKING TRUTH", "WHAT REALLY HAPPENED", "YOU'LL NEVER GUESS",
    "NOBODY EXPECTED", "NOBODY KNOWS", "THEY DON'T WANT YOU TO KNOW",
    "GOVERNMENT DOESN'T WANT YOU TO KNOW", "BIG TECH DOESN'T WANT YOU TO KNOW",
    "THEY'RE HIDING"
  ];
}

function getDefaultTrustedDomains() {
  return [
    "nytimes.com", "washingtonpost.com", "theguardian.com", "bbc.com",
    "reuters.com", "apnews.com", "npr.org", "wsj.com", "bloomberg.com",
    "cnn.com", "politico.com", "axios.com", "theatlantic.com", "time.com",
    "economist.com", "aljazeera.com", "usatoday.com", "cbsnews.com",
    "nbcnews.com", "abcnews.go.com", "ft.com", "independent.co.uk",
    "vox.com", "msnbc.com", "news.google.com"
  ];
}

function getDefaultStopWords() {
  return [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
    'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'as',
    'if', 'then', 'else', 'not', 'no', 'yes', 'all', 'each', 'every', 'both', 'either', 'neither',
    'said', 'says', 'say', 'told', 'tells', 'tell', 'according', 'about', 'just', 'only', 'more',
    'than', 'so', 'because', 'while', 'during', 'after', 'before'
  ];
}

// ========================
// MESSAGE HANDLER
// ========================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle asynchronous storage operations
  (async () => {
    try {
      switch (request.action) {
        // ===== CLICKBAIT WORDS =====
        case 'getClickbaitWords':
          const clickbaitWords = await getClickbaitWords();
          sendResponse({ success: true, words: clickbaitWords });
          break;
        
        case 'addClickbaitWord':
          await addClickbaitWord(request.word);
          sendResponse({ success: true });
          break;
        
        case 'removeClickbaitWord':
          await removeClickbaitWord(request.word);
          sendResponse({ success: true });
          break;
        
        // ===== TRUSTED DOMAINS (LOCAL) =====
        case 'getTrustedDomains':
          const trustedDomains = await getTrustedDomains();
          sendResponse({ success: true, domains: trustedDomains });
          break;
        
        case 'addTrustedDomain':
          await addTrustedDomain(request.domain);
          sendResponse({ success: true });
          break;
        
        case 'removeTrustedDomain':
          await removeTrustedDomain(request.domain);
          sendResponse({ success: true });
          break;
        
        // ===== STOPWORDS =====
        case 'getStopWords':
          const stopWords = await getStopWords();
          sendResponse({ success: true, words: Array.from(stopWords) });
          break;
        
        case 'addStopWord':
          await addStopWord(request.word);
          sendResponse({ success: true });
          break;
        
        // ===== USER-APPROVED DOMAINS (SYNC) =====
        case 'getUserApprovedDomains':
          const approvedDomains = await getUserApprovedDomains();
          sendResponse({ success: true, domains: approvedDomains });
          break;
        
        case 'approveUserDomain':
          await approveUserDomain(request.domain, request.metadata);
          sendResponse({ success: true });
          break;
        
        case 'removeApprovedDomain':
          await removeApprovedDomain(request.domain);
          sendResponse({ success: true });
          break;
        
        case 'isUserApprovedDomain':
          const isApproved = await isUserApprovedDomain(request.domain);
          sendResponse({ success: true, isApproved: isApproved });
          break;
        
        case 'isTrustedDomain':
          const isTrusted = await isTrustedDomainCheck(request.domain);
          sendResponse({ success: true, isTrusted: isTrusted });
          break;

        // ===== ARTICLE GATE SETTINGS =====
        case 'getArticleGateMode':
          const articleGateMode = await getArticleGateMode();
          sendResponse({ success: true, mode: articleGateMode });
          break;

        case 'setArticleGateMode':
          await setArticleGateMode(request.mode);
          sendResponse({ success: true });
          break;
        
        // ===== UTILITY =====
        case 'getAllStorageData':
          const allData = await getAllStorageData();
          sendResponse({ success: true, data: allData });
          break;
        
        default:
          sendResponse({ success: false, error: 'Unknown action: ' + request.action });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  // Return true to indicate async response
  return true;
});

// ========================
// STORAGE FUNCTIONS
// ========================

async function getClickbaitWords() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['clickbaitWords'], (result) => {
      resolve(result.clickbaitWords || getDefaultClickbaitWords());
    });
  });
}

async function addClickbaitWord(word) {
  const words = await getClickbaitWords();
  if (!words.includes(word.toUpperCase())) {
    words.push(word.toUpperCase());
    return new Promise((resolve) => {
      chrome.storage.local.set({ clickbaitWords: words }, resolve);
    });
  }
}

async function removeClickbaitWord(word) {
  const words = await getClickbaitWords();
  const filtered = words.filter(w => w !== word.toUpperCase());
  return new Promise((resolve) => {
    chrome.storage.local.set({ clickbaitWords: filtered }, resolve);
  });
}

async function getTrustedDomains() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['trustedDomains'], (result) => {
      resolve(result.trustedDomains || getDefaultTrustedDomains());
    });
  });
}

async function addTrustedDomain(domain) {
  const domains = await getTrustedDomains();
  const normalizedDomain = domain.toLowerCase();
  if (!domains.includes(normalizedDomain)) {
    domains.push(normalizedDomain);
    return new Promise((resolve) => {
      chrome.storage.local.set({ trustedDomains: domains }, resolve);
    });
  }
}

async function removeTrustedDomain(domain) {
  const domains = await getTrustedDomains();
  const filtered = domains.filter(d => d !== domain.toLowerCase());
  return new Promise((resolve) => {
    chrome.storage.local.set({ trustedDomains: filtered }, resolve);
  });
}

async function getStopWords() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['stopWords'], (result) => {
      const words = result.stopWords || getDefaultStopWords();
      resolve(new Set(words));
    });
  });
}

async function addStopWord(word) {
  const stopWords = await getStopWords();
  const stopWordsArray = Array.from(stopWords);
  if (!stopWordsArray.includes(word.toLowerCase())) {
    stopWordsArray.push(word.toLowerCase());
    return new Promise((resolve) => {
      chrome.storage.local.set({ stopWords: stopWordsArray }, resolve);
    });
  }
}

async function getUserApprovedDomains() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userApprovedDomains'], (result) => {
      resolve(result.userApprovedDomains || []);
    });
  });
}

async function getArticleGateMode() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['articleGateMode'], (result) => {
      const mode = result.articleGateMode;
      resolve(ARTICLE_GATE_MODES.has(mode) ? mode : DEFAULT_ARTICLE_GATE_MODE);
    });
  });
}

async function setArticleGateMode(mode) {
  if (!ARTICLE_GATE_MODES.has(mode)) {
    throw new Error('Invalid article gate mode: ' + mode);
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ articleGateMode: mode }, resolve);
  });
}

async function approveUserDomain(domain, metadata = {}) {
  const domains = await getUserApprovedDomains();
  const normalizedDomain = domain.toLowerCase();
  
  const existingIndex = domains.findIndex(d => d.domain === normalizedDomain);
  
  if (existingIndex === -1) {
    domains.push({
      domain: normalizedDomain,
      approvedAt: new Date().toISOString(),
      ...metadata
    });
  } else {
    domains[existingIndex] = {
      ...domains[existingIndex],
      ...metadata,
      updatedAt: new Date().toISOString()
    };
  }
  
  return new Promise((resolve) => {
    chrome.storage.sync.set({ userApprovedDomains: domains }, resolve);
  });
}

async function removeApprovedDomain(domain) {
  const domains = await getUserApprovedDomains();
  const filtered = domains.filter(d => d.domain !== domain.toLowerCase());
  return new Promise((resolve) => {
    chrome.storage.sync.set({ userApprovedDomains: filtered }, resolve);
  });
}

async function isUserApprovedDomain(domain) {
  const domains = await getUserApprovedDomains();
  return domains.some(d => d.domain === domain.toLowerCase());
}

async function isTrustedDomainCheck(domain) {
  const trustedDomains = await getTrustedDomains();
  const approvedDomains = await getUserApprovedDomains();
  
  const normalizedDomain = domain.toLowerCase();
  
  // Check built-in trusted domains
  if (trustedDomains.some(d => normalizedDomain.includes(d) || d.includes(normalizedDomain))) {
    return true;
  }
  
  // Check user-approved domains
  if (approvedDomains.some(d => d.domain === normalizedDomain)) {
    return true;
  }
  
  return false;
}

async function getAllStorageData() {
  const localData = await new Promise((resolve) => {
    chrome.storage.local.get(null, resolve);
  });
  
  const syncData = await new Promise((resolve) => {
    chrome.storage.sync.get(null, resolve);
  });
  
  return { local: localData, sync: syncData };
}
