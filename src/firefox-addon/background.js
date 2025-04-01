var allTabs = new Set();
var iconChangeTimeout = null;
var currentIconTheme = null;

browser.tabs.onCreated.addListener(tab => {
    if (isValidTab(tab)) allTabs.add(tab.id);
});

browser.tabs.onRemoved.addListener(tabId => {
    allTabs.delete(tabId);
});

browser.runtime.onInstalled.addListener(() => {
    browser.storage.sync.set({
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

browser.runtime.onStartup.addListener(() => {
    browser.storage.sync.get(['enabled']).then((data) => {
        setIconTheme(data.enabled ? 'dark' : 'light');
    });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (isValidTab(tab)) allTabs.add(tabId);
    if (changeInfo.status === 'complete' && isValidTab(tab)) {
        try {
            if (isValidTab(tab)) allTabs.add(tabId);
            browser.storage.sync.get(['enabled', 'exclusions']).then((data) => {
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
                browser.tabs.sendMessage(tabId, {
                    action
                }).catch(error => console.log(`Message to tab ${tabId} failed: ${error.message}`));
            });
        } catch (error) {
            console.error('Error processing tab update:', error);
        }
    }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "changeIcon") {
        setIconTheme(request.theme);
        return Promise.resolve({ success: true });
    } else if (request.action === 'forceUpdateAllTabs') {
        browser.storage.sync.get(['enabled', 'exclusions']).then((storage) => {
            browser.tabs.query({}).then((tabs) => {
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
                    browser.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    }).then(() => {
                        browser.tabs.sendMessage(tab.id, { action })
                            .catch(error => console.log(`Tab ${tab.id} update skipped: ${error.message}`));
                    }).catch(error => console.log(`Script injection failed for tab ${tab.id}: ${error.message}`));
                });
            });
        });
        return Promise.resolve({ success: true });
    }
});

browser.commands.onCommand.addListener((command) => {
    if (command === "toggle-dark-mode") {
        browser.storage.sync.get(['enabled']).then((data) => {
            var newState = !data.enabled;
            browser.storage.sync.set({
                enabled: newState
            }).then(() => {
                updateAllTabs(newState);
                setIconTheme(newState ? 'dark' : 'light');
            });
        });
    }
});

browser.storage.onChanged.addListener((changes, namespace) => {
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
            ? browser.runtime.getURL("icons/icon-dark-16.png") 
            : browser.runtime.getURL("icons/icon-light-16.png");
        browser.action.setIcon({ path: iconPath }).catch(error => {
            console.error("Error setting icon:", error);
        }).finally(() => {
            currentIconTheme = theme;
        });
        iconChangeTimeout = null;
    }, 300);
}

async function injectContentScript(tabId) {
    try {
        await browser.scripting.executeScript({
            target: {
                tabId
            },
            files: ['content.js']
        });
        browser.tabs.sendMessage(tabId, {
            action: 'applyTheme'
        }).catch(error => console.error(`Message to tab ${tabId} failed:`, error));
    } catch (error) {
        console.error('Failed to inject content script:', error);
    }
}

async function updateAllTabs(enabled) {
    var tabs = await browser.tabs.query({});
    for (var tab of tabs) {
        if (!isValidTab(tab)) continue;
        try {
            await browser.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                files: ['content.js']
            });
            browser.tabs.sendMessage(tab.id, {
                action: enabled ? 'applyTheme' : 'removeTheme'
            }).catch(error => console.error(`Message to tab ${tab.id} failed:`, error));
        } catch (error) {
            console.error(`Tab ${tab.id} update failed:`, error);
        }
    }
}

function isValidTab(tab) {
    return tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('moz-extension:');
}