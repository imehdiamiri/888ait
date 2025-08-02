// Production build - all debug logs disabled
(function removeDebugLogs() {
    if (typeof window === 'undefined') return;
    console.log = console.trace = console.warn = function(){};
    // Only console.error remains for critical error reporting
})();

// Global variables
let popup = null;
let selectionIcon = null;

// Helper function to safely get className as string
function safeGetClassName(element) {
    if (!element || !element.className) return '';
    return typeof element.className === 'string' ? element.className : element.className.toString();
}
let currentSelectedText = '';
let translatedText = '';
let isTranslating = false;
let isPopupOpening = false;
let detectedLanguage = '';
let lastDetectedLanguage = ''; // Store language detected during translation
let translationTimeout = null;

// Main popup error functions
function showMainError(message) {
    const errorSection = document.getElementById('main-error-section');
    const errorMessage = document.getElementById('main-error-message');
    
    if (errorSection && errorMessage) {
        errorMessage.textContent = message;
        errorSection.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideMainError();
        }, 5000);
    }
}

function hideMainError() {
    const errorSection = document.getElementById('main-error-section');
    if (errorSection) {
        errorSection.style.display = 'none';
    }
}


let lastUsedAIEngine = null; // Store last AI engine before free mode
let autoSwitchedToFree = false; // Track if we auto-switched
let isLanguageChanging = false; // Track if language is being changed to prevent popup refresh
let lastIconPosition = { left: 0, top: 0 };
let selectedFromElement = null;
let originalSelectionStart = null;
let originalSelectionEnd = null;

// Backup storage for moving/dynamic elements
let backupSelectedText = '';
let backupElementInfo = null;

// Popup state management
let isPopupActivelyUsed = false;
let currentSettings = null;
let isContextInvalidated = false;
let contextCheckInterval = null;

// Utility function to check if extension context is valid
function isExtensionContextValid() {
    // If we already know context is invalidated, don't check again
    if (isContextInvalidated) {
        return false;
    }
    
    try {
        // Check if chrome runtime exists and has a valid ID
        if (!chrome || !chrome.runtime || !chrome.runtime.id) {
            isContextInvalidated = true;
            return false;
        }
        
        // Try to access a chrome API to see if context is still valid
        const test = chrome.runtime.id;
        return true;
    } catch (error) {
        // If any error occurs, the context is invalid
        isContextInvalidated = true;
        return false;
    }
}

// Utility function to handle extension context errors
function handleExtensionContextError(error, operation) {
    if (error.message.includes('Extension context invalidated') || 
        error.message.includes('context invalidated') ||
        !isExtensionContextValid()) {
        console.warn(`Extension context invalidated during ${operation}`);
        cleanupOnContextInvalidation();
        return true; // Indicates this is a context error
    }
    return false; // Not a context error
}

// Clean up UI elements when extension context is invalidated
function cleanupOnContextInvalidation() {
    // Prevent multiple cleanup attempts
    if (isContextInvalidated) {
        return;
    }
    
    isContextInvalidated = true;
    
    // Clear the context check interval
    if (contextCheckInterval) {
        clearInterval(contextCheckInterval);
        contextCheckInterval = null;
    }
    
    try {
        // Hide and cleanup popup
        if (popup) {
            try {
                popup.style.display = 'none';
                popup.style.opacity = '0';
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            } catch (e) {
                // Ignore removal errors
            }
            popup = null;
        }
        
        // Hide and cleanup icon
        if (selectionIcon) {
            try {
                selectionIcon.style.display = 'none';
                selectionIcon.style.opacity = '0';
                if (selectionIcon.parentNode) {
                    selectionIcon.parentNode.removeChild(selectionIcon);
                }
            } catch (e) {
                // Ignore removal errors
            }
            selectionIcon = null;
        }
        
        // Reset global state
        isTranslating = false;
        currentSelectedText = '';
        translatedText = '';
        detectedLanguage = '';
        currentSettings = null;
        
        
    } catch (error) {
        // Silent cleanup - don't throw errors during cleanup
    }
}

// Start periodic context validation
function startContextValidation() {
    // Only start if not already running and context is valid
    if (contextCheckInterval || isContextInvalidated) {
        return;
    }
    
    contextCheckInterval = setInterval(() => {
        if (!isExtensionContextValid()) {
            cleanupOnContextInvalidation();
        }
    }, 30000); // Check every 30 seconds instead of 2 minutes
}

// Language options (Google Translate supported languages)
const languages = {
    'auto': 'Auto Detect',
    'af': 'Afrikaans',
    'ak': 'Akan',
    'sq': 'Albanian',
    'am': 'Amharic',
    'ar': 'Arabic',
    'hy': 'Armenian',
    'as': 'Assamese',
    'ay': 'Aymara',
    'az': 'Azerbaijani',
    'bm': 'Bambara',
    'eu': 'Basque',
    'be': 'Belarusian',
    'bn': 'Bengali',
    'bho': 'Bhojpuri',
    'bs': 'Bosnian',
    'bg': 'Bulgarian',
    'ca': 'Catalan',
    'ceb': 'Cebuano',
    'ny': 'Chichewa',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
    'zh': 'Chinese',
    'co': 'Corsican',
    'hr': 'Croatian',
    'cs': 'Czech',
    'da': 'Danish',
    'dv': 'Dhivehi',
    'doi': 'Dogri',
    'nl': 'Dutch',
    'en': 'English',
    'eo': 'Esperanto',
    'et': 'Estonian',
    'ee': 'Ewe',
    'tl': 'Filipino',
    'fi': 'Finnish',
    'fr': 'French',
    'fy': 'Frisian',
    'ff': 'Fulani',
    'gl': 'Galician',
    'ka': 'Georgian',
    'de': 'German',
    'el': 'Greek',
    'gn': 'Guarani',
    'gu': 'Gujarati',
    'ht': 'Haitian Creole',
    'ha': 'Hausa',
    'haw': 'Hawaiian',
    'iw': 'Hebrew',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hmn': 'Hmong',
    'hu': 'Hungarian',
    'is': 'Icelandic',
    'ig': 'Igbo',
    'ilo': 'Ilocano',
    'id': 'Indonesian',
    'ga': 'Irish',
    'it': 'Italian',
    'ja': 'Japanese',
    'jw': 'Javanese',
    'kl': 'Kalaallisut',
    'kn': 'Kannada',
    'kk': 'Kazakh',
    'km': 'Khmer',
    'rw': 'Kinyarwanda',
    'gom': 'Konkani',
    'ko': 'Korean',
    'kri': 'Krio',
    'ku': 'Kurdish (Kurmanji)',
    'ckb': 'Kurdish (Sorani)',
    'ky': 'Kyrgyz',
    'lo': 'Lao',
    'la': 'Latin',
    'lv': 'Latvian',
    'ln': 'Lingala',
    'lt': 'Lithuanian',
    'lg': 'Luganda',
    'lb': 'Luxembourgish',
    'mk': 'Macedonian',
    'mai': 'Maithili',
    'mg': 'Malagasy',
    'ms': 'Malay',
    'ml': 'Malayalam',
    'mt': 'Maltese',
    'mi': 'Maori',
    'mr': 'Marathi',
    'mni-mtei': 'Meiteilon (Manipuri)',
    'lus': 'Mizo',
    'mn': 'Mongolian',
    'my': 'Myanmar (Burmese)',
    'ne': 'Nepali',
    'no': 'Norwegian',
    'or': 'Odia (Oriya)',
    'om': 'Oromo',
    'ps': 'Pashto',
    'fa': 'Persian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'pa': 'Punjabi',
    'qu': 'Quechua',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sm': 'Samoan',
    'sa': 'Sanskrit',
    'gd': 'Scots Gaelic',
    'nso': 'Sepedi',
    'sr': 'Serbian',
    'st': 'Sesotho',
    'sn': 'Shona',
    'sd': 'Sindhi',
    'si': 'Sinhala',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'so': 'Somali',
    'es': 'Spanish',
    'su': 'Sundanese',
    'sw': 'Swahili',
    'sv': 'Swedish',
    'tg': 'Tajik',
    'ta': 'Tamil',
    'tt': 'Tatar',
    'te': 'Telugu',
    'th': 'Thai',
    'ti': 'Tigrinya',
    'ts': 'Tsonga',
    'tr': 'Turkish',
    'tk': 'Turkmen',
    'ak': 'Twi',
    'uk': 'Ukrainian',
    'ur': 'Urdu',
    'ug': 'Uyghur',
    'uz': 'Uzbek',
    've': 'Venda',
    'vi': 'Vietnamese',
    'cy': 'Welsh',
    'xh': 'Xhosa',
    'yi': 'Yiddish',
    'yo': 'Yoruba',
    'zu': 'Zulu'
};

// Load saved language preferences
async function getLanguagePreferences() {
    const settings = currentSettings || await getExtensionSettings();
    return { 
        source: settings.defaultSourceLang || 'auto', 
        target: settings.defaultTargetLang || 'fa' 
    };
}

// Save language preferences to extension settings
async function saveLanguagePreferences(sourceLang, targetLang) {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            return;
        }
        
        // Set flag to indicate this is a language change
        isLanguageChanging = true;
        
        if (currentSettings) {
            currentSettings.defaultSourceLang = sourceLang;
            currentSettings.defaultTargetLang = targetLang;
        }
        
        await chrome.storage.sync.set({
            defaultSourceLang: sourceLang,
            defaultTargetLang: targetLang
        });
        
        // Clear flag after a short delay
        setTimeout(() => {
            isLanguageChanging = false;
        }, 500);

    } catch (error) {
        isLanguageChanging = false; // Clear flag on error
        if (handleExtensionContextError(error, 'saving language preferences')) {
            return;
        }
        console.error('Error saving language preferences:', error);
    }
}

// Update engine display and selector
async function updateEngineDisplay(engineOverride = null) {
    if (!popup) return;
    
    const engineDisplaySpan = popup.querySelector('#engine-display');
    const engineSelector = popup.querySelector('#engine-selector');
    if (!engineDisplaySpan || !engineSelector) return;
    
    const settings = currentSettings || await getExtensionSettings();
    const engine = engineOverride || settings.translationEngine || 'free';
    
    // Format engine name for display
    let engineDisplayName;
    let selectorValue = engine;
    
    switch (engine) {
        case 'free':
        case 'google':
            engineDisplayName = 'Free';
            selectorValue = 'free'; // Always use 'free' for selector
            break;
        case 'gemini':
            engineDisplayName = 'Gemini';
            break;
        case 'openai':
            // For OpenAI, try to get the actual model being used
            try {
                const bestModel = await getBestOpenAIModel(settings.openaiApiKey);
                engineDisplayName = bestModel.includes('gpt-4') ? 'GPT-4' : 
                                   bestModel.includes('gpt-3.5') ? 'GPT-3.5' : 
                                   'OpenAI';
            } catch (error) {
                engineDisplayName = 'OpenAI';
            }
            break;
        case 'anthropic':
            engineDisplayName = 'Claude';
            break;
        case 'deepseek':
            engineDisplayName = 'DeepSeek';
            break;
        case 'grok':
            engineDisplayName = 'Grok';
            break;
        case 'groq':
            engineDisplayName = 'Groq';
            break;
        default:
            engineDisplayName = engine.charAt(0).toUpperCase() + engine.slice(1);
    }
    
    // Update display text
    engineDisplaySpan.textContent = engineDisplayName;
    
    // Update selector value (use 'free' for both 'free' and 'google')
    engineSelector.value = selectorValue;
}

// Legacy function name for compatibility
async function updateEngineNameInFooter() {
    await updateEngineDisplay();
}

// Default settings (cached for performance)
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

function getDefaultSettings() {
    return DEFAULT_SETTINGS;
}

// Clean any legacy Finglish references from storage
async function cleanLegacyFinglishSettings() {
    try {
        if (!chrome?.storage?.sync) return;
        
        const settings = await chrome.storage.sync.get(null);
        let needsUpdate = false;
        let updates = {};
        
        // Clean source language
        if (settings.defaultSourceLang === 'finglish') {
            updates.defaultSourceLang = 'auto';
            needsUpdate = true;
            console.log('🧹 Cleaned legacy Finglish source language');
        }
        
        // Clean target language (unlikely but just in case)
        if (settings.defaultTargetLang === 'finglish') {
            updates.defaultTargetLang = 'fa';
            needsUpdate = true;
            console.log('🧹 Cleaned legacy Finglish target language');
        }
        
        if (needsUpdate) {
            await chrome.storage.sync.set(updates);
            console.log('✅ Legacy Finglish settings cleaned from storage');
        }
    } catch (error) {
        console.warn('Could not clean legacy settings:', error);
    }
}

// Get extension settings from storage
async function getExtensionSettings() {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            return getDefaultSettings();
        }
        
        const result = await chrome.storage.sync.get({
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
            libretranslateUrl: 'https://libretranslate.com',
            libretranslateApiKey: ''
        });
        return result;
    } catch (error) {
        if (handleExtensionContextError(error, 'loading extension settings')) {
            return getDefaultSettings();
        }
        console.error('Error loading extension settings:', error);
        return getDefaultSettings();
    }
}



// Ensure only one icon exists
function ensureSingleIcon() {
    if (selectionIcon && selectionIcon.parentNode) {
        selectionIcon.parentNode.removeChild(selectionIcon);
    }
    selectionIcon = null;
}

// Create the icon element
function createIcon() {
    ensureSingleIcon();
    selectionIcon = document.createElement('div');
    selectionIcon.id = 'selection-icon';
    selectionIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <defs>
          <filter id="textShadow">
            <feDropShadow dx="0.3" dy="0.3" stdDeviation="0.3" flood-color="rgba(0,0,0,0.2)"/>
          </filter>
        </defs>
        <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
        <text x="12" y="12" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#000000" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">888</text>
      </svg>
    `;
    selectionIcon.style.cssText = `
        position: fixed !important;
        z-index: 2147483647 !important;
        background: transparent;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        cursor: pointer;
        pointer-events: auto;
        opacity: 0;
        transition: all 0.3s ease;
        top: -100px;
        left: -100px;
        visibility: hidden;
    `;
    
    // Add hover effect to icon
    selectionIcon.addEventListener('mouseenter', function() {
        if (selectionIcon.style.opacity !== '0') {
        selectionIcon.style.transform = 'scale(1.1)';
        selectionIcon.style.filter = 'brightness(1.1)';
        }
    });
    
    selectionIcon.addEventListener('mouseleave', function() {
        if (selectionIcon.style.opacity !== '0') {
        selectionIcon.style.transform = 'scale(1)';
        selectionIcon.style.filter = 'brightness(1)';
        }
    });
    
    // Robust icon click handler - works even if selection is lost
    selectionIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // Don't open if popup is already open
        if (popup && popup.style.opacity === '1') {
            return;
        }
        
        // Try to get current selection first
        let textToTranslate = '';
        let isFromStoredText = false;
        
        // Method 1: Try to get current active selection
        const activeElement = document.activeElement;
        if (isInputElement(activeElement)) {
            const inputText = getInputSelection(activeElement);
            if (inputText && inputText.trim().length > 1) {
                textToTranslate = inputText.trim();
            }
        } else {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 1) {
                textToTranslate = selection.toString().trim();
            }
        }
        
        // Method 2: If no current selection, use stored text (for moving elements)
        if (!textToTranslate && currentSelectedText && currentSelectedText.trim() !== '') {
            textToTranslate = currentSelectedText.trim();
            isFromStoredText = true;
        }
        
        // Method 2.5: Use backup text if main storage failed
        if (!textToTranslate && backupSelectedText && backupSelectedText.trim() !== '') {
            textToTranslate = backupSelectedText.trim();
            isFromStoredText = true;
        }
        
        // Method 3: Final fallback - if icon exists, we must have had text
        if (!textToTranslate) {
            // Try to re-capture from the element we stored
            if (selectedFromElement && originalSelectionStart !== null && originalSelectionEnd !== null) {
                try {
                    const storedText = selectedFromElement.value.substring(originalSelectionStart, originalSelectionEnd);
                    if (storedText && storedText.trim().length > 1) {
                        textToTranslate = storedText.trim();
                        isFromStoredText = true;
                    }
                } catch (error) {
                    // Element might be gone or changed
                }
            }
        }
        
        // If we still don't have text, hide icon and return
        if (!textToTranslate || textToTranslate.length < 2) {
            hideIcon();
            return;
        }
        
        // Update currentSelectedText with what we found
        currentSelectedText = textToTranslate;
        
        // Store click position for popup
        const rect = selectionIcon.getBoundingClientRect();
        lastIconPosition = {
            left: rect.left + rect.width/2,
            top: rect.top + rect.height/2,
            width: rect.width,
            height: rect.height
        };
        
            // Set flag to prevent selection interference
    isPopupOpening = true;
    isPopupActivelyUsed = true; // Mark popup as actively used
    
    // Hide icon completely and show popup
    hideIcon();
        showPopup();
    });
    
    // Force append to body with multiple attempts for compatibility
    try {
        if (document.body) {
            document.body.appendChild(selectionIcon);
        } else {
            // If body not ready, wait and try again
            setTimeout(() => {
                if (document.body && selectionIcon) {
                    document.body.appendChild(selectionIcon);
                } else if (document.documentElement && selectionIcon) {
                    document.documentElement.appendChild(selectionIcon);
                }
            }, 100);
        }
    } catch (error) {
        // Fallback to documentElement
        try {
            if (document.documentElement) {
            document.documentElement.appendChild(selectionIcon);
            }
        } catch (fallbackError) {
            console.warn('Failed to append icon to DOM:', fallbackError);
        }
    }
    
    return selectionIcon;
}

// Create popup element
function createPopup() {
    if (popup && popup.parentNode) {
        popup.parentNode.removeChild(popup);
    }
    popup = document.createElement('div');
    popup.id = 'selection-popup';
    // Calculate dynamic width based on selected text length
    const textLength = currentSelectedText.length;
    let dynamicWidth;
    if (textLength < 50) {
        dynamicWidth = 320; // Short text
    } else if (textLength < 150) {
        dynamicWidth = 400; // Medium text
    } else {
        dynamicWidth = 480; // Long text
    }
    
    popup.style.cssText = `
        position: fixed !important;
        z-index: 2147483646 !important;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        width: ${dynamicWidth}px;
        opacity: 0;
        transform: translateY(-5px);
        transition: all 0.2s ease;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        overflow: hidden;
        backdrop-filter: blur(8px);
        background: rgba(255, 255, 255, 0.95);
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: normal !important;
    `;
    
    document.body.appendChild(popup);
}

// Get language display name
function getLanguageName(langCode) {
    if (languages[langCode]) {
        return languages[langCode];
    }
    return langCode.toUpperCase();
}

// Generate language options HTML with proper option text
function generateLanguageOptions(selectedLang = 'auto', includeAuto = true) {
    const langEntries = includeAuto ? Object.entries(languages) : Object.entries(languages).filter(([code]) => code !== 'auto');
    return langEntries.map(([code, name]) => 
        `<option value="${code}" ${code === selectedLang ? 'selected' : ''}>${name}</option>`
    ).join('');
}



// Main translation function that routes to different engines
async function translateText(text, sourceLang, targetLang) {
    console.log('🔄 Starting translation process...');
    
    try {
        // Ensure settings are loaded with timeout
        const settings = await Promise.race([
            currentSettings || getExtensionSettings(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Settings timeout')), 7000))
        ]);
        
        let engine = settings.translationEngine || 'free';
        console.log('🔧 Using translation engine:', engine);
        
        // Check if API key is available for AI engines (Google Translate is free)
        if (engine === 'gemini' && !settings.geminiApiKey) {
            console.log('⚠️ Gemini API key missing - falling back to free');
            engine = 'free';
        } else if (engine === 'openai' && !settings.openaiApiKey) {
            console.log('⚠️ OpenAI API key missing - falling back to free');
            engine = 'free';
        } else if (engine === 'anthropic' && !settings.anthropicApiKey) {
            console.log('⚠️ Anthropic API key missing - falling back to free');
            engine = 'free';
        } else if (engine === 'deepseek' && !settings.deepseekApiKey) {
            console.log('⚠️ DeepSeek API key missing - falling back to free');
            engine = 'free';
        } else if (engine === 'grok' && !settings.grokApiKey) {
            console.log('⚠️ Grok API key missing - falling back to free');
            engine = 'free';
        } else if (engine === 'groq' && !settings.groqApiKey) {
            console.log('⚠️ Groq API key missing - falling back to free');
            engine = 'free';
        }
        
        let result;
        switch (engine) {
            case 'free':
            case 'google':
                result = await translateWithGoogle(text, sourceLang, targetLang, settings);
                break;
            case 'gemini':
                result = await translateWithGemini(text, sourceLang, targetLang, settings);
                break;
            case 'openai':
                result = await translateWithOpenAI(text, sourceLang, targetLang, settings);
                break;
            case 'anthropic':
                result = await translateWithAnthropic(text, sourceLang, targetLang, settings);
                break;
            case 'deepseek':
                result = await translateWithDeepSeek(text, sourceLang, targetLang, settings);
                break;
            case 'grok':
                result = await translateWithGrok(text, sourceLang, targetLang, settings);
                break;
            case 'groq':
                result = await translateWithGroq(text, sourceLang, targetLang, settings);
                break;
            default:
                // Default to Google Translate (free) if unknown engine
                result = await translateWithGoogle(text, sourceLang, targetLang, settings);
        }
        
        console.log('✅ Translation completed successfully');
        return result;
        
    } catch (error) {
        console.error(`❌ Translation error:`, error);
        
        // If settings failed to load, use default free translation
        if (error.message.includes('Settings timeout') || error.message.includes('Extension context invalidated')) {
            console.log('🔄 Settings failed - using default free translation');
            try {
                const defaultSettings = getDefaultSettings();
                return await translateWithGoogle(text, sourceLang, targetLang, defaultSettings);
            } catch (fallbackError) {
                console.error('❌ Fallback translation also failed:', fallbackError);
                return 'Translation service temporarily unavailable. Please try again.';
            }
        }
        
        // Handle specific error types
        if (error.message.includes('rate limit exceeded') || error.message.includes('429')) {
            return `Rate limit exceeded. Please wait a moment and try again.`;
        }
        
        // Handle API key errors
        if (error.message.includes('API key is invalid') || error.message.includes('401')) {
            return `Invalid API key. Please check your API key in settings.`;
        }
        
        // Handle billing errors
        if (error.message.includes('billing issue') || error.message.includes('402')) {
            return `Billing issue. Please check your account billing.`;
        }
        
        // Generic error with fallback attempt
        console.log('🔄 Attempting fallback to free translation');
        try {
            const defaultSettings = getDefaultSettings();
            return await translateWithGoogle(text, sourceLang, targetLang, defaultSettings);
        } catch (fallbackError) {
            console.error('❌ Fallback translation failed:', fallbackError);
            return 'Translation failed. Please try again or refresh the page.';
        }
    }
}

// Google Translate engine (free)
async function translateWithGoogle(text, sourceLang, targetLang, settings) {
    
            // Google Translate API endpoint
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
    try {
        console.log('🌐 Calling Google Translate API...');
        const response = await Promise.race([
            fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 7000))
        ]);
        
        if (!response.ok) {
            throw new Error(`Google Translate API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract detected language and store it globally
        if (sourceLang === 'auto' && data && data[2]) {
            lastDetectedLanguage = data[2];
        }
        
        // Extract translation from Google's response format
        if (data && data[0] && Array.isArray(data[0])) {
            let translatedText = '';
            for (let i = 0; i < data[0].length; i++) {
                if (data[0][i] && data[0][i][0]) {
                    translatedText += data[0][i][0];
                }
            }
            return translatedText.trim();
        }
        
        throw new Error('Invalid response format from Google Translate');
        
    } catch (error) {
        console.error('Google Translate error:', error);
        
        // If the free API fails, try alternative approach
        try {
            return await translateWithGoogleAlternative(text, sourceLang, targetLang);
        } catch (altError) {
            console.error('Google Translate alternative also failed:', altError);
            throw new Error('Google Translate service is currently unavailable');
        }
    }
}

// Alternative Google Translate method
async function translateWithGoogleAlternative(text, sourceLang, targetLang) {
    
    // Use a different Google Translate endpoint
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sourceLang}&tl=${targetLang}&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Google Translate alternative API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats
    if (typeof data === 'string') {
        return data;
    } else if (Array.isArray(data) && data[0]) {
        return data[0];
    } else if (data && data.sentences && Array.isArray(data.sentences)) {
        return data.sentences.map(s => s.trans).join('');
    }
    
    throw new Error('Could not parse Google Translate response');
}

// Google Gemini engine
async function translateWithGemini(text, sourceLang, targetLang, settings) {
    const apiKey = settings.geminiApiKey;
    
    if (!apiKey) {
        throw new Error('Gemini API key is required');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(targetLang);
    
    const prompt = settings.contextAwareTranslation 
        ? `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide a natural, contextually appropriate translation that maintains the original meaning and tone. Consider cultural nuances and context. Return only the translation without any explanations.

Text to translate: "${text}"`
        : `Translate this text from ${sourceLanguage} to ${targetLanguage}. Return only the translation:

"${text}"`;
    
    // Updated API endpoint - using the current Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1000,
                topP: 0.8,
                topK: 10
            }
        })
    });
    
    if (!response.ok) {
        // Get more detailed error information
        let errorDetails = '';
        try {
            const errorData = await response.json();
            errorDetails = errorData.error?.message || '';
    } catch (e) {
            errorDetails = response.statusText;
        }
        
        if (response.status === 429) {
            throw new Error('Gemini rate limit exceeded. Please wait a moment and try again.');
        } else if (response.status === 400) {
            throw new Error(`Gemini API error: ${errorDetails || 'Invalid request. Please check your API key.'}`);
        } else if (response.status === 403) {
            throw new Error('Gemini API access denied. Please check your API key and make sure the Gemini API is enabled.');
        } else if (response.status === 404) {
            throw new Error('Gemini API endpoint not found. The API may have been updated.');
        } else {
            throw new Error(`Gemini API error (${response.status}): ${errorDetails || response.statusText}`);
        }
    }
    
        const data = await response.json();
    if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text.trim().replace(/^["']|["']$/g, '');
    }
    
    throw new Error('Gemini translation failed - no valid response received');
}

// Test OpenAI API key and get available models
async function testOpenAIKey(apiKey) {
    console.log('🧪 Testing OpenAI API key...');
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        });
        
        console.log('🧪 Test response status:', response.status);
        
        if (response.ok) {
        const data = await response.json();
            const availableModels = data.data || [];
            console.log('✅ OpenAI API key is valid. Available models:', availableModels.length);
            
            // Log some model names for debugging
            const modelNames = availableModels.map(m => m.id).slice(0, 10);
            console.log('🧪 First 10 models:', modelNames);
            
            return { valid: true, models: availableModels };
        } else {
            const errorData = await response.json();
            console.log('❌ OpenAI API key test failed:', errorData);
            return { valid: false, error: errorData };
        }
    } catch (error) {
        console.log('❌ OpenAI API key test error:', error);
        return { valid: false, error: error.message };
    }
}

// Get best available OpenAI model for translation
async function getBestOpenAIModel(apiKey) {
    console.log('🤖 Getting best available OpenAI model...');
    
    try {
        const testResult = await testOpenAIKey(apiKey);
        
        if (!testResult.valid || !testResult.models) {
            console.log('🤖 Fallback to gpt-4o-mini (no model list available)');
            return 'gpt-4o-mini';
        }
        
        const availableModels = testResult.models.map(m => m.id);
        console.log('🤖 Checking for preferred models in:', availableModels.length, 'available models');
        
        // Preferred models in order of SPEED (fastest first for translation)
        const preferredModels = [
            'gpt-4o-mini',          // Fastest and cheapest
            'gpt-3.5-turbo',        // Fast classic
            'gpt-3.5-turbo-0125',   // Fast variant
            'gpt-3.5-turbo-1106',   // Fast variant
            'gpt-4o',               // Slower but good quality
            'gpt-4-turbo',          // Slower
            'gpt-4'                 // Slowest
        ];
        
        // Find the first available preferred model
        for (const model of preferredModels) {
            if (availableModels.includes(model)) {
                console.log('🤖 Selected model:', model);
                return model;
            }
        }
        
        // If no preferred model found, use the first available chat model
        const chatModels = availableModels.filter(id => 
            id.includes('gpt') && 
            !id.includes('instruct') && 
            !id.includes('embedding') &&
            !id.includes('whisper') &&
            !id.includes('tts') &&
            !id.includes('dall-e')
        );
        
        if (chatModels.length > 0) {
            console.log('🤖 Using first available chat model:', chatModels[0]);
            return chatModels[0];
        }
        
        // Ultimate fallback
        console.log('🤖 Using ultimate fallback: gpt-4o-mini');
        return 'gpt-4o-mini';
        
    } catch (error) {
        console.error('🤖 Error getting best model:', error);
        return 'gpt-4o-mini';
    }
}

// OpenAI GPT engine
async function translateWithOpenAI(text, sourceLang, targetLang, settings) {
    console.log('🤖 OpenAI Translation Starting...');
    console.log('📝 Text to translate:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    console.log('🔑 API Key provided:', !!settings.openaiApiKey);
    console.log('🔑 API Key length:', settings.openaiApiKey ? settings.openaiApiKey.length : 0);
    
    const apiKey = settings.openaiApiKey;
    if (!apiKey) {
        throw new Error('OpenAI API key is required');
    }
    
    // Test API key and get best available model
    const testResult = await testOpenAIKey(apiKey);
    if (!testResult.valid) {
        throw new Error(`OpenAI API key is invalid: ${testResult.error}`);
    }
    
    // Get the best available model for this API key
    const bestModel = await getBestOpenAIModel(apiKey);
    console.log('🤖 Using model:', bestModel);
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(targetLang);
    console.log('🌍 Languages:', sourceLanguage, '→', targetLanguage);
    
    const prompt = settings.contextAwareTranslation 
        ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide a natural, contextually appropriate translation that maintains the original meaning and tone. If the text contains multiple languages, translate each part appropriately:\n\n"${text}"`
        : `Translate this text from ${sourceLanguage} to ${targetLanguage}:\n\n"${text}"`;
    
    console.log('📡 Sending request to OpenAI...');
    console.log('📡 Request URL: https://api.openai.com/v1/chat/completions');
    console.log('📡 API Key starts with:', apiKey.substring(0, 10) + '...');
    console.log('📡 Using model:', bestModel);
    
    const requestBody = {
        model: bestModel,
        messages: [
            {
                role: 'system',
                content: 'You are a fast professional translator. Provide only the translation, no explanations.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 300,  // Reduced for faster response
        temperature: 0.1, // Lower for faster, more deterministic responses
        stream: false     // Disable streaming for simplicity
    };
    
    console.log('📡 Request body:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);
    
    if (!response.ok) {
        let errorMessage = '';
        try {
            const errorData = await response.json();
            console.log('❌ OpenAI Error Response:', errorData);
            errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
        } catch (e) {
            console.log('❌ Could not parse error response');
            errorMessage = response.statusText;
        }
        
        if (response.status === 429) {
            throw new Error('OpenAI rate limit exceeded. Please wait a moment and try again, or switch to a different translation engine.');
        } else if (response.status === 401) {
            throw new Error(`OpenAI API key is invalid. Please check your API key in settings. Error: ${errorMessage}`);
        } else if (response.status === 402) {
            throw new Error('OpenAI billing issue. Please check your OpenAI account billing.');
        } else {
            throw new Error(`OpenAI API error: ${response.status} - ${errorMessage}`);
        }
    }
    
    const data = await response.json();
    console.log('✅ OpenAI Response received:', data);
    
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        const translation = data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
        console.log('✅ Translation successful:', translation);
        return translation;
    }
    
    console.log('❌ Invalid response format from OpenAI');
    throw new Error('OpenAI translation failed - invalid response format');
}

// Anthropic Claude engine
async function translateWithAnthropic(text, sourceLang, targetLang, settings) {
    const apiKey = settings.anthropicApiKey;
    if (!apiKey) {
        throw new Error('Anthropic API key is required');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(targetLang);
    
    const prompt = settings.contextAwareTranslation 
        ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide a natural, contextually appropriate translation that maintains the original meaning and tone. If the text contains multiple languages, translate each part appropriately:\n\n"${text}"\n\nTranslation:`
        : `Translate this text from ${sourceLanguage} to ${targetLanguage}:\n\n"${text}"\n\nTranslation:`;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });
    
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Anthropic rate limit exceeded. Please wait a moment and try again, or switch to a different translation engine.');
        } else if (response.status === 401) {
            throw new Error('Anthropic API key is invalid. Please check your API key in settings.');
        } else if (response.status === 402) {
            throw new Error('Anthropic billing issue. Please check your account billing.');
        } else {
            throw new Error(`Anthropic API error: ${response.status} - ${response.statusText}`);
        }
    }
    
    const data = await response.json();
    if (data && data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text.trim();
    }
    
    throw new Error('Failed to get AI explanation');
}

// DeepSeek AI engine
async function translateWithDeepSeek(text, sourceLang, targetLang, settings) {
    const apiKey = settings.deepseekApiKey;
    if (!apiKey) {
        throw new Error('DeepSeek API key is required');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(targetLang);
    
    const prompt = settings.contextAwareTranslation 
        ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide a natural, contextually appropriate translation that maintains the original meaning and tone. If the text contains multiple languages, translate each part appropriately:\n\n"${text}"\n\nTranslation:`
        : `Translate this text from ${sourceLanguage} to ${targetLanguage}:\n\n"${text}"\n\nTranslation:`;
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{
                role: 'user',
                content: prompt
            }],
            max_tokens: 1000,
            temperature: 0.3
        })
    });
    
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('DeepSeek rate limit exceeded. Please wait a moment and try again, or switch to a different translation engine.');
        } else if (response.status === 401) {
            throw new Error('DeepSeek API key is invalid. Please check your API key in settings.');
        } else if (response.status === 402) {
            throw new Error('DeepSeek billing issue. Please check your account billing.');
        } else {
            throw new Error(`DeepSeek API error: ${response.status} - ${response.statusText}`);
        }
    }
    
    const data = await response.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error('Failed to get DeepSeek translation');
}

// Grok AI engine (X.AI)
async function translateWithGrok(text, sourceLang, targetLang, settings) {
    const apiKey = settings.grokApiKey;
    if (!apiKey) {
        throw new Error('Grok API key is required');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(targetLang);
    
    const prompt = settings.contextAwareTranslation 
        ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide a natural, contextually appropriate translation that maintains the original meaning and tone. If the text contains multiple languages, translate each part appropriately:\n\n"${text}"\n\nTranslation:`
        : `Translate this text from ${sourceLanguage} to ${targetLanguage}:\n\n"${text}"\n\nTranslation:`;
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'grok-beta',
            messages: [{
                role: 'user',
                content: prompt
            }],
            max_tokens: 1000,
            temperature: 0.3
        })
    });
    
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Grok rate limit exceeded. Please wait a moment and try again, or switch to a different translation engine.');
        } else if (response.status === 401) {
            throw new Error('Grok API key is invalid. Please check your API key in settings.');
        } else if (response.status === 402) {
            throw new Error('Grok billing issue. Please check your account billing.');
        } else {
            throw new Error(`Grok API error: ${response.status} - ${response.statusText}`);
        }
    }
    
    const data = await response.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error('Failed to get Grok translation');
}

// Groq AI engine
async function translateWithGroq(text, sourceLang, targetLang, settings) {
    const apiKey = settings.groqApiKey;
    if (!apiKey) {
        throw new Error('Groq API key is required');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(targetLang);
    
    const prompt = settings.contextAwareTranslation 
        ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide a natural, contextually appropriate translation that maintains the original meaning and tone. If the text contains multiple languages, translate each part appropriately:\n\n"${text}"\n\nTranslation:`
        : `Translate this text from ${sourceLanguage} to ${targetLanguage}:\n\n"${text}"\n\nTranslation:`;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.1-70b-versatile',
            messages: [{
                role: 'user',
                content: prompt
            }],
            max_tokens: 1000,
            temperature: 0.3
        })
    });
    
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Groq rate limit exceeded. Please wait a moment and try again, or switch to a different translation engine.');
        } else if (response.status === 401) {
            throw new Error('Groq API key is invalid. Please check your API key in settings.');
        } else if (response.status === 402) {
            throw new Error('Groq billing issue. Please check your account billing.');
        } else {
            throw new Error(`Groq API error: ${response.status} - ${response.statusText}`);
        }
    }
    
    const data = await response.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error('Failed to get Groq translation');
}

// AI Grammar Correction function
async function applyGrammarCorrection(text, targetLang, settings) {
    // Try to use available AI services for grammar correction
    if (settings.openaiApiKey) {
        return await correctGrammarWithOpenAI(text, targetLang, settings.openaiApiKey);
    } else if (settings.anthropicApiKey) {
        return await correctGrammarWithAnthropic(text, targetLang, settings.anthropicApiKey);
    } else {
        // No AI service available for grammar correction
        return text;
    }
}

// Grammar correction with OpenAI
async function correctGrammarWithOpenAI(text, targetLang, apiKey) {
    try {
        // Get the best available model
        const bestModel = await getBestOpenAIModel(apiKey);
        console.log('📝 Grammar correction using model:', bestModel);
        
        const targetLanguage = getLanguageName(targetLang);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: bestModel,
                messages: [
                    {
                        role: 'system',
                        content: `You are a grammar correction assistant. Improve the grammar, fluency, and naturalness of the given ${targetLanguage} text while preserving its original meaning. Return only the corrected text.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                max_tokens: 1000,
                temperature: 0.1
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content.trim();
            }
        }
    } catch (error) {
        console.error('OpenAI grammar correction failed:', error);
    }
    
    return text; // Return original if correction fails
}

// Grammar correction with Anthropic
async function correctGrammarWithAnthropic(text, targetLang, apiKey) {
    try {
        const targetLanguage = getLanguageName(targetLang);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `Please improve the grammar, fluency, and naturalness of this ${targetLanguage} text while preserving its original meaning. Return only the corrected text:\n\n${text}`
                }]
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.content && data.content[0] && data.content[0].text) {
                return data.content[0].text.trim();
            }
        }
    } catch (error) {
        console.error('Anthropic grammar correction failed:', error);
    }
    
    return text; // Return original if correction fails
}



// Text-to-speech function with natural voice selection for AI engines
async function speakText(text, lang, rate = 1) {
    if ('speechSynthesis' in window) {
        console.log('🔊 Starting speech with text:', text.substring(0, 50), 'lang:', lang, 'rate:', rate);
        
        // Stop any ongoing speech
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Add event listeners for debugging
        utterance.onstart = () => console.log('✅ Speech started successfully');
        utterance.onend = () => console.log('✅ Speech ended successfully');
        utterance.onerror = (e) => console.error('❌ Speech error:', e.error, e);
        utterance.onpause = () => console.log('⏸️ Speech paused');
        utterance.onresume = () => console.log('▶️ Speech resumed');
        
        // Get current settings to check if using AI engine
        const settings = currentSettings || await getExtensionSettings();
        const isAIEngine = settings.translationEngine && 
                          ['gemini', 'openai', 'anthropic'].includes(settings.translationEngine);
        
        // Wait for voices to be loaded (for all engines)
        let voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            console.log('🔊 No voices loaded yet, waiting...');
            // Wait for voices to load
            await new Promise(resolve => {
                speechSynthesis.onvoiceschanged = () => {
                    voices = speechSynthesis.getVoices();
                    console.log('🔊 Voices loaded:', voices.length);
                    resolve();
                };
                // Fallback timeout
                setTimeout(() => {
                    voices = speechSynthesis.getVoices();
                    console.log('🔊 Fallback timeout, voices:', voices.length);
                    resolve();
                }, 2000);
            });
        } else {
            console.log('🔊 Voices already available:', voices.length);
        }
        
        // Enhanced voice selection for AI engines
        if (isAIEngine) {
            
            // Language mapping for better voice selection
            const langMap = {
                'fa': 'fa-IR',
            
                'ar': 'ar-SA', 
                'en': 'en-US',
                'es': 'es-ES',
                'fr': 'fr-FR',
                'de': 'de-DE',
                'it': 'it-IT',
                'pt': 'pt-BR',
                'ru': 'ru-RU',
                'ja': 'ja-JP',
                'ko': 'ko-KR',
                'zh': 'zh-CN'
            };
            
            
                          const targetLang = langMap[lang] || lang;
            
            // Find the best natural voice for the language
            const naturalVoice = voices.find(voice => {
                const voiceLang = voice.lang.toLowerCase();
                const targetLangLower = targetLang.toLowerCase();
                return voiceLang === targetLangLower && 
                       (voice.name.includes('Neural') || 
                        voice.name.includes('Premium') ||
                        voice.name.includes('Enhanced') ||
                        voice.localService === false); // Cloud voices are usually better
            }) || voices.find(voice => {
                return voice.lang.toLowerCase().startsWith(lang.toLowerCase());
            });
            
            if (naturalVoice) {
                utterance.voice = naturalVoice;
                utterance.lang = naturalVoice.lang;
                console.log('🔊 Using enhanced voice for AI engine:', naturalVoice.name, 'Lang:', naturalVoice.lang);
            } else {
                utterance.lang = targetLang;
                console.log('🔊 No enhanced voice found, using default with lang:', targetLang);
                
                // Log available voices for debugging
                console.log('🔊 Available voices for', lang + ':', voices.filter(v => 
                    v.lang.toLowerCase().startsWith(lang.toLowerCase())).map(v => v.name + ' (' + v.lang + ')'));
            }
        } else {
            // Standard voice selection for free engines - enhanced
            const langMap = {
                'fa': 'fa-IR',
                'ar': 'ar-SA',
                'en': 'en-US',
                'es': 'es-ES',
                'fr': 'fr-FR',
                'de': 'de-DE'
            };
            
            const targetLang = langMap[lang] || lang;
            utterance.lang = targetLang;
            
            // Try to find a good voice even for free engines
            const langCode = lang.substring(0, 2);
            const preferredVoice = voices.find(voice => 
                voice.lang.toLowerCase().startsWith(langCode.toLowerCase())
            );
            
            if (preferredVoice) {
                utterance.voice = preferredVoice;
                console.log('🔊 Using voice for free engine:', preferredVoice.name, 'Lang:', preferredVoice.lang);
            } else {
                console.log('🔊 No specific voice found for', langCode, 'using browser default with lang:', targetLang);
                // Log available voices for this language
                const availableForLang = voices.filter(v => 
                    v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
                console.log('🔊 Available voices for', langCode + ':', availableForLang.map(v => v.name + ' (' + v.lang + ')'));
            }
        }
        
        // Final attempt - if no voice was found and it's Persian, try with a fallback
        if (!utterance.voice && (lang === 'fa' || lang.startsWith('fa'))) {
            console.log('🔊 No Persian voice found, trying fallback approaches...');
            
            // Try different Persian language codes
            const persianCodes = ['fa-IR', 'fa', 'per'];
            for (const code of persianCodes) {
                const fallbackVoice = voices.find(v => v.lang.toLowerCase() === code.toLowerCase());
                if (fallbackVoice) {
                    utterance.voice = fallbackVoice;
                    utterance.lang = fallbackVoice.lang;
                    console.log('🔊 Found fallback Persian voice:', fallbackVoice.name);
                    break;
                }
            }
            
            // Last resort: use any available voice but keep Persian lang code
            if (!utterance.voice && voices.length > 0) {
                utterance.voice = voices[0]; // Use first available voice
                utterance.lang = 'fa-IR'; // Keep Persian language code
                console.log('🔊 Using first available voice as last resort:', voices[0].name);
            }
        }
        
        console.log('🔊 Final utterance setup - Voice:', utterance.voice?.name || 'Browser default', 'Lang:', utterance.lang);
        speechSynthesis.speak(utterance);
    } else {
        console.error('❌ Speech synthesis not available');
    }
}

// Show copy feedback animation and message
function showCopyFeedback(button, message, success = true) {
    // Store original button content
    const originalHTML = button.innerHTML;
    const originalStyle = button.style.cssText;
    
    // Update button to show feedback
    button.innerHTML = success ? 
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
        </svg>` :
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;
    
    button.style.background = success ? '#ecfdf5' : '#fef2f2';
    button.style.borderColor = success ? '#10b981' : '#ef4444';
    button.title = message;
    
    // Add a temporary message near the button
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: absolute;
        top: -30px;
        right: 0;
        background: ${success ? '#10b981' : '#ef4444'};
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        z-index: 10001;
        white-space: nowrap;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
        pointer-events: none;
    `;
    
    // Position feedback relative to button
    button.style.position = 'relative';
    button.appendChild(feedback);
    
    // Animate feedback in
    setTimeout(() => {
        feedback.style.opacity = '1';
        feedback.style.transform = 'translateY(0)';
    }, 50);
    
    // Restore button after delay
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.cssText = originalStyle;
            button.title = 'Copy original text';
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 300);
    }, 2000);
}

// Detect multiple languages in text and segment them
async function detectMultipleLanguages(text) {
    try {
        // First, try to detect the overall language of the text
        const overallResponse = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const overallData = await overallResponse.json();
        const overallLang = overallData[2];
        
        // If the entire text is detected as a single language with high confidence, return null
        if (overallLang && overallData[0] && overallData[0].length > 0) {
            // Check if the detected language covers most of the text
            const translatedLength = overallData[0].reduce((sum, part) => sum + (part[1] || '').length, 0);
            if (translatedLength >= text.length * 0.8) {
                return null;
            }
        }
        
        const segments = [];
        
        // Split text into sentences or meaningful chunks first
        const chunks = text.split(/(?<=[.!?])\s+|(?<=[。！？])/);
        
        for (let chunk of chunks) {
            if (chunk.trim().length === 0) continue;
            
            // For each chunk, detect its language
            const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(chunk)}`);
            const data = await response.json();
            
            if (data && data[2]) {
                const detectedLang = data[2];
                const langName = languages[detectedLang] || detectedLang;
                
                // Find existing segment with same language
                const existingSegment = segments.find(s => s.language === detectedLang);
                if (existingSegment) {
                    existingSegment.text += ' ' + chunk;
                } else {
                    segments.push({
                        language: detectedLang,
                        languageName: langName,
                        text: chunk
                    });
                }
            }
        }
        
        // If we still have only one segment, try word-by-word detection for mixed content
        if (segments.length <= 1) {
            segments.length = 0; // Clear segments
            
            // Group words into larger chunks for better detection
            const words = text.split(/\s+/);
            let currentChunk = [];
            let lastDetectedLang = null;
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (word.trim().length === 0) continue;
                
                currentChunk.push(word);
                
                // Process chunk every 3-5 words or at the end
                if (currentChunk.length >= 3 || i === words.length - 1) {
                    const chunkText = currentChunk.join(' ');
                    
                    // Skip very short chunks unless they contain non-Latin scripts
                    if (chunkText.length < 5 && !/[\u0600-\u06FF\u0750-\u077F\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0400-\u04FF\u1100-\u11FF]/.test(chunkText)) {
                        // For short Latin-script chunks, assume same language as previous
                        if (lastDetectedLang && segments.length > 0) {
                            segments[segments.length - 1].text += ' ' + chunkText;
            } else {
                            // Skip detection for very short initial chunks
                            continue;
                        }
                } else {
                        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(chunkText)}`);
                        const data = await response.json();
                        
                        if (data && data[2]) {
                            const detectedLang = data[2];
                            const langName = languages[detectedLang] || detectedLang;
                            
                            // If same as last detected language, append to last segment
                            if (lastDetectedLang === detectedLang && segments.length > 0) {
                                segments[segments.length - 1].text += ' ' + chunkText;
                            } else {
                                // Check if we already have a segment for this language
                                const existingSegment = segments.find(s => s.language === detectedLang);
                                if (existingSegment) {
                                    existingSegment.text += ' ' + chunkText;
                                } else {
                                    segments.push({
                                        language: detectedLang,
                                        languageName: langName,
                                        text: chunkText
                                    });
                                }
                                lastDetectedLang = detectedLang;
                            }
                        }
                    }
                    
                    currentChunk = [];
                }
            }
        }
        
        // Filter out noise and merge segments
        const languageMap = new Map();
        
        for (let segment of segments) {
            // Skip segments that are likely misdetected (very short and uncommon languages)
            const uncommonLanguages = ['oc', 'eo', 'la', 'cy', 'gd', 'ga'];
            if (segment.text.trim().length < 10 && uncommonLanguages.includes(segment.language)) {
                // Try to merge with the most common language in the text
                const mostCommonLang = segments.reduce((acc, s) => {
                    if (!uncommonLanguages.includes(s.language)) {
                        acc[s.language] = (acc[s.language] || 0) + s.text.length;
                    }
                    return acc;
                }, {});
                
                const mainLang = Object.keys(mostCommonLang).sort((a, b) => mostCommonLang[b] - mostCommonLang[a])[0];
                if (mainLang) {
                    segment.language = mainLang;
                    segment.languageName = languages[mainLang] || mainLang;
                }
            }
            
            if (languageMap.has(segment.language)) {
                const existing = languageMap.get(segment.language);
                existing.text += ' ' + segment.text;
            } else {
                languageMap.set(segment.language, {
                    language: segment.language,
                    languageName: segment.languageName,
                    text: segment.text
                });
            }
        }
        
        // Convert map back to array and filter
        const finalSegments = Array.from(languageMap.values()).filter(segment => {
            const cleanText = segment.text.trim();
            // Keep segments with meaningful content
            return cleanText.length > 2;
        });
        
        // Only return if we have multiple different languages

        return finalSegments.length > 1 ? finalSegments : null;
    } catch (error) {
        console.error('Multi-language detection failed:', error);
        return null;
    }
}

// Speak specific language segment
function speakLanguageSegment(text, lang, rate = 1) {
    if ('speechSynthesis' in window) {
        // Stop any current speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        
        // Try to find a voice for the specific language
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(lang)) || 
                     voices.find(v => v.lang.startsWith(lang.split('-')[0]));
        
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            utterance.lang = speechLang;
        }
        
        window.speechSynthesis.speak(utterance);
    }
}

// Copy specific language segment to clipboard
async function copyLanguageSegment(text, buttonElement) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback(buttonElement, 'Text copied!');
    } catch (error) {
        console.error('Error copying text:', error);
        // Fallback for older browsers
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showCopyFeedback(buttonElement, 'Text copied!');
        } catch (fallbackError) {
            console.error('Fallback copy failed:', fallbackError);
            showCopyFeedback(buttonElement, 'Copy failed!', false);
        }
    }
}

// Make functions globally accessible for HTML onclick
window.speakLanguageSegment = speakLanguageSegment;
window.copyLanguageSegment = copyLanguageSegment;

// Simple and reliable selection handler
let selectionTimeout = null;
let lastSelectionTime = 0;

function handleSelectionChange() {
    const now = Date.now();
    
    // Clear previous timeout
    if (selectionTimeout) {
        clearTimeout(selectionTimeout);
    }
    
    // Skip if popup is currently open or being opened
    if (isPopupOpening || (popup && (popup.style.opacity === '1' || popup.style.display === 'block'))) {
        console.log('⏱️ Popup is opening/open - skipping selection check');
        return;
    }
    
    // Shorter timeouts for better responsiveness
    const timeoutDuration = (now - lastSelectionTime < 800) ? 300 : 100;
    lastSelectionTime = now;
    
    console.log('⏱️ Selection change, timeout:', timeoutDuration + 'ms');
    
    selectionTimeout = setTimeout(() => {
        checkAndShowSelection();
    }, timeoutDuration);
}

function checkAndShowSelection() {
        let hasSelection = false;
    let selectedText = '';
    let isInputSelection = false;
    let targetElement = null;
    let selectionInfo = null;
        
    // Check for any type of text selection
    
    // Check input/textarea first
    const activeElement = document.activeElement;
        if (isInputElement(activeElement)) {
        selectedText = getInputSelection(activeElement);
        if (selectedText.trim().length > 1) {
                hasSelection = true;
            isInputSelection = true;
            targetElement = activeElement;
                
                selectedFromElement = activeElement;
                originalSelectionStart = activeElement.selectionStart;
                originalSelectionEnd = activeElement.selectionEnd;
            currentSelectedText = selectedText.trim();
            
            // Get detailed selection info for input elements
            selectionInfo = getInputSelectionInfo(activeElement);
        }
    }
        
    // Check regular text selection if no input selection
    if (!hasSelection) {
            const selection = window.getSelection();
        
        if (selection.rangeCount > 0 && selection.toString().trim().length > 1) {
            // First check raw selection
            const rawText = selection.toString().trim();
            
            // Then apply filter
            selectedText = filterSelectedText(selection);
            
            if (selectedText.trim().length > 1) {
                hasSelection = true;
                isInputSelection = false;
                currentSelectedText = selectedText.trim();
                
                // Clear input info
                    selectedFromElement = null;
                    originalSelectionStart = null;
                    originalSelectionEnd = null;
                
                // Get detailed selection info for regular text
                selectionInfo = getTextSelectionInfo(selection);
            } else {
                // If filter rejected it but we have raw text, maybe allow it
                const basicCleanedText = rawText
                    .replace(/\n\s*888\s*\n/g, '\n')
                    .replace(/\n\s*Select models?\s*\n/gi, '\n')
                    .replace(/^\s*888\s*\n/g, '')
                    .replace(/\n\s*888\s*$/g, '')
                    .replace(/^\s*Select models?\s*\n/gi, '')
                    .replace(/\n\s*Select models?\s*$/gi, '')
                    .replace(/\n\s*\n/g, '\n')
                    .trim();
                
                if (basicCleanedText.length >= 10 && !basicCleanedText.match(/^(click|submit|cancel|ok|yes|no|888|select models?)$/i)) {
                    hasSelection = true;
                    isInputSelection = false;
                    currentSelectedText = basicCleanedText;
                    
                    // Clear input info
                    selectedFromElement = null;
                    originalSelectionStart = null;
                    originalSelectionEnd = null;
                    
                    // Get selection info for cleaned text
                    selectionInfo = getTextSelectionInfo(selection);
                }
            }
        }
    }
    
    // Show or hide icon based on selection
    if (hasSelection && selectionInfo && selectionInfo.isValid) {
        // Calculate optimal icon position using the comprehensive selection info
        const iconPosition = calculateUniversalIconPosition(selectionInfo, isInputSelection);
        lastMousePosition = iconPosition;
        
        // Always allow repositioning for new selection
        isIconPositioned = false;
        
        // Show icon with fade-in from left animation
        setTimeout(() => {
            // Double-check selection still exists before showing icon
            if (isInputSelection) {
                const currentInput = getInputSelection(targetElement);
                if (currentInput && currentInput.trim().length > 1) {
                    showUniversalIconWithFadeIn(iconPosition);
                }
        } else {
                const currentSelection = window.getSelection();
                if (currentSelection && currentSelection.toString().trim().length > 1) {
                    showUniversalIconWithFadeIn(iconPosition);
                }
            }
        }, 100);
    } else {
        // No selection found - hide icon but KEEP popup open if it's already open
            hideIcon();
        
        // DON'T auto-close popup - user might be interacting with it
        // Only clear selection text if popup is not open
        if (!popup || popup.style.opacity !== '1') {
            currentSelectedText = '';
        }
    }
}

// Get language name from code
function getLanguageName(langCode) {

    return languages[langCode] || langCode || 'Unknown';
}

// Detect if language is RTL
function isRTLLanguage(langCode) {
    const rtlLanguages = ['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ckb', 'dv'];
    return rtlLanguages.includes(langCode);
}

// Validate if stored element is still valid and accessible
function isStoredElementValid() {
    if (!selectedFromElement) {
        return false;
    }
    
    // Check if element is still in DOM
    if (!document.contains(selectedFromElement)) {
        return false;
    }
    
    // Check if it's still an input/textarea
    if (!isInputElement(selectedFromElement)) {
        return false;
    }
    
    // Check if selection positions are still valid
    if (originalSelectionStart === null || originalSelectionEnd === null) {
        return false;
    }
    
    // Check if element still has the expected text length
    if (selectedFromElement.value.length < originalSelectionEnd) {
        return false;
    }
    
    return true;
}

// Show popup with intelligent positioning
async function showPopup() {
    if (!popup) {
        createPopup();
    }
    
    // Icon is already faded in click handler - no need to fade again
    
    // Reset translation state
    translatedText = '';
    isTranslating = false;
    detectedLanguage = '';
    lastDetectedLanguage = ''; // Reset detected language from previous translations
    
    // Get saved preferences and extension settings
    const prefs = await getLanguagePreferences();
    const settings = currentSettings || await getExtensionSettings();
    
    // Store settings globally for future use
    if (!currentSettings) {
        currentSettings = settings;
    }
    
    // Check if we're in an editable area using stored element with validation
    const isInEditableArea = isStoredElementValid();
    
    // Generate replace button HTML ONLY if in editable area
    const replaceButtonHTML = isInEditableArea ? `
                 <button id="replace-btn" style="background: #f3f4f6; border: 1px solid #d1d5db; padding: 2px 6px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 3px; transition: all 0.2s ease; font-size: 10px; color: #374151;" title="Replace selected text">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="flex-shrink: 0;">
                <path d="M16 3l4 4-4 4"></path>
                <path d="M20 7H4"></path>
                <path d="M8 21l-4-4 4-4"></path>
                <path d="M4 17h16"></path>
            </svg>
             <span style="font-weight: 400; line-height: 1; white-space: nowrap;">Replace</span>
        </button>
    ` : '';
    
    // Update popup content with standardized UI
    popup.innerHTML = `
        <!-- Compact Header with Language Selection and Controls -->
        <div id="popup-header" style="background: #f8f9fa; padding: 3px 6px; border-bottom: 1px solid #dee2e6; height: 28px; display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none;">
            <!-- Target Language Only (Left) -->
            <div style="display: flex; gap: 6px; align-items: center; flex: 1;">
                <span style="color: #6c757d; font-size: 11px; font-weight: 500;">To:</span>
                <div style="position: relative; display: inline-flex; align-items: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 3px 6px; cursor: pointer; transition: all 0.2s;" id="target-lang-container">
                    <span id="target-lang-display" style="color: #495057; font-size: 11px; font-weight: 500; margin-right: 4px;">
                        ${getLanguageName(prefs.target)}
                    </span>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="pointer-events: none;">
                        <path d="M1 1L5 5L9 1" stroke="#6c757d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <select id="target-lang" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 1;">
                    ${generateLanguageOptions(prefs.target, false)}
                </select>
                </div>
            </div>
            
            <!-- Control Icons Only (Right) -->
            <div style="display: flex; gap: 8px; align-items: center;">
                <div id="donate-btn" style="cursor: pointer; color: #dc3545; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 3px;" title="Support Development">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </div>
                <div id="history-btn" style="cursor: pointer; color: #6c757d; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 3px;" title="History">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <path d="M3 3v5h5"></path>
                        <path d="M12 7v5l4 2"></path>
                    </svg>
                </div>
                <div id="settings-btn" style="cursor: pointer; color: #6c757d; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 3px;" title="Settings">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </div>
                <div id="close-btn" style="cursor: pointer; color: #6c757d; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 3px;" title="Close">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
            </div>
        </div>
        
        <!-- Error Message Section -->
        <div id="main-error-section" style="display: none; margin: 4px 6px 0 6px;">
            <div style="background: #fee; border: 1px solid #fcc; color: #c33; padding: 6px; border-radius: 4px; font-size: 11px; text-align: center;" id="main-error-message">
                <!-- Error message will appear here -->
            </div>
            </div>
            
        <!-- Content Area -->
        <div style="padding: 4px 6px;">
            <!-- Language Detection Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div id="detected-lang" style="font-size: 10px; color: #6c757d; flex: 1;">
                    Detecting language...
                </div>
                <!-- Action Buttons Row -->
                <div style="display: flex; gap: 4px; align-items: center;">
                    ${settings.textToSpeech ? `
                        <!-- Speech Buttons -->
                        <button id="speak-normal" style="background: #f8f9fa !important; border: 1px solid #dee2e6 !important; width: 22px !important; height: 22px !important; border-radius: 3px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.2s ease !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important;" title="Normal speed">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" style="display: block !important; margin: 0 auto !important;">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        </button>
                        <button id="speak-slow" style="background: #f8f9fa !important; border: 1px solid #dee2e6 !important; width: 22px !important; height: 22px !important; border-radius: 3px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.2s ease !important; position: relative !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important;" title="Slow speed (${settings.slowSpeechRate || 0.25}x)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" style="display: block !important; margin: 0 auto !important;">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                            <span style="position: absolute !important; top: -2px !important; right: -2px !important; background: #6c757d !important; color: white !important; font-size: 7px !important; padding: 1px 2px !important; border-radius: 2px !important; line-height: 1 !important; font-weight: 500 !important;">${settings.slowSpeechRate || 0.25}x</span>
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <!-- Translation Result -->
            <div id="translation-section" style="margin-bottom: 2px; display: none;">
                <div id="translation-result" style="background: white; padding: 6px 4px; border-radius: 4px; color: #495057; font-size: ${settings.fontSize}px; max-height: 120px; overflow-y: auto; border: 1px solid #dee2e6; line-height: 1.4; text-align: center !important; display: flex; align-items: center; justify-content: center; min-height: 40px;">
                    <!-- Translation will appear here -->
                </div>
                
                <!-- Engine Info and Action Buttons -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; gap: 6px;">
                    <!-- Engine selector on left -->
                    <div style="display: flex; align-items: center; gap: 4px; font-size: 10px; color: #6c757d;">
                        <span>Engine:</span>
                        <div style="position: relative; display: inline-flex; align-items: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 3px; padding: 2px 4px; cursor: pointer; transition: all 0.2s;" id="engine-selector-container">
                            <span id="engine-display" style="color: #0d6efd; font-size: 10px; font-weight: 500; margin-right: 3px;">
                                Loading...
                            </span>
                            <svg width="8" height="5" viewBox="0 0 10 6" fill="none" style="pointer-events: none;">
                                <path d="M1 1L5 5L9 1" stroke="#6c757d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <select id="engine-selector" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 1;">
                                <option value="free">Free</option>
                                <option value="gemini">Gemini</option>
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Claude</option>
                                <option value="deepseek">DeepSeek</option>
                                <option value="grok">Grok</option>
                                <option value="groq">Groq</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Buttons on right -->
                    <div style="display: flex; align-items: center; gap: 4px;">
                    ${replaceButtonHTML}
                        ${settings.textToSpeech ? `
                        <!-- Speech Translation Button -->
                        <button id="speak-translation-btn" style="background: #f8f9fa !important; border: 1px solid #dee2e6 !important; width: 22px !important; height: 22px !important; border-radius: 3px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.2s ease !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important;" title="Speak translation">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" style="display: block !important; margin: 0 auto !important;">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        </button>
                        ` : ''}
                        <!-- Copy Translation Button -->
                        <button id="copy-btn" style="background: #f8f9fa !important; border: 1px solid #dee2e6 !important; width: 22px !important; height: 22px !important; border-radius: 3px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.2s ease !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important;" title="Copy translation">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" style="display: block !important; margin: 0 auto !important;">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    </div>
                </div>
            </div>
            
            <!-- Loading State -->
            <div id="loading-state" style="text-align: center; padding: 8px; color: #6c757d; font-size: 13px;">
                <div style="display: inline-block; width: 18px; height: 18px; border: 2px solid #dee2e6; border-top: 2px solid #6c757d; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></div>
                Translating...
        </div>
        
            <!-- Grammar Correction Section -->
            <div id="grammar-correction-section" style="margin-top: 4px; display: none;">
                <div style="background: #fff3cd; padding: 8px; border-radius: 6px; border: 1px solid #ffeaa7; margin-bottom: 8px; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                        <span style="font-size: 11px; font-weight: 400; color: #6c757d;">Grammar Correction:</span>
                    </div>
                    <div id="grammar-correction-text" style="font-size: ${settings.fontSize}px; line-height: 1.5; color: #856404; margin-bottom: 10px; font-weight: bold; text-align: center !important; display: block; width: 100%;">
                        <!-- Corrected text will appear here -->
                    </div>
                    <div style="display: flex; justify-content: center; gap: 6px;">
                        <button id="copy-correction-inline" style="background: #f8f9fa !important; border: 1px solid #dee2e6 !important; width: 24px !important; height: 24px !important; border-radius: 3px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.2s ease !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important;" title="Copy correction">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" style="display: block !important; margin: 0 auto !important;">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
            </button>
                    </div>
                </div>
            </div>
        
            <!-- Grammar Success Section -->
            <div id="grammar-success-section" style="margin-top: 4px; display: none;">
                <div style="background: #d1e7dd; padding: 8px; border-radius: 6px; border: 1px solid #a3cfbb; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #6c757d; font-size: 11px; font-weight: 400;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"></path>
                            <circle cx="12" cy="12" r="9"></circle>
                        </svg>
                        Perfect Grammar!
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Footer - Always show with different content based on engine -->
        <div id="footer" style="background: #f8f9fa; padding: 3px 6px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; height: 26px; gap: 6px; margin-top: 1px;">
                        <!-- AI Explain Button (Left) -->
                        <button id="ai-explain-btn" style="background: #e7f1ff !important; border: none !important; padding: 2px 6px !important; border-radius: 4px !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 3px !important; transition: all 0.2s ease !important; font-size: 10px !important; color: #0d6efd !important; font-weight: 600 !important; white-space: nowrap !important; flex-direction: row !important; justify-content: center !important; min-height: 22px !important; max-height: 22px !important; height: 22px !important; line-height: 1.2 !important; box-sizing: border-box !important;" title="AI Explain">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0 !important; display: inline-block !important; vertical-align: middle !important;">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                            </svg>
                            <span style="white-space: nowrap !important; line-height: 1 !important;">AI Explain</span>
                        </button>
                        
                        <!-- Grammar Check Button (Right) -->
                        <button id="grammar-check-btn" style="background: #e7f1ff !important; border: none !important; padding: 2px 6px !important; border-radius: 4px !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 3px !important; transition: all 0.2s ease !important; font-size: 10px !important; color: #0d6efd !important; font-weight: 600 !important; white-space: nowrap !important; flex-direction: row !important; justify-content: center !important; min-height: 22px !important; max-height: 22px !important; height: 22px !important; line-height: 1 !important; box-sizing: border-box !important;" title="Check Grammar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0 !important; display: inline-block !important; vertical-align: middle !important;">
                                <path d="M9 12l2 2 4-4"></path>
                                <circle cx="12" cy="12" r="9"></circle>
                            </svg>
                            <span style="white-space: nowrap !important; line-height: 1 !important;">Check Grammar</span>
                        </button>
        </div>
        
        <style>
            /* FORCE LTR for all popup elements */
            #selection-popup * {
                direction: ltr !important;
                text-align: left !important;
                unicode-bidi: normal !important;
            }
            
            /* RTL ONLY for translated text content */
            #selection-popup .rtl-text {
                direction: rtl !important;
                text-align: right !important;
                unicode-bidi: embed !important;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes heartbeat {
                0%, 50%, 100% { transform: scale(1); }
                25%, 75% { transform: scale(1.1); }
            }
            
            /* Consistent Hover Effects */
            #close-btn:hover, #settings-btn:hover, #history-btn:hover {
                background: #e9ecef !important;
                color: #495057 !important;
            }
            
            #donate-btn {
                animation: heartbeat 2s ease-in-out infinite;
            }
            
            #donate-btn:hover {
                background: #f8d7da !important;
                color: #c82333 !important;
            }
            
            #target-lang-container:hover {
                background: #e9ecef !important;
                border-color: #adb5bd !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            #target-lang-container:active {
                transform: translateY(0px);
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            
            #engine-selector-container:hover {
                background: #e9ecef !important;
                border-color: #adb5bd !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            #engine-selector-container:active {
                transform: translateY(0px);
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            
            #target-lang {
                border: none !important;
                outline: none !important;
            }
            
            #speak-normal:hover, #speak-slow:hover, #speak-translation-btn:hover, #copy-btn:hover {
                background: #e9ecef !important;
                border-color: #adb5bd !important;
                transform: scale(1.1) !important;
            }
            
            #replace-btn:hover {
                background: #e9ecef !important;
                border-color: #adb5bd !important;
                transform: scale(1.02) !important;
            }
            
            #ai-explain-btn:hover {
                background: #cfe2ff !important;
                border-color: #86b7fe !important;
                transform: scale(1.02) !important;
            }
            
            #grammar-check-btn:hover {
                background: #ffeaa7 !important;
                border-color: #ffda6a !important;
                transform: scale(1.02) !important;
            }
            
            #switch-to-ai-btn:hover {
                background: #cfe2ff !important;
                border-color: #86b7fe !important;
                transform: scale(1.02) !important;
            }
            
            #grammar-check-btn:disabled {
                background: #e9ecef !important;
                border-color: #adb5bd !important;
                color: #6c757d !important;
                cursor: not-allowed !important;
                transform: none !important;
            }
            
            /* Inline correction buttons */
            #copy-correction-inline:hover {
                background: #146c43 !important;
                transform: scale(1.05) !important;
            }
            
            #replace-correction-inline:hover {
                background: #0b5ed7 !important;
                transform: scale(1.05) !important;
            }
            
            /* RTL Support */
            .rtl-text {
                direction: rtl;
                text-align: right;
                unicode-bidi: embed;
            }
        </style>
    `;
    
    // Position popup intelligently
    positionPopup();
    
    // Show popup with animation
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(0)';
    
    // Clear the opening flag - popup is now fully open
    isPopupOpening = false;
    console.log('✅ Popup fully opened - cleared opening flag');
    
    // Update engine name in footer
            updateEngineDisplay();
    
    // Hide grammar sections initially
    hideGrammarSections();
    
    // Setup header buttons immediately (they should always work)
    setupHeaderButtons();
    
    // Setup drag functionality for popup
    setupPopupDrag();
    
    // Start auto-translation and multi-language detection
    setTimeout(async () => {
        await detectAndShowMultipleLanguages(); // Only call this now
        await setupEventListeners();
    }, 100);
}

// Detect and show multiple languages
async function detectAndShowMultipleLanguages() {
    // Simply perform standard translation - no multi-language or specific mode handling
    await performTranslation();
}

// Helper function to detect single language
async function detectSingleLanguage(text) {
    try {
        // Use Google Translate API to detect language
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        
        // Extract detected language from response
        if (data && data[2]) {
            return data[2];
        }
        
        return 'auto';
    } catch (error) {
        console.error('Language detection failed:', error);
        return 'auto';
    }
}

// Perform translation
async function performTranslation() {
    if (!currentSelectedText || isTranslating) return;
    
    // Check if popup still exists and context is valid
    if (!popup || !isExtensionContextValid()) {
        isTranslating = false;
        return;
    }
    
    // Hide any previous error messages
    hideMainError();
    
    isTranslating = true;
    const loadingState = popup.querySelector('#loading-state');
    const translationSection = popup.querySelector('#translation-section');
    const translationResult = popup.querySelector('#translation-result');
    
    // Hide grammar sections when starting new translation
    hideGrammarSections();
    
    if (loadingState) loadingState.style.display = 'block';
    if (translationSection) translationSection.style.display = 'none';
    
    try {
        const prefs = await getLanguagePreferences();
        const settings = currentSettings || await getExtensionSettings();
        
        // Store current AI engine before translation
        if (settings.translationEngine !== 'free' && settings.translationEngine !== 'google') {
            lastUsedAIEngine = settings.translationEngine;
        }
        
        // Always use the source language from preferences (auto or specific)
        let sourceLang = prefs.source;
        
        // Use the main translation function which handles all engines with timeout
        console.log('🔤 Starting translation with timeout...');
        translatedText = await Promise.race([
            translateText(currentSelectedText, sourceLang, prefs.target),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Translation timeout')), 10000))
        ]);
        console.log('🔤 Translation completed:', translatedText.substring(0, 50) + '...');
        
        // Clear timeout if translation succeeded
        if (translationTimeout) {
            clearTimeout(translationTimeout);
            translationTimeout = null;
        }
        
        // Update source language display based on user selection
        // Check if popup still exists before updating UI
        if (!popup || !isExtensionContextValid()) {
            isTranslating = false;
            return;
        }
        
            const detectedLangDiv = popup.querySelector('#detected-lang');
            if (detectedLangDiv) {
            let displayLanguage;
            
            if (sourceLang === 'auto') {
                // For auto mode, use the language detected during translation
                if (lastDetectedLanguage) {
                    displayLanguage = lastDetectedLanguage;
                    detectedLanguage = lastDetectedLanguage;
                } else {
                    // Fallback to separate detection
                    displayLanguage = await detectSingleLanguage(currentSelectedText);
                    detectedLanguage = displayLanguage;
                }
            } else {
                // For manual selection, use the selected language
                displayLanguage = sourceLang;
                detectedLanguage = sourceLang;
            }
            
            const languageName = getLanguageName(displayLanguage);
            detectedLangDiv.textContent = `Source: ${languageName}`;
        }
            
        // Show translation with RTL support - always centered
            if (translationResult) {
                const isTargetRTL = isRTLLanguage(prefs.target);
                const rtlClass = isTargetRTL ? 'rtl-text' : '';
            const fontSize = settings.fontSize || 12;
                
                translationResult.innerHTML = `
                <div class="${rtlClass}" style="font-size: ${fontSize}px; padding: 8px; text-align: center !important;">${translatedText}</div>
                `;
            }
            
            if (loadingState) loadingState.style.display = 'none';
            if (translationSection) translationSection.style.display = 'block';
            
            // Save translation to history
            await saveTranslationToHistory(currentSelectedText, translatedText, detectedLanguage, prefs.target);
            
            // Re-setup event listeners for buttons after content update
            setupTranslationButtons();
        setupLanguageSelectorListeners();
        
    } catch (error) {
        console.error('Translation error:', error);
        
        // Clear timeout if error occurred
        if (translationTimeout) {
            clearTimeout(translationTimeout);
            translationTimeout = null;
        }
        
        // Check if popup still exists before updating UI
        if (!popup || !isExtensionContextValid()) {
            isTranslating = false;
            return;
        }
        
        // Handle timeout errors specifically
        if (error.message.includes('Translation timeout')) {
            console.log('⏰ Translation timed out - attempting fallback');
            try {
                const prefs = await getLanguagePreferences();
                const defaultSettings = getDefaultSettings();
                const fallbackTranslation = await translateWithGoogle(currentSelectedText, prefs.source, prefs.target, defaultSettings);
                
        if (translationResult) {
                    const fontSize = currentSettings ? currentSettings.fontSize : 12;
                    const isTargetRTL = isRTLLanguage(prefs.target);
                    const rtlClass = isTargetRTL ? 'rtl-text' : '';
                    translationResult.innerHTML = `
                        <div class="${rtlClass}" style="font-size: ${fontSize}px; padding: 8px; text-align: center !important;">${fallbackTranslation}</div>
                    `;
                    
                    // Show timeout warning in proper error section
                    showMainError('⚡ Timeout - Used Free Engine');
                }
                
                if (loadingState) loadingState.style.display = 'none';
                if (translationSection) translationSection.style.display = 'block';
                
                await saveTranslationToHistory(currentSelectedText, fallbackTranslation, detectedLanguage || 'auto', prefs.target);
                setupTranslationButtons();
                setupLanguageSelectorListeners();
                isTranslating = false;
                return;
                
            } catch (fallbackError) {
                console.error('Fallback translation also failed:', fallbackError);
                // Continue to regular error handling below
            }
        }
        
        if (translationResult) {
            const fontSize = currentSettings ? currentSettings.fontSize : 12;
            const settings = currentSettings || await getExtensionSettings();
            const currentEngine = settings.translationEngine || 'free';
            
            // Show error message for AI engines
            if (currentEngine !== 'free' && currentEngine !== 'google') {
                // For AI engines, show the actual error and options
                const errorMatch = error.message.match(/Error: (.+)$/);
                const actualError = errorMatch ? errorMatch[1] : error.message;
            
            translationResult.innerHTML = `
                    <div style="text-align: center; font-size: ${fontSize}px; color: #dc2626; margin-bottom: 8px;">
                        <strong>${currentEngine.toUpperCase()} Error:</strong>
                    </div>
                    <div style="text-align: center; font-size: ${fontSize - 1}px; color: #dc2626; margin-bottom: 12px; background: #fef2f2; padding: 8px; border-radius: 4px; border: 1px solid #fecaca;">
                        ${actualError}
                    </div>
                    <div style="text-align: center;">
                        <button id="retry-translation" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; margin-right: 8px;" title="Retry with current engine">
                            🔁 Retry
                        </button>
                        <button id="switch-to-free" style="background: #22c55e; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;" title="Switch to free Google Translate">
                            🆓 Free
                        </button>
                    </div>
                `;
                
                // Add event listeners for fallback buttons
                const switchToFreeBtn = translationResult.querySelector('#switch-to-free');
                const retryBtn = translationResult.querySelector('#retry-translation');
                
                if (switchToFreeBtn) {
                    switchToFreeBtn.addEventListener('click', async () => {
                        // Temporarily switch to free engine and retry translation
                        try {
                            if (loadingState) loadingState.style.display = 'block';
                            if (translationSection) translationSection.style.display = 'none';
                            
                            const prefs = await getLanguagePreferences();
                            const freeTranslation = await translateWithGoogle(currentSelectedText, prefs.source, prefs.target, settings);
                            
                            if (translationResult) {
                                const isTargetRTL = isRTLLanguage(prefs.target);
                                const rtlClass = isTargetRTL ? 'rtl-text' : '';
                                translationResult.innerHTML = `
                                    <div class="${rtlClass}" style="font-size: ${fontSize}px; padding: 8px; text-align: center !important;">${freeTranslation}</div>
                                    <div style="text-align: center; margin-top: 8px; padding: 6px; background: #ecfdf5; border-radius: 4px; font-size: 11px; color: #059669; direction: ltr !important;">
                                        ✅ Translated with Free Engine (Google Translate)
                                    </div>
                                `;
                            }
                            
        if (loadingState) loadingState.style.display = 'none';
        if (translationSection) translationSection.style.display = 'block';
        
                            // Save to history
                            await saveTranslationToHistory(currentSelectedText, freeTranslation, detectedLanguage || 'auto', prefs.target);
                            
                        } catch (freeError) {
                            console.error('Free engine also failed:', freeError);
                            if (translationResult) {
                                translationResult.innerHTML = `
                                    <div style="text-align: center; font-size: ${fontSize}px; color: #dc2626;">
                                        All translation engines failed. Please check your internet connection.
                                    </div>
                                `;
                            }
                            if (loadingState) loadingState.style.display = 'none';
                            if (translationSection) translationSection.style.display = 'block';
                        }
                    });
                }
                
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => {
                        // Retry with current engine
                        performTranslation();
                    });
                }
            } else {
                // For free engine failures
                translationResult.innerHTML = `
                    <div style="text-align: center; font-size: ${fontSize}px; color: #dc2626; margin-bottom: 8px;">
                        <strong>Free Translation Failed</strong>
                    </div>
                    <div style="text-align: center; font-size: ${fontSize - 1}px; color: #dc2626; margin-bottom: 12px; background: #fef2f2; padding: 8px; border-radius: 4px; border: 1px solid #fecaca;">
                        ${error.message || 'Network or service issue'}
                    </div>
                    <div style="text-align: center;">
                        <button id="retry-translation" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;" title="Retry translation">
                            🔁 Retry
                        </button>
                    </div>
                `;
                
                // Add retry button listener
                const retryBtn = translationResult.querySelector('#retry-translation');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => {
                        performTranslation();
                    });
                }
            }
        }
        if (loadingState) loadingState.style.display = 'none';
        if (translationSection) translationSection.style.display = 'block';
        
        // Re-setup event listeners
        setupTranslationButtons();
        setupLanguageSelectorListeners();
    }
    
    isTranslating = false;
}

// Switch to free mode and save settings
async function switchToFreeMode() {
    try {
        console.log('🔄 Auto-switching to free mode due to timeout/error');
        
        // Update settings to free mode
        const settings = await getExtensionSettings();
        settings.translationEngine = 'free';
        autoSwitchedToFree = true;
        
        // Save settings
        await chrome.storage.sync.set(settings);
        currentSettings = settings;
        
        console.log('✅ Switched to free mode and saved settings');
        
        // Retry translation with free mode
        if (currentSelectedText && popup) {
            const prefs = await getLanguagePreferences();
            const sourceLang = prefs.source;
            
            try {
                console.log('🔄 Retrying translation with free mode');
                
                const loadingState = popup.querySelector('#loading-state');
                const translationSection = popup.querySelector('#translation-section');
                const translationResult = popup.querySelector('#translation-result');
                
                if (loadingState) loadingState.style.display = 'block';
                if (translationSection) translationSection.style.display = 'none';
                
                translatedText = await translateText(currentSelectedText, sourceLang, prefs.target);
                
                // Update UI with successful translation
                if (translationResult) {
                    const isTargetRTL = isRTLLanguage(prefs.target);
                    const rtlClass = isTargetRTL ? 'rtl-text' : '';
                    const fontSize = currentSettings ? currentSettings.fontSize : 14;
                    
                    translationResult.innerHTML = `
                        <div class="${rtlClass}" style="font-size: ${fontSize}px; padding: 8px; text-align: center !important;">${translatedText}</div>
                    `;
                    
                    // Show timeout warning in proper error section
                    showMainError('⚡ Auto-switched to Free Mode due to timeout');
                }
                
                if (loadingState) loadingState.style.display = 'none';
                if (translationSection) translationSection.style.display = 'block';
                
                // Update footer to show switch button
                updateFooterWithSwitchButton();
                
            } catch (freeError) {
                console.error('Free translation also failed:', freeError);
                showTranslationError('Translation failed even with free mode');
            }
        }
        
    } catch (error) {
        console.error('Error switching to free mode:', error);
        showTranslationError('Failed to switch to free mode');
    }
}

// Show translation error
function showTranslationError(message) {
    if (!popup) return;
    
    const loadingState = popup.querySelector('#loading-state');
    const translationSection = popup.querySelector('#translation-section');
    const translationResult = popup.querySelector('#translation-result');
    
    if (loadingState) loadingState.style.display = 'none';
    if (translationSection) translationSection.style.display = 'block';
    if (translationResult) {
        const fontSize = currentSettings ? currentSettings.fontSize : 14;
        translationResult.innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 10px; font-size: ${fontSize}px;">
                <div style="font-weight: bold;">Translation Failed</div>
                <div style="font-size: 12px; margin-top: 5px;">${message}</div>
            </div>
        `;
    }
}

// Update footer with switch button when in free mode
function updateFooterWithSwitchButton() {
    if (!popup || !autoSwitchedToFree || !lastUsedAIEngine) return;
    
    const footerDiv = popup.querySelector('#footer');
    if (!footerDiv) return;
    
    // Get engine display name
    const engineNames = {
        'gemini': 'Gemini AI',
        'openai': 'OpenAI GPT',
        'anthropic': 'Claude AI'
    };
    
    const lastEngineName = engineNames[lastUsedAIEngine] || lastUsedAIEngine.toUpperCase();
    
    // Update footer with switch button
    footerDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #6b7280;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <span>🆓 Free Mode</span>
                <span style="padding: 2px 6px; background: #fef3c7; color: #d97706; border-radius: 10px; font-size: 9px;">
                    Auto-switched
                </span>
            </div>
            <button id="switch-back-to-ai" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 9px; font-weight: 500;" title="Switch back to ${lastEngineName}">
                🤖 Switch to ${lastEngineName}
            </button>
        </div>
    `;
    
    // Add event listener for switch button
    const switchBtn = footerDiv.querySelector('#switch-back-to-ai');
    if (switchBtn) {
        switchBtn.addEventListener('click', async () => {
            await switchBackToAI();
        });
    }
}

// Switch back to last used AI engine
async function switchBackToAI() {
    if (!lastUsedAIEngine) return;
    
    try {
        console.log('🤖 Switching back to AI engine:', lastUsedAIEngine);
        
        // Update settings back to AI engine
        const settings = await getExtensionSettings();
        settings.translationEngine = lastUsedAIEngine;
        autoSwitchedToFree = false;
        
        // Save settings
        await chrome.storage.sync.set(settings);
        currentSettings = settings;
        
        console.log('✅ Switched back to', lastUsedAIEngine);
        
        // Update footer to show AI engine
        const footerDiv = popup.querySelector('#footer');
        if (footerDiv) {
            const engineNames = {
                'gemini': 'Gemini AI',
                'openai': 'OpenAI GPT', 
                'anthropic': 'Claude AI'
            };
            
            const engineName = engineNames[lastUsedAIEngine] || lastUsedAIEngine.toUpperCase();
            
            footerDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #6b7280;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>🤖 ${engineName}</span>
                        <span style="padding: 2px 6px; background: #dcfce7; color: #16a34a; border-radius: 10px; font-size: 9px;">
                            Restored
                        </span>
                    </div>
                    <span>Ready for AI translation</span>
                </div>
            `;
        }
        
        // Optionally retry current translation with AI
        if (currentSelectedText) {
            console.log('🔄 Retrying translation with AI engine');
            performTranslation();
        }
        
    } catch (error) {
        console.error('Error switching back to AI:', error);
                    showMainError('Failed to switch back to AI engine. Please check settings.');
    }
}

// Setup event listeners specifically for translation buttons
function setupTranslationButtons() {
    // Check if popup still exists and context is valid
    if (!popup || !isExtensionContextValid()) {
        return;
    }
    
    // Speech translation button
    const speakTranslationBtn = popup.querySelector('#speak-translation-btn');
    if (speakTranslationBtn) {
        speakTranslationBtn.removeEventListener('click', handleSpeakTranslationClick); // Remove existing listener
        speakTranslationBtn.addEventListener('click', handleSpeakTranslationClick);
    }
    
    // Copy button
    const copyBtn = popup.querySelector('#copy-btn');
    if (copyBtn) {
        copyBtn.removeEventListener('click', handleCopyClick); // Remove existing listener
        copyBtn.addEventListener('click', handleCopyClick);
    }
    
    // Replace button (only for editable areas)
    const replaceBtn = popup.querySelector('#replace-btn');
    if (replaceBtn) {
        replaceBtn.removeEventListener('click', handleReplaceClick); // Remove existing listener
        replaceBtn.addEventListener('click', handleReplaceClick);
    }
}

// Setup event listeners specifically for language selectors
function setupLanguageSelectorListeners() {
    if (!popup || !isExtensionContextValid()) return;
    
    const targetLang = popup.querySelector('#target-lang');
    
    if (targetLang) {
        // Remove existing listeners to prevent duplicates
        targetLang.removeEventListener('change', handleTargetLanguageChange);
        targetLang.addEventListener('change', function(event) {
            // Update the display text
            const display = popup.querySelector('#target-lang-display');
            if (display) {
                display.textContent = getLanguageName(event.target.value);
            }
            // Call the original handler
            handleTargetLanguageChange(event);
        });
        console.log('🔗 Target language listener setup complete for dropdown with', targetLang.options.length, 'options');
    } else {
        console.log('❌ Target language dropdown not found');
    }
}

// Setup event listener for engine selector
function setupEngineSelectorListener() {
    if (!popup || !isExtensionContextValid()) return;
    
    const engineSelector = popup.querySelector('#engine-selector');
    
    if (engineSelector) {
        // Remove existing listeners to prevent duplicates
        engineSelector.removeEventListener('change', handleEngineChange);
        engineSelector.addEventListener('change', async function(event) {
            console.log('🔧 Engine changed to:', event.target.value);
            
            // Update the display text immediately
            const engineDisplay = popup.querySelector('#engine-display');
            if (engineDisplay) {
                await updateEngineDisplay(event.target.value);
            }
            
            // Save the new engine setting
            await handleEngineChange(event);
        });
        console.log('🔗 Engine selector listener setup complete');
    } else {
        console.log('❌ Engine selector dropdown not found');
    }
}

// Separate handler functions to make them reusable
async function handleSourceLanguageChange(event) {
    console.log('🎯 Source language change triggered:', event.target.value);
    
    // Check if popup still exists and context is valid
    if (!popup || !isExtensionContextValid()) {
        console.log('❌ Popup or context invalid in handleSourceLanguageChange');
        return;
    }
    
    const sourceLang = event.target;
    const targetLang = popup.querySelector('#target-lang');
    
    if (!targetLang) {
        console.log('❌ Target lang not found in handleSourceLanguageChange');
        return;
    }
    
    try {
        console.log('💾 Saving language preferences:', sourceLang.value, '->', targetLang.value);
        await saveLanguagePreferences(sourceLang.value, targetLang.value);
        console.log('🔄 Starting translation after source language change');
        await performTranslation();
        console.log('✅ Translation completed after source language change');
    } catch (error) {
        console.error('Error updating source language:', error);
    }
}

async function handleTargetLanguageChange(event) {
    console.log('🎯 Target language change triggered:', event.target.value);
    
    // Check if popup still exists and context is valid
    if (!popup || !isExtensionContextValid()) {
        console.log('❌ Popup or context invalid in handleTargetLanguageChange');
        return;
    }
    
    const targetLang = event.target;
    
    try {
        // Get current preferences to maintain source language
        const prefs = await getLanguagePreferences();
        console.log('💾 Saving language preferences:', prefs.source, '->', targetLang.value);
        await saveLanguagePreferences(prefs.source, targetLang.value);
        console.log('🔄 Starting translation after target language change');
        await performTranslation();
        console.log('✅ Translation completed after target language change');
    } catch (error) {
        console.error('Error updating target language:', error);
    }
}

// Engine selector change handler
async function handleEngineChange(event) {
    console.log('🔧 Engine change triggered:', event.target.value);
    
    // Check if popup still exists and context is valid
    if (!popup || !isExtensionContextValid()) {
        console.log('❌ Popup or context invalid in handleEngineChange');
        return;
    }
    
    const newEngine = event.target.value;
    
    try {
        // Get current settings to check API keys
        const settings = await getExtensionSettings();
        
        // Validate API keys for premium engines
        if (newEngine === 'gemini' && !settings.geminiApiKey) {
            showMainError('Please enter Gemini API key in Options first');
            // Revert selector to current engine
            await updateEngineDisplay(settings.translationEngine);
            return;
        } else if (newEngine === 'openai' && !settings.openaiApiKey) {
            showMainError('Please enter OpenAI API key in Options first');
            // Revert selector to current engine
            await updateEngineDisplay(settings.translationEngine);
            return;
        } else if (newEngine === 'anthropic' && !settings.anthropicApiKey) {
            showMainError('Please enter Claude API key in Options first');
            // Revert selector to current engine
            await updateEngineDisplay(settings.translationEngine);
            return;
        } else if (newEngine === 'deepseek' && !settings.deepseekApiKey) {
            showMainError('Please enter DeepSeek API key in Options first');
            // Revert selector to current engine
            await updateEngineDisplay(settings.translationEngine);
            return;
        } else if (newEngine === 'grok' && !settings.grokApiKey) {
            showMainError('Please enter Grok API key in Options first');
            // Revert selector to current engine
            await updateEngineDisplay(settings.translationEngine);
            return;
        } else if (newEngine === 'groq' && !settings.groqApiKey) {
            showMainError('Please enter Groq API key in Options first');
            // Revert selector to current engine
            await updateEngineDisplay(settings.translationEngine);
            return;
        }
        
        // Save the new engine setting
        settings.translationEngine = newEngine;
        await chrome.storage.sync.set(settings);
        
        // Update current settings cache
        currentSettings = settings;
        
        console.log('💾 Engine preference saved:', newEngine);
        console.log('🔄 Starting translation with new engine');
        
        // Perform translation with new engine
        await performTranslation();
        
        console.log('✅ Translation completed with new engine:', newEngine);
    } catch (error) {
        console.error('Error updating engine:', error);
        showMainError('Failed to change engine. Please try again.');
    }
}

// Copy button click handler
function handleCopyClick() {
    if (translatedText && popup && isExtensionContextValid()) {
        navigator.clipboard.writeText(translatedText).then(() => {
            // Double-check popup still exists after async operation
            if (!popup || !isExtensionContextValid()) return;
            
            const copyBtn = popup.querySelector('#copy-btn');
            if (copyBtn) {
                // Visual feedback
                const originalIcon = copyBtn.innerHTML;
                copyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                        <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                `;
                setTimeout(() => {
                    // Check again before restoring icon
                    if (copyBtn && popup && isExtensionContextValid()) {
                    copyBtn.innerHTML = originalIcon;
                    }
                }, 1500);
            }
        }).catch(error => {
            console.error('Failed to copy text:', error);
        });
    }
}

// Speech translation button click handler with pause functionality
async function handleSpeakTranslationClick(event) {
    // Prevent event bubbling that might close popup
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('🔊 Speech button clicked - translatedText:', translatedText ? translatedText.substring(0, 50) : 'EMPTY');
    
    // Try to get translated text from the DOM if global variable is empty
    if (!translatedText && popup) {
        const translationDiv = popup.querySelector('#translation-result div:not(.error)');
        if (translationDiv) {
            translatedText = translationDiv.textContent || translationDiv.innerText || '';
            console.log('🔊 Got text from DOM:', translatedText.substring(0, 50));
        }
    }
    
    if (translatedText && popup && isExtensionContextValid()) {
        try {
            const speakBtn = popup.querySelector('#speak-translation-btn');
            
            // Check if speech is currently playing
            if (speechSynthesis.speaking) {
                // Pause/stop speech
                speechSynthesis.cancel();
                
                // Restore original play icon
                if (speakBtn) {
                    speakBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    `;
                }
                return;
            }
            
            // Get target language for speech
            const prefs = await getLanguagePreferences();
            const targetLang = prefs.target;
            
            // Change to pause icon
            if (speakBtn) {
                speakBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                `;
            }
            
            // Speak the translated text
            speakText(translatedText, targetLang, 1);
            
            // Restore play icon when speech ends
            const checkSpeechEnd = setInterval(() => {
                if (!speechSynthesis.speaking) {
                    clearInterval(checkSpeechEnd);
                    if (speakBtn && popup && isExtensionContextValid()) {
                        speakBtn.innerHTML = `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                        `;
                    }
                }
            }, 100);
            
        } catch (error) {
            console.error('Failed to speak translation:', error);
        }
    }
}

// Normal speed speech button click handler with pause functionality
async function handleSpeakNormalClick(event) {
    // Prevent event bubbling that might close popup
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('🔊 Normal speech button clicked');
    
    if (currentSelectedText && popup && isExtensionContextValid()) {
        try {
            const speakBtn = popup.querySelector('#speak-normal');
            
            // Check if speech is currently playing
            if (speechSynthesis.speaking) {
                // Pause/stop speech
                speechSynthesis.cancel();
                
                // Restore original play icon
                if (speakBtn) {
                    speakBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    `;
                }
                return;
            }
            
            // Change to pause icon
            if (speakBtn) {
                speakBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                `;
            }
            
            // Speak the selected text at normal speed
            speakText(currentSelectedText, detectedLanguage || 'auto', 1);
            
            // Restore play icon when speech ends
            const checkSpeechEnd = setInterval(() => {
                if (!speechSynthesis.speaking) {
                    clearInterval(checkSpeechEnd);
                    if (speakBtn && popup && isExtensionContextValid()) {
                        speakBtn.innerHTML = `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        `;
                    }
                }
            }, 100);
            
        } catch (error) {
            console.error('Failed to speak normal:', error);
        }
    }
}

// Slow speed speech button click handler with pause functionality
async function handleSpeakSlowClick(event) {
    // Prevent event bubbling that might close popup
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('🔊 Slow speech button clicked');
    
    if (currentSelectedText && popup && isExtensionContextValid()) {
        try {
            const speakBtn = popup.querySelector('#speak-slow');
            
            // Check if speech is currently playing
            if (speechSynthesis.speaking) {
                // Pause/stop speech
                speechSynthesis.cancel();
                
                // Restore original play icon
                if (speakBtn) {
                    speakBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    `;
                }
                return;
            }
            
            // Change to pause icon
            if (speakBtn) {
                speakBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                `;
            }
            
            // Speak the selected text at slow speed
            const rate = currentSettings ? currentSettings.slowSpeechRate : 0.25;
            speakText(currentSelectedText, detectedLanguage || 'auto', rate);
            
            // Restore play icon when speech ends
            const checkSpeechEnd = setInterval(() => {
                if (!speechSynthesis.speaking) {
                    clearInterval(checkSpeechEnd);
                    if (speakBtn && popup && isExtensionContextValid()) {
                        speakBtn.innerHTML = `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        `;
                    }
                }
            }, 100);
            
        } catch (error) {
            console.error('Failed to speak slow:', error);
        }
    }
}

// Replace selected text with translation in editable areas
function replaceSelectedText(translationText) {
    // Validate stored element
    if (!isStoredElementValid()) {
        return;
    }
    
    const element = selectedFromElement;
    const startPos = originalSelectionStart;
    const endPos = originalSelectionEnd;
    
    try {
        // Get current text
        const currentText = element.value;
        const selectedText = currentText.substring(startPos, endPos);
        
        // Verify the text matches what we expect
        if (selectedText !== currentSelectedText) {
            // Try to find the text in current content
            const textIndex = currentText.indexOf(currentSelectedText);
            if (textIndex !== -1) {
                // Update positions
                const newStartPos = textIndex;
                const newEndPos = textIndex + currentSelectedText.length;
                
                // Replace using found positions
                const newText = currentText.substring(0, newStartPos) + translationText + currentText.substring(newEndPos);
                element.value = newText;
                
                // Set cursor position after replaced text
                const newCursorPos = newStartPos + translationText.length;
                element.setSelectionRange(newCursorPos, newCursorPos);
                
                // Trigger events
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                
                return;
            } else {
                return;
            }
        }
        
        // Replace text using stored positions
        const newText = currentText.substring(0, startPos) + translationText + currentText.substring(endPos);
        element.value = newText;
        
        // Set cursor position after replaced text
        const newCursorPos = startPos + translationText.length;
        element.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input and change events to notify the page
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Focus the element to ensure it's active
        element.focus();
        
    } catch (error) {
        console.error('Error replacing text:', error);
    }
}

// Replace button click handler
function handleReplaceClick() {
    if (translatedText) {
        replaceSelectedText(translatedText);
    }
}

// Simple, quiet settings opener - no error popups, always works
async function openSettingsQuietly() {
    console.log('🔧 Opening settings quietly...');
    
    // Hide popup immediately to prevent interference
    if (popup && popup.style.display !== 'none') {
        hidePopup();
    }
    
    // Stop any ongoing translation to prevent context issues
    if (isTranslating) {
        isTranslating = false;
        if (translationTimeout) {
            clearTimeout(translationTimeout);
            translationTimeout = null;
        }
    }
    
    // Try methods in order, but don't show any errors to user
    const methods = [
        // Method 1: Background script
        async () => {
            if (chrome.runtime && chrome.runtime.sendMessage) {
                const response = await chrome.runtime.sendMessage({ action: 'openOptions' });
                return response && response.success;
            }
            return false;
        },
        
        // Method 2: Direct API
        async () => {
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                await chrome.runtime.openOptionsPage();
                return true;
            }
            return false;
        },
        
        // Method 3: Alternative runtime method
        async () => {
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                await chrome.runtime.openOptionsPage();
                return true;
            }
            return false;
        },
        
        // Method 4: Window open with extension ID
        async () => {
            let extensionId = chrome.runtime?.id;
            if (!extensionId) {
                // Try to extract from script tags
                const scripts = document.querySelectorAll('script[src*="chrome-extension://"]');
                for (const script of scripts) {
                    const match = script.src.match(/chrome-extension:\/\/([a-z]+)\//);
                    if (match) {
                        extensionId = match[1];
                        break;
                    }
                }
            }
            
            if (extensionId) {
                const optionsUrl = `chrome-extension://${extensionId}/options.html`;
                const win = window.open(optionsUrl, '_blank');
                if (win) {
                    win.focus();
                    return true;
                }
            }
            return false;
        }
    ];
    
    // Try each method until one works
    for (const method of methods) {
        try {
            const success = await method();
            if (success) {
                console.log('✅ Settings opened successfully');
                return;
            }
        } catch (error) {
            // Silently continue to next method
            console.log('Method failed, trying next:', error.message);
        }
    }
    
    // All methods failed - still be silent about it
    console.log('❌ All methods failed - options could not be opened');
}

// Open options page with multiple fallback methods
async function openOptionsPageWithFallback() {
    console.log('🔧 Attempting to open options page...');
    console.log('🔧 Extension context valid:', isExtensionContextValid());
    console.log('🔧 Chrome runtime available:', !!chrome.runtime);
    console.log('🔧 OpenOptionsPage available:', !!chrome.runtime?.openOptionsPage);
    
    // Hide popup immediately to prevent interference
    if (popup && popup.style.display !== 'none') {
        hidePopup();
    }
    
    // Stop any ongoing translation to prevent context issues
    if (isTranslating) {
        isTranslating = false;
        if (translationTimeout) {
            clearTimeout(translationTimeout);
            translationTimeout = null;
        }
    }
    
    // Method 1: Direct chrome.runtime.openOptionsPage
    try {
        if (chrome.runtime && chrome.runtime.openOptionsPage && isExtensionContextValid()) {
            console.log('🔧 Trying Method 1: chrome.runtime.openOptionsPage');
            await chrome.runtime.openOptionsPage();
            console.log('✅ Method 1 succeeded');
            return;
    } else {
            console.log('❌ Method 1 not available: openOptionsPage not found or context invalid');
        }
    } catch (error) {
        console.log('❌ Method 1 (openOptionsPage) failed:', error);
    }
    
    // Method 2: Manifest-based URL with manual construction
    try {
        console.log('🔧 Trying Method 2: Manual URL construction');
        
        // Get extension ID from chrome.runtime.id if available
        let extensionId = '';
        try {
            extensionId = chrome.runtime.id;
        } catch (e) {
            // Fallback: try to extract from current script URL
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                if (script.src && script.src.includes('chrome-extension://')) {
                    const match = script.src.match(/chrome-extension:\/\/([a-z]+)\//);
                    if (match) {
                        extensionId = match[1];
                        break;
                    }
                }
            }
        }
        
        if (extensionId) {
            const optionsUrl = `chrome-extension://${extensionId}/options.html`;
            console.log('🔧 Constructed options URL:', optionsUrl);
            
            // Try window.open with specific parameters to avoid blocking
            const optionsWindow = window.open(
                optionsUrl, 
                'ai_translator_options', 
                'width=800,height=700,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no'
            );
            
            if (optionsWindow) {
                // Small delay to ensure window opens
                setTimeout(() => {
                    optionsWindow.focus();
                }, 100);
                console.log('✅ Method 2 succeeded');
                return;
            }
        }
        
        console.log('❌ Method 2 failed: Could not construct or open URL');
    } catch (error) {
        console.log('❌ Method 2 (manual URL) failed:', error);
    }
    
    // Method 3: Alternative runtime method with context validation
    try {
        if (isExtensionContextValid() && chrome.runtime && chrome.runtime.openOptionsPage) {
            console.log('🔧 Trying Method 3: chrome.runtime.openOptionsPage (alternative)');
            await chrome.runtime.openOptionsPage();
            console.log('✅ Method 3 succeeded');
            return;
        }
    } catch (error) {
        console.log('❌ Method 3 (runtime alternative) failed:', error);
    }
    
    // Method 4: chrome.runtime.sendMessage to background
    try {
        if (isExtensionContextValid() && chrome.runtime && chrome.runtime.sendMessage) {
            console.log('🔧 Trying Method 4: chrome.runtime.sendMessage');
            const response = await chrome.runtime.sendMessage({ 
                action: 'openOptions',
                timestamp: Date.now() 
            });
            if (response && response.success) {
                console.log('✅ Method 4 succeeded');
                return;
            }
            console.log('❌ Method 4 failed: Invalid response', response);
        }
    } catch (error) {
        console.log('❌ Method 4 (sendMessage) failed:', error);
    }
    
    // Method 5: User instruction with copy-paste URL
    try {
        console.log('🔧 Trying Method 5: User instruction with URL');
        
        let extensionId = '';
        try {
            extensionId = chrome.runtime.id;
        } catch (e) {
            // Try to extract from any extension URLs on the page
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                const style = window.getComputedStyle(el);
                if (style.backgroundImage && style.backgroundImage.includes('chrome-extension://')) {
                    const match = style.backgroundImage.match(/chrome-extension:\/\/([a-z]+)\//);
                    if (match) {
                        extensionId = match[1];
                        break;
                    }
                }
            }
        }
        
        const optionsUrl = extensionId ? 
            `chrome-extension://${extensionId}/options.html` : 
            'chrome://extensions/ (find 888 AI Popup Translator and click Options)';
        
        // Create a user-friendly dialog
        const userMessage = `Settings cannot be opened automatically due to browser security restrictions.
        
Please try one of these methods:

🔹 Copy this URL to your address bar:
${optionsUrl}

🔹 Or right-click the 888 extension icon in your toolbar and select "Options"

🔹 Or go to chrome://extensions/, find "888 AI Popup Translator", and click "Options"

Would you like to copy the settings URL to your clipboard?`;

        const shouldCopy = confirm(userMessage);
        
        if (shouldCopy && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(optionsUrl);
                showMainError('✅ Settings URL copied to clipboard! Paste it in your address bar.');
            } catch (e) {
                // Fallback for clipboard access issues
                const textArea = document.createElement('textarea');
                textArea.value = optionsUrl;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showMainError('✅ Settings URL copied to clipboard! Paste it in your address bar.');
            }
        }
        
        console.log('✅ Method 5 completed (user instruction)');
        return;
        
    } catch (error) {
        console.log('❌ Method 5 (user instruction) failed:', error);
    }
    
    // Final fallback: Simple instruction
    showMainError('Unable to open settings automatically. Please right-click the 888 extension icon in your browser toolbar and select "Options".');
    
    console.log('❌ All methods completed - user notified');
}

// Setup header buttons that should always work (even during translation)
function setupHeaderButtons() {
    if (!popup) return;
    
    // Close button
    const closeBtn = popup.querySelector('#close-btn');
    if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
        closeBtn.setAttribute('data-listener-added', 'true');
        closeBtn.addEventListener('click', () => {
            hidePopup();
            hideIcon();
        });
    }
    
    // Settings button - should always work with multiple fallback methods
    const settingsBtn = popup.querySelector('#settings-btn');
    if (settingsBtn && !settingsBtn.hasAttribute('data-listener-added')) {
        settingsBtn.setAttribute('data-listener-added', 'true');
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Always allow settings to open, regardless of translation state
            
            // Visual feedback - DON'T disable the button
            const originalOpacity = settingsBtn.style.opacity || '1';
            settingsBtn.style.opacity = '0.7';
            
            openSettingsQuietly().finally(() => {
                // Restore opacity quickly
                setTimeout(() => {
                    if (settingsBtn) {
                        settingsBtn.style.opacity = originalOpacity;
                    }
                }, 200);
            });
        });
    }
    
    // Donate button - show donation addresses
    const donateBtn = popup.querySelector('#donate-btn');
    if (donateBtn && !donateBtn.hasAttribute('data-listener-added')) {
        donateBtn.setAttribute('data-listener-added', 'true');
        donateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showDonationDialog();
        });
    }
    
    // History button - should always work
    const historyBtn = popup.querySelector('#history-btn');
    if (historyBtn && !historyBtn.hasAttribute('data-listener-added')) {
        historyBtn.setAttribute('data-listener-added', 'true');
        historyBtn.addEventListener('click', () => {
            showHistoryDialog();
        });
    }
}

// Setup event listeners for popup
async function setupEventListeners() {
    if (!popup) return;
    
    // Universal click handler for dynamically created buttons
    popup.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        // Handle grammar check button clicks
        if (target.id === 'grammar-check-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔧 Grammar check button clicked (universal handler)');
            await performGrammarCheck();
            return;
        }
        
        // Handle AI explain button clicks
        if (target.id === 'ai-explain-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔧 AI explain button clicked (universal handler)');
            await showAIExplanation();
            return;
        }
    });
    
    // Setup translation buttons
    setupTranslationButtons();
    
    // Setup language selectors
    setupLanguageSelectorListeners();
    
    // Setup engine selector
    setupEngineSelectorListener();
    
    // Speech buttons with play/pause functionality
    const speakNormal = popup.querySelector('#speak-normal');
    const speakSlow = popup.querySelector('#speak-slow');
    
    if (speakNormal) {
        speakNormal.addEventListener('click', (event) => {
            handleSpeakNormalClick(event);
        });
    }
    
    if (speakSlow) {
        speakSlow.addEventListener('click', (event) => {
            handleSpeakSlowClick(event);
        });
    }
    

    
    // Grammar check button (with retry mechanism since it might not be in DOM initially)
    if (popup) {
        const grammarCheckBtn = popup.querySelector('#grammar-check-btn');
        console.log('🔧 Looking for grammar check button:', !!grammarCheckBtn);
        if (grammarCheckBtn && !grammarCheckBtn.hasAttribute('data-listener-added')) {
        console.log('🔧 Setting up grammar check button listener');
        grammarCheckBtn.setAttribute('data-listener-added', 'true');
        grammarCheckBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔧 Grammar check button clicked');
            await performGrammarCheck();
        });
    } else if (!grammarCheckBtn) {
        // Button might not be in DOM yet, set up a delayed retry
        setTimeout(() => {
            const delayedGrammarBtn = popup.querySelector('#grammar-check-btn');
            if (delayedGrammarBtn && !delayedGrammarBtn.hasAttribute('data-listener-added')) {
                console.log('🔧 Setting up delayed grammar check button listener');
                delayedGrammarBtn.setAttribute('data-listener-added', 'true');
                delayedGrammarBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔧 Grammar check button clicked (delayed setup)');
                    await performGrammarCheck();
                });
            }
        }, 500);
    }
}
    
    // AI Explain button
    if (popup) {
        const aiExplainBtn = popup.querySelector('#ai-explain-btn');
        if (aiExplainBtn && !aiExplainBtn.hasAttribute('data-listener-added')) {
        aiExplainBtn.setAttribute('data-listener-added', 'true');
            aiExplainBtn.addEventListener('click', async () => {
                console.log('🔧 AI Explain button clicked');
                await showAIExplanation();
            });
        }
    }
    
    // Switch to AI button (for free engine footer)
    const switchToAiBtn = popup.querySelector('#switch-to-ai-btn');
    if (switchToAiBtn) {
        switchToAiBtn.addEventListener('click', async () => {
            // Open options page to configure AI engine
            try {
                await chrome.runtime.sendMessage({ action: 'openOptions' });
            } catch (error) {
                console.error('Error opening options:', error);
                // Fallback: try alternative method
                try {
                    chrome.runtime.openOptionsPage();
                } catch (fallbackError) {
                    console.error('Fallback failed:', fallbackError);
                    showMainError('Please click the extension icon and select Settings to configure AI engines.');
                }
            }
        });
    }

}

// Setup drag functionality for popup
function setupPopupDrag() {
    if (!popup) return;
    
    const header = popup.querySelector('#popup-header');
    if (!header) return;
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let popupStartX = 0;
    let popupStartY = 0;
    
    header.addEventListener('mousedown', (e) => {
        // Don't start drag if clicking on interactive elements
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('select') || e.target.closest('button')) {
            return;
        }
        
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        // Get current popup position
        const rect = popup.getBoundingClientRect();
        popupStartX = rect.left;
        popupStartY = rect.top;
        
        // Add visual feedback
        header.style.background = '#e5e7eb';
        document.body.style.cursor = 'move';
        document.body.style.userSelect = 'none';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        let newX = popupStartX + deltaX;
        let newY = popupStartY + deltaY;
        
        // Keep popup within viewport bounds
        const popupRect = popup.getBoundingClientRect();
        const maxX = window.innerWidth - popupRect.width;
        const maxY = window.innerHeight - popupRect.height;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        popup.style.left = newX + 'px';
        popup.style.top = newY + 'px';
        
        e.preventDefault();
    });
    
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        
        isDragging = false;
        
        // Remove visual feedback
        header.style.background = '#f5f5f5';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}

// AI Explanation functionality
async function showAIExplanation() {
    const settings = currentSettings || await getExtensionSettings();
    
    // Check if AI engine is selected
    const currentEngine = settings.translationEngine || 'free';
    if (currentEngine === 'free' || currentEngine === 'google') {
        showMainError('To use AI features, go to settings and select an AI engine to activate them');
        return;
    }
    
    // Check if AI services are available
    if (!settings.geminiApiKey && !settings.openaiApiKey && !settings.anthropicApiKey) {
        showMainError('AI Explain requires a Gemini, OpenAI, or Anthropic API key. Please configure it in the extension options.');
        return;
    }
    
    if (!currentSelectedText || !translatedText) {
        showMainError('Please select and translate text first.');
        return;
    }
    
    // Store the text locally to prevent it from being cleared during async operations
    const textToAnalyze = currentSelectedText;
    const sourceLanguage = detectedLanguage;
    
    console.log('🔤 AI Explain - Text to analyze:', textToAnalyze);
    console.log('🔤 AI Explain - Source language:', sourceLanguage);
    
    // Show explanation dialog immediately with generating state
    showExplanationDialog("generating");
    
    try {
        // Show loading state on button
        if (popup) {
            const aiExplainBtn = popup.querySelector('#ai-explain-btn');
            if (aiExplainBtn) {
            aiExplainBtn.style.opacity = '0.5';
            aiExplainBtn.style.pointerEvents = 'none';
            aiExplainBtn.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c.83 0 1.64.11 2.4.31"></path>
                </svg>
                <span>Thinking...</span>
            `;
            }
        }
        
        // Small delay to ensure UI updates are visible before heavy processing
        await new Promise(resolve => setTimeout(resolve, 200));
        
        let explanation;
        if (settings.geminiApiKey) {
            explanation = await getAIExplanationGemini(textToAnalyze, translatedText, sourceLanguage, settings);
        } else if (settings.openaiApiKey) {
            explanation = await getAIExplanationOpenAI(textToAnalyze, translatedText, sourceLanguage, settings);
        } else if (settings.anthropicApiKey) {
            explanation = await getAIExplanationAnthropic(textToAnalyze, translatedText, sourceLanguage, settings);
        }
        
        // Update the dialog with the final explanation
        updateExplanationDialog(explanation);
        
    } catch (error) {
        console.error('AI Explanation error:', error);
                    showMainError('Failed to get AI explanation. Please try again.');
    } finally {
        // Reset button state
        if (popup) {
            const aiExplainBtn = popup.querySelector('#ai-explain-btn');
            if (aiExplainBtn) {
            aiExplainBtn.style.opacity = '1';
            aiExplainBtn.style.pointerEvents = 'auto';
            aiExplainBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"></path>
                    <rect x="9" y="7" width="6" height="6"></rect>
                </svg>
                AI Explain
            `;
            }
        }
    }
}

// Grammar Check functionality
async function performGrammarCheck() {
    const settings = currentSettings || await getExtensionSettings();
    
    // Check if AI engine is selected
    const currentEngine = settings.translationEngine || 'free';
    if (currentEngine === 'free' || currentEngine === 'google') {
        showMainError('To use AI features, go to settings and select an AI engine to activate them');
        return;
    }
    
    // Check if AI services are available (Google Translate doesn't support grammar check)
    if (!settings.geminiApiKey && !settings.openaiApiKey && !settings.anthropicApiKey) {
        showMainError('Grammar check requires an AI service (Gemini, OpenAI, or Anthropic). Please configure an API key in the extension options.');
        return;
    }
    
    if (!currentSelectedText) {
        showMainError('Please select text first to check grammar.');
        return;
    }
    
    try {
        // Show loading state
        const grammarCheckBtn = popup.querySelector('#grammar-check-btn');
        if (grammarCheckBtn) {
            grammarCheckBtn.disabled = true;
            grammarCheckBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c.83 0 1.64.11 2.4.31"></path>
                </svg>
                Checking...
            `;
        }
        
        let correctedText;
        if (settings.geminiApiKey) {
            correctedText = await checkGrammarWithGemini(currentSelectedText, settings);
        } else if (settings.openaiApiKey) {
            correctedText = await checkGrammarWithOpenAI(currentSelectedText, settings);
        } else if (settings.anthropicApiKey) {
            correctedText = await checkGrammarWithAnthropic(currentSelectedText, settings);
        }
        
        // Show grammar check result inline
        showGrammarCheckInline(correctedText);
        
    } catch (error) {
        console.error('Grammar check error:', error);
        showMainError('Failed to check grammar. Please try again.');
    } finally {
        // Reset button state
        const grammarCheckBtn = popup.querySelector('#grammar-check-btn');
        if (grammarCheckBtn) {
            grammarCheckBtn.disabled = false;
            grammarCheckBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"></path>
                    <circle cx="12" cy="12" r="9"></circle>
                </svg>
                Grammar
            `;
        }
    }
}

// Show grammar check result inline in popup
function showGrammarCheckInline(correctedText) {
    if (!popup) return;
    
    const grammarCorrectionSection = popup.querySelector('#grammar-correction-section');
    const grammarSuccessSection = popup.querySelector('#grammar-success-section');
    
    // Hide both sections first
    if (grammarCorrectionSection) grammarCorrectionSection.style.display = 'none';
    if (grammarSuccessSection) grammarSuccessSection.style.display = 'none';
    
    // Check if text is correct
    const isCorrect = correctedText.toUpperCase() === 'CORRECT' || correctedText === currentSelectedText;
    
    if (isCorrect) {
        // Show success section
        if (grammarSuccessSection) {
            grammarSuccessSection.style.display = 'block';
        }
            } else {
        // Show correction section
        if (grammarCorrectionSection) {
            const correctionTextDiv = grammarCorrectionSection.querySelector('#grammar-correction-text');
            if (correctionTextDiv) {
                correctionTextDiv.textContent = correctedText;
            }
            

            
            grammarCorrectionSection.style.display = 'block';
            
            // Setup event listeners for inline buttons
            setupInlineCorrectionButtons(correctedText);
        }
    }
}

// Setup event listeners for inline correction buttons
function setupInlineCorrectionButtons(correctedText) {
    const copyBtn = popup.querySelector('#copy-correction-inline');
    
    // Copy button
    if (copyBtn) {
        // Remove existing listeners
        copyBtn.replaceWith(copyBtn.cloneNode(true));
        const newCopyBtn = popup.querySelector('#copy-correction-inline');
        
        newCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(correctedText).then(() => {
                const originalText = newCopyBtn.innerHTML;
                newCopyBtn.innerHTML = '✅ Copied!';
                setTimeout(() => {
                    newCopyBtn.innerHTML = originalText;
                }, 2000);
            });
        });
    }
}

// Hide grammar correction sections
function hideGrammarSections() {
    if (!popup) return;
    
    const grammarCorrectionSection = popup.querySelector('#grammar-correction-section');
    const grammarSuccessSection = popup.querySelector('#grammar-success-section');
    
    if (grammarCorrectionSection) grammarCorrectionSection.style.display = 'none';
    if (grammarSuccessSection) grammarSuccessSection.style.display = 'none';
}

// Check grammar using Gemini
async function checkGrammarWithGemini(text, settings) {
    const prompt = `Please check the grammar and spelling of the following text and provide a corrected version. If the text is already correct, respond with exactly "CORRECT". If there are errors, provide only the corrected text without any explanations or additional formatting.

Text to check: "${text}"

Corrected text:`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${settings.geminiApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 500,
                topP: 0.8,
                topK: 10
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text.trim();
    }
    
    throw new Error('Failed to get grammar check from Gemini');
}

// Check grammar using OpenAI
async function checkGrammarWithOpenAI(text, settings) {
    const prompt = `Please check the grammar and spelling of the following text. If the text is already correct, respond with exactly "CORRECT". If there are errors, provide only the corrected text without any explanations.

Text: "${text}"`;

    // Get the best available model
    const bestModel = await getBestOpenAIModel(settings.openaiApiKey);
    console.log('📝 Grammar check using model:', bestModel);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.openaiApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: bestModel,
            messages: [
                {
                    role: 'system',
                    content: 'You are a grammar checker. If the text is correct, respond with exactly "CORRECT". If there are errors, provide only the corrected text without explanations.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 300,
            temperature: 0.1
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error('Failed to get grammar check from OpenAI');
}

// Check grammar using Anthropic
async function checkGrammarWithAnthropic(text, settings) {
    const prompt = `Please check the grammar and spelling of the following text. If the text is already correct, respond with exactly "CORRECT". If there are errors, provide only the corrected text without any explanations.

Text: "${text}"`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': settings.anthropicApiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 300,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text.trim();
    }
    
    throw new Error('Failed to get grammar check from Anthropic');
}

// Show grammar check result dialog
function showGrammarCheckDialog(originalText, correctedText) {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.id = 'grammar-check-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
    `;
    
    // Check if text is correct
    const isCorrect = correctedText.toUpperCase() === 'CORRECT' || correctedText === originalText;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        max-height: 80vh;
        width: 90%;
        overflow-y: auto;
        position: relative;
        animation: slideIn 0.3s ease-out;
    `;
    
    const headerColor = isCorrect ? '#10b981' : '#f59e0b';
    const headerIcon = isCorrect ? '✅' : '📝';
    const headerText = isCorrect ? 'Grammar Check - Correct!' : 'Grammar Check - Suggestions';
    
    dialog.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: ${headerColor}; font-size: 18px; font-weight: 600;">
                    ${headerIcon} ${headerText}
                </h3>
                <button id="close-grammar-check" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px;" title="Close">
                    ×
                </button>
            </div>
        </div>
        <div style="padding: 20px;">
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 500;">Original Text:</h4>
                <div style="background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 14px; line-height: 1.5;">
                    ${originalText}
                </div>
            </div>
            
            ${isCorrect ? `
                <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; border: 1px solid #10b981; text-align: center;">
                    <div style="color: #10b981; font-size: 16px; font-weight: 600; margin-bottom: 5px;">
                        ✅ Perfect Grammar!
                    </div>
                    <div style="color: #065f46; font-size: 14px;">
                        Your text is grammatically correct and well-written.
                    </div>
                </div>
            ` : `
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 500;">Suggested Correction:</h4>
                    <div style="background: #fef3c7; padding: 12px; border-radius: 6px; border: 1px solid #f59e0b; font-size: 14px; line-height: 1.5;">
                        ${correctedText}
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button id="copy-correction" style="background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;" title="Copy corrected text">
                        📋 Copy
                    </button>
                    ${isStoredElementValid() ? `
                        <button id="replace-with-correction" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;" title="Replace selected text with correction">
                            🔄 Replace
                        </button>
                    ` : ''}
                </div>
            `}
        </div>
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        #close-grammar-check:hover {
            background: #f3f4f6 !important;
        }
        
        #copy-correction:hover {
            background: #059669 !important;
        }
        
        #replace-with-correction:hover {
            background: #2563eb !important;
        }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Close functionality
    function closeDialog() {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
    }
    
    // Event listeners
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog();
    });
    
    dialog.querySelector('#close-grammar-check').addEventListener('click', closeDialog);
    
    // Copy correction button
    const copyBtn = dialog.querySelector('#copy-correction');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(correctedText).then(() => {
                copyBtn.innerHTML = '✅ Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 Copy Correction';
                }, 2000);
            });
        });
    }
    
    // Replace with correction button
    const replaceBtn = dialog.querySelector('#replace-with-correction');
    if (replaceBtn) {
        replaceBtn.addEventListener('click', () => {
            replaceSelectedText(correctedText);
            closeDialog();
        });
    }
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Get AI explanation using Gemini
async function getAIExplanationGemini(originalText, translatedText, sourceLang, settings) {
    // Validate input text
    if (!originalText || originalText.trim() === '') {
        throw new Error('No text provided for AI explanation');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(settings.defaultTargetLang);
    
    const prompt = `Analyze this ${sourceLanguage} text in ${targetLanguage}. Keep it concise:

Text: "${originalText}"

Provide brief analysis in ${targetLanguage}:

1. **Word-by-Word Breakdown**: Key words/phrases and their meanings (brief).

2. **Explain or Meaning**: Overall meaning and context (concise).

Keep each section short and focused. Use ${targetLanguage} only.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${settings.geminiApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 800,
                topP: 0.9,
                topK: 20
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text.trim();
    }
    
    throw new Error('Failed to get Gemini explanation');
}

// Get AI explanation using OpenAI
async function getAIExplanationOpenAI(originalText, translatedText, sourceLang, settings) {
    // Validate input text
    if (!originalText || originalText.trim() === '') {
        throw new Error('No text provided for AI explanation');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(settings.defaultTargetLang);
    
    const prompt = `Analyze this ${sourceLanguage} text in ${targetLanguage}. Keep it concise:

Text: "${originalText}"

Provide brief analysis in ${targetLanguage}:

1. **Word-by-Word Breakdown**: Key words/phrases and their meanings (brief).

2. **Explain or Meaning**: Overall meaning and context (concise).

Keep each section short and focused. Use ${targetLanguage} only.`;

    // Get the best available model
    const bestModel = await getBestOpenAIModel(settings.openaiApiKey);
    console.log('📚 AI explanation using model:', bestModel);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.openaiApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: bestModel,
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful language teacher and translation expert. Provide clear, educational explanations about translations.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 600,
            temperature: 0.3
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error('Failed to get AI explanation');
}

// Get AI explanation using Anthropic
async function getAIExplanationAnthropic(originalText, translatedText, sourceLang, settings) {
    // Validate input text
    if (!originalText || originalText.trim() === '') {
        throw new Error('No text provided for AI explanation');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(settings.defaultTargetLang);
    
    const prompt = `Analyze this ${sourceLanguage} text in ${targetLanguage}. Keep it concise:

Text: "${originalText}"

Provide brief analysis in ${targetLanguage}:

1. **Word-by-Word Breakdown**: Key words/phrases and their meanings (brief).

2. **Explain or Meaning**: Overall meaning and context (concise).

Keep each section short and focused. Use ${targetLanguage} only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': settings.anthropicApiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 600,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text.trim();
    }
    
    throw new Error('Failed to get AI explanation');
}

// Show explanation dialog
function showExplanationDialog(explanation) {
    // Remove existing dialog if any
    const existingOverlay = document.getElementById('ai-explanation-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.id = 'ai-explanation-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.id = 'ai-explanation-dialog';
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 600px;
        max-height: 80vh;
        width: 90%;
        overflow-y: auto;
        position: relative;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Determine content based on explanation
    let contentHtml;
    if (explanation === "generating") {
        contentHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px; color: #0d6efd;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c.83 0 1.64.11 2.4.31"></path>
                </svg>
                <div style="font-size: 16px; font-weight: 500;">AI is analyzing your text...</div>
                <div style="font-size: 14px; color: #6c757d; text-align: center;">Please wait while we generate a detailed explanation</div>
            </div>
        `;
        } else {
        // Process AI explanation content: remove **, make titles bold, format properly
        contentHtml = explanation
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert **text** to <strong>text</strong>
            .replace(/\n/g, '<br>'); // Convert line breaks
    }
    
    dialog.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                    🤖 AI Translation Explanation
                </h3>
                <button id="close-explanation" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px;" title="Close">
                    ×
                </button>
            </div>
        </div>
        <div id="explanation-content" style="padding: 16px; line-height: 1.4; color: #374151; font-size: ${currentSettings?.fontSize || 14}px;">
            ${contentHtml}
        </div>
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        #close-explanation:hover {
            background: #f3f4f6 !important;
        }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Close functionality
    function closeDialog() {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
    }
    
    // Event listeners
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog();
    });
    
    dialog.querySelector('#close-explanation').addEventListener('click', closeDialog);
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Update explanation dialog with final content
function updateExplanationDialog(explanation) {
    const contentDiv = document.getElementById('explanation-content');
    if (contentDiv) {
        // Process content: remove **, make titles bold, format properly
        const processedContent = explanation
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert **text** to <strong>text</strong>
            .replace(/\n/g, '<br>'); // Convert line breaks
        contentDiv.innerHTML = processedContent;
    }
}

// Intelligent popup positioning - ALWAYS at icon location
function positionPopup() {
    if (!popup) return;
    
    // Use stored icon position (from exact mouse cursor)
    let iconRect = lastIconPosition;
    
    // If no stored position, use current mouse position as fallback
    if (!iconRect || (!iconRect.left && !iconRect.top)) {
            iconRect = {
            left: currentMousePosition.x,
            top: currentMousePosition.y,
            width: 28,
            height: 28
        };
    }
    
    // Get popup dimensions - make it visible first to measure
    popup.style.visibility = 'hidden';
    popup.style.display = 'block';
    popup.style.opacity = '0';
    popup.style.position = 'fixed'; // Ensure fixed positioning
    
    const popupRect = popup.getBoundingClientRect();
    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    
    // Define margins from viewport edges
    const margin = 15;
    const popupWidth = popupRect.width;
    const popupHeight = popupRect.height;
    
    // Position popup exactly at icon location
    let left = iconRect.left - (popupWidth / 2); // Center popup on icon horizontally
    let top = iconRect.top + 35; // Position below the icon
    
    // Horizontal boundary adjustments
    if (left + popupWidth > viewport.width - margin) {
        // Move popup to the left if it goes off right edge
        left = iconRect.left - popupWidth - 10;
    }
    
    if (left < margin) {
        // If still off left edge, position at left margin
        left = margin;
    }
    
    // Vertical boundary adjustments
    if (top + popupHeight > viewport.height - margin) {
        // Position above the icon if no space below
        top = iconRect.top - popupHeight - 10;
    }
    
    if (top < margin) {
        // If still off top edge, position at top margin
        top = margin;
    }
    
    // Final bounds enforcement
    left = Math.max(margin, Math.min(left, viewport.width - popupWidth - margin));
    top = Math.max(margin, Math.min(top, viewport.height - popupHeight - margin));
    
    // Apply fixed positioning (no scroll offset needed)
    popup.style.position = 'fixed';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.style.zIndex = '2147483646';
    
    // Ensure popup remains visible and interactive
    popup.style.visibility = 'visible';
    popup.style.display = 'block';
    popup.style.pointerEvents = 'auto';
    
    // Force redraw to ensure visibility
    popup.offsetHeight;
}

// Smart popup positioning to always stay within viewport
function positionPopupInViewport() {
    if (!popup) return;
    
    // Get current popup position and dimensions
    const popupRect = popup.getBoundingClientRect();
    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    
    const margin = 15;
    let left = parseFloat(popup.style.left) || popupRect.left;
    let top = parseFloat(popup.style.top) || popupRect.top;
    
    // Adjust horizontal position if popup goes outside viewport
    if (left + popupRect.width > viewport.width - margin) {
        left = viewport.width - popupRect.width - margin;
    }
    if (left < margin) {
        left = margin;
    }
    
    // Adjust vertical position if popup goes outside viewport
    if (top + popupRect.height > viewport.height - margin) {
        top = viewport.height - popupRect.height - margin;
    }
    if (top < margin) {
        top = margin;
    }
    
    // Apply the new position
    popup.style.position = 'fixed';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.style.zIndex = '2147483646';
    popup.style.visibility = 'visible';
    popup.style.display = 'block';
    popup.style.pointerEvents = 'auto';
    
    console.log(`📍 Popup repositioned to: ${left}, ${top} (viewport: ${viewport.width}x${viewport.height})`);
}

// Hide popup
function hidePopup() {
    isPopupOpening = false;
    isPopupActivelyUsed = false; // Reset popup usage flag
    
    // Stop any ongoing speech when popup is closed
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        console.log('🔇 Speech stopped - popup closed');
    }
    
    if (popup && popup.parentNode) {
        popup.style.pointerEvents = 'none';
        popup.parentNode.removeChild(popup);
    }
    popup = null;
}

// Check if element is input or textarea
function isInputElement(element) {
    return element && (
        element.tagName === 'INPUT' || 
        element.tagName === 'TEXTAREA' ||
        element.contentEditable === 'true'
    );
}

// Check if element should be excluded from translation
function isExcludedElement(element) {
    if (!element) return false;
    
    // List of tag names to exclude
    const excludedTags = [
        'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'EMBED',
        'OBJECT', 'AUDIO', 'VIDEO', 'CANVAS', 'SVG',
        'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'A', 'LABEL'
    ];
    
    // Check if element itself is excluded
    if (excludedTags.includes(element.tagName)) {
        return true;
    }
    
    // Check if element has certain classes or IDs that suggest UI elements
    const excludedClasses = [
        'btn', 'button', 'nav', 'menu', 'toolbar', 'header', 'footer',
        'sidebar', 'widget', 'control', 'ui-', 'form-control', 'link'
    ];
    
    // Safely get className as string (handle DOMTokenList)
    const className = safeGetClassName(element);
    const id = element.id || '';
    
    for (const excludedClass of excludedClasses) {
        if (className.toLowerCase().includes(excludedClass) || 
            id.toLowerCase().includes(excludedClass)) {
            return true;
        }
    }
    
    // Check if element has click handlers (likely interactive)
    if (element.onclick || element.getAttribute('onclick')) {
        return true;
    }
    
    // Check if element has role attribute suggesting UI element
    const role = element.getAttribute('role');
    if (role && ['button', 'menu', 'menuitem', 'tab', 'toolbar', 'link'].includes(role)) {
        return true;
    }
    
    // Check if element is clickable (has cursor pointer)
    try {
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.cursor === 'pointer') {
            return true;
        }
    } catch (e) {
        // Ignore style computation errors
    }
    
    // Check if element has href attribute (links)
    if (element.hasAttribute('href')) {
        return true;
    }
    
    // Check if element is a form control
    if (element.type && ['button', 'submit', 'reset', 'image'].includes(element.type)) {
        return true;
    }
    
    return false;
}

// Filter selected text to exclude UI elements and clean unwanted content
function filterSelectedText(selection) {
    if (!selection || selection.rangeCount === 0) {
        console.log('🚫 No selection or ranges');
        return '';
    }
    
    let selectedText = selection.toString().trim();
    console.log('🔍 Filtering text:', selectedText.substring(0, 100));
    
    // Basic checks only
    if (selectedText.length < 2) {
        console.log('🚫 Text too short');
        return '';
    }
    
    // Clean unwanted content patterns
    selectedText = cleanSelectedText(selectedText);
    
    // Check if it's obviously a UI element (very restrictive list)
    if (selectedText.length < 20 && /^(click|submit|cancel|login|signup|menu|close|select|choose)$/i.test(selectedText)) {
        console.log('🚫 Obvious UI text');
        return '';
    }
    
    // Check parent elements for UI containers and our own elements
    try {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Check if selection is PRIMARILY our extension elements (not just touching them)
        const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let totalLength = 0;
        let extensionLength = 0;
        let node;
        
        while (node = walker.nextNode()) {
            if (range.intersectsNode(node)) {
                const nodeText = node.textContent || '';
                totalLength += nodeText.length;
                
                // Check if this text node is inside our extension elements
                let parent = node.parentElement;
                let isExtensionNode = false;
                while (parent) {
                    if (parent.id === 'selection-icon' || 
                        parent.id === 'selection-popup' ||
                        parent.classList?.contains('888-ai-translator')) {
                        isExtensionNode = true;
                        break;
                    }
                    parent = parent.parentElement;
                }
                
                if (isExtensionNode) {
                    extensionLength += nodeText.length;
                }
            }
        }
        
        // Only reject if more than 30% of selection is from extension elements
        if (totalLength > 0 && (extensionLength / totalLength) > 0.3) {
            console.log('🚫 Selection primarily contains extension elements');
            return '';
        }
        
        // If selection is in a text node, check its parent
        if (container.nodeType === Node.TEXT_NODE) {
            const parent = container.parentElement;
            if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A' && parent.href)) {
                console.log('🚫 Inside button or link');
                return '';
            }
        }
    } catch (error) {
        console.log('🔍 Filter error, allowing text:', error.message);
    }
    
    console.log('✅ Text passed filter:', selectedText.substring(0, 50));
    return selectedText;
}

// Clean selected text from unwanted patterns
function cleanSelectedText(text) {
    if (!text) return '';
    
    // Remove common UI elements that get accidentally selected
    const cleanPatterns = [
        // Remove standalone numbers that look like UI elements
        /^\s*\d{1,4}\s*$/g,
        // Remove standalone "Select" or similar UI text
        /^\s*(Select|Choose|Click|Submit|Cancel|Login|Signup|Menu|Close)\s*$/gi,
        // Remove common button patterns with objects
        /^\s*(Select\s+models?|Choose\s+models?|Add\s+models?|Configure\s+models?)\s*$/gi,
        /^\s*(Select\s+items?|Choose\s+items?|Add\s+items?|Remove\s+items?)\s*$/gi,
        /^\s*(Select\s+all|Choose\s+all|Add\s+all|Remove\s+all)\s*$/gi,
        /^\s*(Select\s+files?|Choose\s+files?|Browse\s+files?|Upload\s+files?)\s*$/gi,
        /^\s*(View\s+more|Show\s+more|Load\s+more|See\s+more)\s*$/gi,
        // Remove our extension icon text if it gets included
        /^\s*888\s*$/g,
        /\s*888\s*$/g,  // Remove trailing 888
        /^\s*888\s*/g,  // Remove leading 888
    ];
    
    let cleanedText = text;
    
    // Apply cleaning patterns
    cleanPatterns.forEach(pattern => {
        cleanedText = cleanedText.replace(pattern, '');
    });
    
    // Smart content separation - remove UI button text from content
    cleanedText = separateContentFromUI(cleanedText);
    
    // Clean up multiple line breaks and trim
    cleanedText = cleanedText
        .replace(/\n\s*\n/g, '\n') // Multiple line breaks to single
        .replace(/^\s+|\s+$/g, '') // Trim
        .replace(/\s+/g, ' '); // Multiple spaces to single
    
    // Smart line filtering - always filter out UI lines but keep meaningful content
    const lines = cleanedText.split('\n').map(line => line.trim());
    const meaningfulLines = lines.filter(line => {
        // Keep lines that have substantial content
        if (line.length < 5) return false; // Too short
        
        // Skip pure UI elements
        if (line.match(/^\s*888\s*$/i)) return false; // Just "888"
        if (line.match(/^\s*select\s*(models?|items?)?\s*$/i)) return false; // Just "Select models"
        if (line.match(/^\s*\d{1,4}\s*$/)) return false; // Just numbers
        if (line.match(/^\s*(click|submit|cancel|login|signup|menu|close|choose)\s*$/i)) return false; // UI actions
        
        // Keep everything else that looks like real content
        return true;
    });
    
    // If we have meaningful lines, use them; otherwise use original
    if (meaningfulLines.length > 0) {
        const filteredResult = meaningfulLines.join('\n');
        // Only use filtered result if it's substantial (not just removing small parts)
        if (filteredResult.length > cleanedText.length * 0.3) {
            cleanedText = filteredResult;
        }
    }
    
    console.log('🧹 Cleaned text:', cleanedText.substring(0, 50));
    return cleanedText.trim();
}

// Get selected text from input/textarea
function getInputSelection(element) {
    if (!element) return '';
    
    try {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    
        if (start !== undefined && end !== undefined && start !== end && start >= 0 && end >= 0) {
            const selectedText = element.value.substring(start, end);
            if (selectedText.trim().length > 0) {
                return selectedText;
            }
        }
    } catch (error) {
        // Fallback for contentEditable elements
        if (element.isContentEditable) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (element.contains(range.commonAncestorContainer)) {
                    return selection.toString();
                }
            }
        }
    }
    
    return '';
}

// Global variable to store last mouse position
let lastMousePosition = { x: 0, y: 0 };
let isIconPositioned = false;

// Track mouse position globally (only when needed)
function startMouseTracking() {
    if (!isIconPositioned) {
        document.addEventListener('mousemove', updateMousePosition, { passive: true });
    }
}

function stopMouseTracking() {
    document.removeEventListener('mousemove', updateMousePosition, { passive: true });
    isIconPositioned = true;
}

function updateMousePosition(e) {
    if (!isIconPositioned) {
        lastMousePosition = { x: e.clientX, y: e.clientY };
    }
}

// Start tracking initially
startMouseTracking();

// Calculate optimal icon position based on selection bounds
function calculateOptimalIconPosition(selectionRect, isInputSelection) {
    const iconSize = 28;
    const padding = 8;
    
    let x, y;
    
    if (isInputSelection) {
        // For input fields: position at right edge, centered vertically
        x = selectionRect.right + padding;
        y = selectionRect.top + (selectionRect.height / 2);
    } else {
        // For regular text: position exactly at center of selection, above it
        x = selectionRect.left + (selectionRect.width / 2);
        y = selectionRect.top - padding;
        
        // If not enough space above, position below the selection
        if (y < iconSize + padding) {
            y = selectionRect.bottom + padding;
        }
    }
    
    // Ensure icon stays within viewport bounds
    x = Math.max(iconSize/2 + padding, Math.min(window.innerWidth - iconSize/2 - padding, x));
    y = Math.max(iconSize/2 + padding, Math.min(window.innerHeight - iconSize/2 - padding, y));
    
    return { x, y };
}

// Show icon with smooth fade-in animation from 50px left
function showIconWithFadeIn(targetPosition, selectionRect) {
    // Don't show if popup is already open
    if (isPopupOpening || (popup && popup.style.opacity === '1')) {
        return;
    }
    
    // Don't show if icon is already positioned and visible
    if (isIconPositioned && selectionIcon && selectionIcon.style.opacity === '1') {
        return;
    }
    
    // Ensure icon exists
            if (!selectionIcon) {
                createIcon();
            }
            
    try {
        const iconSize = 28;
        
        // Calculate starting position (50px to the left of target)
        const startX = targetPosition.x - 50;
        // Center the icon on the target position
        const finalX = targetPosition.x - (iconSize / 2);
        const finalY = targetPosition.y - (iconSize / 2);
        
        // Set initial position (hidden, 50px to the left)
        selectionIcon.style.position = 'fixed';
        selectionIcon.style.left = startX + 'px';
        selectionIcon.style.top = finalY + 'px';
        selectionIcon.style.opacity = '0';
        selectionIcon.style.visibility = 'visible';
        selectionIcon.style.transform = 'scale(0.8) translateX(-10px)';
        selectionIcon.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        selectionIcon.style.zIndex = '2147483647';
        selectionIcon.style.pointerEvents = 'none';
        
        // Trigger the fade-in animation from left to right
        setTimeout(() => {
            if (selectionIcon) {
                selectionIcon.style.left = finalX + 'px';
                selectionIcon.style.opacity = '1';
                selectionIcon.style.transform = 'scale(1) translateX(0px)';
                selectionIcon.style.pointerEvents = 'auto';
                
                // Mark as positioned and stable
                isIconPositioned = true;
            }
        }, 50);
        
        // Store position for popup positioning
            lastIconPosition = {
            left: targetPosition.x,
            top: targetPosition.y,
            width: iconSize,
            height: iconSize
        };
        
        // Stop mouse tracking
        stopMouseTracking();
        
    } catch (error) {
        console.error('❌ Error showing icon with fade-in:', error);
        hideIcon();
    }
}

// Legacy function - now redirects to new system
function showIconAtMousePosition() {
    
    // Don't reposition icon if popup is opening or open
    if (isPopupOpening || (popup && popup.style.opacity === '1')) {
        return;
    }
    
    // Don't reposition if icon is already positioned and visible
    if (isIconPositioned && selectionIcon && selectionIcon.style.opacity === '1') {
        return;
    }
    
    // Ensure icon exists
    if (!selectionIcon) {
        createIcon();
    }
    
    try {
        // Use the exact mouse position from when selection was made
        let currentMouseX = lastMousePosition.x;
        let currentMouseY = lastMousePosition.y;
        
        // Calculate exact mouse position (center icon on cursor)
        let finalX = Math.max(5, Math.min(window.innerWidth - 35, currentMouseX - 14));
        let finalY = Math.max(5, Math.min(window.innerHeight - 35, currentMouseY - 14));
        
        // Calculate starting position (slightly left of mouse for animation)
        let startX = finalX - 50; // Start 50px to the left of mouse
        
        // Set initial position (hidden, at start point)
        selectionIcon.style.position = 'fixed';
        selectionIcon.style.left = startX + 'px';
        selectionIcon.style.top = finalY + 'px';
        selectionIcon.style.opacity = '0';
        selectionIcon.style.visibility = 'visible';
        selectionIcon.style.transform = 'scale(0.7) translateX(-20px)';
        selectionIcon.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        selectionIcon.style.zIndex = '2147483647';
        selectionIcon.style.pointerEvents = 'none';
        
        // Trigger the fade-in animation to exact mouse position
        setTimeout(() => {
            if (selectionIcon) {
                selectionIcon.style.left = finalX + 'px';
                selectionIcon.style.opacity = '1';
                selectionIcon.style.transform = 'scale(1) translateX(0px)';
                selectionIcon.style.pointerEvents = 'auto';
                
                // Mark as positioned and stable
                isIconPositioned = true;
            }
        }, 50);
        
        // Store position for popup (exact mouse position)
    lastIconPosition = {
            left: currentMouseX,
            top: currentMouseY,
            width: 28,
            height: 28
        };
        
        // Stop mouse tracking once icon is positioned
        stopMouseTracking();
        
    } catch (error) {
        console.error('❌ Error positioning icon at mouse:', error);
        hideIcon();
    }
}

// Legacy function - kept for compatibility but redirects to new function
function showIcon() {
    // This function is now deprecated - use showIconAtSelection instead
    // But we'll handle it for backward compatibility
    const activeElement = document.activeElement;
    
    if (isInputElement(activeElement)) {
        const selectedText = getInputSelection(activeElement);
        if (selectedText.trim() !== '') {
            currentSelectedText = selectedText.trim();
            showIconAtSelection(true, activeElement);
            return;
        }
    }
    
    // Check regular text selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const selectedText = filterSelectedText(selection);
        if (selectedText.trim() !== '') {
            currentSelectedText = selectedText.trim();
            showIconAtSelection(false);
            return;
        }
    }
    
    // No valid selection found
        hideIcon();
}

// Hide icon completely
function hideIcon() {
    if (selectionIcon && selectionIcon.parentNode) {
        selectionIcon.style.pointerEvents = 'none';
        selectionIcon.parentNode.removeChild(selectionIcon);
    }
    selectionIcon = null;
    isIconPositioned = false;
    startMouseTracking();
}

// Hide icon temporarily (keep position for restoration)
function temporaryHideIcon() {
    if (selectionIcon) {
        selectionIcon.style.opacity = '0';
        selectionIcon.style.visibility = 'hidden';
        selectionIcon.style.transform = 'scale(0.8)';
        // DON'T change position - keep it for restoration
    }
}

// Keep icon visible but faded when popup is open
function fadeIcon() {
    if (selectionIcon) {
        // Only change opacity and scale, NOT position
        selectionIcon.style.opacity = '0.3';
        selectionIcon.style.transform = 'scale(0.9)';
        // Ensure visibility is maintained
        selectionIcon.style.visibility = 'visible';
    }
}

// Restore icon to full visibility - DEPRECATED: now we always hide icon after popup
function restoreIcon() {
    console.log('🚫 restoreIcon called but we no longer restore icons after popup');
    // Always hide instead of restore
    hideIcon();
    currentSelectedText = '';
}

// Force icon to stay at current position (prevent position changes)
function maintainIconPosition() {
    if (selectionIcon && currentSelectedText) {
        console.log('🔧 Maintaining icon position - current:', selectionIcon.style.left, selectionIcon.style.top);
        
        // Get current position
        const currentLeft = selectionIcon.style.left;
        const currentTop = selectionIcon.style.top;
        
        // If position was moved to negative values, restore proper position
        if (currentLeft === '-100px' || currentTop === '-100px') {
            console.log('🔧 Icon was moved to corner - restoring position');
            
            // Re-show icon at correct position
            const activeElement = document.activeElement;
            if (isInputElement(activeElement) && getInputSelection(activeElement).trim()) {
                console.log('🔧 Restoring input icon position');
                showIconAtSelection(true, activeElement);
            } else {
                const selection = window.getSelection();
                if (selection.rangeCount > 0 && filterSelectedText(selection).trim()) {
                    console.log('🔧 Restoring text icon position');
                    showIconAtSelection(false);
                }
            }
        }
    }
}

// Override console.error to filter out external service errors
(function() {
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const errorString = args.join(' ');
        
        // Filter out Google One Tap and external service errors
        if (errorString.includes("Cannot read properties of undefined (reading '60')") ||
            errorString.includes('PUBLIC_GetOneTapSettings') ||
            errorString.includes('gsi') ||
            errorString.includes('accounts.google.com') ||
            errorString.includes('gstatic.com') ||
            errorString.includes('Uncaught (in promise)') && errorString.includes('code') && errorString.includes('-32603')) {
            // Don't log these external errors
            return;
        }
        
        // Log other errors normally
        originalConsoleError.apply(console, args);
    };
})();

// Suppress external website errors that are not related to our extension
window.addEventListener('error', function(event) {
    const errorMessage = event.message || '';
    const errorSource = event.filename || '';
    
    // Suppress Google One Tap and other external service errors
    if (errorMessage.includes("Cannot read properties of undefined (reading '60')") ||
        errorMessage.includes('PUBLIC_GetOneTapSettings') ||
        errorSource.includes('gsi') ||
        errorSource.includes('accounts.google.com') ||
        errorSource.includes('gstatic.com') ||
        errorSource.includes('inpage.js') ||
        errorMessage.includes("Cannot read properties of null (reading 'type')")) {
        // Prevent the error from appearing in console
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
});

// Also suppress unhandled promise rejections from external sources
window.addEventListener('unhandledrejection', function(event) {
    const errorMessage = event.reason?.message || event.reason || '';
    const errorStack = event.reason?.stack || '';
    
    // Suppress inpage.js and other external promise rejections
    if (errorStack.includes('inpage.js') ||
        errorMessage.includes("Cannot read properties of null (reading 'type')") ||
        errorStack.includes('gsi') ||
        errorStack.includes('accounts.google.com')) {
        // Prevent the error from appearing in console
        event.preventDefault();
        return false;
    }
});

// Suppress unhandled promise rejections from external services
window.addEventListener('unhandledrejection', function(event) {
    const errorMessage = event.reason?.message || '';
    const errorData = event.reason?.data || {};
    
    // Suppress Google One Tap and other external service promise rejections
    if (errorMessage.includes("Cannot read properties of undefined (reading '60')") ||
        errorData.method === 'PUBLIC_GetOneTapSettings' ||
        errorMessage.includes('gsi') ||
        errorMessage.includes('accounts.google.com')) {
        // Prevent the promise rejection from appearing in console
        event.preventDefault();
        return false;
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Add selection change listeners
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
    
    // Add input event listeners for input/textarea elements
    document.addEventListener('input', handleSelectionChange);
    document.addEventListener('focus', handleSelectionChange);
    document.addEventListener('select', (e) => {
        if (isInputElement(e.target)) {
            console.log('📝 Input select event');
            setTimeout(handleSelectionChange, 10);
        }
    });
    document.addEventListener('blur', () => {
        // When focus is lost, check if there's still selection
        setTimeout(handleSelectionChange, 50);
    });
    
    // Add click listener to hide icon when clicking elsewhere
    document.addEventListener('click', (e) => {
        // Isolate our extension logic from website scripts
        try {
            // Validate event and target safely
            if (!e || !e.target) return;
            // Safely get className as string
            const targetClassName = safeGetClassName(e.target);
            console.log('📋 First click listener - target:', e.target.tagName, targetClassName, 'ID:', e.target.id);
            
        // Don't hide if clicking on the icon or popup
        if (selectionIcon && (e.target === selectionIcon || selectionIcon.contains(e.target))) {
                console.log('📋 Click on icon - ignoring');
            return;
        }
        if (popup && (e.target === popup || popup.contains(e.target))) {
                console.log('📋 Click on popup - ignoring');
                return;
            }
        } catch (error) {
            // Silently handle any errors to prevent interference with page scripts
            console.warn('Extension click handler error (non-critical):', error);
            return;
        }
        
        // Don't check selection if clicking on popup elements
        if (popup && e.target.closest && e.target.closest('#selection-popup')) {
            console.log('📋 Click on popup element - ignoring selection check');
            return;
        }
        
        // Don't check selection if clicking on select elements
        if (e.target.tagName === 'OPTION' || e.target.tagName === 'SELECT') {
            console.log('📋 Click on select element - ignoring selection check');
            return;
        }
        
        console.log('📋 Checking selection after click');
        // Check if there's still selection after click
        setTimeout(handleSelectionChange, 50);
    }, true); // Use capture phase to handle before website scripts
});

// Also add listeners when DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupSelectionListeners();
    });
} else {
    setupSelectionListeners();
}

function setupSelectionListeners() {
    // Force create icon if not exists
    if (!selectionIcon) {
        createIcon();
    }
    
    // Selection event listeners are already added in DOMContentLoaded above
    
    // Add click listener to hide popup when clicking elsewhere  
    document.addEventListener('click', (e) => {
        // Isolate our extension logic from website scripts
        try {
            // Validate event and target safely
            if (!e || !e.target) return;
            // Safely get className as string
            const targetClassName = safeGetClassName(e.target);
            console.log('🖱️ Click detected on:', e.target.tagName, targetClassName, 'ID:', e.target.id);
            
            // Don't hide if clicking on the icon or popup
            if (selectionIcon && (e.target === selectionIcon || selectionIcon.contains(e.target))) {
                console.log('🖱️ Click on icon - ignoring');
                return;
            }
            if (popup && (e.target === popup || popup.contains(e.target))) {
                console.log('🖱️ Click on popup - ignoring');
                return;
            }
            
            // Don't hide if clicking on popup elements (including dropdowns)
            if (popup && e.target.closest && e.target.closest('#selection-popup')) {
                console.log('🖱️ Click on popup element - ignoring');
                return;
            }
            
            // Don't hide if clicking on select options or dropdown elements
            if (e.target.tagName === 'OPTION' || e.target.tagName === 'SELECT') {
                console.log('🖱️ Click on select element - ignoring');
                return;
            }
            
            // If popup is open, hide it when clicking elsewhere
            if (popup && popup.style.opacity === '1') {
                console.log('🖱️ Clicked outside popup - hiding popup');
                hidePopup();
                
                // Also clear selection and hide icon since user clicked away
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (selection) {
                        selection.removeAllRanges();
                    }
                    currentSelectedText = '';
                    if (selectionIcon) {
                        hideIcon();
                    }
                }, 100);
                return;
            }
            
            // Check if there's still selection after click (with delay to avoid conflict)
            setTimeout(() => {
                console.log('🖱️ Checking selection after outside click');
                handleSelectionChange();
            }, 150);
        } catch (error) {
            // Silently handle any errors to prevent interference with page scripts
            console.warn('Extension click handler error (non-critical):', error);
        }
    }, true); // Use capture phase to handle before website scripts
    
    // Handle window resize to reposition popup
    window.addEventListener('resize', function() {
        if (popup && popup.style.opacity === '1') {
            console.log('🔄 Resize detected - repositioning popup');
            positionPopupInViewport();
        }
    });
    
    // Handle scroll to keep popup visible and within viewport
    window.addEventListener('scroll', function() {
        if (popup && popup.style.opacity === '1') {
            console.log('📜 Scroll detected - repositioning popup to stay in viewport');
            positionPopupInViewport();
        }
          }, { passive: true });
    
    // Handle Escape key to close popup
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup && popup.style.opacity === '1') {
            console.log('⌨️ Escape key pressed - closing popup');
            hidePopup();
            
            // Also clear selection and hide icon
            setTimeout(() => {
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                }
                currentSelectedText = '';
                if (selectionIcon) {
                    hideIcon();
                }
            }, 100);
        }
    });
}



// Translation History Management
async function saveTranslationToHistory(sourceText, translatedText, sourceLang, targetLang) {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            return;
        }
        
        const historyItem = {
            id: Date.now(),
            sourceText: sourceText,
            translatedText: translatedText,
            sourceLang: sourceLang,
            targetLang: targetLang,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            title: document.title
        };
        
        // Get existing history
        const result = await chrome.storage.local.get(['translationHistory']);
        let history = result.translationHistory || [];
        
        // Add new item to beginning
        history.unshift(historyItem);
        
        // Keep only last 50 items
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        
        // Save back to storage
        await chrome.storage.local.set({ translationHistory: history });


    } catch (error) {
        if (handleExtensionContextError(error, 'saving translation to history')) {
            return;
        }
        console.error('Error saving translation to history:', error);
    }
}

async function getTranslationHistory() {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            return [];
        }
        
        const result = await chrome.storage.local.get(['translationHistory']);

        return result.translationHistory || [];
    } catch (error) {
        if (handleExtensionContextError(error, 'getting translation history')) {
            return [];
        }
        console.error('Error getting translation history:', error);
        return [];
    }
}

async function clearTranslationHistory() {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            return;
        }
        
        await chrome.storage.local.remove(['translationHistory']);

    } catch (error) {
        if (handleExtensionContextError(error, 'clearing translation history')) {
            return;
        }
        console.error('Error clearing translation history:', error);
    }
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

async function showHistoryDialog() {

    // Hide current popup first
    if (popup) {
        popup.style.display = 'none';
    }
    
    const history = await getTranslationHistory();

    
    // Create history dialog
    const historyDialog = document.createElement('div');
    historyDialog.id = 'translation-history-dialog';
    historyDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 500px;
        max-width: 90vw;
        max-height: 70vh;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: normal !important;
    `;
    
    const historyItems = history.length > 0 ? history.map(item => `
        <div class="history-item" style="padding: 10px; margin: 8px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa; position: relative; direction: ltr !important; text-align: left !important;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div style="flex: 1;">
                    <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px; display: flex; align-items: center; gap: 8px;">
                        <span>${formatDate(item.timestamp)}</span>
                        <a href="${item.url}" target="_blank" style="color: #3b82f6; text-decoration: none;" title="${item.title}">
                            ${item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title}
                        </a>
                    </div>
                    <div style="font-weight: 500; color: #374151; margin-bottom: 4px; font-size: 13px;">${item.sourceText}</div>
                    <div style="color: #1f2937; font-size: 13px; line-height: 1.3;">${item.translatedText}</div>
                </div>
                <button class="copy-history-btn" data-text="${item.translatedText.replace(/"/g, '&quot;')}" style="background: #f3f4f6; border: 1px solid #d1d5db; width: 24px; height: 24px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 8px; transition: all 0.2s ease;" title="Copy translation">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('') : `
        <div style="padding: 40px; text-align: center; color: #6b7280;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px;">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
                <path d="M12 7v5l4 2"></path>
            </svg>
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 4px;">No translations yet</div>
            <div style="font-size: 14px;">Your translation history will appear here</div>
        </div>
    `;
    
    historyDialog.innerHTML = `
        <!-- Header -->
        <div style="background: #f8f9fa; padding: 10px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; direction: ltr !important; text-align: left !important;">
            <div>
                <h2 style="margin: 0; font-size: 15px; font-weight: 600; color: #1f2937;">Translation History</h2>
                <p style="margin: 1px 0 0 0; font-size: 11px; color: #6b7280;">Last ${Math.min(history.length, 50)} translations</p>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                ${history.length > 0 ? `
                    <button id="clear-history-btn" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s ease;" title="Clear all history">
                        Clear All
                    </button>
                ` : ''}
                <button id="close-history-btn" style="background: transparent; color: #6b7280; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;" title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
        
        <!-- History List -->
        <div style="flex: 1; overflow-y: auto; max-height: 400px; direction: ltr !important; text-align: left !important;">
            ${historyItems}
        </div>
    `;
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
    `;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(historyDialog);
    
    // Event listeners
    const closeBtn = historyDialog.querySelector('#close-history-btn');
    const clearBtn = historyDialog.querySelector('#clear-history-btn');
    const copyBtns = historyDialog.querySelectorAll('.copy-history-btn');
    
    function closeDialog() {
        document.body.removeChild(backdrop);
        document.body.removeChild(historyDialog);
        // Show popup back if it exists
        if (popup) {
            popup.style.display = 'block';
        }
    }
    
    closeBtn.addEventListener('click', closeDialog);
    backdrop.addEventListener('click', closeDialog);
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all translation history?')) {
                await clearTranslationHistory();
                closeDialog();
            }
        });
    }
    
    copyBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const text = btn.getAttribute('data-text').replace(/&quot;/g, '"');
            try {
                await navigator.clipboard.writeText(text);
                // Visual feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                        <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                `;
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                }, 1500);
            } catch (error) {
                console.error('Failed to copy text:', error);
            }
        });
    });
    
    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
        .copy-history-btn:hover {
            background: #e5e7eb !important;
            border-color: #9ca3af !important;
            transform: scale(1.05) !important;
        }
        
        .history-item:hover {
            background: #f9fafb !important;
        }
        
        #clear-history-btn:hover {
            background: #dc2626 !important;
        }
        
        #close-history-btn:hover {
            background: #f3f4f6 !important;
            color: #374151 !important;
        }
    `;
    document.head.appendChild(style);
}

// Show donation dialog with crypto addresses
function showDonationDialog() {
    // Hide current popup first
    if (popup) {
        popup.style.display = 'none';
    }
    
    // Create donation dialog
    const donationDialog = document.createElement('div');
    donationDialog.id = 'donation-dialog';
    donationDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 480px;
        max-width: 90vw;
        background: white;
        border-radius: 12px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.25);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: normal !important;
    `;
    
    donationDialog.innerHTML = `
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">Support Development</h2>
            </div>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Your support helps improve this extension for everyone</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 18px;">

            
            <!-- Crypto Addresses -->
                            <div style="background: #f8fafc; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                    <div style="display: grid; gap: 12px;">
                                                 <div class="main-crypto-item" data-address="TEZrH7kkbGoSvsUUxh4ossyCUbW4WMdXzM" data-name="USDT (TRC20)" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                             <div style="flex: 1;">
                                 <div style="font-weight: 600; color: #1e293b; font-size: 12px; margin-bottom: 2px;">USDT (TRC20)</div>
                                 <div style="font-family: monospace; color: #64748b; font-size: 10px; word-break: break-all;">TEZrH7kkbGoSvsUUxh4ossyCUbW4WMdXzM</div>
                             </div>
                             <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                     <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                     <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                 </svg>
                                 <div class="main-qr-btn" data-address="TEZrH7kkbGoSvsUUxh4ossyCUbW4WMdXzM" data-name="USDT (TRC20)" style="cursor: pointer; padding: 4px; border-radius: 3px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                         <rect x="3" y="3" width="5" height="5"></rect>
                                         <rect x="16" y="3" width="5" height="5"></rect>
                                         <rect x="3" y="16" width="5" height="5"></rect>
                                         <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                                         <path d="M21 21v.01"></path>
                                         <path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                                         <path d="M3 12h.01"></path>
                                         <path d="M12 3h.01"></path>
                                         <path d="M12 16v.01"></path>
                                         <path d="M16 12h1"></path>
                                         <path d="M21 12v.01"></path>
                                         <path d="M12 21v-1"></path>
                                     </svg>
                                 </div>
                             </div>
                         </div>
                        
                                                 <div class="main-crypto-item" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="USDT (ERC20)" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                             <div style="flex: 1;">
                                 <div style="font-weight: 600; color: #1e293b; font-size: 12px; margin-bottom: 2px;">USDT (ERC20)</div>
                                 <div style="font-family: monospace; color: #64748b; font-size: 10px; word-break: break-all;">0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7</div>
                             </div>
                             <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                     <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                     <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                 </svg>
                                 <div class="main-qr-btn" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="USDT (ERC20)" style="cursor: pointer; padding: 4px; border-radius: 3px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                         <rect x="3" y="3" width="5" height="5"></rect>
                                         <rect x="16" y="3" width="5" height="5"></rect>
                                         <rect x="3" y="16" width="5" height="5"></rect>
                                         <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                                         <path d="M21 21v.01"></path>
                                         <path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                                         <path d="M3 12h.01"></path>
                                         <path d="M12 3h.01"></path>
                                         <path d="M12 16v.01"></path>
                                         <path d="M16 12h1"></path>
                                         <path d="M21 12v.01"></path>
                                         <path d="M12 21v-1"></path>
                                     </svg>
                                 </div>
                             </div>
                         </div>
                         
                         <div class="main-crypto-item" data-address="bc1q2sfafhrpytkc7y79z60yx8m6t58duk4e9kghm3" data-name="Bitcoin (BTC)" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                             <div style="flex: 1;">
                                 <div style="font-weight: 600; color: #1e293b; font-size: 12px; margin-bottom: 2px;">Bitcoin (BTC)</div>
                                 <div style="font-family: monospace; color: #64748b; font-size: 10px; word-break: break-all;">bc1q2sfafhrpytkc7y79z60yx8m6t58duk4e9kghm3</div>
                             </div>
                             <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                     <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                     <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                 </svg>
                                 <div class="main-qr-btn" data-address="bc1q2sfafhrpytkc7y79z60yx8m6t58duk4e9kghm3" data-name="Bitcoin (BTC)" style="cursor: pointer; padding: 4px; border-radius: 3px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                         <rect x="3" y="3" width="5" height="5"></rect>
                                         <rect x="16" y="3" width="5" height="5"></rect>
                                         <rect x="3" y="16" width="5" height="5"></rect>
                                         <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                                         <path d="M21 21v.01"></path>
                                         <path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                                         <path d="M3 12h.01"></path>
                                         <path d="M12 3h.01"></path>
                                         <path d="M12 16v.01"></path>
                                         <path d="M16 12h1"></path>
                                         <path d="M21 12v.01"></path>
                                         <path d="M12 21v-1"></path>
                                     </svg>
                                 </div>
                             </div>
                         </div>
                         
                         <div class="main-crypto-item" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="Ethereum (ETH)" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                             <div style="flex: 1;">
                                 <div style="font-weight: 600; color: #1e293b; font-size: 12px; margin-bottom: 2px;">Ethereum (ETH)</div>
                                 <div style="font-family: monospace; color: #64748b; font-size: 10px; word-break: break-all;">0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7</div>
                             </div>
                             <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                     <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                     <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path>
                                 </svg>
                                 <div class="main-qr-btn" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="Ethereum (ETH)" style="cursor: pointer; padding: 4px; border-radius: 3px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                         <rect x="3" y="3" width="5" height="5"></rect>
                                         <rect x="16" y="3" width="5" height="5"></rect>
                                         <rect x="3" y="16" width="5" height="5"></rect>
                                         <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                                         <path d="M21 21v.01"></path>
                                         <path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                                         <path d="M3 12h.01"></path>
                                         <path d="M12 3h.01"></path>
                                         <path d="M12 16v.01"></path>
                                         <path d="M16 12h1"></path>
                                         <path d="M21 12v.01"></path>
                                         <path d="M12 21v-1"></path>
                                     </svg>
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>
            
            <!-- Footer -->
            <div style="text-align: center;">
                <p style="margin: 0 0 16px; color: #64748b; font-size: 12px;">
                    Click any address to copy • Every donation helps improve the extension
                </p>
                <button id="close-donation-btn" style="background: #6366f1; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">
                    Close
                </button>
            </div>
        </div>
    `;
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
    `;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(donationDialog);
    
    // Setup event handlers for the new dialog
    setupMainDonationHandlers();
    
    // Close function
    function closeDonationDialog() {
        document.body.removeChild(backdrop);
        document.body.removeChild(donationDialog);
        // Show popup back if it exists
        if (popup) {
            popup.style.display = 'block';
        }
    }
    
    // Event listeners
    const closeBtn = donationDialog.querySelector('#close-donation-btn');
    closeBtn.addEventListener('click', closeDonationDialog);
    backdrop.addEventListener('click', closeDonationDialog);
    
    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
        .crypto-address:hover {
            border-color: #6366f1 !important;
            background: #f8faff !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
        }
        
        #close-donation-btn:hover {
            background: #5b5fcf !important;
        }
    `;
    document.head.appendChild(style);
}

// Show QR code for main popup 
function showMainQRCode(address, name) {
    // Create QR dialog
    const qrDialog = document.createElement('div');
    qrDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        z-index: 10002;
        text-align: center;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        direction: ltr !important;
        text-align: center !important;
        unicode-bidi: normal !important;
    `;
    
    qrDialog.innerHTML = `
        <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 16px;">${name}</h3>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(address)}" 
             style="width: 180px; height: 180px; border: 1px solid #e2e8f0; border-radius: 8px;" alt="QR Code" />
        <p style="margin: 12px 0 6px; font-size: 11px; color: #64748b; word-break: break-all; font-family: monospace;">${address}</p>
        <button id="close-main-qr-btn" style="background: #dc3545; color: white; border: none; padding: 6px 14px; border-radius: 5px; cursor: pointer; font-size: 11px; margin-top: 6px;">Close</button>
    `;
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'main-qr-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        z-index: 10001;
    `;
    
    const closeQR = () => {
        try {
            if (backdrop.parentNode) document.body.removeChild(backdrop);
            if (qrDialog.parentNode) document.body.removeChild(qrDialog);
        } catch (e) {
            console.log('QR dialog cleanup error:', e);
        }
    };
    
    backdrop.onclick = closeQR;
    qrDialog.querySelector('#close-main-qr-btn').onclick = closeQR;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(qrDialog);
}

// Setup main donation functionality  
function setupMainDonationHandlers() {
    const mainCryptoItems = document.querySelectorAll('.main-crypto-item');
    mainCryptoItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Prevent QR button from triggering copy
            if (e.target.closest('.main-qr-btn')) return;
            
            const address = this.getAttribute('data-address');
            const name = this.getAttribute('data-name');
            
            // Copy to clipboard
            navigator.clipboard.writeText(address).then(() => {
                // Visual feedback
                const originalBg = this.style.background;
                this.style.background = '#dcfce7';
                this.style.borderColor = '#16a34a';
                
                // Show "Copied!" message
                const feedbackDiv = document.createElement('div');
                feedbackDiv.textContent = '✅ Copied!';
                feedbackDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #16a34a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; z-index: 1000; pointer-events: none;';
                
                this.style.position = 'relative';
                this.appendChild(feedbackDiv);
                
                setTimeout(() => {
                    this.style.background = originalBg;
                    this.style.borderColor = '';
                    if (feedbackDiv.parentNode) {
                        feedbackDiv.parentNode.removeChild(feedbackDiv);
                    }
                }, 2000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = address;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            });
        });
        
        // Add hover effect
        item.addEventListener('mouseenter', function() {
            this.style.background = '#e0f2fe';
            this.style.borderColor = '#0891b2';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.background = 'white';
            this.style.borderColor = '#e2e8f0';
        });
    });
    
    // Setup QR button handlers
    const mainQrBtns = document.querySelectorAll('.main-qr-btn');
    mainQrBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent copy from triggering
            const address = this.getAttribute('data-address');
            const name = this.getAttribute('data-name');
            showMainQRCode(address, name);
        });
        
        // Add hover effect
        btn.addEventListener('mouseenter', function() {
            this.style.background = '#2563eb';
            this.style.transform = 'scale(1.05)';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.background = '#3b82f6';
            this.style.transform = 'scale(1)';
        });
    });
}



// Listen for messages from popup and options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated') {
        // Force reload settings if requested
        if (message.forceReload) {
        
            currentSettings = null; // Clear cached settings
        }
        
        // Store the new settings globally for immediate use
        currentSettings = message.settings;
        

        
        // Only refresh popup if not from a language change
        if (popup && popup.style.opacity === '1' && !isLanguageChanging) {
            console.log('🔄 Settings updated - refreshing popup');
            // Hide current popup first
            hidePopup();
            // Wait a moment then show with new settings
            setTimeout(() => {
            showPopup();
            }, 100);
        } else if (isLanguageChanging) {
            console.log('🎯 Language change in progress - skipping popup refresh');
        }
        
        sendResponse({success: true, message: 'Settings updated and extension refreshed successfully'});
    } else if (message.action === 'extensionSuspending') {
        // Extension is being suspended, clean up immediately
        console.info('Extension suspending, cleaning up...');
        cleanupOnContextInvalidation();
        sendResponse({success: true});
    } else if (message.action === 'showHistory') {
        showHistoryDialog();
        sendResponse({success: true});
    } else if (message.action === 'testExtension') {
        // Test the extension by showing a test popup
        if (!selectionIcon) {
            createIcon();
        }
        if (!popup) {
            createPopup();
        }
        
        // Simulate a text selection for testing
        currentSelectedText = 'Test text for translation';
        showPopup();
        
        // Add some test history data
        saveTranslationToHistory('Hello world', 'سلام دنیا', 'en', 'fa');
        
        sendResponse({success: true, message: 'Extension is working correctly!'});
    }
    
    return true;
});

// Note: onSuspend is not available in content scripts, only in background scripts
// We rely on periodic checks and error handling for context invalidation detection

// Initialize extension
async function initializeExtension() {
    try {
        // Check if extension context is valid before initializing
        if (!isExtensionContextValid()) {
            console.warn('Extension context invalid during initialization');
            return;
        }
        
        // Clean any legacy Finglish settings first
        await cleanLegacyFinglishSettings();
        
        // Load settings first with timeout and fallback
        try {
            currentSettings = await Promise.race([
                getExtensionSettings(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Settings load timeout')), 2000))
            ]);
            console.log('✅ Settings loaded successfully');
        } catch (settingsError) {
            console.warn('⚠️ Settings load failed, using defaults:', settingsError.message);
            currentSettings = getDefaultSettings();
        }
        
        // Pre-warm Google Translate API to avoid first-use delays
        try {
            console.log('🔥 Pre-warming Google Translate API...');
            await translateWithGoogle('test', 'en', 'fa', currentSettings);
            console.log('✅ Google Translate API pre-warmed');
        } catch (preWarmError) {
            console.warn('⚠️ Pre-warming failed (not critical):', preWarmError.message);
        }
        
    createIcon();
    createPopup();
    setupSelectionListeners();
        
        // Start periodic context validation
        startContextValidation();
    
    // Monitor DOM changes for sites that dynamically modify content
    const observer = new MutationObserver((mutations) => {
        try {
        let iconRemoved = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                    if (node === selectionIcon) {
                        iconRemoved = true;
                    }
                });
            }
        });
        
            if (iconRemoved && !isContextInvalidated) {
            createIcon();
            }
        } catch (error) {
            // Silently handle mutation observer errors to prevent interference
            console.warn('Extension mutation observer error (non-critical):', error);
        }
    });
    
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });
        
    
    } catch (error) {
        if (handleExtensionContextError(error, 'initializing extension')) {
            return;
        }
        console.error('Error initializing extension:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeExtension());
} else {
    initializeExtension();
}

// Also try to initialize after a delay for problematic sites
setTimeout(() => {
    if (!selectionIcon || !document.contains(selectionIcon)) {
        initializeExtension();
    }
}, 1000);

// Force initialization on window load for maximum compatibility
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!selectionIcon || !document.contains(selectionIcon)) {
            initializeExtension();
        }
    }, 500);
}); 

// Separate content text from UI button text
function separateContentFromUI(text) {
    if (!text || text.length < 10) return text;
    
    // Common UI button patterns that often get selected with content
    const uiPatterns = [
        /\b(Select\s+models?|Choose\s+models?|Add\s+models?)\b/gi,
        /\b(Select\s+items?|Choose\s+items?|Add\s+items?)\b/gi,
        /\b(Select\s+all|Choose\s+all|Add\s+all)\b/gi,
        /\b(Select\s+files?|Browse\s+files?|Upload\s+files?)\b/gi,
        /\b(View\s+more|Show\s+more|Load\s+more|See\s+more)\b/gi,
        /\b(Click\s+here|Learn\s+more|Read\s+more|Get\s+started)\b/gi,
        /\b(Sign\s+up|Log\s+in|Sign\s+in|Register)\b/gi,
        /\b(Download|Install|Update|Upgrade)\b/gi,
    ];
    
    // Try to identify and separate meaningful content from UI elements
    let cleanedText = text;
    
    // If text contains both content and UI elements, try to extract just the content
    uiPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            // Split by the UI pattern and keep the longest meaningful part
            const parts = text.split(pattern);
            const meaningfulParts = parts.filter(part => {
                const trimmed = part.trim();
                return trimmed.length > 5 && 
                       !(/^[^\w]*$/.test(trimmed)) && // Not just punctuation
                       !(trimmed.match(/^\s*(Select|Choose|Click|Add|Remove|View|Show|Load)\s/i)); // Not starting with UI verbs
            });
            
            if (meaningfulParts.length > 0) {
                // Use the longest meaningful part
                const longestPart = meaningfulParts.reduce((a, b) => a.length > b.length ? a : b);
                if (longestPart.trim().length >= 10) {
                    cleanedText = longestPart.trim();
                }
            }
        }
    });
    
    return cleanedText;
}

// Check for pending options page request after page load
function checkPendingOptionsRequest() {
    try {
        const shouldOpenOptions = localStorage.getItem('888-ai-open-options');
        const timestamp = localStorage.getItem('888-ai-options-timestamp');
        
        if (shouldOpenOptions === 'true') {
            // Check if request is recent (within last 30 seconds)
            const requestTime = parseInt(timestamp);
            const now = Date.now();
            
            if (now - requestTime < 30000) {
                console.log('🔧 Found pending options request, attempting to open...');
                
                // Clear the flag
                localStorage.removeItem('888-ai-open-options');
                localStorage.removeItem('888-ai-options-timestamp');
                
                // Try to open options
                setTimeout(async () => {
                    try {
                        if (chrome.runtime && chrome.runtime.openOptionsPage) {
                            await chrome.runtime.openOptionsPage();
                            console.log('✅ Options opened from pending request');
                        } else {
                            // Fallback: try window.open
                            const extensionId = chrome.runtime.id;
                            const optionsUrl = `chrome-extension://${extensionId}/options.html`;
                            window.open(optionsUrl, '_blank');
                            console.log('✅ Options opened via fallback from pending request');
                        }
                    } catch (error) {
                        console.log('❌ Failed to open options from pending request:', error);
                    }
                }, 1000);
            } else {
                // Request is too old, clean up
                localStorage.removeItem('888-ai-open-options');
                localStorage.removeItem('888-ai-options-timestamp');
            }
        }
    } catch (error) {
        console.log('❌ Error checking pending options request:', error);
    }
}

// Check for pending options request on load
document.addEventListener('DOMContentLoaded', checkPendingOptionsRequest);
if (document.readyState !== 'loading') {
    checkPendingOptionsRequest();
}

// --- Step 3: Remove duplicate/unnecessary event listeners ---

// Remove all duplicate event listeners and only add them once in DOMContentLoaded
function setupGlobalEventListeners() {
    document.removeEventListener('selectionchange', handleSelectionChange);
    document.removeEventListener('mouseup', handleSelectionChange);
    document.removeEventListener('keyup', handleSelectionChange);
    document.removeEventListener('input', handleSelectionChange);
    document.removeEventListener('focus', handleSelectionChange);
    document.removeEventListener('select', handleSelectionChange);
    document.removeEventListener('blur', handleSelectionChange);

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
    document.addEventListener('input', handleSelectionChange);
    document.addEventListener('focus', handleSelectionChange);
    document.addEventListener('select', (e) => {
        if (isInputElement(e.target)) {
            setTimeout(handleSelectionChange, 10);
        }
    });
    document.addEventListener('blur', () => {
        setTimeout(handleSelectionChange, 50);
    });

    // Add viewport and zoom change detection
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('orientationchange', handleViewportChange);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Detect zoom via Ctrl+Wheel (immediate detection)
    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            console.log('⚡ Ctrl+Wheel zoom detected - immediate closure');
            setTimeout(handleViewportChange, 50); // Small delay to let zoom take effect
        }
    }, { passive: true });
    
    // Detect zoom via keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
            console.log('⚡ Keyboard zoom detected - immediate closure');
            setTimeout(handleViewportChange, 50);
        }
    });

    // Detect zoom changes via matchMedia
    setupZoomDetection();
}

// Handle viewport/zoom changes
function handleViewportChange() {
    console.log('🔄 Viewport/zoom change detected');
    
    // Force close everything immediately
    if (popup) {
        // Store reference before hidePopup() sets it to null
        const popupElement = popup;
        hidePopup();
        
        // Apply additional styles to ensure it's hidden
        if (popupElement && popupElement.parentNode) {
            popupElement.style.display = 'none';
            popupElement.style.opacity = '0';
            popupElement.style.pointerEvents = 'none';
        }
    }
    
    if (selectionIcon) {
        // Store reference before hideIcon() potentially sets it to null
        const iconElement = selectionIcon;
        hideIcon();
        
        // Apply additional styles to ensure it's hidden
        if (iconElement && iconElement.parentNode) {
            iconElement.style.display = 'none';
            iconElement.style.opacity = '0';
            iconElement.style.pointerEvents = 'none';
        }
    }
    
    // Clear all state variables
    currentSelectedText = '';
    translatedText = '';
    detectedLanguage = '';
    lastDetectedLanguage = '';
    isTranslating = false;
    isPopupOpening = false;
    isLanguageChanging = false;
    isPopupActivelyUsed = false;
    lastMousePosition = { x: 0, y: 0 };
    isIconPositioned = false;
    
    // Clear any existing text selection
    try {
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
        if (document.selection) {
            document.selection.empty();
        }
    } catch (error) {
        console.log('Could not clear selection:', error);
    }
    
    console.log('🧹 Cleared all extension state after viewport change');
    
    // Reinitialize elements after a delay
    setTimeout(() => {
        if (!selectionIcon) {
            createIcon();
        }
        if (!popup) {
            createPopup();
        }
        console.log('🔄 Extension reinitialized after viewport change');
    }, 200);
}

// Handle visibility changes (tab switching, minimizing, etc.)
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('🙈 Page hidden - hiding popup/icon');
        hidePopup();
        hideIcon();
    } else {
        console.log('👁️ Page visible - checking selection');
        setTimeout(checkAndShowSelection, 200);
    }
}

// Detect zoom changes using matchMedia
function setupZoomDetection() {
    // Track zoom level changes
    let currentZoom = window.devicePixelRatio;
    
    const checkZoomChange = () => {
        const newZoom = window.devicePixelRatio;
        if (Math.abs(currentZoom - newZoom) > 0.05) {
            console.log('🔍 Zoom change detected:', currentZoom, '->', newZoom);
            currentZoom = newZoom;
            
            // Immediately force close everything on zoom
            console.log('⚡ Forcing immediate closure due to zoom change');
            handleViewportChange();
        }
    };
    
    // Check zoom periodically (every 500ms when active)
    let zoomCheckInterval;
    
    const startZoomCheck = () => {
        if (zoomCheckInterval) clearInterval(zoomCheckInterval);
        zoomCheckInterval = setInterval(checkZoomChange, 500);
    };
    
    const stopZoomCheck = () => {
        if (zoomCheckInterval) {
            clearInterval(zoomCheckInterval);
            zoomCheckInterval = null;
        }
    };
    
    // Start checking when page is visible
    if (!document.hidden) {
        startZoomCheck();
    }
    
    // Start/stop zoom checking based on visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopZoomCheck();
        } else {
            setTimeout(startZoomCheck, 100);
        }
    });
    
    // Also check zoom on focus/blur
    window.addEventListener('focus', () => {
        setTimeout(checkZoomChange, 100);
        startZoomCheck();
    });
    
    window.addEventListener('blur', () => {
        stopZoomCheck();
    });
    
    // Detect developer console opening/closing
    let lastInnerHeight = window.innerHeight;
    let lastInnerWidth = window.innerWidth;
    
    const checkConsoleChange = () => {
        const currentHeight = window.innerHeight;
        const currentWidth = window.innerWidth;
        
        // Detect significant height changes that might indicate console opening/closing
        if (Math.abs(lastInnerHeight - currentHeight) > 100 || 
            Math.abs(lastInnerWidth - currentWidth) > 100) {
            console.log('📏 Window dimensions changed significantly:', 
                       `${lastInnerWidth}x${lastInnerHeight}`, '->', 
                       `${currentWidth}x${currentHeight}`);
            lastInnerHeight = currentHeight;
            lastInnerWidth = currentWidth;
            handleViewportChange();
        }
    };
    
    // Check for console changes every 1 second when tab is active
    let consoleCheckInterval;
    
    const startConsoleCheck = () => {
        if (consoleCheckInterval) clearInterval(consoleCheckInterval);
        consoleCheckInterval = setInterval(checkConsoleChange, 1000);
    };
    
    const stopConsoleCheck = () => {
        if (consoleCheckInterval) {
            clearInterval(consoleCheckInterval);
            consoleCheckInterval = null;
        }
    };
    
    // Start checking when page is visible
    if (!document.hidden) {
        startConsoleCheck();
    }
    
    // Start/stop console checking based on visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopConsoleCheck();
        } else {
            setTimeout(() => {
                lastInnerHeight = window.innerHeight;
                lastInnerWidth = window.innerWidth;
                startConsoleCheck();
            }, 100);
        }
    });
}

document.addEventListener('DOMContentLoaded', setupGlobalEventListeners);
if (document.readyState !== 'loading') {
    setupGlobalEventListeners();
}

// --- Step 7: Robust popup drag ---
// In setupPopupDrag, ensure:
// Only allow drag if mousedown is on header and not on SELECT, OPTION, or BUTTON
// (Already implemented in setupPopupDrag, but double-check for robustness)

// --- Step 8: Robust options opening ---
// Already implemented: checkPendingOptionsRequest is called on DOMContentLoaded and after reload.
// No further action needed unless you want to add more fallback methods.

// Get comprehensive selection information for input elements
function getInputSelectionInfo(element) {
    try {
        const rect = element.getBoundingClientRect();
        const start = element.selectionStart;
        const end = element.selectionEnd;
        
        if (start !== undefined && end !== undefined && start !== end) {
            return {
                isValid: true,
                type: 'input',
                bounds: rect,
                textStart: start,
                textEnd: end,
                element: element,
                // For input elements, use the center of the element
                visualCenter: {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                }
            };
        }
    } catch (error) {
        console.error('Error getting input selection info:', error);
    }
    
    return { isValid: false };
}

// Get comprehensive selection information for regular text
function getTextSelectionInfo(selection) {
    try {
        if (!selection || selection.rangeCount === 0) {
            return { isValid: false };
        }
        
        const range = selection.getRangeAt(0);
        
        // Try multiple methods to get accurate bounds
        let bounds = null;
        let visualCenter = null;
        
        // Method 1: Try to get bounds from range
        try {
            bounds = range.getBoundingClientRect();
            if (bounds.width > 0 && bounds.height > 0) {
                visualCenter = {
                    x: bounds.left + bounds.width / 2,
                    y: bounds.top + bounds.height / 2
                };
            }
        } catch (e) {}
        
        // Method 2: If range bounds are invalid, try from start/end containers
        if (!bounds || bounds.width === 0 || bounds.height === 0) {
            try {
                const startRect = getNodeVisualBounds(range.startContainer, range.startOffset);
                const endRect = getNodeVisualBounds(range.endContainer, range.endOffset);
                
                if (startRect && endRect) {
                    bounds = {
                        left: Math.min(startRect.left, endRect.left),
                        top: Math.min(startRect.top, endRect.top),
                        right: Math.max(startRect.right, endRect.right),
                        bottom: Math.max(startRect.bottom, endRect.bottom),
                        width: Math.abs(endRect.right - startRect.left),
                        height: Math.abs(endRect.bottom - startRect.top)
                    };
                    
                    visualCenter = {
                        x: bounds.left + bounds.width / 2,
                        y: bounds.top + bounds.height / 2
                    };
                }
            } catch (e) {}
        }
        
        // Method 3: Fallback to first text node position
        if (!bounds || bounds.width === 0) {
            try {
                const walker = document.createTreeWalker(
                    range.commonAncestorContainer,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let firstTextNode = null;
                while (walker.nextNode()) {
                    if (range.intersectsNode(walker.currentNode)) {
                        firstTextNode = walker.currentNode;
                        break;
                    }
                }
                
                if (firstTextNode && firstTextNode.parentElement) {
                    bounds = firstTextNode.parentElement.getBoundingClientRect();
                    visualCenter = {
                        x: bounds.left + bounds.width / 2,
                        y: bounds.top + bounds.height / 2
                    };
                }
            } catch (e) {}
        }
        
        if (bounds && visualCenter) {
            return {
                isValid: true,
                type: 'text',
                bounds: bounds,
                range: range,
                visualCenter: visualCenter,
                selection: selection
            };
        }
    } catch (error) {
        console.error('Error getting text selection info:', error);
    }
    
    return { isValid: false };
}

// Get visual bounds for a text node at a specific offset
function getNodeVisualBounds(node, offset) {
    try {
        if (node.nodeType === Node.TEXT_NODE) {
            const range = document.createRange();
            range.setStart(node, Math.max(0, offset - 1));
            range.setEnd(node, Math.min(node.textContent.length, offset + 1));
            return range.getBoundingClientRect();
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            return node.getBoundingClientRect();
        }
    } catch (e) {}
    return null;
}

// Calculate universal icon position that works for all selection types
function calculateUniversalIconPosition(selectionInfo, isInputSelection) {
    const iconSize = 28;
    const padding = 12;
    
    let x, y;
    const bounds = selectionInfo.bounds;
    const center = selectionInfo.visualCenter;
    
    if (isInputSelection) {
        // For input fields: position to the right of the element
        x = bounds.right + padding;
        y = center.y;
    } else {
        // For regular text: position above the center of selection
        x = center.x;
        y = bounds.top - iconSize - padding;
        
        // If not enough space above, position below
        if (y < iconSize + padding) {
            y = bounds.bottom + padding;
        }
        
        // For very wide selections, limit horizontal position to reasonable bounds
        const maxX = bounds.left + Math.min(bounds.width, 400);
        const minX = bounds.left + 50;
        x = Math.max(minX, Math.min(maxX, x));
    }
    
    // Ensure icon stays within viewport bounds
    const viewportPadding = 20;
    x = Math.max(viewportPadding, Math.min(window.innerWidth - iconSize - viewportPadding, x));
    y = Math.max(viewportPadding, Math.min(window.innerHeight - iconSize - viewportPadding, y));
    
    return { x, y };
}

// Universal icon display with fade-in animation
function showUniversalIconWithFadeIn(targetPosition) {
    // Don't show if popup is already open
    if (isPopupOpening || (popup && popup.style.opacity === '1')) {
        return;
    }
    
    // Don't show if icon is already positioned and visible
    if (isIconPositioned && selectionIcon && selectionIcon.style.opacity === '1') {
        return;
    }
    
    // Ensure icon exists
    if (!selectionIcon) {
        createIcon();
    }
    
    try {
        const iconSize = 28;
        
        // Calculate starting position (50px to the left of target)
        const startX = targetPosition.x - 50;
        // Center the icon on the target position
        const finalX = targetPosition.x - (iconSize / 2);
        const finalY = targetPosition.y - (iconSize / 2);
        
        // Set initial position (hidden, 50px to the left)
        selectionIcon.style.position = 'fixed';
        selectionIcon.style.left = startX + 'px';
        selectionIcon.style.top = finalY + 'px';
        selectionIcon.style.opacity = '0';
        selectionIcon.style.visibility = 'visible';
        selectionIcon.style.transform = 'scale(0.8) translateX(-10px)';
        selectionIcon.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        selectionIcon.style.zIndex = '2147483647';
        selectionIcon.style.pointerEvents = 'none';
        
        // Trigger the fade-in animation from left to right
        setTimeout(() => {
            if (selectionIcon) {
                selectionIcon.style.left = finalX + 'px';
                selectionIcon.style.opacity = '1';
                selectionIcon.style.transform = 'scale(1) translateX(0px)';
                selectionIcon.style.pointerEvents = 'auto';
                
                // Mark as positioned and stable
                isIconPositioned = true;
            }
        }, 50);
        
        // Store position for popup positioning
        lastIconPosition = {
            left: targetPosition.x,
            top: targetPosition.y,
            width: iconSize,
            height: iconSize
        };
        
        // Stop mouse tracking
        stopMouseTracking();
        
    } catch (error) {
        console.error('❌ Error showing icon with fade-in:', error);
        hideIcon();
    }
}

// SIMPLE MOUSE-BASED ICON SYSTEM
// Icon appears exactly where the mouse cursor is during selection

// Global mouse position tracking
let currentMousePosition = { x: 0, y: 0 };
let isTrackingMouse = true;

// Track mouse position continuously
function trackMousePosition(e) {
    if (isTrackingMouse) {
        currentMousePosition = { x: e.clientX, y: e.clientY };
    }
}

// Start mouse tracking immediately
document.addEventListener('mousemove', trackMousePosition, { passive: true });
document.addEventListener('mousedown', trackMousePosition, { passive: true });
document.addEventListener('mouseup', trackMousePosition, { passive: true });

function checkAndShowSelection() {
    let hasSelection = false;
    let selectedText = '';
    let isInputSelection = false;
    let targetElement = null;
        
    // Check for any type of text selection
    
    // Check input/textarea first
    const activeElement = document.activeElement;
    if (isInputElement(activeElement)) {
        selectedText = getInputSelection(activeElement);
        if (selectedText.trim().length > 1) {
            hasSelection = true;
            isInputSelection = true;
            targetElement = activeElement;
            
            selectedFromElement = activeElement;
            originalSelectionStart = activeElement.selectionStart;
            originalSelectionEnd = activeElement.selectionEnd;
            currentSelectedText = selectedText.trim();
            
            // Store additional backup info for moving elements
            backupSelectedText = selectedText.trim();
            backupElementInfo = {
                tagName: activeElement.tagName,
                id: activeElement.id,
                className: safeGetClassName(activeElement),
                placeholder: activeElement.placeholder || ''
            };
        }
    }
        
    // Check regular text selection if no input selection
    if (!hasSelection) {
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0 && selection.toString().trim().length > 1) {
            // First check raw selection
            const rawText = selection.toString().trim();
            
            // Then apply filter
            selectedText = filterSelectedText(selection);
            
            if (selectedText.trim().length > 1) {
                hasSelection = true;
                isInputSelection = false;
                currentSelectedText = selectedText.trim();
                
                // Clear input info
                selectedFromElement = null;
                originalSelectionStart = null;
                originalSelectionEnd = null;
                
                // Store backup for regular text selections
                backupSelectedText = selectedText.trim();
                backupElementInfo = null;
            } else {
                // If filter rejected it but we have raw text, maybe allow it
                const basicCleanedText = rawText
                    .replace(/\n\s*888\s*\n/g, '\n')
                    .replace(/\n\s*Select models?\s*\n/gi, '\n')
                    .replace(/^\s*888\s*\n/g, '')
                    .replace(/\n\s*888\s*$/g, '')
                    .replace(/^\s*Select models?\s*\n/gi, '')
                    .replace(/\n\s*Select models?\s*$/gi, '')
                    .replace(/\n\s*\n/g, '\n')
                    .trim();
                
                if (basicCleanedText.length >= 10 && !basicCleanedText.match(/^(click|submit|cancel|ok|yes|no|888|select models?)$/i)) {
                    hasSelection = true;
                    isInputSelection = false;
                    currentSelectedText = basicCleanedText;
                    
                    // Clear input info
                    selectedFromElement = null;
                    originalSelectionStart = null;
                    originalSelectionEnd = null;
                }
            }
        }
    }
    
    // Show or hide icon based on selection
    if (hasSelection) {
        // Use exact mouse position where selection occurred
        lastMousePosition = { 
            x: currentMousePosition.x, 
            y: currentMousePosition.y 
        };
        
        // Always allow repositioning for new selection
        isIconPositioned = false;
        
        // Show icon exactly at mouse cursor with fade-in animation
        setTimeout(() => {
            // Double-check selection still exists before showing icon
            if (isInputSelection) {
                const currentInput = getInputSelection(targetElement);
                if (currentInput && currentInput.trim().length > 1) {
                    showIconAtExactMousePosition();
                }
            } else {
                const currentSelection = window.getSelection();
                if (currentSelection && currentSelection.toString().trim().length > 1) {
                    showIconAtExactMousePosition();
                }
            }
        }, 100);
    } else {
        // No selection found - hide icon but KEEP popup open if it's already open
        hideIcon();
        
        // DON'T auto-close popup - user might be interacting with it
        // Only clear selection text if popup is not open
        if (!popup || popup.style.opacity !== '1') {
            currentSelectedText = '';
        }
    }
}

// Show icon exactly at mouse cursor position with fade-in from left
function showIconAtExactMousePosition() {
    // Don't show if popup is already open
    if (isPopupOpening || (popup && popup.style.opacity === '1')) {
        return;
    }
    
    // Don't show if icon is already positioned and visible
    if (isIconPositioned && selectionIcon && selectionIcon.style.opacity === '1') {
        return;
    }
    
    // Ensure icon exists
    if (!selectionIcon) {
        createIcon();
    }
    
    try {
        const iconSize = 28;
        
        // Use exact mouse position
        const mouseX = currentMousePosition.x;
        const mouseY = currentMousePosition.y;
        
        // Calculate starting position (50px to the left of mouse)
        const startX = mouseX - 50;
        
        // Calculate final position (icon above mouse cursor)
        const finalX = mouseX - (iconSize / 2);
        const finalY = mouseY - iconSize - 8; // 8px above cursor
        
        // Ensure icon stays within viewport bounds
        const padding = 10;
        const boundedFinalX = Math.max(padding, Math.min(window.innerWidth - iconSize - padding, finalX));
        const boundedFinalY = Math.max(padding, Math.min(window.innerHeight - iconSize - padding, finalY));
        const boundedStartX = boundedFinalX - 50;
        
        // Set initial position (hidden, 50px to the left)
        selectionIcon.style.position = 'fixed';
        selectionIcon.style.left = boundedStartX + 'px';
        selectionIcon.style.top = boundedFinalY + 'px';
        selectionIcon.style.opacity = '0';
        selectionIcon.style.visibility = 'visible';
        selectionIcon.style.transform = 'scale(0.8) translateX(-10px)';
        selectionIcon.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        selectionIcon.style.zIndex = '2147483647';
        selectionIcon.style.pointerEvents = 'none';
        
        // Trigger the fade-in animation from left to mouse position
        setTimeout(() => {
            if (selectionIcon) {
                selectionIcon.style.left = boundedFinalX + 'px';
                selectionIcon.style.opacity = '1';
                selectionIcon.style.transform = 'scale(1) translateX(0px)';
                selectionIcon.style.pointerEvents = 'auto';
                
                // Mark as positioned and stable
                isIconPositioned = true;
            }
        }, 50);
        
        // Store position for popup positioning (use exact mouse position)
        lastIconPosition = {
            left: mouseX,
            top: mouseY,
            width: iconSize,
            height: iconSize
        };
        
        // Update lastMousePosition for consistency
        lastMousePosition = { x: mouseX, y: mouseY };
        
    } catch (error) {
        console.error('❌ Error showing icon at mouse position:', error);
        hideIcon();
    }
}

// Listen for storage changes to update settings and engine info
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'sync') {
        console.log('🔧 Storage changes detected:', changes);
        
        // Reload all settings when any setting changes
        try {
            currentSettings = await getExtensionSettings();
            console.log('✅ Settings reloaded in content script:', currentSettings);
            
            // Update engine display if engine changed
            if (changes.translationEngine) {
                await updateEngineDisplay(changes.translationEngine.newValue);
                console.log('🔧 Engine display updated to:', changes.translationEngine.newValue);
            }
            
            // Reset translation state to prevent stuck states
            if (isTranslating) {
                console.log('🔄 Resetting translation state due to settings change');
                isTranslating = false;
                if (translationTimeout) {
                    clearTimeout(translationTimeout);
                    translationTimeout = null;
                }
                // Hide loading states
                if (popup) {
                    const loadingElement = popup.querySelector('.loading');
                    if (loadingElement) {
                        loadingElement.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error handling storage changes:', error);
        }
    }
});