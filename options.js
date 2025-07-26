// Default settings
const defaultSettings = {
    defaultSourceLang: 'auto',
    defaultTargetLang: 'fa',
    fontSize: '12', // Small
    textToSpeech: true,
    translationEngine: 'free', // Free engine by default
    geminiApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    libretranslateUrl: 'https://libretranslate.com',
    libretranslateApiKey: ''
};

// Load settings from storage
async function loadSettings() {
    if (!chrome?.storage?.sync) return defaultSettings;
    
    try {
        return await chrome.storage.sync.get(defaultSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        return defaultSettings;
    }
}

// Save settings to storage
async function saveSettings(settings) {
    if (!chrome?.storage?.sync) return false;
    
    try {
        await chrome.storage.sync.set(settings);
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Update engine selection and show appropriate config
function updateEngineSelection(selectedEngine) {
    // Update dropdown
    const selector = document.getElementById('engine-selector');
    if (selector) {
        selector.value = selectedEngine;
    }
    
    // Hide all config sections
    document.querySelectorAll('.engine-config-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected engine config
    const configSection = document.getElementById(`${selectedEngine}-config`);
    if (configSection) {
        configSection.style.display = 'block';
    }
}

// Get current settings from UI
function getCurrentSettings() {
    const targetSelect = document.getElementById('default-target-lang');
    const fontSizeSelect = document.getElementById('font-size');
    const textToSpeechToggle = document.getElementById('text-to-speech-toggle');
    const engineSelector = document.getElementById('engine-selector');
    
    const geminiApiKey = document.getElementById('gemini-api-key');
    const openaiApiKey = document.getElementById('openai-api-key');
    const anthropicApiKey = document.getElementById('anthropic-api-key');
    
    return {
        defaultSourceLang: 'auto',
        defaultTargetLang: targetSelect?.value || 'fa',
        fontSize: fontSizeSelect?.value || '12',
        textToSpeech: textToSpeechToggle?.classList.contains('active') ?? true,
        translationEngine: engineSelector?.value || 'free',
        geminiApiKey: geminiApiKey?.value || '',
        openaiApiKey: openaiApiKey?.value || '',
        anthropicApiKey: anthropicApiKey?.value || '',
        libretranslateUrl: 'https://libretranslate.com',
        libretranslateApiKey: ''
    };
}

// Show status message
function showStatus(message, isError = false) {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status-message ${isError ? 'error' : 'success'}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    // Engine selector change handler
    const engineSelector = document.getElementById('engine-selector');
    if (engineSelector) {
        engineSelector.addEventListener('change', (e) => {
            updateEngineSelection(e.target.value);
        });
    }
    
    // Text-to-speech toggle
    const ttsToggle = document.getElementById('text-to-speech-toggle');
    if (ttsToggle) {
        ttsToggle.addEventListener('click', () => {
            ttsToggle.classList.toggle('active');
    });
    }
    
    // Save button
    const saveButton = document.getElementById('save-settings');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
            
            try {
                const settings = getCurrentSettings();
                const success = await saveSettings(settings);
        
        if (success) {
                    showStatus('✅ Settings saved successfully!');
            
                    // Notify content script about settings update
            try {
                const tabs = await chrome.tabs.query({});
                        for (const tab of tabs) {
                            try {
                                await chrome.tabs.sendMessage(tab.id, {
                        action: 'settingsUpdated',
                                    settings: settings
                                });
                            } catch (e) {
                                // Ignore tabs that don't have content script
                            }
                        }
                    } catch (e) {
                        console.log('Could not notify content scripts:', e);
                    }
                } else {
                    showStatus('❌ Failed to save settings', true);
                }
            } catch (error) {
                console.error('Save error:', error);
                showStatus('❌ Error saving settings', true);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Settings';
        }
    });
    }
}

// Add Default button logic with auto-save
function setupDefaultButton() {
    const defaultBtn = document.getElementById('reset-defaults');
    if (defaultBtn) {
        defaultBtn.addEventListener('click', async () => {
            // Reset UI to defaults
            document.getElementById('engine-selector').value = 'free';
            document.getElementById('font-size').value = '12';
            updateEngineSelection('free');
            
            // Reset source and target languages to defaults
            const sourceSelect = document.getElementById('default-source-lang');
            const targetSelect = document.getElementById('default-target-lang');
            if (sourceSelect) sourceSelect.value = 'auto';
            if (targetSelect) targetSelect.value = 'fa';
            
            // Auto-save the default settings
            const success = await saveSettings(defaultSettings);
            
            if (success) {
                showStatus('✅ Default settings applied and saved!', true);
            } else {
                showStatus('❌ Failed to save default settings', false);
            }
        });
    }
}

// Load and apply settings to UI
async function loadAndApplySettings() {
    try {
        const settings = await loadSettings();
        
        // Apply target language
        const targetSelect = document.getElementById('default-target-lang');
        if (targetSelect) {
            targetSelect.value = settings.defaultTargetLang || 'fa';
        }
        
        // Apply font size
        const fontSizeSelect = document.getElementById('font-size');
        if (fontSizeSelect) {
            fontSizeSelect.value = settings.fontSize || '12';
        }
        
        // Apply text-to-speech setting
        const ttsToggle = document.getElementById('text-to-speech-toggle');
        if (ttsToggle) {
            if (settings.textToSpeech) {
                ttsToggle.classList.add('active');
            } else {
                ttsToggle.classList.remove('active');
            }
        }
        
        // Apply translation engine
        const engine = settings.translationEngine || 'free';
        updateEngineSelection(engine);
        
        // Apply API keys
        const geminiApiKey = document.getElementById('gemini-api-key');
        if (geminiApiKey) {
            geminiApiKey.value = settings.geminiApiKey || '';
        }
        
        const openaiApiKey = document.getElementById('openai-api-key');
        if (openaiApiKey) {
            openaiApiKey.value = settings.openaiApiKey || '';
        }
        
        const anthropicApiKey = document.getElementById('anthropic-api-key');
        if (anthropicApiKey) {
            anthropicApiKey.value = settings.anthropicApiKey || '';
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('⚠️ Could not load saved settings', true);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadAndApplySettings();
    setupDefaultButton();
});

// Handle extension startup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        loadAndApplySettings();
        setupDefaultButton();
    });
} else {
    setupEventListeners();
    loadAndApplySettings();
    setupDefaultButton();
} 