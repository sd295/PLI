/**
 * the.js
 * Fetches Wikipedia data for a specific term.
 * INCLUDES STRICT SENTENCE DETECTION to avoid triggering on chat.
 */

export default async function the(extraArgs = [], targetSelector = '#chat-box') {
    // Ensure args is an array and clean punctuation
    const args = (Array.isArray(extraArgs) ? extraArgs : [extraArgs])
        .map(arg => String(arg).replace(/[.,!?]/g, ''));

    // 1. CHECK WORD COUNT (After the trigger)
    // Specific entities usually have 1 or 2 words (e.g., "Elon Musk", "The Moon").
    // If there are more than 2 words after the trigger, it's likely a sentence.
    if (args.length > 2) {
        console.log("Wiki skipped: Too many words (likely a sentence).");
        return;
    }

    // 2. SENTENCE GUARD (The "Anti-Chat" Filter)
    // If the arguments contain verbs, pronouns, or connection words, it's a sentence.
    // Example: "clean the dog" -> 'clean' is a blocker.
    // Example: "help me" -> 'me' is a blocker.
    const sentenceBlockers = [
        'me', 'you', 'him', 'her', 'us', 'them', 'my', 'your',
        'is', 'are', 'was', 'were', 'be',
        'help', 'clean', 'make', 'do', 'did', 'go', 'run',
        'to', 'for', 'with', 'from', 'by', 'about',
        'please', 'hello', 'hi', 'hey'
    ];

    const hasSentenceWords = args.some(word => sentenceBlockers.includes(word.toLowerCase()));
    if (hasSentenceWords) {
        console.log("Wiki skipped: Detected sentence structure.");
        return;
    }

    // Join words for the search
    const searchTerm = args.join(' ').trim();

    // 3. STOP WORD CHECK (Target shouldn't be just a stop word)
    const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'of', 'and', 'or'];
    if (!searchTerm || stopWords.includes(searchTerm.toLowerCase())) {
        return; 
    }

    try {
        // Step 1: Search Wikipedia
        const pageTitle = await searchWikipedia(searchTerm);
        if (!pageTitle) {
            console.log(`No Wikipedia page found for "${searchTerm}".`);
            return;
        }

        // Step 2: Fetch summary
        const wikiData = await fetchWikipediaSummary(pageTitle);
        if (!wikiData) return;

        const wikiElement = createWikiElement(wikiData);
        insertElement(wikiElement, targetSelector);

    } catch (err) {
        console.error(err);
    }
}

/* ====================== Wikipedia API Helpers ====================== */

async function searchWikipedia(term) {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return null;
        const data = await response.json();
        const results = data.query?.search || [];
        if (results.length === 0) return null;

        // Prefer exact match
        const exactMatch = results.find(r => r.title.toLowerCase() === term.toLowerCase());
        return exactMatch ? exactMatch.title : results[0].title;
    } catch (err) {
        return null;
    }
}

async function fetchWikipediaSummary(title) {
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return null;
        const data = await response.json();

        if (data.type === 'disambiguation') return null;

        return {
            title: data.title,
            highlight: data.extract || data.description || 'No description available.',
            links: extractKeywords(data.extract),
            images: {
                thumbnail: data.thumbnail?.source || null,
                original: data.originalimage?.source || null,
            },
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        };
    } catch (err) {
        return null;
    }
}

/* ====================== UI Helpers ====================== */

function createWikiElement(data) {
    injectStyles();
    const container = document.createElement('div');
    container.className = 'wiki-result-container';

    container.innerHTML = `
        <div class="wiki-result">
            ${data.images.thumbnail || data.images.original ? `
                <a href="${data.url}" target="_blank" rel="noopener noreferrer" class="wiki-image-link">
                    <img src="${data.images.original || data.images.thumbnail || 'https://via.placeholder.com/400x200?text=No+Image'}"
                         alt="${escapeHtml(data.title)}"
                         class="wiki-image" loading="lazy">
                    
                </a>` : ''}
            
        </div>
    `;
    attachEventListeners(container);
    return container;
}

function highlightLinks(text, links, pageTitle) {
    if (!links || links.length === 0) return escapeHtml(text);
    let highlightedText = escapeHtml(text);
    const sortedLinks = [...links].sort((a, b) => b.length - a.length);
    
    sortedLinks.forEach(link => {
        if (link.toLowerCase() === pageTitle.toLowerCase()) return; 
        const escapedLink = escapeHtml(link);
        const regex = new RegExp(`\\b(${escapeRegex(escapedLink)})\\b`, 'g');
        highlightedText = highlightedText.replace(regex, `<span class="wiki-link" data-word="${escapedLink}">$1</span>`);
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
            await the([word]); 
            e.target.classList.remove('wiki-link-loading');
        });
    });
}

function insertElement(el, targetSelector = '#chat-box') {
    const target = document.querySelector(targetSelector);
    if (!target) { document.body.appendChild(el); return; }
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
    const words = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const commonWords = ['The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'Of', 'To', 'From', 'With'];
    return [...new Set(words.filter(w => !commonWords.includes(w)))];
}

function injectStyles() {
    if (document.getElementById('wiki-result-styles')) return;
    const style = document.createElement('style');
    style.id = 'wiki-result-styles';
    style.textContent = `
        .wiki-result-container { width: 100%; max-width: 700px; margin: 10px auto; }
        .wiki-result { padding: 16px; background: #000000ff; color: White; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-family: Arial, sans-serif; margin: 10px 0; }
        .wiki-image-link { display: block; position: relative; overflow: hidden; border-radius: 8px; margin-bottom: 16px; text-decoration: none; cursor: pointer; }
        .wiki-image { width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block; transition: transform 0.3s ease; }
        .wiki-image-link:hover .wiki-image { transform: scale(1.05); }
        .wiki-image-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); color: white; padding: 12px; transform: translateY(100%); transition: transform 0.3s ease; }
        .wiki-image-link:hover .wiki-image-overlay { transform: translateY(0); }
        .wiki-title { font-size: 24px; font-weight: 700; color: #ffffffff; margin: 0 0 12px 0; line-height: 1.2; }
        .wiki-text { font-size: 14px; line-height: 1.5; color: #e0e0e0ff; margin-bottom: 12px; }
        .wiki-link { color: #5a1e9e; font-weight: 600; cursor: pointer; text-decoration: none; border-bottom: 2px solid transparent; transition: all 0.2s ease; padding: 2px 4px; border-radius: 3px; display: inline-block; }
        .wiki-link:hover { background-color: rgba(220,38,38,0.1); border-bottom-color: #440e5fff; }
        .wiki-link-loading { opacity: 0.6; cursor: wait; pointer-events: none; }
        .wiki-external-link { display: inline-flex; align-items: center; gap: 6px; color: #2563eb; text-decoration: none; font-weight: 500; font-size: 13px; padding: 6px 12px; border: 2px solid #2563eb; border-radius: 6px; transition: all 0.3s ease; }
        .wiki-external-link:hover { background-color: #34203bff; color: white; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(37,99,235,0.3); }
        .wiki-error { padding: 20px; text-align: center; color: #666; font-style: italic; font-size: 14px; }
    `;
    document.head.appendChild(style);
}