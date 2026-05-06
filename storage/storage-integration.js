// 🔧 Storage Integration Guide for Popup and Background Scripts
// This file shows how to integrate chrome.storage into your popup.js and other UI scripts

// ============================================
// FOR USE IN popup.js - Storage Management UI
// ============================================

// Example 1: Get and display trusted domains in the popup
async function displayTrustedDomains() {
  try {
    // Access storage manager functions through chrome.runtime.sendMessage
    // or directly if popup script loads storage/storage-manager.js
    
    const domains = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getTrustedDomains' },
        (response) => resolve(response.domains || [])
      );
    });
    
    const domainList = document.getElementById('trustedDomainsList');
    domainList.innerHTML = '';
    
    domains.forEach(domain => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${domain}</span>
        <button onclick="removeDomain('${domain}')">Remove</button>
      `;
      domainList.appendChild(li);
    });
  } catch (error) {
    console.error('Error displaying trusted domains:', error);
  }
}

// Example 2: Add a new trusted domain
async function addNewTrustedDomain(domain) {
  try {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'addTrustedDomain', domain: domain },
        (response) => resolve(response.success)
      );
    });
    
    if (result) {
      console.log('✅ Domain added successfully');
      displayTrustedDomains(); // Refresh the list
    }
  } catch (error) {
    console.error('Error adding domain:', error);
  }
}

// Example 3: Get user-approved domains (synced across devices)
async function displayUserApprovedDomains() {
  try {
    const domains = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getUserApprovedDomains' },
        (response) => resolve(response.domains || [])
      );
    });
    
    const list = document.getElementById('userApprovedDomainsList');
    list.innerHTML = '';
    
    domains.forEach(domainObj => {
      const li = document.createElement('li');
      const approvedDate = new Date(domainObj.approvedAt).toLocaleDateString();
      li.innerHTML = `
        <div>
          <strong>${domainObj.domain}</strong>
          <small>Approved: ${approvedDate}</small>
          <button onclick="removeApprovedDomain('${domainObj.domain}')">Revoke</button>
        </div>
      `;
      list.appendChild(li);
    });
  } catch (error) {
    console.error('Error displaying approved domains:', error);
  }
}

// Example 4: Get clickbait words and display them
async function displayClickbaitWords() {
  try {
    const words = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getClickbaitWords' },
        (response) => resolve(response.words || [])
      );
    });
    
    const wordList = document.getElementById('clickbaitWordsList');
    wordList.innerHTML = words.map(word => `<span class="tag">${word}</span>`).join('');
  } catch (error) {
    console.error('Error displaying clickbait words:', error);
  }
}

// ============================================
// FOR USE IN A BACKGROUND/SERVICE WORKER
// ============================================

// Add this to your storage/background.js or service_worker.js
// This creates a message handler that bridges storage access for popups

function setupStorageMessageHandler() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        switch (request.action) {
          // Trusted Domains
          case 'getTrustedDomains':
            const trustedDomains = await getTrustedDomainsFromStorage();
            sendResponse({ domains: trustedDomains });
            break;
          
          case 'addTrustedDomain':
            await addTrustedDomainToStorage(request.domain);
            sendResponse({ success: true });
            break;
          
          case 'removeTrustedDomain':
            await removeTrustedDomainFromStorage(request.domain);
            sendResponse({ success: true });
            break;
          
          // Clickbait Words
          case 'getClickbaitWords':
            const words = await getClickbaitWordsFromStorage();
            sendResponse({ words: words });
            break;
          
          case 'addClickbaitWord':
            await addClickbaitWordToStorage(request.word);
            sendResponse({ success: true });
            break;
          
          // User-Approved Domains (Sync Storage)
          case 'getUserApprovedDomains':
            const approvedDomains = await getUserApprovedDomainsFromSync();
            sendResponse({ domains: approvedDomains });
            break;
          
          case 'approveUserDomain':
            await approveUserDomainInSync(request.domain, request.metadata);
            sendResponse({ success: true });
            break;
          
          case 'removeApprovedDomain':
            await removeApprovedDomainFromSync(request.domain);
            sendResponse({ success: true });
            break;
          
          case 'isTrustedDomain':
            const isTrusted = await checkIfTrustedDomain(request.domain);
            sendResponse({ isTrusted: isTrusted });
            break;
          
          default:
            sendResponse({ error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
      }
    })();
    
    // Return true to indicate we will respond asynchronously
    return true;
  });
}

// Helper functions for background script
async function getTrustedDomainsFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['trustedDomains'], (result) => {
      resolve(result.trustedDomains || []);
    });
  });
}

async function addTrustedDomainToStorage(domain) {
  const domains = await getTrustedDomainsFromStorage();
  if (!domains.includes(domain.toLowerCase())) {
    domains.push(domain.toLowerCase());
    chrome.storage.local.set({ trustedDomains: domains });
  }
}

async function removeTrustedDomainFromStorage(domain) {
  let domains = await getTrustedDomainsFromStorage();
  domains = domains.filter(d => d !== domain.toLowerCase());
  chrome.storage.local.set({ trustedDomains: domains });
}

async function getClickbaitWordsFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['clickbaitWords'], (result) => {
      resolve(result.clickbaitWords || []);
    });
  });
}

async function addClickbaitWordToStorage(word) {
  const words = await getClickbaitWordsFromStorage();
  if (!words.includes(word.toUpperCase())) {
    words.push(word.toUpperCase());
    chrome.storage.local.set({ clickbaitWords: words });
  }
}

async function getUserApprovedDomainsFromSync() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userApprovedDomains'], (result) => {
      resolve(result.userApprovedDomains || []);
    });
  });
}

async function approveUserDomainInSync(domain, metadata = {}) {
  const domains = await getUserApprovedDomainsFromSync();
  const normalizedDomain = domain.toLowerCase();
  
  const existingIndex = domains.findIndex(d => d.domain === normalizedDomain);
  if (existingIndex === -1) {
    domains.push({
      domain: normalizedDomain,
      approvedAt: new Date().toISOString(),
      ...metadata
    });
  }
  
  chrome.storage.sync.set({ userApprovedDomains: domains });
}

async function removeApprovedDomainFromSync(domain) {
  let domains = await getUserApprovedDomainsFromSync();
  domains = domains.filter(d => d.domain !== domain.toLowerCase());
  chrome.storage.sync.set({ userApprovedDomains: domains });
}

async function checkIfTrustedDomain(domain) {
  const trustedDomains = await getTrustedDomainsFromStorage();
  const approvedDomains = await getUserApprovedDomainsFromSync();
  
  const normalizedDomain = domain.toLowerCase();
  
  // Check built-in trusted domains
  if (trustedDomains.some(d => normalizedDomain.includes(d) || d.includes(normalizedDomain))) {
    return true;
  }
  
  // Check user-approved domains
  if (approvedDomains.some(d => d.domain === normalizedDomain)) {
    return true;
  }
  
  return false;
}

// ============================================
// EXAMPLE: popup.html Integration
// ============================================

/*
<html>
<head>
  <title>Fake News Detector Settings</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
    .tag { display: inline-block; margin: 5px; padding: 5px 10px; background: #e0e0e0; border-radius: 3px; }
    button { padding: 8px 15px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 3px; }
    button:hover { background: #0056b3; }
    #trustedDomainsList { list-style: none; padding: 0; }
    #trustedDomainsList li { padding: 10px; background: #f5f5f5; margin: 5px 0; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <h1>🛡️ Fake News Detector Settings</h1>
  
  <div class="section">
    <h2>Trusted Domains</h2>
    <ul id="trustedDomainsList"></ul>
    <input type="text" id="newDomain" placeholder="Enter domain (e.g., bbc.com)">
    <button onclick="addNewTrustedDomain(document.getElementById('newDomain').value)">Add Domain</button>
  </div>
  
  <div class="section">
    <h2>User-Approved Domains (Synced)</h2>
    <ul id="userApprovedDomainsList"></ul>
  </div>
  
  <div class="section">
    <h2>Clickbait Detection Words</h2>
    <div id="clickbaitWordsList"></div>
  </div>
  
  <script src="storage/storage-manager.js"></script>
  <script src="storage/storage-integration.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      displayTrustedDomains();
      displayUserApprovedDomains();
      displayClickbaitWords();
    });
  </script>
</body>
</html>
*/

// Initialize the message handler when this script loads
if (typeof chrome !== 'undefined' && chrome.runtime) {
  setupStorageMessageHandler();
}
