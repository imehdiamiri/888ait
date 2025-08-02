// Background service worker for 888 AI Translator
'use strict';

// Default settings - frozen for security
const DEFAULT_SETTINGS = Object.freeze({
    defaultSourceLang: 'auto',
    defaultTargetLang: 'fa',
    fontSize: '12',
    textToSpeech: true,
    slowSpeechRate: 0.25,
    translationEngine: 'free',
    aiGrammarCorrection: true,
    contextAwareTranslation: true,
    geminiApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    deepseekApiKey: '',
    grokApiKey: '',
    groqApiKey: ''
});

// Security: Input validation for messages
function isValidMessage(message) {
    if (!message || typeof message !== 'object') return false;
    if (typeof message.action !== 'string') return false;
    return ['openOptions', 'settingsChanged'].includes(message.action);
}

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        if (details.reason === 'install') {
            await chrome.storage.sync.set(DEFAULT_SETTINGS);
        } else if (details.reason === 'update') {
            // Merge with existing settings to preserve user data
            const existingSettings = await chrome.storage.sync.get();
            const mergedSettings = { ...DEFAULT_SETTINGS, ...existingSettings };
            await chrome.storage.sync.set(mergedSettings);
        }
    } catch (error) {
        console.error('Extension installation error:', error);
    }
});

// Secure message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Security check: validate sender and message
    if (!sender.tab && !sender.url?.includes('chrome-extension://')) {
        sendResponse({ success: false, error: 'Invalid sender' });
        return false;
    }
    
    if (!isValidMessage(message)) {
        sendResponse({ success: false, error: 'Invalid message format' });
        return false;
    }

    // Handle actions
    switch (message.action) {
        case 'openOptions':
            handleOpenOptions(sendResponse);
            return true; // Keep channel open for async response
            
        case 'settingsChanged':
            sendResponse({ success: true });
            return false;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
            return false;
    }
});

async function handleOpenOptions(sendResponse) {
    try {
        await chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
    } catch (error) {
        console.error('Failed to open options page:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Memory management - unload service worker gracefully
chrome.runtime.onSuspend?.addListener(() => {
    // Cleanup any resources if needed
}); 