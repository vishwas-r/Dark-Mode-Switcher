# Dark Mode Switcher
A Browser extension that enables dark mode on any website with smart handling of media elements and customizable settings.

![Dark Mode Switcher - Chrome Extension](https://vishwas-r.github.io/Dark-Mode-Switcher/screenshots/chrome-extension-light.png)

## Key Features

### 🌓 Global Theme Toggle
Apply a dark theme to all websites and tabs with a single click or keyboard shortcut. The extension intelligently inverts colors while preserving readability and usability.

### 📋 Exclusion List
Maintain a list of websites that should be excluded from theme changes. Perfect for sites that already have their own dark mode or where color accuracy is important.

### 🖼️ Smart Media Handling
The extension preserves the original appearance of:
- Images
- Videos
- Canvas elements
- Background images and gradients

This ensures media content remains visually accurate while the rest of the page is in dark mode.

### ⚡ Dynamic Content Support
Using MutationObserver, the extension automatically processes new content as it loads on the page, ensuring a consistent experience even with dynamically loaded elements.

### 💾 Persistent Settings
All your preferences are saved across browser sessions, so you only need to configure the extension once.

### 🎨 UI Theme Toggle
Switch the extension's own user interface between light and dark themes to match your browser theme.

## Usage
### Basic Controls

- Click the extension icon to toggle dark mode on the current site
- Use keyboard shortcut Alt+Shift+D to toggle dark mode on any page

### Settings
Access the extension settings by right-clicking the icon and selecting "Options":
- Exclusion List: Add or remove domains that should never have dark mode applied
- Preservation Options:
-- Choose which media types to preserve (images, videos, canvas)
-- Enable/disable smart inversion for auto-detection of elements that should remain unchanged
- UI Theme: Select light or dark theme for the extension's settings panel

### Customization
The extension offers several options to fine-tune the dark mode experience:

- Smart Inversion: Automatically detects dark UI elements that shouldn't be inverted
- Element Preservation: Customize which types of elements should keep their original colors
- Keyboard Shortcut: Customize the keyboard shortcut in Chrome's extension settings

## Troubleshooting
If you encounter any issues:

- Dark mode not applying: Check if the current site is in your exclusion list
- Media looks inverted: Ensure media preservation is enabled in settings
- Performance issues: Try disabling smart inversion on complex websites
- Extension icon not changing: Refresh the page or restart the browser

## Privacy
This extension:

- Does not collect any user data
- Does not communicate with external servers
- Works entirely within your browser
- Requires only necessary permissions to function

## License
This project is licensed under the GPL License - see the LICENSE file for details.

----
<p align="center">Made with ❤️ for better browsing in the dark!</p>
