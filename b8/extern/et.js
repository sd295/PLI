/** 
 * et.js
 * Processes a prompt string and returns enriched HTML:
 *  - Highlights key terms
 *  - Links them to Wikipedia
 *  - Adds images if available
 */

import the from './the.js'; // assumes the.js handles Wikipedia fetching & cards

/**
 * Main exported function
 * @param {string} prompt - The raw text to process (from Gemini/PLI)
 * @returns {Promise<string>} HTML string with enriched content
 */
export async function processPromptFromEt(prompt) {
    if (!prompt || typeof prompt !== 'string') return '';

    // Split text into words for analysis
    const words = prompt.split(/\s+/);
    const stopWords = ['the','a','an','in','on','at','by','for','of','to','from','with','is','are'];

    // Identify "significant" words to link to Wikipedia
    const significantWords = words
        .map(w => w.replace(/[.,!?]/g,'').toLowerCase())
        .filter(w => w.length >= 3 && !stopWords.includes(w));

    // Build a container div
    const container = document.createElement('div');
    container.className = 'et-response-container';
    
    // Add main prompt text
    const p = document.createElement('p');
    p.textContent = prompt;
    p.className = 'et-response-text';
    container.appendChild(p);

    // For each significant word, fetch Wikipedia summary & image
    for (let word of significantWords) {
        try {
            // the() returns HTML element with Wikipedia card
            const wikiElement = await the([word]); 
            if (wikiElement) container.appendChild(wikiElement);
        } catch (err) {
            console.warn(`Failed to fetch Wikipedia card for "${word}":`, err);
        }
    }

    return container.outerHTML;
}

/* Optional: inject some basic styles for ET cards */
(function injectStyles(){
    if (document.getElementById('et-styles')) return;
    const style = document.createElement('style');
    style.id = 'et-styles';
    style.textContent = `
        .et-response-container { margin: 12px 0; font-family: Arial, sans-serif; }
        .et-response-text { margin-bottom: 8px; color: #E0E0E0; font-size: 14px; }
        .wiki-result-container { margin: 6px 0; }
    `;
    document.head.appendChild(style);
})();
