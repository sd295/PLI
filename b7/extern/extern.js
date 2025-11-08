/**
 * the.js
 * - For single-word queries, fetches a Wikipedia card.
 * - For multi-word queries, validates each word, then passes the prompt to et.js for a response.
 */

// NEW: Import the processing function from your local et.js file
import processPromptFromEt from './et.js';

const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'by', 'for', 'of', 'to', 'from', 'with', 'is', 'are'];

export default async function the(extraArgs = [], targetSelector = '#chat-box') {
    const fullSearchTerm = extraArgs.join(' ').trim();
    
    if (!fullSearchTerm) return;

    const significantWords = fullSearchTerm.split(/\s+/).map(w => w.toLowerCase()).filter(w => w.length >= 4 && !stopWords.includes(w));

    try {
        // --- Multi-word Logic (Now using et.js) ---
        if (significantWords.length > 1) {
            console.log(`[Multi-word query] Words to check: ${significantWords.join(', ')}`);
            
            const allWordsValid = await checkWordsHaveImages(significantWords);

            if (allWordsValid) {
                console.log('[Pre-check PASSED] All words are valid. Delegating to et.js...');
                
                // NEW: Call the function imported from et.js
                const etData = await processPromptFromEt(fullSearchTerm);

                if (etData && etData.text) {
                    // Use the more generic element creator
                    const responseElement = createResponseElement(etData, fullSearchTerm);
                    insertElement(responseElement, targetSelector);
                }
            } else {
                console.warn(`[Pre-check FAILED] Not all words had a valid page with an image. Aborting.`);
            }
        
        // --- Single-word Wikipedia Logic ---
        } else if (fullSearchTerm.length >= 4 && !stopWords.includes(fullSearchTerm.toLowerCase())) {
            await handleSingleWordQuery(fullSearchTerm, targetSelector);
        }
        
    } catch (err) {
        console.error(err);
        insertElement(createErrorElement('An unexpected error occurred during processing.'), targetSelector);
    }
}


/* ====================== Main Logic Helpers ====================== */

async function handleSingleWordQuery(searchTerm, targetSelector) {
    const pageTitle = await searchWikipedia(searchTerm);
    if (!pageTitle) return;

    const wikiData = await fetchWikipediaSummary(pageTitle);
    if (!wikiData) return;

    const wikiElement = createWikiElement(wikiData);
    insertElement(wikiElement, targetSelector);
}

async function checkWordsHaveImages(words) {
    const checks = words.map(async (word) => {
        const pageTitle = await searchWikipedia(word);
        if (!pageTitle) return false;
        const summary = await fetchWikipediaSummary(pageTitle);
        return !!summary;
    });

    const results = await Promise.all(checks);
    return results.every(isValid => isValid);
}
async function searchWikipedia(term) {
    // Using srlimit=10 to find a good match, not just the top one.
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=10&format=json&origin=*`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Search API error: ${response.status}`);
        const data = await response.json();
        const results = data.query?.search || [];

        if (results.length === 0) return null;

        // Prefer exact match, fall back to the top result
        const exactMatch = results.find(r => r.title.toLowerCase() === term.toLowerCase());
        return exactMatch ? exactMatch.title : results[0].title;

    } catch (err) {
        console.error('Search failed:', err);
        return null;
    }
}

async function fetchWikipediaSummary(title) {
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Summary API error: ${response.status}`);
        const data = await response.json();

        // NEW: Abort if no image is available.
        const hasImage = data.thumbnail?.source || data.originalimage?.source;
        if (!hasImage) {
            console.warn(`Skipping page "${title}" because it has no image.`);
            return null;
        }

        const extract = data.extract || data.description || '';
        
        // NEW: Abort if the text extract is too short to be useful.
        // Using 50 chars as a minimum for a meaningful summary.
        if (extract.trim().length < 50) {
            console.warn(`Skipping page "${title}" due to a very short extract.`);
            return null;
        }
        
        // Disambiguation Check: If the extract is short and contains disambiguation patterns, reject it.
        const lowerExtract = extract.toLowerCase();
        const isDisambiguation = (
            extract.length < 80 && 
            (lowerExtract.includes('may refer to:') || lowerExtract.includes('disambiguation') || lowerExtract.includes('list of uses'))
        );

        if (isDisambiguation) {
            console.warn(`Skipping potential disambiguation page for title: ${title}`);
            return null;
        }

        return {
            title: data.title,
            highlight: extract,
            links: extractKeywords(extract), 
            images: {
                thumbnail: data.thumbnail?.source || null,
                original: data.originalimage?.source || null,
            },
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        };
    } catch (err) {
        console.error('Fetch summary failed:', err);
        return null;
    }
}


/* ====================== UI Helpers ====================== */

/**
 * RENAMED & UPDATED: Creates the UI element for the response from et.js.
 */
function createResponseElement(data, prompt) {
    injectStyles(); // Ensures styles are present

    const container = document.createElement('div');
    container.className = 'response-card-container';
    
    container.innerHTML = `
        <div class="response-card">
            <h2 class="response-title">
                <svg class="response-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"></path></svg>
                Analysis: ${escapeHtml(prompt)}
            </h2>
            <p class="response-text">${escapeHtml(data.text)}</p>
            <div class="response-footer">Processed by et.js</div>
        </div>
    `;
    return container;
}

function createWikiElement(data) {
    // This function remains unchanged
    injectStyles();
    const container = document.createElement('div');
    container.className = 'wiki-result-container';
    const imgSrc = data.images.original || data.images.thumbnail;
    container.innerHTML = `
        <div class="wiki-result">
            <a href="${data.url}" target="_blank" rel="noopener noreferrer" class="wiki-image-link">
                <img src="${imgSrc}" alt="${escapeHtml(data.title)}" class="wiki-image" loading="lazy">
            </a>
            <h2 class="wiki-title">${escapeHtml(data.title)}</h2>
            <p class="wiki-text">${highlightLinks(data.highlight, data.links, data.title)}</p>
            <a href="${data.url}" target="_blank" class="wiki-external-link">Read more on Wikipedia</a>
        </div>
    `;
    attachEventListeners(container);
    return container;
}
// ... (highlightLinks, attachEventListeners, insertElement, createErrorElement remain unchanged)
function highlightLinks(text, links, pageTitle) {
    if (!links || links.length === 0) return escapeHtml(text);

    let highlightedText = escapeHtml(text);
    const sortedLinks = [...links].sort((a, b) => b.length - a.length);

    sortedLinks.forEach(link => {
        if (link.toLowerCase() === pageTitle.toLowerCase()) return;
        const escapedLink = escapeHtml(link);
        const regex = new RegExp(`\\b(${escapeRegex(escapedLink)})\\b`, 'g');
        highlightedText = highlightedText.replace(
            regex,
            `<span class="wiki-link" data-word="${escapedLink}">$1</span>`
        );
    });

    return highlightedText;
}

function attachEventListeners(container) {
    const links = container.querySelectorAll('.wiki-link');
    links.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const word = e.target.dataset.word;
            e.target.classList.add('wiki-link-loading');

            // Recursive call to search for the clicked word
            await the([word]);

            e.target.classList.remove('wiki-link-loading');
        });
    });
}

function insertElement(el, targetSelector = '#chat-box') {
    const target = document.querySelector(targetSelector);
    if (!target) {
        console.warn(`Target container "${targetSelector}" not found. Appending to body.`);
        document.body.appendChild(el);
        return;
    }
    // Prepend (or append depending on desired chat flow, sticking to append for now)
    target.appendChild(el);
}

function createErrorElement(msg) {
    const container = document.createElement('div');
    container.className = 'wiki-result-container';
    container.innerHTML = `<div class="wiki-result"><div class="wiki-error">${escapeHtml(msg)}</div></div>`;
    return container;
}


/* ====================== Utilities ====================== */

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKeywords(text) {
    if (!text) return [];
    // Improved regex to capture multi-word capitalized phrases (e.g., 'New York City')
    const words = text.match(/\b[A-Z][a-z\s']+(?:\s+[A-Z][a-z\s']+)*\b/g) || [];
    
    // Filter out very common, short words or single letters
    const commonWords = ['The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'Of', 'To', 'From', 'With', 'Is', 'Are', 'Was', 'Were'];
    
    return [...new Set(words.filter(w => !commonWords.includes(w) && w.length > 2))];
}


/* ====================== Style Injection (Updated) ====================== */

function injectStyles() {
    if (document.getElementById('app-shared-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-shared-styles';
    // RENAMED .gemini-* classes to .response-* for generic use
    style.textContent = `
        /* --- Wikipedia Card Styles (unchanged) --- */
        .wiki-result-container { width: 100%; max-width: 700px; margin: 10px auto; }
        .wiki-result { padding: 16px; background: #202020; color: #E0E0E0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: Arial, sans-serif; margin: 10px 0; }
        .wiki-image-link { display: block; margin-bottom: 16px; }
        .wiki-image { width: 100%; border-radius: 8px; }
        .wiki-title { font-size: 24px; color: #FFFFFF; margin: 0 0 12px 0; }
        /* ... other wiki styles are the same ... */

        /* --- NEW: Generic Response Card Styles --- */
        .response-card-container { width: 100%; max-width: 700px; margin: 10px auto; }
        .response-card {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #2E1A1A, #3E1621);
            color: #E0E0E0;
            border: 1px solid #6A4A4A;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.6);
            margin: 10px 0;
        }
        .response-title {
            display: flex; align-items: center; gap: 10px; font-size: 20px;
            font-weight: 600; color: #FFFFFF; margin: 0 0 16px 0;
            border-bottom: 1px solid #6A4A4A; padding-bottom: 12px;
        }
        .response-icon { width: 24px; height: 24px; color: #FF96A9; flex-shrink: 0; }
        .response-text { font-size: 15px; line-height: 1.6; color: #E0C0C0; margin-bottom: 16px; }
        .response-footer { text-align: right; font-size: 12px; color: #907070; font-style: italic; }
    `;
    document.head.appendChild(style);
}

