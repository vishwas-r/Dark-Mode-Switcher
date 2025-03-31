var allTabs = new Set();

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
		var iconPath = request.theme === "dark" ? chrome.runtime.getURL("icons/icon-dark-16.png") : chrome.runtime.getURL("icons/icon-light-16.png");
		chrome.action.setIcon({
			path: iconPath
		}, () => {
			if (chrome.runtime.lastError) {
				console.error(chrome.runtime.lastError);
			}
		});

		sendResponse({
			success: true
		});
	} else if (request.action === 'forceUpdateAllTabs') {
		updateAllTabs(request.enabled);
		sendResponse({
			success: true
		});
	}
	return true;
});

chrome.commands.onCommand.addListener((command) => {
	if (command === "toggle-dark-mode") {
		chrome.storage.sync.get(['enabled'], (data) => {
			const newState = !data.enabled;
			chrome.storage.sync.set({
				enabled: newState
			}, () => {
				updateAllTabs(newState);
			});
		});
	}
});

chrome.storage.onChanged.addListener((changes, namespace) => {
	if (changes.enabled) {
		updateAllTabs(changes.enabled.newValue);
	}
});

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
	const tabs = await chrome.tabs.query({});

	for (const tab of tabs) {
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