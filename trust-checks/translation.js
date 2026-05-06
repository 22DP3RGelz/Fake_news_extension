// 🌍 Translation Handler
// Translates article text to English internally for clickbait detection
// Uses API auto-detection for source language - no manual detection needed

// Determines whether a block of text is written in English
// Used to decide whether to run English-only checks (clickbait, misleading headline, etc.)
function isEnglish(text) {
  try {
    // List of very common English function words — if enough are present, text is likely English
    const englishWords = [
      'the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'it', 'for', 'with', 'as', 'was', 'be',
      'at', 'this', 'but', 'his', 'from', 'they', 'are', 'or', 'an', 'by', 'on', 'not', 'you',
      'all', 'can', 'her', 'had', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which',
      'me', 'when', 'make', 'go', 'know', 'take', 'see', 'come', 'think', 'also', 'back', 'after',
      'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
      'any', 'these', 'give', 'day', 'most', 'us', 'very', 'over', 'just', 'them', 'through', 'now',
      'could', 'down', 'only', 'being', 'made', 'those', 'more'
    ];
    
    // Reject text that contains characters from non-Latin scripts — these are definitely not English

    if (/[\u4E00-\u9FFF]/.test(text)) return false; // CJK Unified Ideographs (Chinese)
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return false; // Hiragana + Katakana (Japanese)
    if (/[\uAC00-\uD7AF]/.test(text)) return false; // Hangul syllables (Korean)
    if (/[\u0600-\u06FF]/.test(text)) return false; // Arabic script
    if (/[\u0400-\u04FF]/.test(text)) return false; // Cyrillic alphabet (Russian, etc.)
    if (/[\u05D0-\u05FF]/.test(text)) return false; // Hebrew alphabet
    
    // Extract all lowercase words (2+ letters) from the text for frequency analysis
    let words = text.toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
    if (words.length === 0) return false; // No words found = can't determine language
    
    // Count how many words in the text are in our English common-word list
    let englishCount = words.filter(w => englishWords.includes(w)).length;
    // Calculate the percentage of words that are common English words
    let percentage = (englishCount / words.length) * 100;
    
    // If more than 25% of words are common English words, classify as English
    // This threshold catches mixed-language pages while excluding foreign-language sites
    return percentage > 25;
  } catch (e) {
    console.error("English detection error:", e);
    return false; // If detection fails, assume non-English to avoid false clickbait positives
  }
}
