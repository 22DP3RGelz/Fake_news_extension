// ============================================
// CONTENT.JS - Main analysis orchestrator (REFACTORED)
// ============================================
// Imports modular checker functions from:
//  - helpers.js (DOM, domain utilities)
//  - author-detector.js
//  - text-checker.js
//  - source-checker.js
//  - domain-checker.js
//
// This file orchestrates analysis and handles messages

// Main analysis function — gathers article data, runs all checkers, and returns a scored result
async function analyzeContent(text, articleElement) {
  // Get the page headline: prefer h1, fall back to h2, then <title>
  const headline = document.querySelector("h1")?.textContent ||
                   document.querySelector("h2")?.textContent ||
                   document.title || "";

  // Join all readable paragraphs into one big string for analysis
  const paragraphText = getArticleTextBlocks(articleElement)
    .map(block => block.innerText.trim())
    .filter(Boolean)
    .join("\n\n");

  // Combine headline and body text as the primary input for most checks
  const searchText = [headline, paragraphText].filter(Boolean).join("\n\n");

  // Determine if the article is in English — some checks are English-only
  const isEnglishArticle = isEnglish(searchText);

  // Weight map: how much each detected issue contributes to the overall risk score
  const weights = {
    misleading: 3,    // Headline doesn't match content — biggest red flag
    clickbait: 2,     // Sensationalist language
    caps: 2,          // Excessive ALL CAPS
    punct: 1,         // Excessive !! or ??
    links: 1,         // Lack of external source links
    author: 2,        // No identifiable author
    domain: 1,        // Unknown or suspicious domain
    ads: 1,           // Too many advertisements
    attribution: 1,   // No "according to..." phrases
    wire: 1,          // Wire service detected (used differently — positive signal)
    anonymous: 2,     // Anonymous sources cited
    imageSource: 1    // Image source credits (positive signal)
  };

  let rawScore = 0;   // Running sum of triggered weights
  let factors = [];   // All factor objects (both triggered and non-triggered)
  // Warning text shown when article is not in English
  let languageWarning = isEnglishArticle ? "" : "Non-English article detected; English-only checks are limited.";

  // Calculate max possible score (sum of all weights)
  let maxScore = Object.values(weights).reduce((a, b) => a + b, 0);
  // Reduce max score for non-English articles since some checks are skipped
  if (!isEnglishArticle) {
    maxScore -= (weights.misleading + weights.clickbait);
  }

  // 🌍 If English, prepare text for clickbait analysis (translation hook exists here)
  let textForAnalysis = searchText;
  if (isEnglishArticle) {
    try {
      // If a translation function exists (from translation.js), use it
      if (typeof getTranslatedText === 'function') {
        textForAnalysis = await getTranslatedText(searchText);
      }
    } catch (e) {
      textForAnalysis = searchText; // Fall back to original on translation failure
    }
  }

  // --- Run all modular checkers ---

  // 1) Text-based checks (misleading headline, clickbait, caps, punctuation, ads)
  if (typeof checkTextIssues === 'function') {
    const textResult = await checkTextIssues(searchText, textForAnalysis, isEnglishArticle, articleElement, weights);
    rawScore += textResult.rawScore;         // Accumulate score
    factors.push(...textResult.factors);     // Merge factors into main list
  }

  // 2) Source checks (attribution, links, wire services, anonymous sources, image credits)
  if (typeof checkSources === 'function') {
    const sourceResult = await checkSources(searchText, articleElement, weights);
    rawScore += sourceResult.rawScore;
    factors.push(...sourceResult.factors);
    var sourceLinks = sourceResult.sourceLinks;               // Credible source links found in article
    var externalLinks = sourceResult.externalLinks;           // Weak external links not counted as sources
    var imageSourceCaptions = sourceResult.imageSourceCaptions; // Image credits found
  }

  // 3) Author detection (tries meta, JSON-LD, CSS selectors, and "By" text patterns)
  if (typeof findAuthor === 'function') {
    const authorInfo = findAuthor(articleElement);
    if (authorInfo && authorInfo.name) {
      // Author found — no penalty, log it as a positive factor
      factors.push({
        id: 'author',
        label: 'Author detected',
        weight: weights.author,
        triggered: false,              // No issue
        details: authorInfo.name,      // The author's name for display
        method: authorInfo.method      // How the author was found (for debugging)
      });
    } else {
      // No author found — increase risk score
      rawScore += weights.author;
      factors.push({
        id: 'author',
        label: 'No clear author',
        weight: weights.author,
        triggered: true  // Issue found
      });
    }
  }

  // 4) Domain reputation (trusted list, typosquatting detection, user-approved domains)
  let domainStatus = 'unknown', domainSimilarTo = null;
  if (typeof checkDomain === 'function') {
    const domainResult = await checkDomain(weights);
    rawScore += domainResult.rawScore;
    factors.push(...domainResult.factors);
    domainStatus = domainResult.domainStatus;       // 'trusted', 'suspicious', or 'unknown'
    domainSimilarTo = domainResult.domainSimilarTo; // e.g. "bbc.com" if suspicious
  }

  // --- Normalize rawScore to a 0–10 scale ---
  let normalized = 0;
  if (maxScore > 0) normalized = Math.round((rawScore / maxScore) * 10);
  normalized = Math.max(0, Math.min(10, normalized)); // Clamp between 0 and 10

  // Determine the overall verdict label and emoji based on the normalized score
  let level = '🟢 Likely Safe';
  if (normalized >= 6) level = '🔴 Highly Suspicious';
  else if (normalized >= 3) level = '🟡 Possibly Misleading';

  // Build the explanation array from triggered factors (issues found)
  let explanation = factors
    .filter(f => f.triggered)
    .map(f => ({ text: f.label, reasonId: f.id }));

  // Prepend the language warning if applicable
  if (!isEnglishArticle) {
    explanation.unshift({ text: 'Non-English article detected; English-only checks were skipped.', reasonId: 'non-english-warning' });
  }

  // If nothing was triggered, show a generic all-clear message
  if (explanation.length === 0) {
    explanation.push({ text: 'No major issues detected', reasonId: 'none' });
  }

  // Return the complete result object to popup.js via the message listener
  return {
    score: normalized,                                         // 0–10 normalized risk score
    rawScore,                                                  // Raw sum of triggered weights
    maxScore,                                                  // Maximum possible raw score
    level,                                                     // Human-readable verdict
    factors,                                                   // All factors (for Issues list)
    explanation,                                               // Triggered factors only
    languageWarning: languageWarning || null,                  // Non-English warning text
    domain: normalizeHost(window.location.hostname || ''),     // Current page's domain
    domainStatus: domainStatus,                                // Trusted/suspicious/unknown
    domainSimilarTo: domainSimilarTo || null,                  // Which trusted domain it resembles
    authorName: factors.find(f => f.id === 'author')?.details || null, // Detected author name
    sourceLinks: sourceLinks || [],                            // Credible source links found
    externalLinks: externalLinks || [],                        // Weak external links not counted as sources
    imageSourceCaptions: imageSourceCaptions || []             // Image credits found
  };
}

function getConfiguredArticleGateMode() {
  return new Promise((resolve) => {
    try {
      api.runtime.sendMessage({ action: 'getArticleGateMode' }, (response) => {
        if (api.runtime.lastError || !response || !response.success) {
          resolve('strict');
          return;
        }

        resolve(response.mode || 'strict');
      });
    } catch (e) {
      resolve('strict');
    }
  });
}

// Message listener for "analyze" action (triggered when popup clicks "Analyze Page")
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    try {
      let articleElement = getArticleElement(); // Find the main article container
      let text = articleElement.innerText;       // Get all visible text within it

      (async () => {
        const articleGateMode = await getConfiguredArticleGateMode();
        // First confirm this is a news/article page. If not, stop before scoring.
        const articleGate = typeof checkNewsArticlePage === 'function'
          ? checkNewsArticlePage(articleElement, articleGateMode)
          : {
              isNewsArticle: false,
              articleGateMode,
              articleChecks: {
                detector: {
                  id: 'detector',
                  label: 'Article detector',
                  passed: false,
                  details: 'Article detection script is unavailable.'
                }
              },
              nonArticleWarning: 'This page could not be verified as a news article.'
            };

        if (!articleGate.isNewsArticle) {
          const failedChecks = Object.values(articleGate.articleChecks || {})
            .filter(check => !check.passed)
            .map(check => ({ text: check.label, reasonId: check.id }));

          sendResponse({
            isNewsArticle: false,
            score: null,
            rawScore: null,
            maxScore: null,
            level: "Not a News Article",
            factors: [],
            explanation: failedChecks,
            nonArticleWarning: articleGate.nonArticleWarning,
            articleChecks: articleGate.articleChecks,
            articleGateMode: articleGate.articleGateMode,
            domain: normalizeHost(window.location.hostname || ''),
            sourceLinks: [],
            externalLinks: [],
            imageSourceCaptions: []
          });
          return;
        }

        const result = await analyzeContent(text, articleElement);
        sendResponse({
          ...result,
          isNewsArticle: true,
          articleChecks: articleGate.articleChecks,
          articleGateMode: articleGate.articleGateMode,
          articleGateWarning: articleGate.articleGateWarning
        });
      })().catch(error => {
        console.error("Analysis error:", error);
        // Return a safe error response so the popup doesn't hang
        sendResponse({
          score: 0,
          level: "❌ Error",
          explanation: [{ text: "Analysis failed - try reloading", reasonId: "error" }]
        });
      });
      
      return true; // Tells Chrome we'll respond asynchronously (required for async listeners)
    } catch (error) {
      console.error("Content script error:", error);
      sendResponse({
        score: 0,
        level: "❌ Error",
        explanation: [{ text: "Analysis failed - check console for details", reasonId: "error" }]
      });
    }
  }
});

// Message listener for "scrollToReason" action (triggered when user clicks a "Go" button)
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrollToReason") {
    let elements = [];
    const reasonId = request.reasonId; // Which issue type to scroll to (e.g. 'clickbait')
    const index = request.index || 0;  // Which occurrence to scroll to (for cycling)
    
    // Find all elements that were tagged with this reason ID during highlighting
    elements = Array.from(document.querySelectorAll(`[data-reason-id="${reasonId}"]`));
    
    // Special case: image credits are often captions below images, not text marks.
    // Re-run the image-credit locator so the Go button can still find them.
    if (reasonId === 'imageSource') {
      let detectedImageCredits = [];
      const articleElement = typeof getArticleElement === 'function'
        ? getArticleElement()
        : document.body;

      elements = elements.filter(element => articleElement && articleElement.contains(element));

      if (typeof getImageCreditElements === 'function') {
        detectedImageCredits = getImageCreditElements(articleElement);
      } else {
        const imageCreditRegex = /\b(source|photo|image|credit|via|copyright|getty images|associated press|ap photo|reuters|afp)\b|\u00a9/i;
        const fallbackCandidates = Array.from(articleElement.querySelectorAll(
          'figcaption, .caption, .caption-text, .image-caption, .img-caption, .photo-caption, .photo-credit, .image-credit, .media-caption, .wp-caption-text, [class*="caption"], [class*="credit"], [class*="copyright"], img'
        ));

        detectedImageCredits = fallbackCandidates.filter(el => {
          const text = (el.innerText || el.textContent || el.alt || el.title || '').replace(/\s+/g, ' ').trim();
          return text && text.length <= 500 && imageCreditRegex.test(text);
        });
      }

      detectedImageCredits.forEach(el => {
        if (typeof markImageCreditElement === 'function') {
          markImageCreditElement(el);
        } else {
          el.setAttribute('data-reason-id', 'imageSource');
          el.classList.add('nd-highlight', 'nd-imageSource');
        }
      });

      elements = Array.from(new Set([...elements, ...detectedImageCredits]));
    }
    
    if (elements.length > 0) {
      // Clamp index to array bounds (in case index > totalFound somehow)
      const targetIndex = Math.min(index, elements.length - 1);
      const element = elements[targetIndex];
      
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" }); // Smooth scroll to element
        element.style.boxShadow = "0 0 10px 2px rgba(255, 0, 0, 0.7)"; // Red glow effect
        setTimeout(() => {
          element.style.boxShadow = ""; // Remove glow after 2 seconds
        }, 2000);
        sendResponse({ success: true, totalFound: elements.length, currentIndex: targetIndex });
      } else {
        sendResponse({ success: false, message: "Element not found", totalFound: elements.length });
      }
    } else {
      sendResponse({ success: false, message: "No elements found for this reason", totalFound: 0 });
    }
  }
});

// Message listener for "getKeywords" action (used by related-articles.js to build search URLs)
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getKeywords") {
    // Get page title from h1, <title> element, or document.title
    let title = document.querySelector("h1")?.textContent || 
                document.querySelector("title")?.textContent || 
                document.title || "";
    
    // Extract main article text, limited to first 500 characters for efficiency
    let articleElement = document.querySelector('article') || document.body;
    let text = articleElement.innerText.substring(0, 500);
    
    // Set of common English words to skip when extracting keywords
    let commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'do', 'does', 'did']);

    // Extract all lowercase 4+ character words from the text
    let words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    // Filter out common words and take first 5 unique meaningful words
    let keywords = words.filter(w => !commonWords.has(w)).slice(0, 5).join(" ");
    
    sendResponse({
      title: title.trim(),    // Clean page title for display
      keywords: keywords      // Space-joined keyword string for search queries
    });
  }
});
