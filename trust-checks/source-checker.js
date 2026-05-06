// ============================================
// SOURCE-CHECKER.JS - Source credibility checks
// ============================================
// Checks: attribution, hyperlinks quality, wire services, anonymous sources, image captions

// Evaluates the quality and quantity of sources cited in the article
async function checkSources(searchText, articleElement, weights) {
  let rawScore = 0;               // Cumulative risk score from source checks
  let factors = [];               // Factor objects to display in popup
  let sourceLinks = [];           // Collection of detected credible source links
  let externalLinks = [];         // Weak external links that are not counted as sources
  let imageSourceCaptions = [];   // Collection of image credit/caption text found

  // --- Check 1: Direct Attribution Phrases ---
  // Regex matches common journalistic attribution phrases
  const attributionRegex = /\baccording to\b|\breported by\b|\breports? say\b|\bwas quoted as saying\b|\bsaid [A-Z][a-z]+/gi;
  const attrMatches = (searchText.match(attributionRegex) || []);
  if (attrMatches.length) {
    factors.push({
      id: 'attribution',
      label: 'Direct attribution present',
      weight: weights.attribution || 1,
      triggered: false,
      details: attrMatches.slice(0, 3).join('; ')
    });
    highlightPattern(articleElement, attributionRegex, 'attribution');
  } else {
    rawScore += weights.attribution || 1;
    factors.push({
      id: 'attribution',
      label: 'Direct attribution present',
      weight: weights.attribution || 1,
      triggered: true
    });
  }

  // --- Check 2: Hyperlinks and External Source Quality ---
  // Only scan anchors inside readable article text blocks to avoid sidebars and related links.
  const articleBlocks = typeof getArticleTextBlocks === 'function'
    ? getArticleTextBlocks(articleElement)
    : [articleElement];
  const anchors = Array.from(new Set(articleBlocks.flatMap(block =>
    block && typeof block.querySelectorAll === 'function'
      ? Array.from(block.querySelectorAll('a[href]'))
      : []
  )));

  const currentHost = normalizeHost(window.location.hostname || '');
  const currentMainDomain = typeof extractMainDomain === 'function'
    ? extractMainDomain(currentHost)
    : currentHost;
  const rejectedContainerSelector = [
    'nav',
    'header',
    'footer',
    'aside',
    '.share',
    '.social',
    '.related',
    '.recommended',
    '.newsletter',
    '.ad',
    '.tags',
    '.topics',
    '.breadcrumb',
    '.author',
    '.byline'
  ].join(',');
  const nonSourcePathRegex = /\/(?:login|log-in|signin|sign-in|signup|sign-up|register|subscribe|subscription|account|profile|tag|tags|category|categories|topic|topics|author|authors|privacy|contact|about|share|shares|sharing|sharer)(?:\/|$)/i;
  const trackingOrShareHostRegex = /(^|\.)((facebook|twitter|x|linkedin|pinterest|reddit|whatsapp|telegram|threads)\.com|t\.co|bit\.ly|tinyurl\.com|sharethis\.com|addthis\.com|doubleclick\.net|googlesyndication\.com|google-analytics\.com)$/i;
  const genericLinkTextRegex = /^(click here|read more|view|continue|next|more info|share|subscribe|sign up|log in|login)$/i;
  const articleReferenceTextRegex = /^(?:[$]?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:million|billion|trillion|thousand|percent|%|won|dollars?|euros?|pounds?)){0,3}|(?:more|full|related)\s+(?:coverage|story|article))$/i;
  const authoritativeLinkRegex = /\.gov(?:\/|$)|\.edu(?:\/|$)|doi\.org|\.pdf(?:[?#]|$)|apnews|reuters|bbc\.co|nytimes|washingtonpost|theguardian/i;
  const citationContextRegex = /\b(according to|reported by|reports? say|data from|figures? from|study by|research by|report from|filing by|statement from|source:|source link|quoted|cited by|via|documents? from|records? from)\b/i;
  const sourceLabelRegex = /\b(source|study|report|filing|statement|dataset|data|document|records?)\b/i;
  const seenSourceHosts = new Set();
  const seenExternalUrls = new Set();

  const getLinkText = (a) => (a.innerText || a.textContent || a.title || a.href || '').trim();
  const getContextText = (a) => {
    const parent = a.closest('p, li, blockquote, figcaption') || a.parentElement;
    return (parent && (parent.innerText || parent.textContent) || getLinkText(a)).trim();
  };
  const isSameSite = (host) => {
    const mainDomain = typeof extractMainDomain === 'function'
      ? extractMainDomain(host)
      : host;
    return host === currentHost || mainDomain === currentMainDomain;
  };
  const parseUsableUrl = (a) => {
    try {
      const rawHref = a.getAttribute('href') || '';
      if (!rawHref || rawHref.trim().startsWith('#')) return null;

      const url = new URL(rawHref, window.location.href);
      const protocol = url.protocol.toLowerCase();
      if (protocol !== 'http:' && protocol !== 'https:') return null;
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.hash &&
        !url.search
      ) {
        return null;
      }

      return url;
    } catch (e) {
      return null;
    }
  };
  const shouldRejectLink = (a, url, text) => {
    if (!url || !url.hostname) return true;
    if (a.closest(rejectedContainerSelector)) return true;
    if (genericLinkTextRegex.test(text.toLowerCase())) return true;
    if (nonSourcePathRegex.test(url.pathname)) return true;
    if (trackingOrShareHostRegex.test(normalizeHost(url.hostname))) return true;

    return false;
  };
  const addSourceLink = (a, url, text, type) => {
    const host = normalizeHost(url.hostname);
    if (seenSourceHosts.has(host) || sourceLinks.length >= 10) return;

    seenSourceHosts.add(host);
    sourceLinks.push({ href: url.href, text, host, type });
    a.setAttribute('data-reason-id', 'links');
    a.classList.add('nd-highlight', 'nd-links');
  };
  const addWeakExternalLink = (url, text) => {
    if (externalLinks.length >= 10 || seenExternalUrls.has(url.href)) return;

    seenExternalUrls.add(url.href);
    externalLinks.push({
      href: url.href,
      text,
      host: normalizeHost(url.hostname),
      type: 'external'
    });
  };

  const linkCandidates = anchors
    .map(a => {
      const url = parseUsableUrl(a);
      const text = getLinkText(a);
      return { a, url, text, contextText: getContextText(a) };
    })
    .filter(candidate =>
      candidate.url &&
      candidate.text.length > 2 &&
      candidate.text.length < 200 &&
      !shouldRejectLink(candidate.a, candidate.url, candidate.text) &&
      !isSameSite(normalizeHost(candidate.url.hostname))
    );

  linkCandidates.forEach(({ a, url, text, contextText }) => {
    const hasSourceLabel = sourceLabelRegex.test(text);
    const hasCitationContext = citationContextRegex.test(contextText);
    const isArticleReference = articleReferenceTextRegex.test(text);

    if (!isArticleReference && (authoritativeLinkRegex.test(url.href) || authoritativeLinkRegex.test(text))) {
      addSourceLink(a, url, text, 'authoritative');
    } else if (!isArticleReference && (hasCitationContext || hasSourceLabel)) {
      addSourceLink(a, url, text, 'cited');
    } else {
      addWeakExternalLink(url, text);
    }
  });

  const sourceCount = sourceLinks.length;
  const weakExternalCount = externalLinks.length;

  if (sourceCount < 1) {
    // No credible cited sources found - weak external links do not clear this penalty.
    rawScore += weights.links;
    factors.push({
      id: 'links',
      label: 'Very few sources/links',
      weight: weights.links,
      triggered: true,
      details: weakExternalCount
        ? 'External links found, but none look like cited sources'
        : 'Found 0 cited source links',
      links: sourceLinks,
      externalLinks
    });
  } else {
    const hasAuthoritative = sourceLinks.some(s => s.type === 'authoritative');
    factors.push({
      id: 'links',
      label: hasAuthoritative
        ? 'Sources/links found (authoritative present)'
        : 'Sources/links found',
      weight: weights.links,
      triggered: false,
      details: hasAuthoritative
        ? `Found ${sourceCount} cited source links, including authoritative sources`
        : `Found ${sourceCount} cited source links`,
      links: sourceLinks,
      externalLinks
    });
  }

  // --- Check 3: Wire Service Detection ---
  // Presence of AP, Reuters, etc. is generally a positive credibility signal
  const wireRegex = /\b(Associated Press|AP\b|Reuters|AFP|Agence France[-\s]?Presse|Bloomberg)\b/i;
  const wireMatch =
    wireRegex.test(searchText) ||
    linkCandidates.some(({ url }) => /apnews|politifact|reuters|afp\.|bloomberg/i.test(url.href || ''));

  if (wireMatch) {
    factors.push({
      id: 'wire',
      label: 'Wire service attribution detected',
      weight: weights.wire || 1,
      triggered: true
    });
    highlightPattern(articleElement, wireRegex, 'wire');
  } else {
    factors.push({
      id: 'wire',
      label: 'Wire service attribution detected',
      weight: weights.wire || 1,
      triggered: false
    });
  }

  // --- Check 4: Anonymous or Unattributed Sources ---
  // These phrases indicate information from unnamed sources - a credibility concern
  const anonPatterns = [
    'a source familiar with',
    'an unnamed source',
    'an anonymous source',
    'sources said',
    'a source said',
    'according to sources'
  ];

  const lowerText = searchText.toLowerCase();
  const anonFound = anonPatterns.some(p => lowerText.includes(p));

  if (anonFound) {
    rawScore += weights.anonymous || 1;
    factors.push({
      id: 'anonymous',
      label: 'Anonymous/unattributed sources present',
      weight: weights.anonymous || 1,
      triggered: true,
      details: anonPatterns.filter(p => lowerText.includes(p)).slice(0, 3).join('; ')
    });
    const anonRegex = new RegExp('(' + anonPatterns.join('|') + ')', 'gi');
    highlightPattern(articleElement, anonRegex, 'anonymous');
  } else {
    factors.push({
      id: 'anonymous',
      label: 'Anonymous/unattributed sources present',
      weight: weights.anonymous || 1,
      triggered: false
    });
  }

  // --- Check 5: Image Captions and Photo Credit Lines ---
  // Articles that properly credit images demonstrate editorial accountability
  try {
    const figcaps = Array.from(articleElement.querySelectorAll(
      'figcaption, .caption, .photo-credit, .image-credit, .img-caption'
    ));

    figcaps.forEach(fc => {
      const t = (fc.innerText || '').trim();
      if (t && /source:|photo:|image:|credit:|via\b/i.test(t)) {
        imageSourceCaptions.push(t);
        fc.setAttribute('data-reason-id', 'imageSource');
        fc.classList.add('nd-highlight', 'nd-imageSource');
      }
    });

    const imgs = Array.from(articleElement.querySelectorAll('img'));
    imgs.slice(0, 20).forEach(img => {
      const alt = (img.alt || '').trim();
      if (alt && /photo:|image:|credit:|via\b|source:/i.test(alt)) {
        imageSourceCaptions.push(alt);
        img.setAttribute('data-reason-id', 'imageSource');
        img.classList.add('nd-highlight', 'nd-imageSource');
      }

      const sib = img.nextElementSibling ||
                  (img.parentElement && img.parentElement.querySelector('.caption'));
      if (sib && sib.innerText && /source:|photo:|credit:|via\b/i.test(sib.innerText)) {
        imageSourceCaptions.push(sib.innerText.trim());
        sib.setAttribute('data-reason-id', 'imageSource');
        sib.classList.add('nd-highlight', 'nd-imageSource');
      }
    });
  } catch (e) { /* ignore any DOM errors during image scanning */ }

  if (imageSourceCaptions.length) {
    factors.push({
      id: 'imageSource',
      label: 'Image captions/source credits found',
      weight: weights.imageSource || 1,
      triggered: false,
      details: imageSourceCaptions.slice(0, 3).join(' | '),
      captions: imageSourceCaptions.slice(0, 5)
    });
  } else {
    factors.push({
      id: 'imageSource',
      label: 'Image captions/source credits found',
      weight: weights.imageSource || 1,
      triggered: false
    });
  }

  return { rawScore, factors, sourceLinks, externalLinks, imageSourceCaptions };
}
