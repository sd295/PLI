/**
 * the.js
 * - For any query, fetches up to 3 images per word from Wikipedia.
 * - Displays them in a carousel style, no text.
 */

const stopWords = [
    // Articles / prepositions / common words
    'the', 'a', 'an', 'in', 'on', 'at', 'by', 'for', 'of', 'to', 'from', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "well", "back", "mirror", "remind",

    // Greetings
    'hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'howdy', 'goodmorning', 'goodafternoon', 'goodevening', 'welcome',

    // Common conversational words (optional)
    'please', 'thanks', 'thank', 'okay', 'ok', 'bye', 'goodbye', 'see', 'later',

    // Adult / NSFW / inappropriate words
    'porn', 'porno', 'xxx', 'sex', 'nude', 'naked', 'adult', 'erotic', 'fuck', 'shit', 'bitch', 'asshole', 'cock', 'dick', 'boobs', 'tits', 'pussy', 'anal', 'cum', 'blowjob', 'milf', 'hentai', 'fetish', 'slut', 'whore',

    // Drugs / illegal
    'cocaine', 'heroin', 'meth', 'weed', 'marijuana', 'lsd', 'acid', 'drug', 'drugs'
];


export default async function the(extraArgs = [], targetSelector = '#chat-box') {
    // Ensure input is array
    if (!Array.isArray(extraArgs)) extraArgs = [extraArgs];
    const fullSearchTerm = extraArgs.join(' ').trim();
    if (!fullSearchTerm) return;

    const words = fullSearchTerm.split(/\s+/)
        .map(w => w.toLowerCase())
        .filter(w => w.length >= 3 && !stopWords.includes(w));

    if (words.length === 0) {
        insertElement(createErrorElement(''), targetSelector);
        return;
    }

    try {
        const usedImages = new Set();
        const wikiCards = [];

        for (let word of words) {
            const page = await searchWikipedia(word);
            if (!page) continue;

            const summary = await fetchWikipediaSummary(page);
            if (!summary) continue;

            const imgUrl = summary.images.original || summary.images.thumbnail;
            if (!imgUrl || usedImages.has(imgUrl)) continue; // skip duplicates

            usedImages.add(imgUrl);
            wikiCards.push(summary);

            if (wikiCards.length >= 3) break; // max 3 images
        }

        if (wikiCards.length === 0) {
            insertElement(createErrorElement(''), targetSelector);
        } else {
            const carouselEl = createCarousel(wikiCards);
            insertElement(carouselEl, targetSelector);
        }

    } catch (err) {
        console.error(err);
        insertElement(createErrorElement('An unexpected error occurred.'), targetSelector);
    }
}

/* ====================== Wikipedia Helpers ====================== */

async function searchWikipedia(term) {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=5&format=json&origin=*`;
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) return null;
        const data = await res.json();
        const results = data.query?.search || [];
        if (results.length === 0) return null;
        const exact = results.find(r => r.title.toLowerCase() === term.toLowerCase());
        return exact ? exact.title : results[0].title;
    } catch {
        return null;
    }
}

async function fetchWikipediaSummary(title) {
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) return null;
        const data = await res.json();
        const image = data.thumbnail?.source || data.originalimage?.source;
        const extract = data.extract || '';
        if (!image || extract.length < 20) return null;
        return {
            title: data.title,
            extract: extract,
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
            images: { thumbnail: data.thumbnail?.source || null, original: data.originalimage?.source || null }
        };
    } catch {
        return null;
    }
}

/* ====================== UI Helpers ====================== */

function createCarousel(cards) {
    if (!cards || !cards.length) return null;

    const container = document.createElement('div');
    container.className = 'wiki-carousel-container';

    container.innerHTML = cards.map((card, i) => {
        const imgSrc = card.images?.original || card.images?.thumbnail || '';
        return `
            <div class="wiki-card ${i === 0 ? 'active' : ''}">
                <a href="${card.url}" target="_blank" rel="noopener noreferrer">
                    <img src="${imgSrc}" alt="${escapeHtml(card.title)}"/>
                </a>
                
            </div>
        `;
    }).join('');

    if (cards.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '⟨';
        prevBtn.className = 'carousel-prev';
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '⟩';
        nextBtn.className = 'carousel-next';
        container.appendChild(prevBtn);
        container.appendChild(nextBtn);

        const allCards = container.querySelectorAll('.wiki-card');
        let current = 0;

        function showCard(index) {
            allCards.forEach((c, i) => c.classList.toggle('active', i === index));
        }

        prevBtn.addEventListener('click', () => {
            current = (current - 1 + cards.length) % cards.length;
            showCard(current);
        });
        nextBtn.addEventListener('click', () => {
            current = (current + 1) % cards.length;
            showCard(current);
        });
    }

    injectCarouselStyles();
    return container;
}

function insertElement(el, targetSelector = '#chat-box') {
    const target = document.querySelector(targetSelector);
    if (!target) document.body.appendChild(el);
    else target.appendChild(el);
}

function createErrorElement(msg) {
    const div = document.createElement('div');
    div.className = 'wiki-error-container';
    div.textContent = msg;
    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ====================== Styles ====================== */

function injectCarouselStyles() {
    if (document.getElementById('wiki-carousel-styles')) return;
    const style = document.createElement('style');
    style.id = 'wiki-carousel-styles';
    style.textContent = style.textContent = `
.wiki-carousel-container {
    position: relative;
    width: 100%;
    max-width: 700px;
    margin: 10px auto;
    overflow: hidden;
    min-height: 350px; /* Prevent compression */
    border-radius: 12px;
    background: #202020;
}

.wiki-card {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    opacity: 0;
    transition: opacity 0.5s ease, transform 0.5s ease;
    padding: 16px;
    text-align: center;
    box-sizing: border-box;
    border-radius: 12px;
    color: #E0E0E0;
}

.wiki-card.active {
    opacity: 1;
    z-index: 1;
}

.wiki-card img {
    max-width: 100%;
    border-radius: 8px;
    margin-bottom: 12px;
}

.wiki-card h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
}

.wiki-card p {
    font-size: 14px;
    line-height: 1.4;
}

.carousel-prev, .carousel-next {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(50,50,50,0.7);
    color: #fff;
    border: none;
    font-size: 24px;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 6px;
    z-index: 2;
}

.carousel-prev { left: 10px; }
.carousel-next { right: 10px; }

.carousel-prev:hover, .carousel-next:hover {
    background: rgba(80,80,80,0.9);
}
`;
    document.head.appendChild(style);
}
