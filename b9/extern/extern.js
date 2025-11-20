// ====================== CONFIGURATION ======================

const WIKI_OUTPUT_COOLDOWN = 850;
const WIKI_DATA_CACHE_LIFETIME = 6000000; 
const MAX_IMAGES_PER_QUERY = 5;
const GEMINI_API_KEY = "AIzaSyB9kpAZ7hsC0xIyStlaTk1r-bF8Q1O7U6o"; 

// ====================== STATE & CACHING ======================

let lastOutputTimestamp = 1;
const pendingFetches = {};
const wikipediaSummaryTemporalCache = {};

const conversationBlockers = []

const commandBlockers = [
    "visualize", "3d", 
    "weather", "remind", "remember", "mirror", 
    "play", "stop", "pause" 
];

const stopWords = [
    'the', 'a', 'an', 'in', 'on', 'at', 'by', "appears", 'for', 'of', 'to', 'from', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "well", "back", "mirror", "remind", 'hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'howdy', 'goodmorning', 'goodafternoon', 'goodevening', 'welcome', 'please', 'thanks', 'thank', 'okay', 'ok', 'bye', 'goodbye', 'see', 'later', "weather", 'porn', 'porno', 'xxx', 'sex', 'nude', 'naked', 'adult', 'erotic', 'shit', 'bitch', 'asshole', 'cock', 'dick', 'boobs', 'tits', 'pussy', 'anal', 'cum', 'blowjob', 'milf', 'hentai', 'fetish', 'slut', 'whore', "nice", 'cocaine', 'heroin', 'meth', 'weed', 'marijuana', 'lsd', 'acid', 'drug', 'drugs', "seridarivus",
    "image", "images", "picture", "pictures", "photo", "photos", "show", "me", "detail", "details"
];

// ====================== CORE LOGIC ======================

export default async function the(extraArgs = [], targetSelector = '#chat-box') {

    if (Date.now() - lastOutputTimestamp < WIKI_OUTPUT_COOLDOWN) return; 

    if (!Array.isArray(extraArgs)) extraArgs = [extraArgs];
    const fullSearchTerm = extraArgs.join(' ').trim();
    if (!fullSearchTerm) return;

    const lowerTerm = fullSearchTerm.toLowerCase();
    const inputTokens = lowerTerm.split(/\s+/).map(w => w.replace(/[.,!?]/g, ''));

    // --- 1. CHECK COMMAND BLOCKERS (NEW) ---
    // If the input contains a command word, stop extern immediately.
    const isCommand = inputTokens.some(token => commandBlockers.includes(token));
    if (isCommand) {
        console.log(`Skipping Extern: Command detected ("${fullSearchTerm}")`);
        return; // RETURN NOTHING
    }

    // --- 2. CHECK CONVERSATION BLOCKERS ---
    const isConversation = inputTokens.some(token => conversationBlockers.includes(token));
    if (isConversation) {
        console.log(`Skipping Extern: Conversational word detected.`);
        return; 
    }
    // --- FIX IS HERE ---
    const words = fullSearchTerm.split(/\s+/)
        .map(w => w.replace(/[.,!?]/g, '').toLowerCase()) // Clean punctuation individually
        .filter(w => w.length >= 3 && !stopWords.includes(w));

    if (words.length === 0) {
        insertElement(createErrorElement(''), targetSelector);
        return;
    }

    try {
        const usedImages = new Set();
        const wikiCards = [];
        const maxWordsToCheck = Math.min(words.length, 6); 

        // Loop through words in the user's sentence
        for (let i = 0; i < maxWordsToCheck; i++) {
            const word = words[i];
            
            // 1. SEARCH WIKIPEDIA (Get top 3 results to avoid Movie/Disambiguation traps)
            const potentialPages = await searchWikipedia(word); 
            if (!potentialPages || potentialPages.length === 0) continue;

            // Loop through the potential pages for this word
            let foundImageForWord = false;
            
            for (const pageTitle of potentialPages) {
                if (foundImageForWord) break; // Only need 1 image per word

                // 2. Get Details & Check Image Dimensions
                const summary = await fetchWikipediaSummary(pageTitle);
                if (!summary) continue;

                const imgUrl = summary.images.original || summary.images.thumbnail;
                if (!imgUrl || usedImages.has(imgUrl)) continue;

                // 3. CHECK RELEVANCE WITH GEMINI
                const isRelevant = await validateWithGemini(fullSearchTerm, summary.title, summary.extract);
                
                if (!isRelevant) {
                    console.log(`Gemini rejected: "${summary.title}" not visual match for "${fullSearchTerm}"`);
                    continue; // Try the next Wiki result for this word
                }

                usedImages.add(imgUrl);
                wikiCards.push(summary);
                foundImageForWord = true;
            }

            if (wikiCards.length >= MAX_IMAGES_PER_QUERY) break;
        }

        if (wikiCards.length > 0) {
            lastOutputTimestamp = Date.now(); 
            const carouselEl = createCarousel(wikiCards);
            insertElement(carouselEl, targetSelector);
        } else {
            insertElement(createErrorElement(''), targetSelector);
        }

    } catch (err) {
        console.error("Extern Error:", err);
        insertElement(createErrorElement('An unexpected error occurred.'), targetSelector);
    }
}

// ====================== GEMINI VALIDATION ======================

async function validateWithGemini(userQuery, wikiTitle, wikiExtract) {
    try {
        const shortExtract = wikiExtract.substring(0, 150);
        
        // Prompt checks visual relevance
        const prompt = `
        Context: User wants images based on this text: "${userQuery}".
        Candidate Image Subject: "${wikiTitle}" (${shortExtract}).
        
        Task: Decide if showing an image of "${wikiTitle}" is helpful and relevant?
        - Ignore strict grammar.
        - If user asks for "Airplane", reject "Airplane!" (The Movie).
        - If user asks for "Jet", accept "Airliner" or "Passenger".
        - Dont return anything if Visualization or 3d no image nothing
        
        Reply ONLY with "YES" or "NO".
        `;

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=" + GEMINI_API_KEY,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        if (!response.ok) return true; 
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "YES";
        return text.trim().toUpperCase().includes("YES");

    } catch (e) {
        console.warn("Gemini validation failed, allowing image.", e);
        return true;
    }
}

/* ====================== DATA FETCHING ====================== */

async function fetchWikipediaSummary(title) {
    const cacheKey = title.trim();
    
    if (wikipediaSummaryTemporalCache[cacheKey] && (Date.now() - wikipediaSummaryTemporalCache[cacheKey].timestamp < WIKI_DATA_CACHE_LIFETIME)) {
        return wikipediaSummaryTemporalCache[cacheKey].data;
    }

    if (pendingFetches[cacheKey]) return pendingFetches[cacheKey];

    const fetchPromise = (async () => {
        const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) return null;
            const data = await res.json();

            // --- DIMENSION CHECK (Landscape Only) ---
            const imgData = data.originalimage || data.thumbnail;
            if (!imgData || !imgData.source) return null;

            const width = imgData.width;
            const height = imgData.height;

            if (width && height) {
                const aspectRatio = width / height;
                // < 1.3 removes Verticals, Squares, and "Fat Squares"
                if (aspectRatio < 1.3) {
                    return null; 
                }
            }

            const extract = data.extract || '';
            if (extract.length < 20) return null;

            const summary = {
                title: data.title,
                extract: extract,
                url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
                images: { thumbnail: data.thumbnail?.source || null, original: data.originalimage?.source || null }
            };

            wikipediaSummaryTemporalCache[cacheKey] = { data: summary, timestamp: Date.now() };
            return summary;
        } catch (error) {
            return null;
        } finally {
            delete pendingFetches[cacheKey];
        }
    })();

    pendingFetches[cacheKey] = fetchPromise;
    return fetchPromise;
}

// Returns top 3 results
async function searchWikipedia(term) { 
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=3&format=json&origin=*`; 
    try { 
        const res = await fetch(apiUrl); 
        if (!res.ok) return null; 
        const data = await res.json(); 
        const results = data.query?.search || []; 
        if (results.length === 0) return null; 
        return results.map(r => r.title); 
    } catch { return null; } 
}

/* ====================== UI HELPERS (Unchanged) ====================== */

function createCarousel(cards) { 
    if (!cards || !cards.length) return null; 
    const container = document.createElement('div'); 
    container.className = 'wiki-carousel-container'; 
    container.innerHTML = cards.map((card, i) => { 
        const imgSrc = card.images?.original || card.images?.thumbnail || ''; 
        return ` <div class="wiki-card ${i === 0 ? 'active' : ''}"> <a href="${card.url}" target="_blank" rel="noopener noreferrer"> <img src="${imgSrc}" alt="${escapeHtml(card.title)}"/> </a> <h3><a href="${card.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(card.title)}</a></h3> </div> `; 
    }).join(''); 

    if (cards.length > 1) { 
        const prevBtn = document.createElement('button'); prevBtn.textContent = '⟨'; prevBtn.className = 'carousel-prev'; 
        const nextBtn = document.createElement('button'); nextBtn.textContent = '⟩'; nextBtn.className = 'carousel-next'; 
        container.appendChild(prevBtn); container.appendChild(nextBtn); 
        const allCards = container.querySelectorAll('.wiki-card'); 
        let current = 0; 
        function showCard(index) { allCards.forEach((c, i) => c.classList.toggle('active', i === index)); } 
        prevBtn.addEventListener('click', () => { current = (current - 1 + cards.length) % cards.length; showCard(current); }); 
        nextBtn.addEventListener('click', () => { current = (current + 1) % cards.length; showCard(current); }); 
    } 
    injectCarouselStyles(); 
    return container; 
}

function insertElement(el, targetSelector = '#chat-box') { 
    if (!el) return; 
    const target = document.querySelector(targetSelector); 
    if (!target) { document.body.appendChild(el); } else { target.appendChild(el); } 
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

function injectCarouselStyles() { 
    if (document.getElementById('wiki-carousel-styles')) return; 
    const style = document.createElement('style'); 
    style.id = 'wiki-carousel-styles'; 
    style.textContent = ` 
    .wiki-carousel-container { position: relative; width: 100%; max-width: 700px; margin: 10px auto; overflow: hidden; min-height: 350px; max-height: 350px; border-radius: 12px; background: #000000ff; } 
    .wiki-card { position: absolute; top: 0; left: 0; width: 100%; opacity: 0; transition: opacity 0.5s ease, transform 0.5s ease; padding: 16px; text-align: center; box-sizing: border-box; border-radius: 12px; color: #E0E0E0; } 
    .wiki-card.active { opacity: 1; z-index: 1; } 
    .wiki-card img { max-width: 100%; border-radius: 8px; margin-bottom: 12px; } 
    .wiki-card h3 { margin: 0 0 8px 0; font-size: 18px; } 
    .carousel-prev, .carousel-next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.7); color: #fff; border: none; font-size: 24px; padding: 4px 12px; cursor: pointer; border-radius: 6px; z-index: 2; } 
    .carousel-prev { left: 10px; } 
    .carousel-next { right: 10px; } 
    .carousel-prev:hover, .carousel-next:hover { background: rgba(0, 0, 0, 0.9); } 
    `; 
    document.head.appendChild(style); 
}