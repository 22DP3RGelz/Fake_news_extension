// 🚨 Clickbait words detection
// Uses chrome.storage.local to load clickbait detection patterns persistently

// Master list of words and phrases commonly used in clickbait and sensationalist headlines
// This is now stored in chrome.storage.local and managed by storage/storage-manager.js
const DEFAULT_CLICKBAIT_WORDS = [
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
  "THEY'RE HIDING", "HIDDEN FROM YOU", "DARK SECRET", "CELEBRITY",
  "RICH", "CELEBRITIES", "PREGNANT", "DIED", "DEATH", "CRASH",
  "EMERGENCY", "HORROR", "TERRIFIED", "TERRIFYING", "NIGHTMARE",
  "MONSTER", "MONSTER DISCOVERED", "CREEPY", "BIZARRE", "WEIRD",
  "FREAKY", "CONSPIRACY THEORY", "CONSPIRACY THEORIES", "HOAX", "FAKE", "FRAUD"
];

// Global cache for clickbait words (populated from storage)
let CLICKBAIT_WORDS = DEFAULT_CLICKBAIT_WORDS;

// Load clickbait words from chrome.storage.local
async function loadClickbaitWordsFromStorage() {
  try {
    if (window.StorageManager && window.StorageManager.getClickbaitWords) {
      CLICKBAIT_WORDS = await window.StorageManager.getClickbaitWords();
      console.log('✅ Clickbait words loaded from storage:', CLICKBAIT_WORDS.length);
      return CLICKBAIT_WORDS;
    }
  } catch (error) {
    console.warn('Failed to load clickbait words from storage, using defaults:', error);
    CLICKBAIT_WORDS = DEFAULT_CLICKBAIT_WORDS;
  }
  return CLICKBAIT_WORDS;
}

// Initialize clickbait words when StorageManager is ready
document.addEventListener('DOMContentLoaded', loadClickbaitWordsFromStorage);
// Also try loading immediately in case DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadClickbaitWordsFromStorage);
} else {
  loadClickbaitWordsFromStorage().catch(e => console.warn('Error loading clickbait words:', e));
}

// Builds a compiled RegExp from the clickbait words list for efficient matching
function getClickbaitRegex() {
  // Use current CLICKBAIT_WORDS (either from storage or defaults)
  const words = CLICKBAIT_WORDS.length > 0 ? CLICKBAIT_WORDS : DEFAULT_CLICKBAIT_WORDS;
  
  // Escape any special regex characters in each word/phrase
  const escapedWords = words.map(word => 
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|');

  // Return a regex that matches any clickbait words as whole words, case-insensitively
  return new RegExp(`\\b(${escapedWords})\\b`, 'gi');
}

// Register functions on the window object so content scripts can call them
if (typeof window !== 'undefined') {
  window.getClickbaitRegex = getClickbaitRegex;
  window.loadClickbaitWordsFromStorage = loadClickbaitWordsFromStorage;
  window.getClickbaitWords = () => CLICKBAIT_WORDS;
}
