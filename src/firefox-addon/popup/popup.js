document.addEventListener('DOMContentLoaded', function () {
    var themeToggle = document.getElementById('themeToggle');
    var preserveImages = document.getElementById('preserveImages');
    var preserveVideos = document.getElementById('preserveVideos');
    var preserveCanvas = document.getElementById('preserveCanvas');
    var smartInversion = document.getElementById('smartInversion');
    var exclusionInput = document.getElementById('exclusionInput');
    var addExclusionBtn = document.getElementById('addExclusion');
    var exclusionList = document.getElementById('exclusionList');
    var uiToggle = document.getElementById('uiToggle');
    
    browser.storage.sync.get([
        'enabled',
        'preserveImages',
        'preserveVideos',
        'preserveCanvas',
        'smartInversion',
        'exclusions',
        'uiTheme'
    ]).then(function (data) {
        themeToggle.checked = data.enabled || false;
        preserveImages.checked = data.preserveImages !== false;
        preserveVideos.checked = data.preserveVideos !== false;
        preserveCanvas.checked = data.preserveCanvas !== false;
        smartInversion.checked = data.smartInversion !== false;
        if (data.uiTheme === 'dark') {
            document.body.classList.add('dark-theme');
            uiToggle.checked = true;
        }
        populateExclusionList(data.exclusions || []);
    });
    
    browser.storage.onChanged.addListener(function (changes, namespace) {
        if (changes.enabled) {
            themeToggle.checked = changes.enabled.newValue;
        }
        if (changes.uiTheme) {
            document.body.classList.toggle('dark-theme', changes.uiTheme.newValue === 'dark');
            uiToggle.checked = changes.uiTheme.newValue === 'dark';
        }
    });
    
    themeToggle.addEventListener('change', function () {
        var enabled = themeToggle.checked;
        // Immediately update UI while waiting for confirmation
        themeToggle.checked = enabled;
        browser.storage.sync.set({
            enabled
        }).then(() => {
            browser.tabs.query({
                active: true,
                currentWindow: true
            }).then((tabs) => {
                var tab = tabs[0];
                if (!tab?.url || tab.url.startsWith("about:")) return;
                // Verify change was successful
                browser.tabs.sendMessage(tab.id, {
                    action: enabled ? 'applyTheme' : 'removeTheme'
                }).then((response) => {
                    if (!response?.success) {
                        // Revert UI if failed
                        themeToggle.checked = !enabled;
                        browser.storage.sync.set({
                            enabled: !enabled
                        });
                    }
                }).catch(error => {
                    console.error("Error sending message:", error);
                });
            });
        });
    });
    
    preserveImages.addEventListener('change', function () {
        browser.storage.sync.set({
            preserveImages: preserveImages.checked
        });
        showLoadingState();
        refreshAllTabs();
    });
    
    preserveVideos.addEventListener('change', function () {
        browser.storage.sync.set({
            preserveVideos: preserveVideos.checked
        });
        showLoadingState();
        refreshAllTabs();
    });
    
    preserveCanvas.addEventListener('change', function () {
        browser.storage.sync.set({
            preserveCanvas: preserveCanvas.checked
        });
        showLoadingState();
        refreshAllTabs();
    });
    
    smartInversion.addEventListener('change', function () {
        browser.storage.sync.set({
            smartInversion: smartInversion.checked
        });
        showLoadingState();
        refreshAllTabs();
    });
    
    function addExclusion() {
        var domain = exclusionInput.value.trim();
        if (!domain) return;
        browser.storage.sync.get(['exclusions']).then(function (data) {
            var exclusions = data.exclusions || [];
            if (!exclusions.includes(domain)) {
                exclusions.push(domain);
                browser.storage.sync.set({ exclusions }).then(() => {
                    populateExclusionList(exclusions);
                    exclusionInput.value = '';
                    showLoadingState();
                    refreshAllTabs();  // Ensure all tabs are updated
                });
            }
        });
    }
    
    addExclusionBtn.addEventListener('click', addExclusion);
    
    exclusionInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            addExclusion();
        }
    });
    
    uiToggle.addEventListener('change', function () {
        if (uiToggle.checked) {
            document.body.classList.add('dark-theme');
            browser.storage.sync.set({
                uiTheme: 'dark'
            });
        } else {
            document.body.classList.remove('dark-theme');
            browser.storage.sync.set({
                uiTheme: 'light'
            });
        }
    });
    
    function populateExclusionList(exclusions) {
        exclusionList.innerHTML = '';
        exclusions.forEach(function (domain) {
            var li = document.createElement('li');
            var domainSpan = document.createElement('span');
            domainSpan.textContent = domain;
            var removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', function () {
                removeExclusion(domain);
            });
            li.appendChild(domainSpan);
            li.appendChild(removeBtn);
            exclusionList.appendChild(li);
        });
    }
    
    function removeExclusion(domain) {
        browser.storage.sync.get(['exclusions']).then(function (data) {
            var exclusions = data.exclusions || [];
            var updatedExclusions = exclusions.filter(item => item !== domain);
            browser.storage.sync.set({
                exclusions: updatedExclusions
            }).then(() => {
                populateExclusionList(updatedExclusions);
                showLoadingState();
                refreshAllTabs();
            });
        });
    }
    
    var refreshTimeout;
    function refreshAllTabs() {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
            browser.storage.sync.get(['enabled', 'exclusions']).then(function (data) {
                themeToggle.checked = data.enabled;
                browser.runtime.sendMessage({
                    action: 'forceUpdateAllTabs',
                    enabled: data.enabled,
                    exclusions: data.exclusions
                });
                browser.tabs.query({}).then(function (tabs) {
                    tabs.forEach(function (tab) {
                        try {
                            if (!tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:") || tab.url.startsWith("file://")) {
                                return; // Skip unsupported pages
                            }
                            var url = new URL(tab.url);
                            var domain = url.hostname;
                            var exclusions = data.exclusions || [];
                            var isExcluded = exclusions.some(exclusion =>
                                domain === exclusion || domain.endsWith('.' + exclusion)
                            );
                            var action = (data.enabled && !isExcluded) ? 'applyTheme' : 'removeTheme';
                            try {
                                browser.scripting.executeScript({
                                    target: {
                                        tabId: tab.id
                                    },
                                    files: ["content.js"]
                                }).then(() => {
                                    try {
                                        browser.tabs.sendMessage(tab.id, {
                                            action
                                        }).then((response) => {
                                            console.log(`Message sent to tab ${tab.id}:`, response);
                                        }).catch(error => {
                                            console.warn(`Error sending message to tab ${tab.id}: ${error.message}`);
                                        });
                                    } catch (sendError) {
                                        console.error(`Failed to send message to tab ${tab.id}:`, sendError);
                                    }
                                }).catch(error => {
                                    console.warn(`Skipping tab ${tab.id}: ${error.message}`);
                                });
                            } catch (scriptError) {
                                console.error(`Failed to inject script into tab ${tab.id}:`, scriptError);
                            }
                        } catch (tabError) {
                            console.error("Error processing tab:", tab.id, tabError);
                        }
                    });
                });
            });
        }, 300);
    }
    
    function showLoadingState() {
        exclusionList.classList.add('updating');
        var interactiveElements = exclusionList.querySelectorAll('button, input, select, a');
        interactiveElements.forEach(element => {
            element.setAttribute('disabled', 'true');
            if (element.tagName === 'A') {
                element.style.pointerEvents = 'none';
            }
        });
        setTimeout(() => {
            exclusionList.classList.remove('updating');
            interactiveElements.forEach(element => {
                element.removeAttribute('disabled');
                if (element.tagName === 'A') {
                    element.style.pointerEvents = '';
                }
            });
        }, 500);
    }
});