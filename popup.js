// Detect Firefox vs Chrome and use the appropriate extension API object
const api = typeof browser !== "undefined" ? browser : chrome;
const POPUP_SIZES = ["small", "medium", "large"];
const POPUP_SIZE_LABELS = {
  small: "Small",
  medium: "Medium",
  large: "Large"
};

// Tracks which occurrence index we're currently showing for each issue type
// Allows "Go" buttons to cycle through multiple instances of the same issue
const issueIndexes = {};

// Sets up the popup UI — attaches event listeners and loads initial data
function setupUI() {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const popupSizeBtn = document.getElementById("popupSizeBtn");
  const settingsBtn = document.getElementById("settingsBtn");

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", handleAnalyzeClick); // Wire up main analyze button
  }

  setPopupSize("small");

  if (popupSizeBtn) {
    popupSizeBtn.addEventListener("click", cyclePopupSize);
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", openSettingsPage);
  }

  // Fetch and render related article links on popup load (from related-articles.js)
  if (typeof fetchRelatedArticles === 'function') {
    fetchRelatedArticles();
  }
}

function normalizePopupSize(size) {
  return POPUP_SIZES.includes(size) ? size : "small";
}

function getCurrentPopupSize() {
  const className = Array.from(document.body.classList)
    .find(name => name.startsWith("popup-size-"));

  return normalizePopupSize(className ? className.replace("popup-size-", "") : "small");
}

function setPopupSize(size) {
  const normalized = normalizePopupSize(size);
  const popupSizeBtn = document.getElementById("popupSizeBtn");

  document.body.classList.remove(...POPUP_SIZES.map(value => `popup-size-${value}`));
  document.body.classList.add(`popup-size-${normalized}`);

  if (popupSizeBtn) {
    popupSizeBtn.textContent = POPUP_SIZE_LABELS[normalized];
    popupSizeBtn.title = `Popup size: ${POPUP_SIZE_LABELS[normalized]}`;
  }
}

function cyclePopupSize() {
  const current = getCurrentPopupSize();
  const next = POPUP_SIZES[(POPUP_SIZES.indexOf(current) + 1) % POPUP_SIZES.length];

  setPopupSize(next);
}

function openSettingsPage() {
  if (api.runtime && typeof api.runtime.openOptionsPage === 'function') {
    api.runtime.openOptionsPage();
  }
}

// Run setup immediately if DOM is already loaded, otherwise wait for DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupUI); // DOM not ready yet — defer
} else {
  setupUI(); // DOM already ready — run immediately
}

// Renders the early-exit state when the current page is not a news article.
function renderNonArticleResponse(response) {
  const meterFill = document.getElementById("meter-fill");
  const scoreText = document.getElementById("scoreText");
  const resultEl = document.getElementById("result");
  const reasonsList = document.getElementById("reasons");
  const levelBadge = document.getElementById("levelBadge");
  const nonArticleWarningEl = document.getElementById("nonArticleWarning");
  const languageWarningEl = document.getElementById("languageWarning");
  const authorBox = document.getElementById("authorBox");
  const authorNameEl = document.getElementById("authorName");
  const domainStatusWrapper = document.getElementById("domainStatus");
  const domainInfoEl = document.getElementById("domainInfo");
  const domainActionsEl = document.getElementById("domainActions");
  const externalChecksWrapper = document.getElementById("externalChecksWrapper");
  const externalChecks = document.getElementById("externalChecks");
  const relatedArticlesTitle = document.getElementById("relatedArticlesTitle");
  const relatedArticles = document.getElementById("relatedArticles");

  if (scoreText) scoreText.innerText = "Score: N/A";
  if (meterFill) {
    meterFill.style.width = "0%";
    meterFill.style.background = "#adb5bd";
  }

  if (levelBadge) {
    levelBadge.style.display = "inline-block";
    levelBadge.className = "level-badge neutral";
    levelBadge.innerText = "Not a News Article";
  }

  if (resultEl) resultEl.innerText = "Analysis skipped";

  if (nonArticleWarningEl) {
    nonArticleWarningEl.style.display = "block";
    nonArticleWarningEl.innerText = response.nonArticleWarning ||
      "This page does not look like a news article.";
  }

  if (languageWarningEl) {
    languageWarningEl.style.display = "none";
    languageWarningEl.innerText = "";
  }

  if (authorBox) authorBox.style.display = "none";
  if (authorNameEl) authorNameEl.textContent = "";
  if (domainStatusWrapper) domainStatusWrapper.style.display = "none";
  if (domainInfoEl) domainInfoEl.innerHTML = "";
  if (domainActionsEl) domainActionsEl.innerHTML = "";
  if (externalChecksWrapper) externalChecksWrapper.style.display = "none";
  if (externalChecks) externalChecks.innerHTML = "";
  if (relatedArticlesTitle) relatedArticlesTitle.style.display = "none";
  if (relatedArticles) {
    relatedArticles.style.display = "none";
    relatedArticles.innerHTML = "";
  }

  if (!reasonsList) return;
  reasonsList.innerHTML = "";

  const checks = response.articleChecks
    ? Object.values(response.articleChecks)
    : [];
  const failedChecks = checks.filter(check => !check.passed);

  if (!failedChecks.length) {
    const li = document.createElement("li");
    li.className = "article-check-failed";
    li.textContent = "The page failed the news/article gate.";
    reasonsList.appendChild(li);
    return;
  }

  failedChecks.forEach(check => {
    const li = document.createElement("li");
    li.className = "article-check-failed";

    const left = document.createElement("div");
    left.className = "reason-left";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = check.label || "Article check failed";

    const detail = document.createElement("div");
    detail.className = "detail";
    detail.textContent = check.details || "";

    left.appendChild(label);
    if (detail.textContent) left.appendChild(detail);
    li.appendChild(left);
    reasonsList.appendChild(li);
  });
}

// Main handler function - runs when the user clicks "Analyze Page"
async function handleAnalyzeClick() {
  // Grab all the DOM elements we'll need to update during/after analysis
  const analyzeBtn = document.getElementById("analyzeBtn");
  const spinner = document.getElementById("spinner");
  const meterFill = document.getElementById("meter-fill");
  const scoreText = document.getElementById("scoreText");
  const resultEl = document.getElementById("result");
  const languageWarningEl = document.getElementById("languageWarning");
  const nonArticleWarningEl = document.getElementById("nonArticleWarning");
  const reasonsList = document.getElementById("reasons");
  const levelBadge = document.getElementById("levelBadge");
  const externalChecksWrapper = document.getElementById("externalChecksWrapper");
  const externalChecks = document.getElementById("externalChecks");
  const relatedArticlesTitle = document.getElementById("relatedArticlesTitle");
  const relatedArticles = document.getElementById("relatedArticles");

  try {
    // Reset issue navigation indexes from any previous analysis
    Object.keys(issueIndexes).forEach(key => delete issueIndexes[key]);
    
    analyzeBtn.disabled = true;                      // Disable button to prevent double-clicks
    spinner.classList.remove('hidden');              // Show spinner animation
    resultEl.innerText = "Analyzing...";            // Update result text
    levelBadge.style.display = 'none';              // Hide badge until a verdict is available
    levelBadge.innerText = "";
    scoreText.innerText = "Score: -";               // Reset score display
    languageWarningEl.style.display = 'none';       // Hide any previous language warning
    nonArticleWarningEl.style.display = 'none';     // Hide any previous non-article warning
    nonArticleWarningEl.innerText = '';
    externalChecksWrapper.style.display = 'none';   // Show only after analysis finishes
    relatedArticlesTitle.style.display = 'block';
    relatedArticles.style.display = 'block';
    reasonsList.innerHTML = '';                      // Clear previous issues list
    externalChecks.innerHTML = '';

    // Get the currently active browser tab
    let tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
      throw new Error('No active tab found'); // Guard against edge cases
    }

    let tab = tabs[0];
    // Send "analyze" message to content.js running on the active tab and await its response
    let response = await api.tabs.sendMessage(tab.id, { action: "analyze" });

    if (response && response.isNewsArticle === false) {
      renderNonArticleResponse(response);
      return;
    }

    // --- Normalize the score to a 0–10 integer ---
    // Handle multiple possible response shapes for backwards compatibility
    let score = 0;
    if (typeof response.score === 'number') score = response.score;
    else if (typeof response.riskScore === 'number') score = response.riskScore;
    else if (typeof response.rawScore === 'number' && typeof response.maxScore === 'number' && response.maxScore > 0) {
      score = Math.round((response.rawScore / response.maxScore) * 10); // Recalculate if needed
    } else if (typeof response.score === 'string') {
      score = Number(response.score) || 0; // Handle string scores
    }

    score = Math.max(0, Math.min(10, Number(score))); // Clamp to valid 0–10 range
    scoreText.innerText = `Score: ${score}/10`;       // Display the score

    // Update the meter bar width as a percentage of 10
    let percent = Math.min((score / 10) * 100, 100);
    meterFill.style.width = percent + "%";

    // Determine color class based on score range
    let levelClass = 'safe';
    if (score >= 6) levelClass = 'danger'; // Red zone
    else if (score >= 3) levelClass = 'warn'; // Yellow zone

    // Update the level badge appearance and text
    levelBadge.style.display = 'inline-block';
    levelBadge.className = `level-badge ${levelClass}`;
    levelBadge.innerText = response.level ||
      (levelClass === 'danger' ? 'Highly Suspicious' : levelClass === 'warn' ? 'Possibly Misleading' : 'Likely Safe');
    resultEl.innerText = '';

    // Set meter bar color to match the risk level
    if (levelClass === 'safe') meterFill.style.background = '#2ecc71';       // Green
    else if (levelClass === 'warn') meterFill.style.background = '#f39c12';  // Orange
    else meterFill.style.background = '#e74c3c';                             // Red

    if (response.articleGateWarning) {
      nonArticleWarningEl.style.display = 'block';
      nonArticleWarningEl.innerText = response.articleGateWarning;
    }

    // Show language warning if the article is not in English
    if (response.languageWarning) {
      languageWarningEl.style.display = 'block';
      languageWarningEl.innerText = response.languageWarning;
    } else {
      languageWarningEl.style.display = 'none';
      languageWarningEl.innerText = '';
    }

    // --- Render detected author information ---
    const authorBox = document.getElementById('authorBox');
    const authorNameEl = document.getElementById('authorName');
    if (authorBox) authorBox.style.display = 'none';       // Hide by default
    if (authorNameEl) authorNameEl.textContent = '';

    // Find the author factor in the response (not triggered = author was found)
    const authorFactor = (response.factors || []).find(f => f.id === 'author');
    if (authorFactor && !authorFactor.triggered && authorFactor.details) {
      if (authorNameEl) authorNameEl.textContent = authorFactor.details; // Show author name
      if (authorBox) authorBox.style.display = 'block';                  // Make box visible
    }

    // --- Render domain status section ---
    const domainStatusWrapper = document.getElementById('domainStatus');
    const domainInfoEl = document.getElementById('domainInfo');
    const domainActionsEl = document.getElementById('domainActions');
    if (domainInfoEl) domainInfoEl.innerHTML = '';           // Clear previous content
    if (domainActionsEl) domainActionsEl.innerHTML = '';
    if (domainStatusWrapper) domainStatusWrapper.style.display = 'none';

    if (response.domain) {
      if (domainStatusWrapper) domainStatusWrapper.style.display = 'block'; // Show domain block

      // Get domain status from response or from the domain factor in factors array
      const ds = response.domainStatus ||
        (response.factors && response.factors.find(f => f.id === 'domain')?.domainStatus) || 'unknown';
      const displayDomain = response.domain;

      if (ds === 'trusted') {
        // Green — domain is on the trusted list
        domainInfoEl.innerHTML = `<strong>Domain:</strong> ${displayDomain} — <span style="color:#2ecc71">Trusted</span>`;
      } else if (ds === 'suspicious') {
        // Red — domain looks like it's impersonating a trusted one
        const similar = response.domainSimilarTo ||
          (response.factors && response.factors.find(f => f.id === 'domain')?.similarTo) || '';
        domainInfoEl.innerHTML = `<strong>Domain:</strong> ${displayDomain} — <span style="color:#e74c3c">Suspicious (similar to ${similar})</span>`;
      } else {
        // Orange — unknown domain; offer the user a way to approve it
        domainInfoEl.innerHTML = `<strong>Domain:</strong> ${displayDomain} — <span style="color:#f39c12">Unknown</span>`;

        // Create "Approve domain" button for user to whitelist this domain
        const approveBtn = document.createElement('button');
        approveBtn.className = 'approve-btn';
        approveBtn.textContent = 'Approve domain';
        approveBtn.onclick = async () => {
          try {
            approveBtn.disabled = true;
            approveBtn.textContent = 'Approving...';

            const approveResponse = await api.runtime.sendMessage({
              action: 'approveUserDomain',
              domain: displayDomain,
              metadata: { source: 'popup' }
            });

            if (!approveResponse || !approveResponse.success) {
              throw new Error(approveResponse?.error || 'Approve failed');
            }

            approveBtn.disabled = true;
            approveBtn.textContent = 'Approved';
            domainInfoEl.innerHTML = `<strong>Domain:</strong> ${displayDomain} - <span style="color:#2ecc71">Trusted (user-approved)</span>`;
            return;

            // Try to save approved domain to chrome.storage.local (preferred)
            if (api && api.storage && api.storage.local && typeof api.storage.local.get === 'function') {
              api.storage.local.get(['approvedDomains'], (res) => {
                const arr = (res && res.approvedDomains && Array.isArray(res.approvedDomains))
                  ? res.approvedDomains : [];
                if (!arr.map(d => d.toLowerCase()).includes(displayDomain.toLowerCase())) {
                  arr.push(displayDomain); // Add this domain to the approved list
                  api.storage.local.set({ approvedDomains: arr }, () => {
                    approveBtn.disabled = true;
                    approveBtn.textContent = 'Approved';
                    domainInfoEl.innerHTML = `<strong>Domain:</strong> ${displayDomain} — <span style="color:#2ecc71">Trusted (user-approved)</span>`;
                  });
                } else {
                  // Domain was already approved
                  approveBtn.disabled = true;
                  approveBtn.textContent = 'Already Approved';
                }
              });
            } else {
              // Fallback: use page localStorage if extension storage isn't available
              let arr = [];
              try { arr = JSON.parse(localStorage.getItem('approvedDomains') || '[]'); } catch (e) { arr = []; }
              if (!arr.map(d => d.toLowerCase()).includes(displayDomain.toLowerCase())) {
                arr.push(displayDomain);
                localStorage.setItem('approvedDomains', JSON.stringify(arr)); // Persist to localStorage
                approveBtn.disabled = true;
                approveBtn.textContent = 'Approved';
                domainInfoEl.innerHTML = `<strong>Domain:</strong> ${displayDomain} — <span style="color:#2ecc71">Trusted (user-approved)</span>`;
              } else {
                approveBtn.disabled = true;
                approveBtn.textContent = 'Already Approved';
              }
            }
          } catch (e) {
            console.error('Approve failed', e);
            approveBtn.disabled = false;
            approveBtn.textContent = 'Approve domain'; // Re-enable on failure
          }
        };

        domainActionsEl.appendChild(approveBtn); // Add approve button to the DOM
      }
    }

    // --- Render the Issues list (factors) ---
    // MODULAR DESIGN: This section intelligently filters and displays ONLY relevant issues
    // - Excludes author/domain (shown separately above)
    // - Excludes language checks for non-English articles
    // - Shows negative indicators only when problem found (triggered = true)
    // - Shows positive indicators only when signal found (triggered = false)
    // Result: Clean, clutter-free issues list with only necessary information
    reasonsList.innerHTML = ''; // Clear the list

    // Set of factor IDs that support "Go" button navigation (scroll to highlighted text)
    const navigable = new Set(['clickbait', 'caps', 'wire', 'anonymous', 'imageSource', 'links', 'attribution', 'punct']);

    // Factor IDs that are shown separately above the issues section (don't repeat them)
    const excludeFromIssues = new Set(['author', 'domain']);

    // Factor IDs that are language-dependent (skip if non-English article)
    const languageDependentChecks = new Set(['clickbait', 'caps', 'punct', 'misleading']);

    // Positive indicator factors: show when triggered = false (i.e., good thing was found)
    const positiveIndicators = new Set(['links', 'attribution', 'imageSource', 'wire']);

    // Determine if this is a non-English article
    const isNonEnglish = response.languageWarning && response.languageWarning.length > 0;

    if (Array.isArray(response.factors) && response.factors.length) {
      // Filter and process factors for display
      const relevantFactors = response.factors.filter(f => {
        // 1. Skip factors shown in separate sections (author, domain)
        if (excludeFromIssues.has(f.id)) return false;

        // 2. Skip language-dependent checks for non-English articles
        if (isNonEnglish && languageDependentChecks.has(f.id)) return false;

        // 3. Show positive indicators only when NOT triggered (i.e., good thing found)
        // Links are useful in both states: either credible sources were found, or source links are missing.
        if (f.id === 'links') return true;

        // 4. Show positive indicators only when NOT triggered (i.e., good thing found)
        if (positiveIndicators.has(f.id)) {
          return !f.triggered && f.found !== false; // Show only when the signal was actually found
        }

        // 5. Show negative indicators only when triggered (i.e., problem found)
        return f.triggered; // Show if triggered = true (issue found)
      });

      // Render only the relevant factors
      if (relevantFactors.length === 0) {
        // No issues found — show a positive message
        const li = document.createElement('li');
        li.style.color = '#2ecc71';
        li.textContent = '✓ No major issues detected';
        reasonsList.appendChild(li);
      } else {
        relevantFactors.forEach(f => {
          const li = document.createElement('li'); // One list item per factor

          // Left side: label and detail text
          const left = document.createElement('div');
          left.className = 'reason-left';
          const label = document.createElement('div');
          label.className = 'label';
          label.textContent = f.label || f.text || 'Issue'; // Factor name
          const detail = document.createElement('div');
          detail.className = 'detail';
          // Show details if present, otherwise omit (cleaner UI)
          detail.textContent = f.id === 'imageSource' ? '' : (f.details || '');
          left.appendChild(label);
          if (detail && detail.textContent) left.appendChild(detail);

          // Right side: "Go" button for navigating to highlighted occurrences in the page
          const actions = document.createElement('div');
          actions.className = 'reason-actions';

          // Show Go button for navigable factors
          // For positive indicators: show button when triggered = false (i.e., links were found)
          // For negative indicators: show button when triggered = true (i.e., issue occurred)
          const hasImageCreditTargets = f.id !== 'imageSource' ||
            (Array.isArray(f.captions) && f.captions.length > 0) ||
            (typeof f.details === 'string' && f.details.trim().length > 0);
          const showGoButton = navigable.has(f.id) &&
            hasImageCreditTargets &&
            (f.id === 'links' ? !f.triggered : (positiveIndicators.has(f.id) ? !f.triggered : f.triggered));
          
          if (showGoButton) {
            const btn = document.createElement('button');
            btn.textContent = ' Go ';
            btn.onclick = async () => {
              // Initialize index tracker for this issue type if not already set
              if (!(f.id in issueIndexes)) {
                issueIndexes[f.id] = 0; // Start at first occurrence
              }
              
              // Send scroll request to content.js
              let tabs2 = await api.tabs.query({ active: true, currentWindow: true });
              const response2 = await api.tabs.sendMessage(tabs2[0].id, { 
                action: 'scrollToReason', 
                reasonId: f.id,
                index: issueIndexes[f.id] // Which occurrence to jump to
              });
              
              // Advance index so next click goes to the next occurrence (wraps around)
              if (response2 && response2.success && response2.totalFound > 0) {
                issueIndexes[f.id] = (issueIndexes[f.id] + 1) % response2.totalFound;
              }
            };
            actions.appendChild(btn);
          }

          li.appendChild(left);
          li.appendChild(actions);
          reasonsList.appendChild(li); // Add this factor row to the issues list
        });
      }
    } else if (Array.isArray(response.explanation)) {
      // Fallback: render plain explanation array if factors aren't available
      response.explanation.forEach(r => {
        let li = document.createElement('li');
        li.textContent = typeof r === 'string' ? r : r.text || r;
        reasonsList.appendChild(li);
      });
    } else {
      // No data at all - show fallback message
      const li = document.createElement('li');
      li.style.color = '#2ecc71';
      li.textContent = 'No issues detected';
      reasonsList.appendChild(li);
    }

    // --- Build External Fact-Check Links ---
    try {
      // Clean the tab title by removing anything after " - " or " | " (site name suffix)
      const rawText = String(tab.title || tab.url || '')
        .split(' | ')[0]
        .split(' - ')[0]
        .trim();
      const searchText = rawText || tab.url || '';
      const q = encodeURIComponent(searchText); // URL-encode for use in query strings

      externalChecksWrapper.style.display = 'block';
      externalChecks.innerHTML = ''; // Clear loading placeholder

      // Site-specific fact-check searches
      const engines = [
        // Use Google site: search for fact-checking sites (their own search may miss some)
        { name: 'Snopes (site search)', url: `https://www.google.com/search?q=${encodeURIComponent('site:snopes.com ' + searchText)}` },
        { name: 'PolitiFact (site search)', url: `https://www.google.com/search?q=${encodeURIComponent('site:politifact.com ' + searchText)}` },
        { name: 'FactCheck.org (site search)', url: `https://www.google.com/search?q=${encodeURIComponent('site:factcheck.org ' + searchText)}` },
        { name: 'PolitiFact direct', url: `https://www.politifact.com/search/?q=${q}` } // PolitiFact's own search
      ];

      // Create a clickable link for each fact-checking engine
      engines.forEach(e => {
        const a = document.createElement('a');
        a.href = e.url;
        a.target = '_blank';             // Open in new tab
        a.rel = 'noopener noreferrer';   // Security: prevent new tab from accessing opener
        a.textContent = e.name;
        a.style.display = 'block';
        a.style.marginBottom = '6px';
        externalChecks.appendChild(a);
      });

      // Display the source links found in the article (from source-checker.js)
      const sourceLinks = Array.isArray(response.sourceLinks) ? response.sourceLinks : [];
      const externalLinks = Array.isArray(response.externalLinks) ? response.externalLinks : [];

      if (sourceLinks.length) {
        const header = document.createElement('div');
        header.style.marginTop = '8px';
        header.style.fontSize = '12px';
        header.style.color = '#333';
        header.textContent = 'Cited external sources found in article:';
        externalChecks.appendChild(header);

        // Show up to 5 source links
        sourceLinks.slice(0, 5).forEach(s => {
          try {
            const la = document.createElement('a');
            la.href = s.href;
            la.target = '_blank';
            la.rel = 'noopener noreferrer';
            la.textContent = s.text || s.href; // Use link text or fall back to URL
            la.style.display = 'block';
            la.style.marginBottom = '4px';
            externalChecks.appendChild(la);
          } catch (e) { /* ignore links with malformed URLs */ }
        });
      } else {
        // No source links found — show informational note
        const p = document.createElement('div');
        p.style.marginTop = '8px';
        p.style.fontSize = '12px';
        p.style.color = '#666';
        p.textContent = externalLinks.length
          ? `Other external links found (${externalLinks.length}), but none look like cited sources.`
          : 'No explicit external sources detected in article.';
        externalChecks.appendChild(p);
      }

      if (sourceLinks.length && externalLinks.length) {
        const p = document.createElement('div');
        p.style.marginTop = '6px';
        p.style.fontSize = '12px';
        p.style.color = '#666';
        p.textContent = `Other external links found (${externalLinks.length}) were not counted as cited sources.`;
        externalChecks.appendChild(p);
      }

    } catch (e) {
      console.warn('External checks build failed', e); // Non-fatal — log and continue
    }

  } catch (error) {
    console.error("Error analyzing page:", error);
    resultEl.innerText = "Error - Try reloading the page"; // Show user-friendly error
  } finally {
    // Always runs — clean up UI state whether analysis succeeded or failed
    try { 
      analyzeBtn.style.display = 'none'; // Hide button after analysis (result is now shown)
      spinner.classList.add('hidden');   // Stop and hide spinner
    } catch(e){}
  }
}
