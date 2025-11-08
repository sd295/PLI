/**
 * the.js
 * Fetches Wikipedia data for a specific term (model, person, etc.)
 * Prefers exact matches and renders a styled card inside #chat-box
 */

export default async function the(extraArgs = [], targetSelector = '#chat-box') {
    const searchTerm = extraArgs[0];

    const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'by', 'for', 'of', 'to', 'from', 'with'];
    if (!searchTerm || stopWords.includes(searchTerm.toLowerCase())) {
        insertElement(createErrorElement('Please provide a valid keyword.'), targetSelector);
        return;
    }

    try {
        // Step 1: Search Wikipedia for the term
        const pageTitle = await searchWikipedia(searchTerm);
        if (!pageTitle) {
            insertElement(createErrorElement(`No Wikipedia page found for "${searchTerm}".`), targetSelector);
            return;
        }

        // Step 2: Fetch summary for the exact page
        const wikiData = await fetchWikipediaSummary(pageTitle);
        if (!wikiData) {
            insertElement(createErrorElement('Failed to fetch Wikipedia data.'), targetSelector);
            return;
        }

        const wikiElement = createWikiElement(wikiData);
        insertElement(wikiElement, targetSelector);

    } catch (err) {
        console.error(err);
        insertElement(createErrorElement('An error occurred while fetching Wikipedia data.'), targetSelector);
    }
}

/* ====================== Wikipedia API Helpers ====================== */

/**
 * Search Wikipedia for a term and return the best matching page title
 */
async function searchWikipedia(term) {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Search API error: ${response.status}`);
        const data = await response.json();
        const results = data.query?.search || [];

        if (results.length === 0) return null;

        // Prefer exact match
        const exactMatch = results.find(r => r.title.toLowerCase() === term.toLowerCase());
        return exactMatch ? exactMatch.title : results[0].title;

    } catch (err) {
        console.error('Search failed:', err);
        return null;
    }
}

/**
 * Fetch summary and images for a Wikipedia page
 */
async function fetchWikipediaSummary(title) {
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Summary API error: ${response.status}`);
        const data = await response.json();

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
        console.error('Fetch summary failed:', err);
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
                    <div class="wiki-image-overlay"><span>View on Wikipedia </span></div>
                </a>` : ''}
            <h2 class="wiki-title">${escapeHtml(data.title)}</h2>
            <div class="wiki-text">${highlightLinks(data.highlight, data.links, data.title)}</div>
            <a href="${data.url}" target="_blank" rel="noopener noreferrer" class="wiki-external-link">
                Read full article on Wikipedia 
            </a>
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
        if (link.toLowerCase() === pageTitle.toLowerCase()) return; // skip highlighting page title
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

            await the([word]); // recursively fetch the new word

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
