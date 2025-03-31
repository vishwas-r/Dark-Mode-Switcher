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

	chrome.storage.sync.get([
		'enabled',
		'preserveImages',
		'preserveVideos',
		'preserveCanvas',
		'smartInversion',
		'exclusions',
		'uiTheme'
	], function (data) {
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

	chrome.storage.onChanged.addListener(function (changes, namespace) {
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

		chrome.storage.sync.set({
			enabled
		}, () => {
			chrome.tabs.query({
				active: true,
				currentWindow: true
			}, (tabs) => {
				var tab = tabs[0];
				if (!tab?.url || tab.url.startsWith("chrome://")) return;

				// Verify change was successful
				chrome.tabs.sendMessage(tab.id, {
					action: enabled ? 'applyTheme' : 'removeTheme'
				}, (response) => {
					if (!response?.success) {
						// Revert UI if failed
						themeToggle.checked = !enabled;
						chrome.storage.sync.set({
							enabled: !enabled
						});
					}
				});
			});
		});
	});

	preserveImages.addEventListener('change', function () {
		chrome.storage.sync.set({
			preserveImages: preserveImages.checked
		});
		refreshAllTabs();
	});

	preserveVideos.addEventListener('change', function () {
		chrome.storage.sync.set({
			preserveVideos: preserveVideos.checked
		});
		refreshAllTabs();
	});

	preserveCanvas.addEventListener('change', function () {
		chrome.storage.sync.set({
			preserveCanvas: preserveCanvas.checked
		});
		refreshAllTabs();
	});

	smartInversion.addEventListener('change', function () {
		chrome.storage.sync.set({
			smartInversion: smartInversion.checked
		});
		refreshAllTabs();
	});

	function addExclusion() {
    var domain = exclusionInput.value.trim();
    if (!domain) return;

    chrome.storage.sync.get(['exclusions'], function (data) {
        var exclusions = data.exclusions || [];
        if (!exclusions.includes(domain)) {
            exclusions.push(domain);
            chrome.storage.sync.set({ exclusions }, () => {
                populateExclusionList(exclusions);
                exclusionInput.value = '';
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
			chrome.storage.sync.set({
				uiTheme: 'dark'
			});
		} else {
			document.body.classList.remove('dark-theme');
			chrome.storage.sync.set({
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
		chrome.storage.sync.get(['exclusions'], function (data) {
			var exclusions = data.exclusions || [];
			var updatedExclusions = exclusions.filter(item => item !== domain);

			chrome.storage.sync.set({
				exclusions: updatedExclusions
			});
			populateExclusionList(updatedExclusions);

			refreshAllTabs();
		});
	}

	function refreshAllTabs() {
		chrome.storage.sync.get(['enabled', 'exclusions'], function (data) {
            themeToggle.checked = data.enabled;
            chrome.runtime.sendMessage({ 
                action: 'forceUpdateAllTabs',
                enabled: data.enabled,
                exclusions: data.exclusions || []
            });

			chrome.tabs.query({}, function (tabs) {
				tabs.forEach(function (tab) {
					try {
						if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("about:") || tab.url.startsWith("file://")) {
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
							chrome.scripting.executeScript({
								target: {
									tabId: tab.id
								},
								files: ["content.js"]
							}, () => {
								if (chrome.runtime.lastError) {
									console.warn(`Skipping tab ${tab.id}: ${chrome.runtime.lastError.message}`);
									return;
								}
								try {
									chrome.tabs.sendMessage(tab.id, {
										action
									}, (response) => {
										if (chrome.runtime.lastError) {
											console.warn(`Error sending message to tab ${tab.id}: ${chrome.runtime.lastError.message}`);
										} else {
											console.log(`Message sent to tab ${tab.id}:`, response);
										}
									});
								} catch (sendError) {
									console.error(`Failed to send message to tab ${tab.id}:`, sendError);
								}
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
	}
});