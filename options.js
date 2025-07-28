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
    setupDonationHandlers();
});

// Copy crypto address to clipboard
function copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => {
        return true;
    }).catch(err => {
        console.error('Could not copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
    });
}

// Add visual feedback to crypto items
function addCopiedFeedback(element) {
    const originalBg = element.style.background;
    element.style.background = '#dcfce7';
    element.style.borderColor = '#16a34a';
    
    // Show "Copied!" message
    const feedbackDiv = document.createElement('div');
    feedbackDiv.textContent = '✅ Copied!';
    feedbackDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #16a34a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; z-index: 1000; pointer-events: none;';
    
    element.style.position = 'relative';
    element.appendChild(feedbackDiv);
    
    setTimeout(() => {
        element.style.background = originalBg;
        element.style.borderColor = '';
        if (feedbackDiv.parentNode) {
            feedbackDiv.parentNode.removeChild(feedbackDiv);
        }
    }, 2000);
}

// Show QR code for crypto address
function showQRCode(address, name) {
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
        z-index: 10001;
        text-align: center;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    qrDialog.innerHTML = `
        <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 18px;">${name}</h3>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}" 
             style="width: 200px; height: 200px; border: 1px solid #e2e8f0; border-radius: 8px;" alt="QR Code" />
        <p style="margin: 16px 0 8px; font-size: 12px; color: #64748b; word-break: break-all; font-family: monospace;">${address}</p>
        <button id="close-qr-btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 8px;">Close</button>
    `;
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'qr-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
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
    qrDialog.querySelector('#close-qr-btn').onclick = closeQR;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(qrDialog);
}

// Setup donation functionality
function setupDonationHandlers() {
    const cryptoItems = document.querySelectorAll('.crypto-item');
    cryptoItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Prevent QR button from triggering copy
            if (e.target.closest('.qr-btn')) return;
            
            const address = this.getAttribute('data-address');
            const name = this.getAttribute('data-name');
            
            copyToClipboard(address).then(() => {
                addCopiedFeedback(this);
            });
        });
        
        // Add hover effect
        item.addEventListener('mouseenter', function() {
            this.style.background = '#e0f2fe';
            this.style.borderColor = '#0891b2';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.background = '#f8fafc';
            this.style.borderColor = '';
        });
    });
    
    // Setup QR button handlers
    const qrBtns = document.querySelectorAll('.qr-btn');
    qrBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent copy from triggering
            const address = this.getAttribute('data-address');
            const name = this.getAttribute('data-name');
            showQRCode(address, name);
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