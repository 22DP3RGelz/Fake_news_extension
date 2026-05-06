// ============================================
// TEXT-CHECKER.JS - Text-based issue detection
// ============================================
// Checks: misleading headlines, clickbait, excessive caps, punctuation, ads

// Runs all text-level checks on the article and returns a score contribution + factor list
async function checkTextIssues(searchText, textForAnalysis, isEnglishArticle, articleElement, weights) {
  let rawScore = 0;  // Cumulative risk score from text checks
  let factors = [];  // List of factor objects (shown in popup as Issues list)

  // --- Get the headline and body text for headline-vs-content comparison ---

  // Grab the main headline from h1, h2, or the page <title> tag
  const headline = document.querySelector("h1")?.textContent ||
                   document.querySelector("h2")?.textContent ||
                   document.title || "";
  
  // Join all readable paragraph text blocks into one string for analysis
  const paragraphText = getArticleTextBlocks(articleElement)
    .map(block => block.innerText.trim())
    .filter(Boolean)
    .join("\n\n");

  // 🚨 Check 1: Headline vs. Article Content Similarity
  // Only run on English articles with enough body text to meaningfully compare
  if (isEnglishArticle && headline && paragraphText.length > 200) {
    try {
      if (typeof detectMisleadingHeadline === 'function') {
        // Call the misleading headline detector from trust-checks/misleading-content.js
        let misleadingCheck = detectMisleadingHeadline(headline, paragraphText);
        if (misleadingCheck && misleadingCheck.isMisleading) {
          rawScore += weights.misleading;  // Increase risk score
          factors.push({
            id: 'misleading',
            label: 'Headline may not match article content',
            weight: weights.misleading,
            triggered: true,               // Issue found
            details: `similarity=${Number(misleadingCheck.similarity).toFixed(2)}`
          });
        } else {
          factors.push({
            id: 'misleading',
            label: 'Headline vs content similarity',
            weight: weights.misleading,
            triggered: false,              // No issue
            details: `similarity=${Number(misleadingCheck?.similarity || 1).toFixed(2)}`
          });
        }
      }
    } catch (e) {
      console.error("Misleading content check error:", e); // Log but don't crash
    }
  } else {
    // Skip this check for non-English or very short articles
    factors.push({
      id: 'misleading',
      label: 'Headline vs content similarity',
      weight: weights.misleading,
      triggered: false,
      details: 'Skipped for non-English'
    });
  }

  // 🔴 Check 2: Clickbait Language Detection
  if (isEnglishArticle) {
    let clickbaitRegex = null;
    try {
      // Get the compiled regex from trust-checks/clickbait-words.js
      if (typeof getClickbaitRegex === 'function') clickbaitRegex = getClickbaitRegex();
    } catch (e) {
      // Fall back to a basic hardcoded regex if the module isn't available
      clickbaitRegex = /\b(SHOCKING|BREAKING|INSANE|UNBELIEVABLE|YOU WON'T BELIEVE)\b/gi;
    }

    // Run the regex against the (possibly translated) article text
    const cbMatches = clickbaitRegex ? (textForAnalysis.match(clickbaitRegex) || []) : [];
    if (cbMatches.length) {
      rawScore += weights.clickbait;  // Increase risk score
      factors.push({
        id: 'clickbait',
        label: 'Uses clickbait language',
        weight: weights.clickbait,
        triggered: true,
        details: `${cbMatches.slice(0, 4).join(', ')}` // Show first 4 matched words in popup
      });
      highlightPattern(articleElement, clickbaitRegex, 'clickbait'); // Visually mark in page
    } else {
      factors.push({
        id: 'clickbait',
        label: 'Uses clickbait language',
        weight: weights.clickbait,
        triggered: false  // No clickbait found — good signal
      });
    }
  } else {
    // Can't reliably detect English clickbait in non-English text
    factors.push({
      id: 'clickbait',
      label: 'Uses clickbait language',
      weight: weights.clickbait,
      triggered: false,
      details: 'Skipped for non-English'
    });
  }

  // 🔴 Check 3: Excessive ALL CAPS Text
  // Words that are 5+ consecutive uppercase letters are flagged
  const capsRegex = /\b[A-Z]{5,}\b/g;
  const capsMatches = (searchText.match(capsRegex) || []);
  if (capsMatches.length >= 10) {
    // Threshold of 10 instances to avoid false positives from acronyms (NASA, COVID, etc.)
    rawScore += weights.caps;
    factors.push({
      id: 'caps',
      label: 'Contains excessive ALL CAPS',
      weight: weights.caps,
      triggered: true,
      details: `${capsMatches.length} instances: ${capsMatches.slice(0, 5).join(', ')}` // Show first 5
    });
    highlightPattern(articleElement, capsRegex, 'caps'); // Highlight in page
  } else {
    factors.push({
      id: 'caps',
      label: 'Contains excessive ALL CAPS',
      weight: weights.caps,
      triggered: false,
      details: `${capsMatches.length} instances (threshold: 10)` // Show count for transparency
    });
  }

  // 🔴 Check 4: Excessive Punctuation (!! or ??)
  // Multiple consecutive ! or ? is a hallmark of sensationalist writing
  const punctRegex = /!{2,}|\?{2,}/g;
  const punctMatches = (searchText.match(punctRegex) || []);
  if (punctMatches.length) {
    rawScore += weights.punct;
    factors.push({
      id: 'punct',
      label: 'Excessive punctuation',
      weight: weights.punct,
      triggered: true,
      details: `${punctMatches.length} occurrences`
    });
    highlightPattern(articleElement, punctRegex, 'punct'); // Highlight in page
  } else {
    factors.push({
      id: 'punct',
      label: 'Excessive punctuation',
      weight: weights.punct,
      triggered: false
    });
  }

  // 🟣 Check 5: Excessive Advertisements
  // A high ad density can indicate low-quality, revenue-farming content
  const adSelectors = [
    'iframe[src*="ad"]',            // iframes loading ad URLs
    'iframe[src*="doubleclick"]',   // Google DoubleClick ad iframes
    'iframe[src*="google"]',        // General Google ad iframes
    '[class*="ad"]',                // Any element with "ad" in its class name
    '[class*="banner"]',            // Banner ad containers
    '[class*="advertisement"]',     // Explicit advertisement class
    '[id*="ad"]',                   // Elements with "ad" in their ID
    '[id*="ads"]',                  // Elements with "ads" in their ID
    '[id*="banner"]',               // Banner IDs
    '[data-adslot]',                // DFP/GAM ad slot attribute
    '[data-google-query-id]',       // Google ad query attribute
    '.google-auto-placed',          // Auto-placed Google AdSense
    '.adsbygoogle',                 // Standard Google AdSense class
    '.ad-container',                // Generic ad container
    '.ad-wrapper',                  // Generic ad wrapper
    '.advertisement',               // Explicit advertisement class
    '.sponsored',                   // Sponsored/native ad content
    '[class*="sponsored"]'          // Any class containing "sponsored"
  ];

  let adCount = 0;
  for (let selector of adSelectors) {
    try {
      adCount += articleElement.querySelectorAll(selector).length; // Count matching elements
    } catch (e) { /* skip invalid selectors silently */ }
  }

  if (adCount > 10) {
    // More than 10 ad elements is suspicious (typical quality articles have a few at most)
    rawScore += weights.ads;
    factors.push({
      id: 'ads',
      label: 'Too many ads',
      weight: weights.ads,
      triggered: true,
      details: `${adCount} ad elements found`
    });
  } else {
    factors.push({
      id: 'ads',
      label: 'Too many ads',
      weight: weights.ads,
      triggered: false,
      details: `${adCount} ad elements found`
    });
  }

  return { rawScore, factors }; // Return accumulated score and factor list to content.js
}
