/**
 * renderWikiResult.js
 * Renders Wikipedia results with clickable links
 */

export function renderWikiResult(data, container, onLinkClick) {
    if (!data) {
        container.innerHTML = '<div class="wiki-error">No results found</div>';
        return;
    }

    // Create the HTML structure
    const wikiHTML = `
        <div class="wiki-result">
            ${renderImage(data)}
            ${renderTitle(data)}
            ${renderText(data)}
            ${renderExternalLink(data)}
        </div>
    `;

    container.innerHTML = wikiHTML;

    // Add event listeners for clickable links
    attachLinkListeners(container, onLinkClick);
}

function renderImage(data) {
    if (!data.images.thumbnail) return '';
    
    return `
        <a href="${data.url}" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="wiki-image-link">
            <img src="${data.images.original || data.images.thumbnail}" 
                 alt="${escapeHtml(data.title)}" 
                 class="wiki-image" />
            <div class="wiki-image-overlay">
                <span>View on Wikipedia →</span>
            </div>
        </a>
    `;
}

function renderTitle(data) {
    return `<h2 class="wiki-title">${escapeHtml(data.title)}</h2>`;
}

function renderText(data) {
    const highlightedText = highlightLinks(data.highlight, data.links);
    return `<div class="wiki-text">${highlightedText}</div>`;
}

function renderExternalLink(data) {
    return `
        <a href="${data.url}" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="wiki-external-link">
            Read full article on Wikipedia →
        </a>
    `;
}

/**
 * Highlight keywords as clickable links in red
 */
function highlightLinks(text, links) {
    if (!links || links.length === 0) return escapeHtml(text);
    
    let highlightedText = escapeHtml(text);
    
    // Sort links by length (longest first) to avoid partial replacements
    const sortedLinks = [...links].sort((a, b) => b.length - a.length);
    
    sortedLinks.forEach(link => {
        const escapedLink = escapeHtml(link);
        const regex = new RegExp(`\\b(${escapeRegex(escapedLink)})\\b`, 'g');
        highlightedText = highlightedText.replace(
            regex,
            `<span class="wiki-link" data-word="${escapedLink}">$1</span>`
        );
    });
    
    return highlightedText;
}

/**
 * Attach click event listeners to wiki-link elements
 */
function attachLinkListeners(container, onLinkClick) {
    const links = container.querySelectorAll('.wiki-link');
    
    links.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const word = e.target.dataset.word;
            
            // Add loading state
            link.classList.add('wiki-link-loading');
            
            if (onLinkClick) {
                await onLinkClick(word);
            }
            
            link.classList.remove('wiki-link-loading');
        });
    });
}

/**
 * Helper functions
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}