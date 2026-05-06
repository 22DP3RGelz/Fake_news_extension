// Related Articles Handler
// Note: 'api' is already declared in popup.js, so we use it globally here

// Fetches the page's topic keywords and renders search links to related articles
async function fetchRelatedArticles() {
  try {
    // Get the currently active browser tab
    let tabs = await api.tabs.query({ active: true, currentWindow: true });
    let tab = tabs[0]; // We only care about the first (active) tab
    
    // Ask the content script for the article's keywords and title
    // This calls the "getKeywords" message listener in content.js
    let keywordsResponse = await api.tabs.sendMessage(tab.id, { action: "getKeywords" });
    let keywords = keywordsResponse.keywords || ""; // Space-separated keyword string
    let title = keywordsResponse.title || tab.title || ""; // Article title (fallback to tab title)
    
    // Extract the main topic: use the part of the title before a dash (e.g. "Biden wins - CNN" → "Biden wins")
    // If that fails, use the first keyword as the topic
    let topic = title.split(" - ")[0] || keywords.split(" ")[0];
    
    if (!topic) {
      // No topic could be determined — show a fallback message
      document.getElementById("relatedArticles").innerHTML = '<p style="color: #999; margin: 0;">No topic found</p>';
      return;
    }
    
    // Get the container element in the popup HTML where links will be injected
    let relatedDiv = document.getElementById("relatedArticles");
    relatedDiv.innerHTML = ""; // Clear any existing content (e.g. loading placeholder)
    
    // List of search engines/sites to search for related articles
    const searchEngines = [
      { name: "Google News", url: `https://news.google.com/search?q=${encodeURIComponent(topic)}` },
      // Reddit link search - finds news articles shared on Reddit matching the topic
      { name: "Reddit", url: `https://www.reddit.com/search/?q=${encodeURIComponent(topic)}&type=link` },
      // Wikipedia API search - finds relevant Wikipedia articles
      { name: "Wikipedia", url: `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json` },
      { name: "BBC News", url: `https://www.bbc.com/search?q=${encodeURIComponent(topic)}` },
      { name: "Reuters", url: `https://www.reuters.com/search/news?query=${encodeURIComponent(topic)}` }
    ];
    
    // Build a clickable link for each search engine and append to the container
    searchEngines.forEach(engine => {
      let link = document.createElement("a");
      link.href = engine.url;             // URL to the search results page
      link.target = "_blank";             // Open in a new tab
      link.textContent = engine.name;
      link.style.display = "block";       // Stack vertically
      link.style.marginBottom = "6px";    // Space between links
      link.style.color = "#2196F3";       // Blue link color
      link.style.textDecoration = "none"; // No underline by default
      link.onmouseover = () => link.style.textDecoration = "underline"; // Underline on hover
      link.onmouseout = () => link.style.textDecoration = "none";       // Remove on mouse out
      relatedDiv.appendChild(link); // Add this link to the DOM
    });
    
    // Show the detected topic at the bottom so the user can see what was searched for
    let topicLabel = document.createElement("p");
    topicLabel.textContent = `Topic: "${topic}"`; // Display the extracted topic
    topicLabel.style.fontSize = "11px";
    topicLabel.style.color = "#666";
    topicLabel.style.marginTop = "8px";
    topicLabel.style.paddingTop = "8px";
    topicLabel.style.borderTop = "1px solid #eee"; // Visual separator above label
    relatedDiv.appendChild(topicLabel);
    
  } catch (error) {
    console.error("Error fetching related articles:", error);
    // Show a graceful error message if anything goes wrong
    document.getElementById("relatedArticles").innerHTML =
      '<p style="color: #999; margin: 0;">Error loading articles</p>';
  }
}
