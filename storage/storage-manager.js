// 💾 Chrome Storage Manager
// Handles persistent storage for extension data using chrome.storage API
// chrome.storage.local: clickbait words, trusted domains, stopwords (extension-wide data)
// chrome.storage.sync: user-approved domains (synced across user's devices)

// ======================
// STORAGE INITIALIZATION
// ======================

// Initialize chrome.storage.local with default data on extension install
function initializeLocalStorage() {
  chrome.storage.local.get(['clickbaitWords', 'trustedDomains', 'stopWords'], (result) => {
    // Only initialize if data doesn't already exist
    if (!result.clickbaitWords || !result.trustedDomains || !result.stopWords) {
      const defaultData = {
        clickbaitWords: getDefaultClickbaitWords(),
        trustedDomains: getDefaultTrustedDomains(),
        stopWords: getDefaultStopWords()
      };
      
      chrome.storage.local.set(defaultData, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to initialize local storage:', chrome.runtime.lastError);
        } else {
          console.log('✅ Chrome local storage initialized with default data');
        }
      });
    }
  });
}

// Initialize chrome.storage.sync for user-approved domains
function initializeSyncStorage() {
  chrome.storage.sync.get(['userApprovedDomains'], (result) => {
    if (!result.userApprovedDomains) {
      chrome.storage.sync.set({ userApprovedDomains: [] }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to initialize sync storage:', chrome.runtime.lastError);
        } else {
          console.log('✅ Chrome sync storage initialized for user-approved domains');
        }
      });
    }
  });
}

// Initialize both storage systems when the script loads
if (typeof chrome !== 'undefined' && chrome.storage) {
  // Use runtime.onInstalled for background script context, fallback for content script
  if (typeof chrome.runtime !== 'undefined' && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      initializeLocalStorage();
      initializeSyncStorage();
    });
  } else {
    // For content scripts, initialize on first load
    initializeLocalStorage();
    initializeSyncStorage();
  }
}

// ========================
// CLICKBAIT WORDS MANAGEMENT
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

// Get clickbait words from chrome.storage.local
async function getClickbaitWords() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['clickbaitWords'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving clickbait words:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.clickbaitWords || getDefaultClickbaitWords());
      }
    });
  });
}

// Add a new clickbait word to storage
async function addClickbaitWord(word) {
  const words = await getClickbaitWords();
  if (!words.includes(word.toUpperCase())) {
    words.push(word.toUpperCase());
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ clickbaitWords: words }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(words);
      });
    });
  }
  return words;
}

// Remove a clickbait word from storage
async function removeClickbaitWord(word) {
  const words = await getClickbaitWords();
  const filtered = words.filter(w => w !== word.toUpperCase());
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ clickbaitWords: filtered }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(filtered);
    });
  });
}

// ========================
// TRUSTED DOMAINS MANAGEMENT
// ========================

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

// Get trusted domains from chrome.storage.local
async function getTrustedDomains() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['trustedDomains'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving trusted domains:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.trustedDomains || getDefaultTrustedDomains());
      }
    });
  });
}

// Add a domain to trusted list (local storage)
async function addTrustedDomain(domain) {
  const domains = await getTrustedDomains();
  const normalizedDomain = domain.toLowerCase();
  if (!domains.includes(normalizedDomain)) {
    domains.push(normalizedDomain);
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ trustedDomains: domains }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(domains);
      });
    });
  }
  return domains;
}

// Remove a domain from trusted list
async function removeTrustedDomain(domain) {
  const domains = await getTrustedDomains();
  const filtered = domains.filter(d => d !== domain.toLowerCase());
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ trustedDomains: filtered }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(filtered);
    });
  });
}

// ========================
// STOPWORDS MANAGEMENT
// ========================

function getDefaultStopWords() {
  return [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
    'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'as',
    'if', 'then', 'else', 'not', 'no', 'yes', 'all', 'each', 'every', 'both', 'either', 'neither',
    'said', 'says', 'say', 'told', 'tells', 'tell', 'according', 'about', 'just', 'only', 'more',
    'than', 'so', 'because', 'while', 'during', 'after', 'before', 'been'
  ];
}

// Get stopwords from chrome.storage.local
async function getStopWords() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['stopWords'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving stopwords:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(new Set(result.stopWords || getDefaultStopWords()));
      }
    });
  });
}

// Add a stopword to storage
async function addStopWord(word) {
  const stopWords = await getStopWords();
  const stopWordsArray = Array.from(stopWords);
  if (!stopWordsArray.includes(word.toLowerCase())) {
    stopWordsArray.push(word.toLowerCase());
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ stopWords: stopWordsArray }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(new Set(stopWordsArray));
      });
    });
  }
  return stopWords;
}

// ========================
// USER-APPROVED DOMAINS MANAGEMENT (SYNC)
// ========================

// Get user-approved domains from chrome.storage.sync (synced across devices)
async function getUserApprovedDomains() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['userApprovedDomains'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving user-approved domains:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.userApprovedDomains || []);
      }
    });
  });
}

// Add a domain to user-approved list (chrome.storage.sync - persists across user's devices)
async function approveUserDomain(domain, metadata = {}) {
  const approvedDomains = await getUserApprovedDomains();
  const normalizedDomain = domain.toLowerCase();
  
  // Check if domain already exists
  const existingIndex = approvedDomains.findIndex(d => d.domain === normalizedDomain);
  
  if (existingIndex === -1) {
    // Add new approved domain with metadata (timestamp, reason, etc.)
    approvedDomains.push({
      domain: normalizedDomain,
      approvedAt: new Date().toISOString(),
      ...metadata
    });
  } else {
    // Update existing domain's metadata
    approvedDomains[existingIndex] = {
      ...approvedDomains[existingIndex],
      ...metadata,
      updatedAt: new Date().toISOString()
    };
  }
  
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ userApprovedDomains: approvedDomains }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(approvedDomains);
    });
  });
}

// Remove a domain from user-approved list
async function removeApprovedDomain(domain) {
  const approvedDomains = await getUserApprovedDomains();
  const filtered = approvedDomains.filter(d => d.domain !== domain.toLowerCase());
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ userApprovedDomains: filtered }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(filtered);
    });
  });
}

// Check if a domain is in user-approved list
async function isUserApprovedDomain(domain) {
  const approvedDomains = await getUserApprovedDomains();
  return approvedDomains.some(d => d.domain === domain.toLowerCase());
}

// ========================
// UTILITY FUNCTIONS
// ========================

// Clear all local storage data (for testing/reset)
async function clearLocalStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else {
        console.log('✅ Local storage cleared');
        resolve();
      }
    });
  });
}

// Clear all sync storage data (for testing/reset)
async function clearSyncStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.clear(() => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else {
        console.log('✅ Sync storage cleared');
        resolve();
      }
    });
  });
}

// Get all storage data (for debugging)
async function getAllStorageData() {
  const localData = await new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result);
    });
  });
  
  const syncData = await new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result);
    });
  });
  
  return { local: localData, sync: syncData };
}

// Expose all functions on window for use in other scripts
if (typeof window !== 'undefined') {
  window.StorageManager = {
    // Local storage functions
    getClickbaitWords,
    addClickbaitWord,
    removeClickbaitWord,
    getTrustedDomains,
    addTrustedDomain,
    removeTrustedDomain,
    getStopWords,
    addStopWord,
    
    // Sync storage functions
    getUserApprovedDomains,
    approveUserDomain,
    removeApprovedDomain,
    isUserApprovedDomain,
    
    // Utility functions
    clearLocalStorage,
    clearSyncStorage,
    getAllStorageData,
    
    // Initialize functions
    initializeLocalStorage,
    initializeSyncStorage
  };
}
