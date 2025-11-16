// --- MODULE IMPORTS ---
import { initGoogleClients, loadGoogleScripts } from './reminder/googleAuth.js';
import { promptForGoogleConnection } from './reminder/reminder.js';

// --- SINGLE DOMContentLoaded LISTENER ---
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENT REFERENCES ---
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const modelTitle = document.getElementById('model-title');

    const pliBtn = document.getElementById('connect-google-btn');
    const googleConnectButton = document.getElementById('connect-google-btn');

    // --- MODEL AND API CONFIGURATION ---
    let currentModel = 'pli6lte';
    const pliApiUrl = 'https://fhf567456745.pythonanywhere.com/r/';

    // --- COMMAND CONFIGURATION ---
    const commands = {
        'weather': { folder: 'weather', script: 'weather.js' },
        'remind': { folder: 'reminder', script: 'reminder.js' },
        'remember': { folder: 'reminder', script: 'reminder.js' },
        'mirror': { folder: 'mirror', script: 'mirror.js' },
    };

    // ===================================================================================
    //  INITIALIZATION LOGIC
    // ===================================================================================

    // --- Initialize Google Calendar Connection ---
    if (googleConnectButton) {
        googleConnectButton.addEventListener('click', () => {
            promptForGoogleConnection();
        });

        console.log("Loading Google API scripts...");
        loadGoogleScripts().then(() => {
            console.log("Scripts loaded successfully. Initializing Google clients...");
            initGoogleClients((isAuthorized) => {
                if (isAuthorized) {
                    console.log("Google Calendar is connected and authorized.");
                    googleConnectButton.textContent = "Calendar Connected";
                    googleConnectButton.disabled = true;
                }
            });
        }).catch(error => {
            console.error("Failed to load Google scripts.", error);
            googleConnectButton.disabled = true;
            googleConnectButton.textContent = "Google API Failed";
        });
    }

    // --- Register Service Worker ---
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.register('sw.js')
            .then(swReg => console.log('Service Worker registered', swReg))
            .catch(error => console.error('Service Worker Error', error));
    } else {
        console.warn('Push messaging not supported');
    }

    // --- Chat Form Listener ---
    if (chatForm) {
        chatForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const messageText = userInput.value.trim();
            if (messageText) {
                addMessageToChatbox('user', messageText);
                userInput.value = '';
                getBotResponse(messageText);
            }
        });
    }

    // --- Model Switch Buttons ---
    if (pliBtn) pliBtn.addEventListener('click', () => switchModel('pli6lte'));

    // --- INITIAL PAGE SETUP ---
    switchModel(currentModel);
    loadChatHistory();
    requestNotificationPermission();

    // ===================================================================================
    //  CORE FUNCTIONS
    // ===================================================================================


    // 🔥 GEMINI API — added back cleanly
    async function getGeminiResponse(messageText) {
        const apiKey = "AIzaSyB9kpAZ7hsC0xIyStlaTk1r-bF8Q1O7U6o";

        try {
            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=" + apiKey,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: messageText }] }]
                    })
                }
            );

            if (!response.ok) return null;
            const data = await response.json();

            return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

        } catch (err) {
            console.error("Gemini API error:", err);
            return null;
        }
    }


    async function getBotResponse(messageText) {
    showTypingIndicator();

    // 1️⃣ Handle dynamic word modules & extern
    const wordResults = await handleEveryWord(messageText, commands);
    const moduleMessages = wordResults.map(r => r.result).filter(r => r);

    // If local commands returned something, show them first
    if (moduleMessages.length > 0) {
        hideTypingIndicator();
        for (let msg of moduleMessages) {
            // Insert images first via extern
            msg = await processExtern(msg);
            addMessageToChatbox('Local Command', msg);
        }
        // After images displayed, call Gemini
        const geminiShort = await getGeminiResponse(`Answer shortly (1-2 sentences) about: ${messageText}, dont use emoji, respond simple, return no image and think that images are displayed so you can make reference about it, Model name PLI7 with gemini fallback`);
        if (geminiShort) addMessageToChatbox('Gemini', geminiShort);
        return;
    }

    // 2️⃣ Fallback to PLI
    let pliResponse = await getPliResponse(messageText);
    const unhelpfulContent = [
        "I'm not sure about",
        "I couldn't solve that math problem.",
        "That's a great question about"
    ];

    let finalResponse = "";
    let finalSender = "";

    if (!pliResponse || unhelpfulContent.some(p => pliResponse.startsWith(p))) {
        // Gemini backup only after images/extern
        const geminiResponse = await getGeminiResponse(`Answer shortly (1-2 sentences) about: ${messageText}`);
        if (geminiResponse) {
            finalResponse = geminiResponse;
            finalSender = "Gemini";
        } else {
            finalResponse = "Sorry, I could not generate a response.";
            finalSender = "System";
        }
    } else {
        finalResponse = pliResponse;
        finalSender = "PLI 7b8";
    }

    // 3️⃣ Extern processing
    finalResponse = await processExtern(finalResponse);

    hideTypingIndicator();
    addMessageToChatbox(finalSender, finalResponse);
}

// 🔹 Helper to send text to extern.js if available
async function processExtern(text) {
    try {
        const externModule = await import(`./extern/extern.js`);
        if (externModule.default && typeof externModule.default === 'function') {
            const result = await externModule.default(text);
            return result ?? text;
        }
    } catch (err) {
        console.warn("Extern processing failed:", err);
    }
    return text;
}


    async function getPliResponse(messageText) {
        try {
            const response = await fetch(pliApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: messageText }),
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data?.response || null;
        } catch (error) {
            console.error("PLI API Error:", error);
            return null;
        }
    }


    // ===================================================================================
    //  UI & LOCAL STORAGE
    // ===================================================================================

    function formatMessageText(text) {
        let formattedText = String(text);
        formattedText = formattedText.replace(
            /\*\*(.*?)\*\*/g,
            '<strong style="color: #8d2fe5ff;">$1</strong>'
        );
        return formattedText.replace(/\n/g, '<br>');
    }

       function addMessageToChatbox(sender, text, images = []) {
    if (!chatBox) return;
    const messageElement = document.createElement('div');
    const senderClass = (sender === 'user') ? 'user-message' : 'bot-message';
    messageElement.classList.add('message', senderClass);
    // Remove duplicate images
    const uniqueImages = [...new Set(images)].slice(1, 3); // max 3

    // Add text
    const textHtml = `<div>${formatMessageText(text)}</div>`;

    // Add images (carousel if more than 1)
    let imagesHtml = '';
    if (uniqueImages.length > 0) {
        if (uniqueImages.length === 1) {
            imagesHtml = `<img src="${uniqueImages[0]}" alt="image">`;
        } else {
            imagesHtml = `<div class="image-carousel">` +
                uniqueImages.map(url => `<img src="${url}" alt="image">`).join('') +
                `</div>`;
        }
    }

    messageElement.innerHTML = textHtml + imagesHtml;

    let finalHtml;

    // THIS IS THE NEW LOGIC:
    // If the message is from our command handler and it looks like HTML (starts with '<'),
    // then use it directly without trying to format it further.
    if (sender === 'Local Command' && String(text).trim().startsWith('<')) {
        finalHtml = text; // It's our iframe, so we trust it.
    } else {
        // For all other messages, format them as usual.
        const formattedText = formatMessageText(text);
        finalHtml = (sender !== 'user' && sender !== 'Local Command')
            ? `<strong style="color: #5f2892ff;">${sender}:</strong> ${formattedText}`
            : formattedText;
    }

    messageElement.innerHTML = finalHtml;

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
    saveChatHistory();
}



    function showTypingIndicator() {
        hideTypingIndicator();
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.classList.add('message', 'bot-message');
        indicator.innerHTML = `
            <div class="typing-indicator">
                <span>.</span><span>.</span><span>.</span>
            </div>
        `;
        chatBox.appendChild(indicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    function switchModel(model) {
        currentModel = model;
        if (chatBox) chatBox.innerHTML = '';
        localStorage.removeItem('chatHistory');

        if (model === 'pli6lte') {
            modelTitle.textContent = 'PLI 7 when he wants (when not PLI6)';
            pliBtn.classList.add('active');
        }
    }

    function saveChatHistory() {
        if (!chatBox) return;
        localStorage.setItem('chatHistory', chatBox.innerHTML);
    }

    function loadChatHistory() {
        const history = localStorage.getItem('chatHistory');
        if (history && chatBox) {
            chatBox.innerHTML = history;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    function requestNotificationPermission() {
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications.");
            return;
        }

        if (Notification.permission !== 'denied' && Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log("Notification permission granted.");
                }
            });
        }
    }


    // ===================================================================================
    //  WORD HANDLER / DYNAMIC MODULE LOADER / EXTERN
    // ===================================================================================

    async function handleEveryWord(messageText, commands = {}) {
        const words = messageText.split(/\s+/);
        const results = [];

        let externHandler = null;
        try {
            const externModule = await import(`./extern/extern.js`);
            if (externModule.default && typeof externModule.default === 'function') {
                externHandler = externModule.default;
            }
        } catch (err) {
            console.warn("No extern handler found");
        }

        if (externHandler) {
            try { await externHandler(words); } catch {}
        }

        for (let i = 0; i < words.length; i++) {
            const cleanedWord = words[i].replace(/[.,!?]/g, '').toLowerCase();
            if (!cleanedWord) continue;

            let wordResult = null;

            // 1️⃣ Check mapped commands
            if (commands[cleanedWord]) {
                const cmd = commands[cleanedWord];
                try {
                    const module = await import(`./${cmd.folder}/${cmd.script}`);
                    if (module.default && typeof module.default === 'function') {
                        const args = words.slice(i + 1).join(' ');
                        wordResult = await module.default(args);
                    }
                } catch (err) {}
                results.push({ word: cleanedWord, result: wordResult });

                if (externHandler) { try { await externHandler(cleanedWord); } catch {} }

                continue;
            }

            // 2️⃣ Dynamic module after number
            const numValue = parseFloat(cleanedWord);
            if (!isNaN(numValue) && i + 1 < words.length) {
                const nextWord = words[i + 1].replace(/[.,!?]/g, '').toLowerCase();
                try {
                    const module = await import(`./${nextWord}/${nextWord}.js`);
                    if (module.default && typeof module.default === 'function') {
                        const extraArgs = words.slice(i + 2);
                        wordResult = await module.default(numValue, extraArgs);
                    }
                    results.push({ word: cleanedWord, number: numValue, module: nextWord, result: wordResult });
                    i++;
                } catch (err) {
                    results.push({ word: cleanedWord, result: null });
                }

                if (externHandler) { try { await externHandler(cleanedWord); } catch {} }

                continue;
            }

            // 3️⃣ Dynamic module by folder
            try {
                const module = await import(`./${cleanedWord}/${cleanedWord}.js`);
                if (module.default && typeof module.default === 'function') {
                    const extraArgs = words.slice(i + 1);
                    wordResult = await module.default(extraArgs);
                }
                results.push({ word: cleanedWord, result: wordResult });
            } catch (err) {
                results.push({ word: cleanedWord, result: null });
            }

            if (externHandler) { try { await externHandler(cleanedWord); } catch {} }
        }

        return results;
    }

    // --- FINAL INIT ---
    switchModel(currentModel);
    loadChatHistory();
    requestNotificationPermission();
});
