// 🚨 Misleading Content Detection
// Checks if headline matches article content by comparing keyword overlap
// Uses chrome.storage.local to manage stopwords persistently

// Default stopwords that appear everywhere and don't indicate topic
const DEFAULT_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
  'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'as',
  'if', 'then', 'else', 'not', 'no', 'yes', 'all', 'each', 'every', 'both', 'either', 'neither',
  'said', 'says', 'say', 'told', 'tells', 'tell', 'according', 'about', 'just', 'only', 'more',
  'than', 'so', 'because', 'while', 'during', 'after', 'before', 'been'
]);

// Global cache for stopwords (populated from storage)
let stopWords = DEFAULT_STOP_WORDS;

// Load stopwords from chrome.storage.local
async function loadStopWordsFromStorage() {
  try {
    if (window.StorageManager && window.StorageManager.getStopWords) {
      stopWords = await window.StorageManager.getStopWords();
      console.log('✅ Stop words loaded from storage:', stopWords.size);
      return stopWords;
    }
  } catch (error) {
    console.warn('Failed to load stop words from storage, using defaults:', error);
    stopWords = DEFAULT_STOP_WORDS;
  }
  return stopWords;
}

// Initialize on DOMContentLoaded or immediately if already loaded
document.addEventListener('DOMContentLoaded', loadStopWordsFromStorage);
if (document.readyState !== 'loading') {
  loadStopWordsFromStorage().catch(e => console.warn('Error loading stop words:', e));
}

// Extracts the most frequently occurring meaningful words from a piece of text
function extractKeywords(text, limit = 10) {
  // Extract only words with 4+ characters using a regex — short words are usually articles/prepositions
  let words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  
  // Build a frequency map of how often each meaningful word appears
  let frequency = {};
  words.forEach(word => {
    if (!stopWords.has(word)) {
      frequency[word] = (frequency[word] || 0) + 1; // Increment count or start at 1
    }
  });

  // Sort words by frequency descending and return only the top `limit` words
  return Object.keys(frequency)
    .sort((a, b) => frequency[b] - frequency[a]) // Most frequent first
    .slice(0, limit);                             // Only keep top N keywords
}

// Returns the proportion of keywords shared between two keyword arrays (0.0 to 1.0)
function calculateSimilarity(keywords1, keywords2) {
  // Filter keywords1 to only those that also appear in keywords2
  let shared = keywords1.filter(k => keywords2.includes(k));
  // Divide by the longer array length to normalize (avoid inflating score with short arrays)
  return shared.length / Math.max(keywords1.length, keywords2.length, 1);
}

// Compares headline keywords to article body keywords to detect potential clickbait mismatch
function detectMisleadingHeadline(headline, articleText) {
  if (!headline || !articleText) return null; // Can't compare without both inputs

  // Extract top keywords from the headline (fewer since it's short)
  let headlineKeywords = extractKeywords(headline, 8);
  // Extract top keywords from the article body (more since it's longer)
  let articleKeywords = extractKeywords(articleText, 15);

  // Calculate how much the headline and article overlap in topic keywords
  let similarity = calculateSimilarity(headlineKeywords, articleKeywords);

  // If fewer than 30% of headline keywords appear in the article, it's likely misleading
  // Also require at least 3 headline keywords to avoid false positives on very short titles
  if (similarity < 0.3 && headlineKeywords.length >= 3) {
    return {
      isMisleading: true,                   // Flag this article as potentially misleading
      similarity: similarity,               // Include the raw similarity score
      headlineKeywords: headlineKeywords,   // Return headline keywords for debugging
      articleKeywords: articleKeywords      // Return article keywords for debugging
    };
  }

  // Not misleading — return the similarity score anyway for display in the UI
  return {
    isMisleading: false,
    similarity: similarity
  };
}

// Register functions on window so they can be called from content.js and text-checker.js
if (typeof window !== 'undefined') {
  window.detectMisleadingHeadline = detectMisleadingHeadline;
  window.loadStopWordsFromStorage = loadStopWordsFromStorage;
  window.extractKeywords = extractKeywords;
  window.calculateSimilarity = calculateSimilarity;
}
