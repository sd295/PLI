/**
 * the.js
 * Fetches Wikipedia data and renders complete HTML (iframe-style)
 * Returns a container element ready to be inserted into DOM
 */

export default async function the(extraArgs = []) {
    const nextWord = extraArgs[0];
    
    if (!nextWord) {
        console.warn('No word found after "the"');
        return createErrorElement('No word provided');
    }

    try {
        // Fetch Wikipedia data
        const wikiData = await fetchWikipedia(nextWord);
        
        if (!wikiData) {
            return createErrorElement('No Wikipedia data found');
        }
        
        // Create and return the complete HTML element
        return createWikiElement(wikiData);
        
    } catch (error) {
        console.error('Error in the.js:', error);
        return createErrorElement('Failed to load Wikipedia data');
    }
}

/**
 * Fetch Wikipedia data
 */
async function fetchWikipedia(term) {
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
    
    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`Wikipedia API error: ${response.status}`);
        }
        
        const data = await response.json();
        const links = extractKeywords(data.extract);
        
        return {
            title: data.title,
            highlight: data.extract || data.description || 'No description available',
            links: links,
            images: {
                thumbnail: data.thumbnail?.source || null,
                original: data.originalimage?.source || null,
            },
            url: data.content_urls?.desktop?.page || 
                 `https://en.wikipedia.org/wiki/${encodeURIComponent(term)}`,
        };
    } catch (error) {
        console.error(`Failed to fetch Wikipedia data for "${term}":`, error);
        return null;
    }
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
    if (!text) return [];
    
    const words = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const commonWords = ['The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'Of', 'To', 'From', 'With'];
    const filtered = words.filter(word => !commonWords.includes(word));
    
    return [...new Set(filtered)];
}

/**
 * Create the complete wiki element with all HTML, styles, and handlers
 */
function createWikiElement(data) {
    // Create container
    const container = document.createElement('div');
    container.className = 'wiki-result-container';
    
    // Inject styles (scoped to this component)
    injectStyles();
    
    // Build HTML
    container.innerHTML = `
        <div class="wiki-result">
            ${createImageHTML(data)}
            ${createTitleHTML(data)}
            ${createTextHTML(data)}
            ${createExternalLinkHTML(data)}
        </div>
    `;
    
    // Attach event listeners
    attachEventListeners(container);
    
    return container;
}

/**
 * Create image HTML
 */
function createImageHTML(data) {
    if (!data.images.thumbnail) return '';
    
    return `
        <a href="${data.url}" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="wiki-image-link">
            <img src="${data.images.original || data.images.thumbnail}" 
                 alt="${escapeHtml(data.title)}" 
                 class="wiki-image" 
                 loading="lazy" />
            <div class="wiki-image-overlay">
                <span>View on Wikipedia →</span>
            </div>
        </a>
    `;
}

/**
 * Create title HTML
 */
function createTitleHTML(data) {
    return `<h2 class="wiki-title">${escapeHtml(data.title)}</h2>`;
}

/**
 * Create text HTML with highlighted links
 */
function createTextHTML(data) {
    const highlightedText = highlightLinks(data.highlight, data.links);
    return `<div class="wiki-text">${highlightedText}</div>`;
}

/**
 * Create external link HTML
 */
function createExternalLinkHTML(data) {
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
 * Highlight keywords as clickable red links
 */
function highlightLinks(text, links) {
    if (!links || links.length === 0) return escapeHtml(text);
    
    let highlightedText = escapeHtml(text);
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
 * Attach click event listeners to wiki-links
 */
function attachEventListeners(container) {
    const links = container.querySelectorAll('.wiki-link');
    
    links.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const word = e.target.dataset.word;
            
            // Add loading state
            link.classList.add('wiki-link-loading');
            
            // Recursively call the() with the new word
            const newElement = await the([word]);
            
            // Replace current content
            if (newElement) {
                container.parentElement.replaceChild(newElement, container);
                
                // Scroll to view
                newElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            link.classList.remove('wiki-link-loading');
        });
    });
}

/**
 * Create error element
 */
function createErrorElement(message) {
    const container = document.createElement('div');
    container.className = 'wiki-result-container';
    container.innerHTML = `
        <div class="wiki-result">
            <div class="wiki-error">${escapeHtml(message)}</div>
        </div>
    `;
    return container;
}

/**
 * Inject styles into document (only once)
 */
function injectStyles() {
    // Check if styles already injected
    if (document.getElementById('wiki-result-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'wiki-result-styles';
    style.textContent = `
        .wiki-result-container {
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
        }
        
        .wiki-result {
            padding: 24px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 20px 0;
        }
        
        /* Image Section */
        .wiki-image-link {
            display: block;
            position: relative;
            overflow: hidden;
            border-radius: 8px;
            margin-bottom: 24px;
            text-decoration: none;
            cursor: pointer;
        }
        
        .wiki-image {
            width: 100%;
            height: auto;
            max-height: 400px;
            object-fit: cover;
            display: block;
            transition: transform 0.3s ease;
        }
        
        .wiki-image-link:hover .wiki-image {
            transform: scale(1.05);
        }
        
        .wiki-image-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
            color: white;
            padding: 20px;
            transform: translateY(100%);
            transition: transform 0.3s ease;
        }
        
        .wiki-image-link:hover .wiki-image-overlay {
            transform: translateY(0);
        }
        
        .wiki-image-overlay span {
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        
        /* Title */
        .wiki-title {
            font-size: 32px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 20px 0;
            line-height: 1.2;
        }
        
        /* Text Content */
        .wiki-text {
            font-size: 16px;
            line-height: 1.7;
            color: #333;
            margin-bottom: 24px;
        }
        
        /* Clickable Red Links */
        .wiki-link {
            color: #dc2626;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
            padding: 2px 4px;
            border-radius: 3px;
            position: relative;
            display: inline-block;
        }
        
        .wiki-link:hover {
            background-color: rgba(220, 38, 38, 0.1);
            border-bottom-color: #dc2626;
        }
        
        .wiki-link:active {
            background-color: rgba(220, 38, 38, 0.2);
        }
        
        .wiki-link-loading {
            opacity: 0.6;
            cursor: wait;
            pointer-events: none;
        }
        
        .wiki-link-loading::after {
            content: '...';
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        
        /* External Link */
        .wiki-external-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            padding: 10px 18px;
            border: 2px solid #2563eb;
            border-radius: 6px;
            transition: all 0.3s ease;
        }
        
        .wiki-external-link:hover {
            background-color: #2563eb;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        /* Error State */
        .wiki-error {
            padding: 40px 20px;
            text-align: center;
            color: #666;
            font-style: italic;
            font-size: 16px;
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
            .wiki-result {
                padding: 16px;
                margin: 10px;
            }
            
            .wiki-title {
                font-size: 24px;
            }
            
            .wiki-text {
                font-size: 15px;
            }
            
            .wiki-image {
                max-height: 250px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Helper: Escape Regex
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}