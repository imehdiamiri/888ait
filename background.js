// Background script for handling extension actions

// Inject content script when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Inject content script and CSS into the active tab
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });
        
        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css']
        });
    } catch (error) {
        console.error('Error injecting scripts:', error);
    }
});

// Listen for messages from content script and options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
        sendResponse({success: true});
    } else if (request.action === 'settingsChanged') {
        // Broadcast settings change to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    settings: request.settings
                }).catch(() => {});
            });
        });
        sendResponse({success: true});
    }
    
    return true;
});

// Default settings
const defaultSettings = {
    defaultSourceLang: 'auto',
    defaultTargetLang: 'fa',
    fontSize: '12', // Small font
    textToSpeech: true,
    slowSpeechRate: 0.25,

    translationEngine: 'free', // Free engine by default

    aiGrammarCorrection: true,
    contextAwareTranslation: true,
    geminiApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    libretranslateUrl: 'https://libretranslate.com',
    libretranslateApiKey: ''
};

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set(defaultSettings);
    }
});

// Listen for storage changes and broadcast to content scripts
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        chrome.storage.sync.get(defaultSettings, (settings) => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'settingsUpdated',
                        settings: settings
                    }).catch(() => {});
                });
            });
        });
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openOptions') {
        // Try to open options page
        try {
            chrome.runtime.openOptionsPage();
            sendResponse({success: true});
        } catch (error) {
            console.error('Error opening options page:', error);
            sendResponse({success: false, error: error.message});
        }
        return true; // Keep message channel open for async response
    }
});

// Listen for extension suspend event and notify content scripts
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension being suspended, notifying content scripts...');
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'extensionSuspending'
            }).catch(() => {});
        });
    });
}); 