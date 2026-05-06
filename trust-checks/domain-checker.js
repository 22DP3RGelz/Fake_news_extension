// ============================================
// DOMAIN-CHECKER.JS - Domain reputation check
// ============================================
// Checks: trusted domains, suspicious typosquats, unknown domains

// Evaluates the current page's domain against the trusted domain list
// Returns a score contribution plus metadata about the domain status
async function checkDomain(weights) {
  let rawScore = 0;          // Cumulative risk score to add to the total
  let factors = [];          // Array of factor objects to display in the popup
  let domainStatus = 'unknown';   // Will be set to 'trusted', 'suspicious', or 'unknown'
  let domainSimilarTo = null;     // If suspicious, stores the trusted domain it resembles

  // Get the current page's hostname from the browser URL bar
  const rawHostname = window.location.hostname || '';
  // Normalize it (lowercase, strip www.) for consistent comparison
  const normHost = normalizeHost(rawHostname);
  // Extract just the registrable domain (e.g. "sub.bbc.co.uk" → "bbc.co.uk")
  const mainHost = extractMainDomain(normHost);

  // Load the hardcoded trusted domains list (from trust-checks/trusted-domains.js)
  const trusted = (
    typeof window.getTrustedNewsDomains === 'function'
      ? window.getTrustedNewsDomains()          // Use the accessor function if available
      : (window.TRUSTED_NEWS_DOMAINS || [])      // Fall back to direct array access
  ).map(d => normalizeHost(d));                  // Normalize each entry for comparison

  // Load any user-approved domains from extension storage (added via "Approve domain" button)
  const approved = await getApprovedDomains();

  // Combine both lists and extract main domains, stored in a Set for O(1) lookup
  const trustedSet = new Set([...trusted, ...approved].map(d => extractMainDomain(d)));

  // Check if the current domain is in our trusted set (either by full host or main domain)
  if (trustedSet.has(mainHost) || trustedSet.has(normHost)) {
    domainStatus = 'trusted'; // This domain is known and reputable
    factors.push({
      id: 'domain',
      label: 'Domain reputation',
      weight: weights.domain,
      triggered: false,           // 'triggered: false' means no issue — good signal
      details: normHost,          // Show the actual domain in the UI
      domainStatus
    });
  } else {
    // Domain not in trusted list — check for typosquatting via similarity scoring
    let best = { domain: null, similarity: 0 }; // Track best similarity match found

    // Compare the current domain against every trusted domain using Levenshtein distance
    for (let t of trusted) {
      const tMain = extractMainDomain(t);                       // Extract main domain of trusted entry
      const sim = similarityScore(mainHost, tMain);             // Score 0.0 – 1.0
      if (sim > best.similarity) best = { domain: t, similarity: sim }; // Keep the best match
    }

    // 80%+ similarity suggests a typosquatting attempt (e.g. "nytimes.co" vs "nytimes.com")
    if (best.similarity >= 0.8) {
      rawScore += weights.domain;            // Add to risk score
      domainStatus = 'suspicious';
      domainSimilarTo = best.domain;         // Store which trusted domain it resembles
      factors.push({
        id: 'domain',
        label: 'Domain looks similar to trusted site',
        weight: weights.domain,
        triggered: true,                     // 'triggered: true' = issue found
        details: `${normHost} ≈ ${best.domain} (sim=${best.similarity.toFixed(2)})`,
        domainStatus,
        similarTo: best.domain,             // Used in the popup to show which domain it mimics
        similarity: best.similarity          // Raw similarity score for debugging
      });
    } else {
      // Domain is not trusted and doesn't closely resemble a trusted one — simply unknown
      rawScore += weights.domain;            // Still adds risk since it's unverified
      domainStatus = 'unknown';
      factors.push({
        id: 'domain',
        label: 'Unknown domain',
        weight: weights.domain,
        triggered: true,
        details: normHost,
        domainStatus
      });
    }
  }

  // Return all results for the main content.js orchestrator to consume
  return { rawScore, factors, domainStatus, domainSimilarTo };
}
