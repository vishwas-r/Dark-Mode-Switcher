var currentThemeState = null;

function createDarkModeStyles() {
    if (document.getElementById('dms-styles')) {
        return;
    }
    var style = document.createElement('style');
    style.id = 'dms-styles';
    style.textContent = `
      html.dms-enabled {
        filter: invert(100%) hue-rotate(180deg);
      }
    `;
    document.head.appendChild(style);
}

function updatePreservationRules(settings) {
    var preserveStyle = document.getElementById('dms-preserve-styles');
    if (!preserveStyle) {
        preserveStyle = document.createElement('style');
        preserveStyle.id = 'dms-preserve-styles';
        document.head.appendChild(preserveStyle);
    }
    var selectors = [];
    if (settings.preserveImages) {
        selectors.push('img', '[style*="background-image"]', '[style*="background:url"]');
    }
    if (settings.preserveVideos) {
        selectors.push('video', 'iframe[src*="youtube"]', 'iframe[src*="vimeo"]', '.video-player');
    }
    if (settings.preserveCanvas) {
        selectors.push('canvas');
    }
    if (settings.smartInversion) {
        selectors.push('.dms-preserve');
        initSmartDetection();
    }
    if (selectors.length > 0) {
        preserveStyle.textContent = `
        html.dms-enabled ${selectors.join(', html.dms-enabled ')} {
          filter: invert(100%) hue-rotate(180deg);
        }
      `;
    } else {
        preserveStyle.textContent = '';
    }
}

// Smart detection of elements that should be preserved
function initSmartDetection() {
    var observer = new MutationObserver((mutations) => {
        if (!document.documentElement.classList.contains('dms-enabled')) {
            return;
        }
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        processElementForSmartDetection(node);
                        var elements = node.querySelectorAll('*');
                        elements.forEach(element => {
                            processElementForSmartDetection(element);
                        });
                    }
                });
            }
        });
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    var elements = document.querySelectorAll('*');
    elements.forEach(element => {
        processElementForSmartDetection(element);
    });
}

function processElementForSmartDetection(element) {
    if (!element || !element.tagName) return;
    var skipTags = ['HTML', 'HEAD', 'STYLE', 'SCRIPT', 'META', 'LINK'];
    if (skipTags.includes(element.tagName)) return;
    try {
        var computedStyle = window.getComputedStyle(element);
        var bgColor = computedStyle.backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            if (isDarkColor(bgColor)) {
                element.classList.add('dms-preserve');
            }
        }
        var bgImage = computedStyle.backgroundImage;
        if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
            element.classList.add('dms-preserve');
        }
    } catch (error) {
        // Ignore errors accessing computed style
    }
}

function isDarkColor(color) {
    var r, g, b;
    if (color.startsWith('rgb')) {
        var match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        }
    } else if (color.startsWith('#')) {
        var hex = color.substring(1);
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    if (r !== undefined && g !== undefined && b !== undefined) {
        var brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128;
    }
    return false;
}

function checkExclusionStatus() {
    return new Promise(resolve => {
        browser.storage.sync.get(['enabled', 'exclusions']).then(data => {
            var domain = window.location.hostname;
            var isExcluded = (data.exclusions || []).some(exclusion => 
                domain === exclusion || domain.endsWith(`.${exclusion}`)
            );
            resolve({ enabled: data.enabled, isExcluded });
        });
    });
}

async function applyTheme() {
    var { enabled, isExcluded } = await checkExclusionStatus();
    if (!enabled || isExcluded) return;
    createDarkModeStyles();
    browser.storage.sync.get([
        'preserveImages',
        'preserveVideos',
        'preserveCanvas',
        'smartInversion'
    ]).then((settings) => {
        updatePreservationRules(settings);
        document.documentElement.classList.add('dms-enabled');
    });
    // Only send icon change message if state has actually changed
    if (currentThemeState !== 'dark') {
        browser.runtime.sendMessage({
            action: "changeIcon",
            theme: "dark"
        }).catch(error => console.error("Error sending message:", error));
        currentThemeState = 'dark';
    }
    localStorage.setItem('dmsState', 'enabled');
}

async function removeTheme() {
    var { enabled, isExcluded } = await checkExclusionStatus();
    if (enabled && !isExcluded) return;
    document.documentElement.classList.remove('dms-enabled');
    // Only send icon change message if state has actually changed
    if (currentThemeState !== 'light') {
        browser.runtime.sendMessage({
            action: "changeIcon",
            theme: "light"
        }).catch(error => console.error("Error sending message:", error));
        currentThemeState = 'light';
    }
    localStorage.removeItem('dmsState');
}

browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action === 'applyTheme') {
        applyTheme();
        return Promise.resolve({ success: true });
    } else if (request.action === 'removeTheme') {
        removeTheme();
        return Promise.resolve({ success: true });
    } else {
        return browser.storage.sync.get(['enabled', 'exclusions']).then((data) => {
            var domain = window.location.hostname;
            var isExcluded = (data.exclusions || []).some(exclusion =>
                domain === exclusion || domain.endsWith('.' + exclusion)
            );
            if (data.enabled && !isExcluded) {
                applyTheme();
            } else {
                removeTheme();
            }
            return { success: true };
        });
    }
});

(async function init() {
    if (localStorage.getItem('dmsState') === 'enabled') {
        applyTheme();
    }
    browser.storage.sync.get(['enabled', 'exclusions']).then((data) => {
        if (data.enabled) {
            var domain = window.location.hostname;
            var exclusions = data.exclusions || [];
            var isExcluded = exclusions.some(exclusion =>
                domain === exclusion || domain.endsWith('.' + exclusion)
            );
            if (!isExcluded) {
                applyTheme();
            } else {
                removeTheme();
            }
        } else {
            removeTheme();
        }
    });
})();