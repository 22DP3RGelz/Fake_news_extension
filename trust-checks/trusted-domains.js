// 💾 Trusted News Domains
// Uses chrome.storage.local to manage trusted domain lists persistently
// Also integrates with chrome.storage.sync for user-approved domains

// Default list of well-known, editorially accountable news organizations
const DEFAULT_TRUSTED_NEWS_DOMAINS = [
  "nytimes.com", "washingtonpost.com", "theguardian.com", "bbc.com",
  "reuters.com", "apnews.com", "npr.org", "wsj.com", "bloomberg.com",
  "cnn.com", "politico.com", "axios.com", "theatlantic.com", "time.com",
  "economist.com", "aljazeera.com", "usatoday.com", "cbsnews.com",
  "nbcnews.com", "abcnews.go.com", "ft.com", "independent.co.uk",
  "vox.com", "msnbc.com", "news.google.com"
];

// Global cache for trusted domains (populated from storage)
let TRUSTED_NEWS_DOMAINS = DEFAULT_TRUSTED_NEWS_DOMAINS;

// Load trusted domains from chrome.storage.local
async function loadTrustedDomainsFromStorage() {
  try {
    if (window.StorageManager && window.StorageManager.getTrustedDomains) {
      TRUSTED_NEWS_DOMAINS = await window.StorageManager.getTrustedDomains();
      console.log('✅ Trusted domains loaded from storage:', TRUSTED_NEWS_DOMAINS.length);
      return TRUSTED_NEWS_DOMAINS;
    }
  } catch (error) {
    console.warn('Failed to load trusted domains from storage, using defaults:', error);
    TRUSTED_NEWS_DOMAINS = DEFAULT_TRUSTED_NEWS_DOMAINS;
  }
  return TRUSTED_NEWS_DOMAINS;
}

// Initialize on DOMContentLoaded or immediately if already loaded
document.addEventListener('DOMContentLoaded', loadTrustedDomainsFromStorage);
if (document.readyState !== 'loading') {
  loadTrustedDomainsFromStorage().catch(e => console.warn('Error loading trusted domains:', e));
}

// Check if a domain is in the trusted list (built-in or user-approved)
async function isTrustedDomain(domain) {
  // Check built-in trusted domains
  const normalizedDomain = domain.toLowerCase();
  if (TRUSTED_NEWS_DOMAINS.some(d => normalizedDomain.includes(d) || d.includes(normalizedDomain))) {
    return true;
  }
  
  // Check user-approved domains from sync storage
  try {
    if (window.StorageManager && window.StorageManager.isUserApprovedDomain) {
      return await window.StorageManager.isUserApprovedDomain(normalizedDomain);
    }
  } catch (error) {
    console.warn('Error checking user-approved domains:', error);
  }
  
  return false;
}

// Get a copy of trusted domains for read-only access
function getTrustedNewsDomains() {
  return (TRUSTED_NEWS_DOMAINS || DEFAULT_TRUSTED_NEWS_DOMAINS).slice();
}

// Get a copy of default trusted domains
function getDefaultTrustedDomains() {
  return DEFAULT_TRUSTED_NEWS_DOMAINS.slice();
}

// Expose functions on the window object
if (typeof window !== 'undefined') {
  window.TRUSTED_NEWS_DOMAINS = TRUSTED_NEWS_DOMAINS;
  window.getTrustedNewsDomains = getTrustedNewsDomains;
  window.getDefaultTrustedDomains = getDefaultTrustedDomains;
  window.isTrustedDomain = isTrustedDomain;
  window.loadTrustedDomainsFromStorage = loadTrustedDomainsFromStorage;
}
