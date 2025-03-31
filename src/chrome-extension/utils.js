// Utility functions for theme transformation

// Check if element should be ignored for inversion
function shouldIgnoreElement(element) {
  // List of elements that should not be inverted
  const ignoreTags = ['IMG', 'VIDEO', 'CANVAS', 'SVG', 'PICTURE', 'IFRAME'];
  
  if (ignoreTags.includes(element.tagName)) {
    return true;
  }
  
  // Check for background images
  const computedStyle = window.getComputedStyle(element);
  const backgroundImage = computedStyle.backgroundImage;
  
  if (backgroundImage && backgroundImage !== 'none' && 
      (backgroundImage.includes('url(') || 
       backgroundImage.includes('linear-gradient'))) {
    return true;
  }
  
  // Check for video players
  if (element.classList.toString().toLowerCase().includes('video') || 
      element.classList.toString().toLowerCase().includes('player')) {
    return true;
  }
  
  return false;
}

// Determine if a color is light or dark
function isLightColor(color) {
  const rgb = parseRgb(color);
  if (!rgb) return true;
  
  // Calculate relative luminance
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luminance > 128;
}

// Parse RGB color from different formats
function parseRgb(color) {
  if (!color) return null;
  
  // Handle rgb/rgba format
  let match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3])
    };
  }
  
  // Handle hex format
  match = color.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (match) {
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16)
    };
  }
  
  // Handle short hex format
  match = color.match(/#([0-9a-f])([0-9a-f])([0-9a-f])/i);
  if (match) {
    return {
      r: parseInt(match[1] + match[1], 16),
      g: parseInt(match[2] + match[2], 16),
      b: parseInt(match[3] + match[3], 16)
    };
  }
  
  return null;
}

// Invert a color
function invertColor(color) {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  
  // Calculate inverted color with reduced contrast for better readability
  const ir = Math.floor(255 - rgb.r * 0.8);
  const ig = Math.floor(255 - rgb.g * 0.8);
  const ib = Math.floor(255 - rgb.b * 0.8);
  
  return `rgb(${ir}, ${ig}, ${ib})`;
}