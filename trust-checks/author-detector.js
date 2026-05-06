// ============================================
// AUTHOR-DETECTOR.JS - Author detection
// ============================================
// Multi-strategy author detection from meta, JSON-LD, selectors, and page structure

// Cleans raw author strings by removing common noise like "By:", dates, and pipes
function cleanAuthorText(raw) {
  if (!raw) return null;                                // Return null for empty input
  let s = raw.replace(/\s+/g, ' ').trim();             // Collapse multiple spaces into one
  s = s.replace(/^By\s*[:\-\s]?/i, '');               // Remove leading "By", "By:", "By -" etc.
  s = s.replace(/\s*on\s+\w+.*/i, '');                // Remove trailing " on Monday..." style dates
  s = s.split(/\||•|·|—|\n/)[0].trim();               // Take only text before pipe/bullet/dash/newline
  s = s.replace(/,?\s*\w+\s+\d{1,2},?\s*\d{4}$/, ''); // Remove trailing dates like "Jan 5, 2024"
  s = s.replace(/\s+\(.*?\)$/, '').trim();            // Remove trailing parenthetical e.g. "(Reuters)"
  if (s.length === 0) return null;                     // Return null if nothing meaningful remains
  return s;                                            // Return the cleaned author name
}

// Extracts an author name string from various author data shapes (string, array, or object)
function getNameFromAuthorObject(a) {
  if (!a) return null;                                          // Guard against null/undefined
  if (typeof a === 'string') return cleanAuthorText(a);         // Plain string: clean and return
  if (Array.isArray(a)) return getNameFromAuthorObject(a[0]);   // Array: use first element
  if (a.name) return cleanAuthorText(a.name);                   // Object with .name property
  if (a['@type'] && a.author) return getNameFromAuthorObject(a.author); // Nested author object
  return null;                                                  // Can't extract a name
}

// Attempts to find the author from HTML <meta> tags in the document <head>
function getAuthorFromMeta() {
  try {
    // Query for any of the common meta tag patterns used to declare an author
    const meta = document.querySelector(
      'meta[name="author"], meta[name="Author"], meta[property="article:author"], ' +
      'meta[name="article:author"], meta[name="twitter:creator"], meta[name="twitter:author"]'
    );
    if (meta && meta.content) return cleanAuthorText(meta.content); // Use the content attribute

    // Try an <a rel="author"> link tag (often used in bylines)
    const linkAuthor = document.querySelector('a[rel="author"]');
    if (linkAuthor && linkAuthor.innerText) return cleanAuthorText(linkAuthor.innerText);

    // Try a <link rel="author"> element (less common, href is used)
    const linkRel = document.querySelector('link[rel="author"]');
    if (linkRel && linkRel.href) return cleanAuthorText(linkRel.href.split('/').pop()); // Last path segment
  } catch (e) { /* ignore any DOM errors */ }
  return null; // No meta author found
}

// Attempts to find the author from structured JSON-LD data embedded in the page
function getAuthorFromJsonLd() {
  try {
    // Find all <script type="application/ld+json"> blocks on the page
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (let s of scripts) {
      try {
        const data = JSON.parse(s.textContent); // Parse the JSON-LD block
        if (!data) continue;                     // Skip if parsing returned nothing

        // Normalize to an array of nodes (handles both @graph arrays and single objects)
        const nodes = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);

        for (let node of nodes) {
          if (!node) continue;

          // Check for a top-level 'author' property
          if (node.author) {
            const name = getNameFromAuthorObject(node.author);
            if (name) return name; // Return immediately if found
          }

          // Also check nodes explicitly typed as article-like content
          if (node['@type'] && /Article|NewsArticle|BlogPosting/i.test(node['@type'])) {
            if (node.author) {
              const name = getNameFromAuthorObject(node.author);
              if (name) return name;
            }
          }
        }
      } catch (e) { continue; } // Skip malformed JSON-LD blocks
    }
  } catch (e) { /* ignore outer errors */ }
  return null; // No JSON-LD author found
}

// Specialized function to extract author from "By FirstName LastName" patterns
// Searches for variations like "By", "Written by", "Author:", etc. followed by a person's name
function extractAuthorByPattern(text) {
  if (!text) return null;
  
  // Match patterns like "By John Smith", "Written by Jane Doe", "Author: Bob Johnson"
  // Handles: By/Written by/Author/Created by/Posted by, with optional colons/hyphens
  const patterns = [
    /(?:by|written\s+by|author|created\s+by|posted\s+by|contributor|authored\s+by|filed\s+by)[\s:\-]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?)/i,
    // More lenient: Match capitalized words after "by"
    /\bby\b\s+([A-Z][a-z\-']+\s+[A-Z][a-z\-']+)/i,
    // Handle surnames with prefixes (van, von, de, etc.)
    /(?:by|author)[\s:\-]+([A-Z][a-z]+\s+(?:van|von|de|da|di|du|le|la|los|las)?\s*[A-Z][a-z\-']+)/i
  ];
  
  for (let pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Validate: reasonable name length (5-80 chars) and contains at least one space (First Last)
      if (name.length >= 5 && name.length <= 80 && name.includes(' ')) {
        return cleanAuthorText(name);
      }
    }
  }
  
  return null;
}

// Searches for "By FirstName LastName" pattern throughout the document
// This strategy finds author bylines outside the main article text
function findAuthorByPattern() {
  try {
    // Priority locations to search (usually outside main text):
    // 1. Meta tags and headers
    // 2. Byline elements
    // 3. Article metadata sections
    
    // Check common byline/meta areas first
    const bylineAreas = document.querySelectorAll(
      '.byline, .article-byline, .post-byline, .author-byline, ' +
      '.article-meta, .post-meta, .entry-meta, ' +
      '[class*="byline"], [class*="author-info"], [class*="author-meta"], ' +
      'header, .article-header, .post-header, .entry-header'
    );
    
    for (let area of bylineAreas) {
      if (!area) continue;
      const text = area.innerText || area.textContent;
      const author = extractAuthorByPattern(text);
      if (author) {
        return { name: author, element: area, method: 'by-pattern:byline-area' };
      }
    }
    
    // Search in text nodes near the top of the page (before main content)
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    let textNodesSearched = 0;
    const maxNodesToSearch = 150; // Limit search to first 150 text nodes to avoid performance issues
    
    while (node = walker.nextNode()) {
      if (textNodesSearched++ > maxNodesToSearch) break; // Stop after searching enough
      
      const text = node.nodeValue || '';
      const author = extractAuthorByPattern(text);
      
      if (author) {
        // Verify this isn't deep inside article content
        const parent = node.parentElement;
        if (parent && !parent.innerText?.includes('\n\n')) { // Not a large text block
          return { name: author, element: parent, method: 'by-pattern:text-node' };
        }
      }
    }
  } catch (e) { 
    // Silently handle any DOM errors
  }
  
  return null;
}

// Searches within a specific DOM element for author information using CSS selectors and text patterns
function findAuthorInElement(el) {
  if (!el) return null; // Guard against null element

  // Common CSS selectors used across many news and blog sites to mark author information
  const selectors = [
    '[itemprop="author"]',       // Schema.org microdata
    '[rel="author"]',            // Rel attribute link
    '.byline',                   // Generic byline class
    '.by-line',                  // Variant spelling
    '.article-byline',           // Article-specific byline
    '.author-name',              // Direct author name class
    '.author',                   // Generic author class
    '.post-author',              // WordPress post author
    '.contributor',              // Contributor label
    '.byline__name',             // BEM-style byline name
    '.byline-author',            // Variant byline author class
    '.article-meta__author',     // Article meta block author
    '.blog-author',              // Blog-specific author class
    '[data-author]'              // Data attribute fallback
  ];

  // Try each CSS selector and return the first one that has text content
  for (let sel of selectors) {
    try {
      const node = el.querySelector(sel);
      if (node && node.innerText) {
        const name = cleanAuthorText(node.innerText);
        if (name) return { name, element: node, method: `selector:${sel}` }; // Return match with metadata
      }
    } catch (e) { /* ignore invalid selectors */ }
  }

  // Fall back to a text-pattern scan: look for "By John Smith" style text anywhere in element
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); // Walk only text nodes
  let node;
  while (node = walker.nextNode()) {
    const t = node.nodeValue.trim(); // Get the text content of this text node
    
    // Try the advanced "By FirstName LastName" pattern
    const author = extractAuthorByPattern(t);
    if (author) {
      return { name: author, element: node.parentElement, method: 'text:by-firstname-lastname' };
    }
  }
  return null; // No author found in this element
}

// Main author detection function — tries multiple strategies in priority order
function findAuthor(articleElement) {
  // Strategy 1: Check HTML <meta> tags (fastest, most reliable when present)
  const meta = getAuthorFromMeta();
  if (meta) return { name: meta, element: null, method: 'meta' };

  // Strategy 2: Check JSON-LD structured data (very reliable on modern sites)
  const json = getAuthorFromJsonLd();
  if (json) return { name: json, element: null, method: 'json-ld' };

  // Strategy 3: Search for "By FirstName LastName" pattern (high-confidence byline pattern)
  // This is now earlier since it's very specific and reliable outside main text
  const byPattern = findAuthorByPattern();
  if (byPattern) return byPattern;

  // Strategy 4: Search the entire document using CSS selectors and text patterns
  const docCandidate = findAuthorInElement(document);
  if (docCandidate) return docCandidate;

  // Strategy 5: Look near the main headline (author bylines often follow the title)
  const titleEl = document.querySelector('h1, h2');
  if (titleEl) {
    // Search the next 6 sibling elements after the headline
    let sib = titleEl.nextElementSibling;
    for (let i = 0; i < 6 && sib; i++, sib = sib.nextElementSibling) {
      // Try selector search first, then fall back to raw text
      const cand = findAuthorInElement(sib) ||
        (sib.innerText && cleanAuthorText(sib.innerText)
          ? { name: cleanAuthorText(sib.innerText), element: sib, method: 'near-title-sibling' }
          : null);
      // Accept candidate only if name is short and not ad/promo content
      if (cand && cand.name && cand.name.length < 100 && !/advert|promo|subscribe/i.test(cand.name)) return cand;
    }

    // Also search up to 4 siblings BEFORE the headline (some layouts put author above title)
    sib = titleEl.previousElementSibling;
    for (let i = 0; i < 4 && sib; i++, sib = sib.previousElementSibling) {
      const cand = findAuthorInElement(sib) ||
        (sib.innerText && cleanAuthorText(sib.innerText)
          ? { name: cleanAuthorText(sib.innerText), element: sib, method: 'near-title-prev' }
          : null);
      if (cand && cand.name && cand.name.length < 100 && !/advert|promo|subscribe/i.test(cand.name)) return cand;
    }
  }

  // Strategy 6: Look just before the first paragraph of the article body
  try {
    const blocks = getArticleTextBlocks(articleElement); // Get readable text blocks
    const firstBlock = blocks && blocks.length ? blocks[0] : null;
    if (firstBlock) {
      let node = firstBlock.previousElementSibling; // Start from element before first paragraph
      for (let i = 0; i < 6 && node; i++, node = node.previousElementSibling) {
        const cand = findAuthorInElement(node) ||
          (node.innerText && cleanAuthorText(node.innerText)
            ? { name: cleanAuthorText(node.innerText), element: node, method: 'before-article' }
            : null);
        if (cand && cand.name && cand.name.length < 100 && !/advert|promo|subscribe/i.test(cand.name)) return cand;
      }
    }
  } catch (e) { /* ignore */ }

  // Strategy 7: Last-resort selector search for very generic author elements
  const fallback = document.querySelector('[rel="author"], .author, #author');
  if (fallback && fallback.innerText) {
    return { name: cleanAuthorText(fallback.innerText), element: fallback, method: 'fallback-selector' };
  }

  return null; // Could not detect an author
}
