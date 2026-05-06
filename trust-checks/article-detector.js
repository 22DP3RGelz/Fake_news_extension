// ============================================
// ARTICLE-DETECTOR.JS - News/article page gate
// ============================================
// Requires all three checks to pass before credibility analysis runs:
// 1) article metadata, 2) semantic article structure, 3) readerable text body.

function getMetaContent(selector) {
  const node = document.querySelector(selector);
  return node && node.content ? node.content.trim() : "";
}

function normalizeJsonLdType(typeValue) {
  if (!typeValue) return [];
  const values = Array.isArray(typeValue) ? typeValue : [typeValue];

  return values
    .filter(Boolean)
    .map(value => String(value).trim().split(/[\/#]/).pop().toLowerCase());
}

function isArticleJsonLdNode(node) {
  const types = normalizeJsonLdType(node && node["@type"]);
  return types.includes("newsarticle") || types.includes("article");
}

function flattenJsonLdNodes(value, output) {
  if (!value) return output;

  if (Array.isArray(value)) {
    value.forEach(item => flattenJsonLdNodes(item, output));
    return output;
  }

  if (typeof value !== "object") return output;

  output.push(value);

  const nestedKeys = ["@graph", "mainEntity", "mainEntityOfPage", "hasPart", "isPartOf", "itemListElement"];
  nestedKeys.forEach(key => {
    if (value[key]) flattenJsonLdNodes(value[key], output);
  });

  return output;
}

function getJsonLdNodes() {
  const nodes = [];
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent || "");
      flattenJsonLdNodes(data, nodes);
    } catch (e) {
      // Ignore malformed JSON-LD blocks. Many sites include tracking snippets here.
    }
  });

  return nodes;
}

function hasArticleMetadata() {
  const ogType = getMetaContent('meta[property="og:type"], meta[name="og:type"]')
    .toLowerCase();

  if (ogType === "article") {
    return {
      passed: true,
      details: 'Open Graph type is "article".'
    };
  }

  const articleNode = getJsonLdNodes().find(isArticleJsonLdNode);
  if (articleNode) {
    const articleType = normalizeJsonLdType(articleNode["@type"]).find(type =>
      type === "newsarticle" || type === "article"
    );

    return {
      passed: true,
      details: `JSON-LD type is "${articleType === "newsarticle" ? "NewsArticle" : "Article"}".`
    };
  }

  return {
    passed: false,
    details: 'Missing og:type="article" or JSON-LD Article/NewsArticle metadata.'
  };
}

function looksLikeDate(value) {
  if (!value) return false;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text || text.length > 120) return false;

  if (!Number.isNaN(Date.parse(text))) return true;

  return (
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i.test(text) ||
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(text) ||
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(text)
  );
}

function getDateFromJsonLd() {
  const dateNode = getJsonLdNodes().find(node =>
    isArticleJsonLdNode(node) && (looksLikeDate(node.datePublished) || looksLikeDate(node.dateModified))
  );

  if (!dateNode) return null;
  return dateNode.datePublished || dateNode.dateModified || null;
}

function findPublicationDate() {
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[property="article:modified_time"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    'meta[name="date"]',
    'meta[name="dc.date"]',
    'meta[name="dcterms.date"]',
    'meta[name="DC.date.issued"]',
    'meta[name="citation_publication_date"]',
    'meta[itemprop="datePublished"]',
    'meta[itemprop="dateModified"]'
  ];

  for (const selector of metaSelectors) {
    const content = getMetaContent(selector);
    if (looksLikeDate(content)) {
      return { value: content, method: `meta:${selector}` };
    }
  }

  const jsonLdDate = getDateFromJsonLd();
  if (looksLikeDate(jsonLdDate)) {
    return { value: jsonLdDate, method: "json-ld:datePublished" };
  }

  const timeNodes = document.querySelectorAll(
    'time[datetime], [itemprop="datePublished"], [itemprop="dateModified"]'
  );
  for (const node of timeNodes) {
    const value = node.getAttribute("datetime") || node.getAttribute("content") || node.textContent;
    if (looksLikeDate(value)) {
      return { value: String(value).trim(), method: "time-or-itemprop" };
    }
  }

  const dateSelectors = [
    ".date",
    ".published",
    ".timestamp",
    ".article-date",
    ".post-date",
    '[class*="published"]',
    '[class*="timestamp"]'
  ];
  const dateCandidates = document.querySelectorAll(dateSelectors.join(","));

  for (const node of Array.from(dateCandidates).slice(0, 30)) {
    const value = node.getAttribute("datetime") || node.getAttribute("content") || node.textContent;
    if (looksLikeDate(value)) {
      return { value: String(value).trim(), method: "date-selector" };
    }
  }

  return null;
}

function hasSemanticArticleSignals(articleElement) {
  const articleCount = document.querySelectorAll("article").length;
  if (articleCount !== 1) {
    return {
      passed: false,
      details: `Expected exactly one <article> tag, found ${articleCount}.`
    };
  }

  const authorInfo = typeof findAuthor === "function" ? findAuthor(articleElement) : null;
  const dateInfo = findPublicationDate();

  if (authorInfo && authorInfo.name) {
    return {
      passed: true,
      details: `One <article> tag and author detected: ${authorInfo.name}.`
    };
  }

  if (dateInfo && dateInfo.value) {
    return {
      passed: true,
      details: `One <article> tag and publication date detected: ${dateInfo.value}.`
    };
  }

  return {
    passed: false,
    details: "Found one <article> tag, but no clear author/byline or publication date."
  };
}

function hasReaderableBody() {
  if (typeof isProbablyReaderable !== "function") {
    return {
      passed: false,
      details: "Mozilla Readability readerable check is unavailable."
    };
  }

  try {
    const passed = isProbablyReaderable(document, {
      minContentLength: 140,
      minScore: 20
    });

    return {
      passed,
      details: passed
        ? "Mozilla Readability found a dense article-like text body."
        : "Mozilla Readability did not find a dense article-like text body."
    };
  } catch (e) {
    return {
      passed: false,
      details: "Mozilla Readability check failed on this page."
    };
  }
}

function getArticleGateDecision(articleChecks, mode) {
  const articleGateMode = ["strict", "balanced", "lenient"].includes(mode) ? mode : "strict";
  const checks = Object.values(articleChecks);
  const passedCount = checks.filter(check => check.passed).length;
  const allPassed = passedCount === checks.length;

  if (articleGateMode === "strict") {
    return { passed: allPassed, warning: null };
  }

  if (articleGateMode === "balanced") {
    return {
      passed: passedCount >= 2,
      warning: allPassed ? null : "Article gate is in Balanced mode. Analysis continued because 2 of 3 article checks passed."
    };
  }

  return {
    passed: !!articleChecks.readability.passed,
    warning: allPassed ? null : "Article gate is in Lenient mode. Analysis continued because the page has a readable article-like body."
  };
}

function checkNewsArticlePage(articleElement, mode = "strict") {
  const metadata = {
    id: "metadata",
    label: "Article metadata",
    ...hasArticleMetadata()
  };
  const semantic = {
    id: "semantic",
    label: "Semantic article structure",
    ...hasSemanticArticleSignals(articleElement)
  };
  const readability = {
    id: "readability",
    label: "Readable article body",
    ...hasReaderableBody()
  };

  const articleChecks = { metadata, semantic, readability };
  const articleGateMode = ["strict", "balanced", "lenient"].includes(mode) ? mode : "strict";
  const decision = getArticleGateDecision(articleChecks, articleGateMode);
  const isNewsArticle = decision.passed;

  return {
    isNewsArticle,
    articleChecks,
    articleGateMode,
    articleGateWarning: isNewsArticle ? decision.warning : null,
    nonArticleWarning: isNewsArticle
      ? null
      : "This page does not look like a news article. Fake News Detector only analyzes news/article pages."
  };
}
