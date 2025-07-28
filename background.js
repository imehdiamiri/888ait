// Background script for handling extension actions

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

// Listen for messages from content scripts and options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openOptions') {
        // Try to open options page with enhanced error handling
        try {
            chrome.runtime.openOptionsPage();
            sendResponse({success: true});
        } catch (error) {
            console.error('Error opening options page:', error);
            // Try alternative method
            try {
                chrome.tabs.create({ url: chrome.runtime.getURL('options.html'), active: true });
                sendResponse({success: true});
            } catch (altError) {
                console.error('Alternative method also failed:', altError);
                sendResponse({success: false, error: altError.message});
            }
        }
        return true; // Keep message channel open for async response
    } else if (message.action === 'settingsChanged') {
        // Broadcast settings change to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    settings: message.settings
                }).catch(() => {});
            });
        });
        sendResponse({success: true});
        return true;
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