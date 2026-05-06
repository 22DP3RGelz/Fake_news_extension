// ============================================
// HELPERS.JS - Utility functions
// ============================================
// DOM & text utilities, domain normalizers, storage access

// Detect which browser API to use: Firefox uses 'browser', Chrome uses 'chrome'
const api = typeof browser !== "undefined" ? browser : chrome;

// 🔍 Find article content container
function getArticleElement() {
  // Try the semantic <article> HTML tag first — most modern news sites use it
  let article = document.querySelector('article');
  if (article) return article; // Return immediately if found

  // List of common CSS class/role selectors used by news sites for their main content
  const commonClasses = [
    '.article-content',       // Generic article content class
    '.post-content',          // Common in WordPress blogs
    '.entry-content',         // Another WordPress standard
    '.story-body',            // Used by BBC and similar
    '.article-body',          // Used by many news outlets
    '[role="main"]',          // ARIA landmark for main content
    'main',                   // HTML5 <main> semantic element
    '.main-content',          // Generic main content class
    '.content',               // Very generic fallback class
    '.post',                  // Common blog post container
    '[data-testid="article"]' // React-based sites using test IDs
  ];

  // Loop through each selector and return the first one that has enough text
  for (let selector of commonClasses) {
    let element = document.querySelector(selector);
    // Only use this element if it contains more than 200 characters (avoids nav menus etc.)
    if (element && element.innerText.length > 200) {
      return element;
    }
  }

  // Last resort: return the whole page body if nothing specific was found
  return document.body;
}

// 🎨 Highlight function with reason tracking
// Returns an array of paragraph elements that make up the article's readable text
function getArticleTextBlocks(articleElement) {
  // Find all <p> tags inside the article that have more than 30 characters (skip empty/short ones)
  const blocks = Array.from(articleElement.querySelectorAll('p'))
    .filter(p => p.innerText.trim().length > 30);

  // Also grab the main headline (h1 or h2) so it's included in analysis
  const titleElement = document.querySelector('h1') || document.querySelector('h2');
  if (titleElement && titleElement.innerText.trim()) {
    blocks.unshift(titleElement); // Add title to the FRONT of the array
  }

  // If no paragraphs were found, fall back to the whole article element
  return blocks.length ? blocks : [articleElement];
}

// Wraps matched text in <mark> tags with a CSS class and data attribute for scrolling
function highlightPattern(articleElement, regex, reasonId) {
  // Get all readable text blocks to search through
  const blocks = getArticleTextBlocks(articleElement);

  // Loop through each paragraph/block
  for (let block of blocks) {
    // Create a tree walker to traverse only TEXT nodes (not elements)
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node;

    // Walk through each text node in this block
    while (node = walker.nextNode()) {
      let parent = node.parentNode;
      // Skip text inside <script> or <style> tags — we don't want to highlight code
      if (!parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE") continue;

      let content = node.nodeValue; // The raw text content of this text node
      let matches = content.match(regex); // Check if this text contains any matches
      if (matches) {
        // Create a wrapper <span> to hold the highlighted HTML
        let span = document.createElement("span");
        // Replace each match with a <mark> tag carrying the reason ID and CSS class
        span.innerHTML = content.replace(regex, match =>
          `<mark data-reason-id="${reasonId}" class="nd-highlight nd-${reasonId}">${match}</mark>`
        );
        // Swap the original plain text node with our new highlighted span
        parent.replaceChild(span, node);
      }
    }
  }
}

// --- Domain helpers ---

// Strips 'www.' prefix, trailing slashes, and lowercases a hostname
function normalizeHost(host) {
  if (!host) return ''; // Guard against null/undefined
  return host.toLowerCase()           // Make comparison case-insensitive
             .replace(/^www\./, '')   // Remove leading 'www.'
             .replace(/\/$/, '')      // Remove trailing slash
             .trim();                 // Remove any surrounding whitespace
}

// Extracts the registrable/main domain from a full hostname
// e.g. "blog.bbc.co.uk" → "bbc.co.uk", "sub.nytimes.com" → "nytimes.com"
function extractMainDomain(host) {
  const h = normalizeHost(host);         // Normalize first
  const parts = h.split('.');            // Split by dots into parts
  if (parts.length <= 2) return h;       // Already a simple domain like "bbc.com"

  const last = parts[parts.length - 1];        // TLD e.g. "com", "uk"
  const secondLast = parts[parts.length - 2];  // e.g. "co", "com" (for ccTLDs)
  const compoundSecondLevelDomains = new Set([
    'ac',
    'co',
    'com',
    'edu',
    'gov',
    'net',
    'org'
  ]);

  // Handle compound TLDs like "co.uk" or "com.au" (both parts are short)
  if (last.length === 2 && compoundSecondLevelDomains.has(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join('.'); // Return last 3 parts e.g. "bbc.co.uk"
  }

  return parts.slice(-2).join('.'); // Return last 2 parts e.g. "nytimes.com"
}

// Calculates the edit distance between two strings (how many single-char edits to transform a→b)
// Used to detect typosquatting domains like "nytimes.co" vs "nytimes.com"
function levenshteinDistance(a, b) {
  a = a || ''; // Default to empty string if null/undefined
  b = b || '';
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl; // If a is empty, distance = length of b
  if (bl === 0) return al; // If b is empty, distance = length of a

  // Create a 2D matrix of size (al+1) x (bl+1), filled with 0
  const matrix = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));

  // Fill first column: cost to delete all chars of a
  for (let i = 0; i <= al; i++) matrix[i][0] = i;
  // Fill first row: cost to insert all chars of b
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;

  // Fill the rest of the matrix using dynamic programming
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      // No cost if characters match, otherwise cost is 1
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // Deletion
        matrix[i][j - 1] + 1,       // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[al][bl]; // Bottom-right cell = total edit distance
}

// Returns a 0.0–1.0 similarity score between two strings (1.0 = identical)
function similarityScore(a, b) {
  if (!a && !b) return 1; // Both empty = identical
  const dist = levenshteinDistance(a, b);
  // Normalize by the length of the longer string so score is 0–1
  return 1 - dist / Math.max(a.length || 1, b.length || 1);
}

// Reads the list of user-approved domains from extension storage (or localStorage as fallback)
function getApprovedDomains() {
  // Returns a Promise so callers can await it
  return new Promise((resolve) => {
    try {
      if (api && api.storage && api.storage.sync && typeof api.storage.sync.get === 'function') {
        api.storage.sync.get(['userApprovedDomains'], (syncRes) => {
          const synced = Array.isArray(syncRes?.userApprovedDomains)
            ? syncRes.userApprovedDomains.map(d => typeof d === 'string' ? d : d.domain)
            : [];

          // Include old local approvedDomains entries so existing users do not lose approvals.
          if (api.storage.local && typeof api.storage.local.get === 'function') {
            api.storage.local.get(['approvedDomains'], (localRes) => {
              const legacy = Array.isArray(localRes?.approvedDomains) ? localRes.approvedDomains : [];
              resolve([...synced, ...legacy].filter(Boolean).map(d => normalizeHost(d)));
            });
          } else {
            resolve(synced.filter(Boolean).map(d => normalizeHost(d)));
          }
        });
      } else {
        // Fallback: try localStorage (works in non-extension contexts like testing)
        try {
          const raw = localStorage.getItem('approvedDomains');       // Read raw JSON string
          const arr = raw ? JSON.parse(raw) : [];                    // Parse or default to []
          resolve(arr.map(d => normalizeHost(d)));                   // Normalize and resolve
        } catch (e) {
          resolve([]); // If localStorage also fails, return empty array
        }
      }
    } catch (e) {
      resolve([]); // Catch-all: never reject, just return empty array
    }
  });
}
