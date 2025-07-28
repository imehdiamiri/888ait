// Get DOM elements
const inputText = document.getElementById('input-text');
const targetLang = document.getElementById('target-lang');
const translateBtn = document.getElementById('translate-btn');
const btnText = document.getElementById('btn-text');
const translationResult = document.getElementById('translation-result');
const copyBtn = document.getElementById('copy-btn');
const optionsBtn = document.getElementById('go-to-options');
const engineInfo = document.getElementById('engine-info');
const speakOriginalBtn = document.getElementById('speak-original-btn');
const grammarBtn = document.getElementById('grammar-btn');
const grammarResultSection = document.getElementById('grammar-result-section');
const grammarSuccess = document.getElementById('grammar-success');
const grammarCorrection = document.getElementById('grammar-correction');
const grammarCorrectedText = document.getElementById('grammar-corrected-text');
const copyGrammarBtn = document.getElementById('copy-grammar-btn');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');

// RTL languages that need right-to-left text direction
const rtlLanguages = ['ar', 'fa', 'he', 'ur', 'yi'];

// Current settings - will be loaded from storage
let currentSettings = null;

// Error message functions
function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

function hideError() {
    errorSection.style.display = 'none';
}

// Default settings (same as content.js)
function getDefaultSettings() {
    return {
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
    };
}

// Get extension settings from storage (same as content.js)
async function getExtensionSettings() {
    try {
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
        console.error('Error loading extension settings:', error);
        return getDefaultSettings();
    }
}

// Google Translate engine (free) - exact copy from content.js
async function translateWithGoogle(text, sourceLang, targetLang, settings) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Google Translate API error: ${response.status}`);
        }
        
        const data = await response.json();
        
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

// Alternative Google Translate method - exact copy from content.js
async function translateWithGoogleAlternative(text, sourceLang, targetLang) {
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

// Get language name helper function
function getLanguageName(code) {
    const languageNames = {
        'auto': 'Auto-detect',
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
        'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'fa': 'Persian',
        'hi': 'Hindi', 'tr': 'Turkish', 'nl': 'Dutch', 'sv': 'Swedish',
        'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish', 'pl': 'Polish',
        'cs': 'Czech', 'hu': 'Hungarian', 'ro': 'Romanian', 'bg': 'Bulgarian',
        'hr': 'Croatian', 'sk': 'Slovak', 'sl': 'Slovenian', 'et': 'Estonian',
        'lv': 'Latvian', 'lt': 'Lithuanian', 'uk': 'Ukrainian', 'be': 'Belarusian',
        'mk': 'Macedonian', 'sr': 'Serbian', 'bs': 'Bosnian', 'sq': 'Albanian',
        'el': 'Greek', 'he': 'Hebrew', 'th': 'Thai', 'vi': 'Vietnamese',
        'id': 'Indonesian', 'ms': 'Malay', 'tl': 'Filipino', 'sw': 'Swahili',
        'am': 'Amharic', 'ha': 'Hausa', 'ig': 'Igbo', 'yo': 'Yoruba',
        'zu': 'Zulu', 'af': 'Afrikaans'
    };
    return languageNames[code] || code;
}

// Gemini translation - exact copy from content.js
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

// OpenAI translation - exact copy from content.js
async function translateWithOpenAI(text, sourceLang, targetLang, settings) {
    const apiKey = settings.openaiApiKey;
    
    if (!apiKey) {
        throw new Error('OpenAI API key is required');
    }
    
    const sourceLanguage = getLanguageName(sourceLang);
    const targetLanguage = getLanguageName(targetLang);
    
    const prompt = settings.contextAwareTranslation 
        ? `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide a natural, contextually appropriate translation that maintains the original meaning and tone. Consider cultural nuances and context. Return only the translation without any explanations.

Text to translate: "${text}"`
        : `Translate this text from ${sourceLanguage} to ${targetLanguage}. Return only the translation:

"${text}"`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{
                role: 'user',
                content: prompt
            }],
            temperature: 0.2,
            max_tokens: 1000
        })
    });
    
    if (!response.ok) {
        let errorDetails = '';
        try {
            const errorData = await response.json();
            errorDetails = errorData.error?.message || '';
        } catch (e) {
            errorDetails = response.statusText;
        }
        
        if (response.status === 429) {
            throw new Error('OpenAI rate limit exceeded. Please wait a moment and try again.');
        } else if (response.status === 401) {
            throw new Error('OpenAI API key is invalid or expired. Please check your API key.');
        } else if (response.status === 402) {
            throw new Error('OpenAI API billing issue. Please check your account billing.');
        } else if (response.status === 403) {
            throw new Error('OpenAI API access denied. Please check your API key permissions.');
                    } else {
            throw new Error(`OpenAI API error (${response.status}): ${errorDetails || response.statusText}`);
        }
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    }
    
    throw new Error('OpenAI translation failed - no valid response received');
}

// Main translation function that routes to different engines - exact copy from content.js
async function translateText(text, sourceLang, targetLang) {
    const settings = currentSettings || await getExtensionSettings();
    let engine = settings.translationEngine || 'free';
    
    // Check if API key is available for AI engines (Google Translate is free)
    if (engine === 'gemini' && !settings.geminiApiKey) {
        return 'Gemini API key is required. Please add your API key in the extension settings.';
    } else if (engine === 'openai' && !settings.openaiApiKey) {
        return 'OpenAI API key is required. Please add your API key in the extension settings.';
    } else if (engine === 'anthropic' && !settings.anthropicApiKey) {
        return 'Anthropic API key is required. Please add your API key in the extension settings.';
    }
    
    try {
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
            default:
                // Default to Google Translate (free) if unknown engine
                result = await translateWithGoogle(text, sourceLang, targetLang, settings);
        }
        
        return result;
    } catch (error) {
        console.error(`Translation error with ${engine}:`, error);
        
        // Handle specific error types
        if (error.message.includes('rate limit exceeded') || error.message.includes('429')) {
            return `Rate limit exceeded for ${engine}. Please wait a moment and try again.`;
        }
        
        // Handle API key errors
        if (error.message.includes('API key is invalid') || error.message.includes('401')) {
            return `Invalid API key for ${engine}. Please check your API key in settings.`;
        }
        
        // Handle billing errors
        if (error.message.includes('billing issue') || error.message.includes('402')) {
            return `Billing issue with ${engine}. Please check your account billing.`;
        }
        
        // Don't fallback automatically - user chose specific engine
        return `Translation failed with ${engine}. Error: ${error.message}`;
    }
}

// Load settings and initialize
async function initialize() {
    try {
        // Load current settings
        currentSettings = await getExtensionSettings();
        
        // Load saved target language preference
        if (currentSettings.defaultTargetLang) {
            targetLang.value = currentSettings.defaultTargetLang;
        }
        
        // Update engine info display
        updateEngineInfo(currentSettings.translationEngine);
        
        console.log('Popup initialized with engine:', currentSettings.translationEngine);
    } catch (error) {
        console.log('Could not load preferences:', error);
    }
}

// Update engine info in header
function updateEngineInfo(engine) {
    const engineNames = {
        'free': 'Free',
        'google': 'Free', 
        'gemini': 'Gemini',
        'openai': 'GPT-4',
        'anthropic': 'Claude'
    };
    
    if (engine === 'free' || engine === 'google') {
        engineInfo.innerHTML = `Engine: ${engineNames[engine] || 'Free'} <span style="color: #dc3545;">(no AI)</span>`;
    } else {
        engineInfo.textContent = `Engine: ${engineNames[engine] || 'Free'}`;
    }
}

// Show loading state
function showLoading() {
    translateBtn.disabled = true;
    btnText.textContent = 'Translating...';
    translateBtn.querySelector('svg').classList.add('loading');
}

// Hide loading state
function hideLoading() {
    translateBtn.disabled = false;
    btnText.textContent = 'Translate';
    translateBtn.querySelector('svg').classList.remove('loading');
}

// Show translation result
function showTranslation(text, targetLanguage) {
    const isRTL = rtlLanguages.includes(targetLanguage);
    
    translationResult.innerHTML = `
        <div class="${isRTL ? 'rtl-text' : ''}">${text}</div>
    `;
    
    translationResult.classList.add('show');
    copyBtn.classList.add('show');
}

// Show error message
function showError(message) {
    translationResult.innerHTML = `<div class="error">${message}</div>`;
    translationResult.classList.add('show');
    copyBtn.classList.remove('show');
}

// Hide translation and copy button
function hideTranslation() {
    translationResult.classList.remove('show');
    copyBtn.classList.remove('show');
}

// Perform translation using the exact same logic as content.js
async function performTranslation() {
    // Hide any previous error messages
    hideError();
    
    const text = inputText.value.trim();
    const target = targetLang.value;
    
    if (!text) {
        showError('Please enter text to translate');
        return;
    }
    
    if (!target) {
        showError('Please select a target language');
        return;
    }
    
    console.log('Translating with engine:', currentSettings?.translationEngine || 'loading...');
    showLoading();
    
    try {
        // Use the exact same translateText function as content.js
        const translatedText = await translateText(text, 'auto', target);
        
        showTranslation(translatedText, target);
        
        // Save language preference
        try {
            await chrome.storage.sync.set({ defaultTargetLang: target });
        } catch (error) {
            console.log('Could not save language preference:', error);
        }
    } catch (error) {
        console.error('Translation error:', error);
        showError(error.message || 'Translation failed. Please try again.');
    } finally {
        hideLoading();
    }
}

// Text-to-speech for original text
function speakOriginalText() {
    const text = inputText.value.trim();
    if (!text) {
        showError('Please enter some text first.');
        return;
    }
    
    if (!('speechSynthesis' in window)) {
        showError('Text-to-speech is not supported in your browser.');
        return;
    }
    
    // Stop any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to set language based on detected language (basic detection)
    const sourceLanguage = detectSourceLanguage(text);
    if (sourceLanguage) {
        utterance.lang = sourceLanguage;
    }
    
    // Find a natural voice for the language
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
        voice.lang.startsWith(sourceLanguage?.substring(0, 2) || 'en') && 
        voice.name.toLowerCase().includes('natural')
    ) || voices.find(voice => 
        voice.lang.startsWith(sourceLanguage?.substring(0, 2) || 'en')
    );
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    speechSynthesis.speak(utterance);
}

// Simple language detection for speech
function detectSourceLanguage(text) {
    // Basic language detection based on character sets
    if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic
    if (/[\u0590-\u05FF]/.test(text)) return 'he'; // Hebrew
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh'; // Chinese
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'; // Japanese
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
    if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Russian/Cyrillic
    if (/[\u0100-\u017F\u1E00-\u1EFF]/.test(text)) return 'de'; // German (with umlauts)
    if (/[\u00C0-\u00FF]/.test(text)) return 'fr'; // French (with accents)
    if (/[àáäâèéëêìíïîòóöôùúüûñç]/.test(text.toLowerCase())) return 'es'; // Spanish
    return 'en'; // Default to English
}

// Grammar check functionality (copied from content.js)
async function checkGrammar() {
    const text = inputText.value.trim();
    if (!text) {
        showError('Please enter some text first.');
        return;
    }
    
    const settings = currentSettings || await getExtensionSettings();
    
    // Check if AI engine is selected
    const currentEngine = settings.translationEngine || 'free';
    if (currentEngine === 'free' || currentEngine === 'google') {
        showError('Grammar check requires an AI engine. Please select Gemini, OpenAI, or Anthropic in extension settings.');
        return;
    }
    
    // Check if AI services are available
    if (!settings.geminiApiKey && !settings.openaiApiKey && !settings.anthropicApiKey) {
        showError('Grammar check requires an AI service (Gemini, OpenAI, or Anthropic). Please configure an API key in the extension options.');
        return;
    }
    
    try {
        // Show loading state
        const originalHTML = grammarBtn.innerHTML;
        grammarBtn.disabled = true;
        grammarBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c.83 0 1.64.11 2.4.31"></path>
            </svg>
            Checking...
        `;
        
        let correctedText;
        if (settings.geminiApiKey) {
            correctedText = await checkGrammarWithGemini(text, settings);
        } else if (settings.openaiApiKey) {
            correctedText = await checkGrammarWithOpenAI(text, settings);
        } else if (settings.anthropicApiKey) {
            correctedText = await checkGrammarWithAnthropic(text, settings);
        }
        
        // Show result
        showGrammarResult(correctedText, text);
        
    } catch (error) {
        console.error('Grammar check error:', error);
        showError('Failed to check grammar. Please try again.');
    } finally {
        // Reset button state
        grammarBtn.disabled = false;
        grammarBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"></path>
                <circle cx="12" cy="12" r="9"></circle>
            </svg>
            Check Grammar
        `;
    }
}

// Show grammar check result inline
function showGrammarResult(correctedText, originalText) {
    const isCorrect = correctedText.toUpperCase() === 'CORRECT' || correctedText === originalText;
    
    // Hide both sections first
    grammarSuccess.style.display = 'none';
    grammarCorrection.style.display = 'none';
    
    if (isCorrect) {
        // Show success message
        grammarSuccess.style.display = 'block';
        grammarResultSection.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            grammarResultSection.style.display = 'none';
        }, 3000);
    } else {
        // Show correction
        grammarCorrectedText.textContent = correctedText;
        grammarCorrection.style.display = 'block';
        grammarResultSection.style.display = 'block';
        
        // Set up button listeners for this correction
        setupGrammarButtons(correctedText);
    }
}

// Setup grammar result buttons
function setupGrammarButtons(correctedText) {
    // Copy button
    copyGrammarBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(correctedText);
            const originalIcon = copyGrammarBtn.innerHTML;
            copyGrammarBtn.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                    <path d="M9 12l2 2 4-4"></path>
                    <circle cx="12" cy="12" r="9"></circle>
                </svg>
            `;
            setTimeout(() => {
                copyGrammarBtn.innerHTML = originalIcon;
            }, 1500);
        } catch (error) {
            console.error('Copy failed:', error);
        }
    };
}

// Grammar check with Gemini (simplified from content.js)
async function checkGrammarWithGemini(text, settings) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${settings.geminiApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `Check and correct grammar for this text. If the text is already correct, respond with "CORRECT". If corrections are needed, respond only with the corrected text:\n\n"${text}"`
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 500
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text.trim().replace(/"/g, '');
    }
    
    throw new Error('Failed to get grammar check from Gemini');
}

// Grammar check with OpenAI (simplified from content.js)
async function checkGrammarWithOpenAI(text, settings) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.openaiApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a grammar checker. Check and correct grammar. If the text is already correct, respond with "CORRECT". If corrections are needed, respond only with the corrected text.'
                },
                {
                    role: 'user',
                    content: `"${text}"`
                }
            ],
            max_tokens: 500,
            temperature: 0.1
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim().replace(/"/g, '');
    }
    
    throw new Error('Failed to get grammar check from OpenAI');
}

// Grammar check with Anthropic (simplified from content.js)
async function checkGrammarWithAnthropic(text, settings) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': settings.anthropicApiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 500,
            messages: [{
                role: 'user',
                content: `Check and correct grammar for this text. If the text is already correct, respond with "CORRECT". If corrections are needed, respond only with the corrected text:\n\n"${text}"`
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text.trim().replace(/"/g, '');
    }
    
    throw new Error('Failed to get grammar check from Anthropic');
}

// Copy translation to clipboard
async function copyTranslation() {
    try {
        const text = translationResult.querySelector('div:not(.error)').textContent;
        await navigator.clipboard.writeText(text);
        
        // Show brief feedback
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                <path d="M9 12l2 2 4-4"></path>
                <circle cx="12" cy="12" r="9"></circle>
            </svg>
            Copied!
        `;
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
        }, 1500);
    } catch (error) {
        console.error('Copy failed:', error);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = translationResult.querySelector('div:not(.error)').textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

// Event listeners
translateBtn.addEventListener('click', performTranslation);

inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        performTranslation();
    }
});

inputText.addEventListener('input', () => {
    if (!inputText.value.trim()) {
        hideTranslation();
    }
});

targetLang.addEventListener('change', () => {
    if (inputText.value.trim() && translationResult.classList.contains('show')) {
        // Auto-retranslate if text exists and translation is showing
        performTranslation();
    }
});

copyBtn.addEventListener('click', copyTranslation);

speakOriginalBtn.addEventListener('click', speakOriginalText);

grammarBtn.addEventListener('click', checkGrammar);

optionsBtn.addEventListener('click', async () => {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options.html'));
    }
});

// Listen for storage changes to update engine info and settings
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'sync') {
        // Reload all settings when any setting changes
        currentSettings = await getExtensionSettings();
        
        if (changes.translationEngine) {
            updateEngineInfo(changes.translationEngine.newValue);
            console.log('Engine updated to:', changes.translationEngine.newValue);
        }
    }
});

// Donate button event handler
document.getElementById('donate-btn-pin').addEventListener('click', () => {
    showPinDonationDialog();
});

// Show donation dialog for pin popup
function showPinDonationDialog() {
    // Create donation dialog for pin popup
    const donationDialog = document.createElement('div');
    donationDialog.id = 'pin-donation-dialog';
    donationDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 420px;
        max-width: 95vw;
        background: white;
        border-radius: 12px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.3);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: normal !important;
    `;
    
    donationDialog.innerHTML = `
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%); padding: 18px; text-align: center; color: white;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">💝 Support Development</h2>
            </div>
            <p style="margin: 0; font-size: 12px; opacity: 0.9;">Help keep this extension free and improving</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 16px;">
                         <p style="margin: 0 0 12px; color: #64748b; font-size: 12px; text-align: center; line-height: 1.3;">
                 Support development with crypto. Every contribution helps!
             </p>
            
                         <!-- Crypto Addresses -->
                            <div style="background: #f8fafc; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                  <div style="display: grid; gap: 10px;">
                                             <div class="pin-crypto-item" data-address="TEZrH7kkbGoSvsUUxh4ossyCUbW4WMdXzM" data-name="USDT (TRC20)" style="display: flex; align-items: center; justify-content: space-between; padding: 6px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #1e293b; font-size: 10px; margin-bottom: 1px;">USDT (TRC20)</div>
                                <div style="font-family: monospace; color: #64748b; font-size: 8px; word-break: break-all;">TEZrH7kkbGoSvsUUxh4ossyCUbW4WMdXzM</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; margin-left: 4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <div class="pin-qr-btn" data-address="TEZrH7kkbGoSvsUUxh4ossyCUbW4WMdXzM" data-name="USDT (TRC20)" style="cursor: pointer; padding: 3px; border-radius: 2px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                       
                       <div class="pin-crypto-item" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="USDT (ERC20)" style="display: flex; align-items: center; justify-content: space-between; padding: 6px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #1e293b; font-size: 10px; margin-bottom: 1px;">USDT (ERC20)</div>
                                <div style="font-family: monospace; color: #64748b; font-size: 8px; word-break: break-all;">0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; margin-left: 4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <div class="pin-qr-btn" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="USDT (ERC20)" style="cursor: pointer; padding: 3px; border-radius: 2px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                        
                        <div class="pin-crypto-item" data-address="bc1q2sfafhrpytkc7y79z60yx8m6t58duk4e9kghm3" data-name="Bitcoin (BTC)" style="display: flex; align-items: center; justify-content: space-between; padding: 6px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #1e293b; font-size: 10px; margin-bottom: 1px;">Bitcoin (BTC)</div>
                                <div style="font-family: monospace; color: #64748b; font-size: 8px; word-break: break-all;">bc1q2sfafhrpytkc7y79z60yx8m6t58duk4e9kghm3</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; margin-left: 4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <div class="pin-qr-btn" data-address="bc1q2sfafhrpytkc7y79z60yx8m6t58duk4e9kghm3" data-name="Bitcoin (BTC)" style="cursor: pointer; padding: 3px; border-radius: 2px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                        
                        <div class="pin-crypto-item" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="Ethereum (ETH)" style="display: flex; align-items: center; justify-content: space-between; padding: 6px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s;" title="Click to copy address">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #1e293b; font-size: 10px; margin-bottom: 1px;">Ethereum (ETH)</div>
                                <div style="font-family: monospace; color: #64748b; font-size: 8px; word-break: break-all;">0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; margin-left: 4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <div class="pin-qr-btn" data-address="0xe160639f71A0A7b3eBf26BCEF2D302C2C03817f7" data-name="Ethereum (ETH)" style="cursor: pointer; padding: 3px; border-radius: 2px; transition: all 0.2s; background: #3b82f6; color: white;" title="Show QR Code">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                <p style="margin: 0 0 12px; color: #64748b; font-size: 11px;">
                    Click any address to copy • Thank you for your support! 🙏
                </p>
                                 <button id="close-pin-donation-btn" style="background: #dc3545; color: white; border: none; padding: 6px 16px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: 500; transition: background 0.2s;">
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
    setupPinDonationHandlers();
    
    // Close function
    function closePinDonationDialog() {
        document.body.removeChild(backdrop);
        document.body.removeChild(donationDialog);
    }
    
    // Event listeners
    const closeBtn = donationDialog.querySelector('#close-pin-donation-btn');
    closeBtn.addEventListener('click', closePinDonationDialog);
    backdrop.addEventListener('click', closePinDonationDialog);
    
    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
                 .crypto-address-pin:hover {
             border-color: #dc3545 !important;
             background: #f8d7da !important;
             transform: translateY(-1px);
             box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2);
         }
         
         #close-pin-donation-btn:hover {
             background: #c82333 !important;
         }
    `;
    document.head.appendChild(style);
}

// Show QR code for pin popup
function showPinQRCode(address, name) {
    // Create QR dialog
    const qrDialog = document.createElement('div');
    qrDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 10px;
        box-shadow: 0 15px 30px rgba(0,0,0,0.3);
        z-index: 10002;
        text-align: center;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        direction: ltr !important;
        text-align: center !important;
        unicode-bidi: normal !important;
    `;
    
    qrDialog.innerHTML = `
        <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 14px;">${name}</h3>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}" 
             style="width: 150px; height: 150px; border: 1px solid #e2e8f0; border-radius: 6px;" alt="QR Code" />
        <p style="margin: 10px 0 6px; font-size: 9px; color: #64748b; word-break: break-all; font-family: monospace;">${address}</p>
        <button id="close-pin-qr-btn" style="background: #dc3545; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 10px; margin-top: 4px;">Close</button>
    `;
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'pin-qr-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
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
    qrDialog.querySelector('#close-pin-qr-btn').onclick = closeQR;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(qrDialog);
}

// Setup pin donation functionality
function setupPinDonationHandlers() {
    const pinCryptoItems = document.querySelectorAll('.pin-crypto-item');
    pinCryptoItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Prevent QR button from triggering copy
            if (e.target.closest('.pin-qr-btn')) return;
            
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
                feedbackDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #16a34a; color: white; padding: 3px 6px; border-radius: 3px; font-size: 8px; z-index: 1000; pointer-events: none;';
                
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
    const pinQrBtns = document.querySelectorAll('.pin-qr-btn');
    pinQrBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent copy from triggering
            const address = this.getAttribute('data-address');
            const name = this.getAttribute('data-name');
            showPinQRCode(address, name);
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

// Copy donation address to clipboard for pin popup (legacy - can be removed)
function copyPinDonationAddress(address, element) {
    navigator.clipboard.writeText(address).then(() => {
        // Visual feedback
        const originalIcon = element.querySelector('svg');
        const checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkIcon.setAttribute('width', '16');
        checkIcon.setAttribute('height', '16');
        checkIcon.setAttribute('viewBox', '0 0 24 24');
        checkIcon.setAttribute('fill', 'none');
        checkIcon.setAttribute('stroke', '#16a34a');
        checkIcon.setAttribute('stroke-width', '2');
        checkIcon.innerHTML = '<polyline points="20,6 9,17 4,12"></polyline>';
        
        element.style.borderColor = '#16a34a';
        element.style.background = '#f0fdf4';
        originalIcon.parentNode.replaceChild(checkIcon, originalIcon);
        
        setTimeout(() => {
            element.style.borderColor = '#e2e8f0';
            element.style.background = 'white';
            checkIcon.parentNode.replaceChild(originalIcon, checkIcon);
        }, 2000);
    }).catch(err => {
        console.error('Could not copy address: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Visual feedback
        element.style.borderColor = '#16a34a';
        element.style.background = '#f0fdf4';
        setTimeout(() => {
            element.style.borderColor = '#e2e8f0';
            element.style.background = 'white';
        }, 2000);
    });
}

// Initialize on load
initialize(); 