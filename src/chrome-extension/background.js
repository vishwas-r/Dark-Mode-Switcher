var allTabs = new Set();
var iconChangeTimeout = null;
var currentIconTheme = null;

chrome.tabs.onCreated.addListener(tab => {
    if (isValidTab(tab)) allTabs.add(tab.id);
});

chrome.tabs.onRemoved.addListener(tabId => {
    allTabs.delete(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        enabled: false,
        preserveImages: true,
        preserveVideos: true,
        preserveCanvas: true,
        smartInversion: false,
        exclusions: [],
        uiTheme: 'light'
    });

    setIconTheme('light');
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get(['enabled'], (data) => {
        setIconTheme(data.enabled ? 'dark' : 'light');
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (isValidTab(tab)) allTabs.add(tabId);
    if (changeInfo.status === 'complete' && isValidTab(tab)) {
        try {
            if (isValidTab(tab)) allTabs.add(tabId);
            chrome.storage.sync.get(['enabled', 'exclusions'], (data) => {
                if (!data.enabled) return;
                var domain;
                try {
                    var url = new URL(tab.url);
                    domain = url.hostname;
                } catch (error) {
                    console.warn('Invalid URL:', tab.url);
                    return;
                }
                var isExcluded = data.exclusions.some(exclusion =>
                    domain === exclusion || domain.endsWith(`.${exclusion}`)
                );
                var action = isExcluded ? 'removeTheme' : 'applyTheme';
                chrome.tabs.sendMessage(tabId, {
                    action
                });
            });
        } catch (error) {
            console.error('Error processing tab update:', error);
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "changeIcon") {
        setIconTheme(request.theme);
        sendResponse({ success: true });
    } else if (request.action === 'forceUpdateAllTabs') {
        chrome.storage.sync.get(['enabled', 'exclusions'], (storage) => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (!isValidTab(tab)) return;
                    
                    var isExcluded = false;
                    try {
                        var domain = new URL(tab.url).hostname;
                        isExcluded = storage.exclusions.some(exclusion => 
                            domain === exclusion || domain.endsWith(`.${exclusion}`)
                        );
                    } catch (error) {
                        console.warn('Invalid URL:', tab.url);
                    }
                    var action = storage.enabled && !isExcluded 
                        ? 'applyTheme' 
                        : 'removeTheme';
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    }, () => {
                        chrome.tabs.sendMessage(tab.id, { action })
                            .catch(error => console.log(`Tab ${tab.id} update skipped`));
                    });
                });
            });
        });
        sendResponse({ success: true });
    }
    return true;
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-dark-mode") {
        chrome.storage.sync.get(['enabled'], (data) => {
            var newState = !data.enabled;
            chrome.storage.sync.set({
                enabled: newState
            }, () => {
                updateAllTabs(newState);
                setIconTheme(newState ? 'dark' : 'light');
            });
        });
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.enabled) {
        updateAllTabs(changes.enabled.newValue);
        setIconTheme(changes.enabled.newValue ? 'dark' : 'light');
    }
});

function setIconTheme(theme) {
    // If it's the same theme, do nothing
    if (theme === currentIconTheme) return;
    
    if (iconChangeTimeout) {
        clearTimeout(iconChangeTimeout);
    }
    
    iconChangeTimeout = setTimeout(() => {
        var iconPath = theme === "dark" 
            ? chrome.runtime.getURL("icons/icon-dark-16.png") 
            : chrome.runtime.getURL("icons/icon-light-16.png");
            
        chrome.action.setIcon({ path: iconPath }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            }
            currentIconTheme = theme;
        });
        
        iconChangeTimeout = null;
    }, 300);
}

async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: {
                tabId
            },
            files: ['content.js']
        });
        chrome.tabs.sendMessage(tabId, {
            action: 'applyTheme'
        });
    } catch (error) {
        console.error('Failed to inject content script:', error);
    }
}

async function updateAllTabs(enabled) {
    var tabs = await chrome.tabs.query({});
    for (var tab of tabs) {
        if (!isValidTab(tab)) continue;
        try {
            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                files: ['content.js']
            });
            chrome.tabs.sendMessage(tab.id, {
                action: enabled ? 'applyTheme' : 'removeTheme'
            });
        } catch (error) {
            console.error(`Tab ${tab.id} update failed:`, error);
        }
    }
}

function isValidTab(tab) {
    return tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:');
}