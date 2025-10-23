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
    const gemmaBtn = document.getElementById('gemma-btn'); // left in, even if unused
    const pliBtn = document.getElementById('google-connect-btn');
    const googleConnectButton = document.getElementById('google-connect-btn');

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
    } else {
        console.warn("Button with ID 'pli-btn' not found. Calendar features disabled.");
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
    if (gemmaBtn) gemmaBtn.addEventListener('click', () => switchModel('gemma3')); // left, may error

    // --- INITIAL PAGE SETUP ---
    switchModel(currentModel);
    loadChatHistory();
    requestNotificationPermission();

    // ===================================================================================
    //  CORE FUNCTIONS
    // ===================================================================================

    async function getBotResponse(messageText) {
    showTypingIndicator();

    // 1️⃣ Run dynamic word handler first
    const wordResults = await handleEveryWord(messageText, commands);

    // Collect any outputs from modules
    const moduleMessages = wordResults
        .map(r => r.result)
        .filter(r => r); // remove null/undefined

    if (moduleMessages.length > 0) {
        hideTypingIndicator();
        moduleMessages.forEach(msg => addMessageToChatbox('Local Command', msg));
        return;
    }

    // 2️⃣ Fallback PLI response
    let pliResponse = await getPliResponse(messageText);
    const unhelpfulContent = [
        "I'm not sure about",
        "I couldn't solve that math problem.",
        "That's a great question about"
    ];

    let finalResponse = '';
    let finalSender = 'bot';

    if (!pliResponse || unhelpfulContent.some(phrase => pliResponse.startsWith(phrase))) {
        // Gemini removed intentionally
        finalResponse = "Gemini removed (error left intentionally)";
        finalSender = 'Gemini';
    } else {
        finalResponse = pliResponse;
        finalSender = 'PLI 7b4';
    }

    hideTypingIndicator();
    addMessageToChatbox(finalSender, finalResponse);
}

    async function handleCommand(messageText) {
        const lowerCaseMessage = messageText.toLowerCase();

        for (const commandWord of Object.keys(commands)) {
            if (lowerCaseMessage.includes(commandWord)) {
                const command = commands[commandWord];
                const scriptPath = `./${command.folder}/${command.script}`;

                try {
                    const commandModule = await import(scriptPath);
                    if (commandModule.default && typeof commandModule.default === 'function') {
                        const commandIndex = lowerCaseMessage.indexOf(commandWord);
                        const args = messageText.substring(commandIndex + commandWord.length).trim();
                        const result = commandModule.default(args);
                        return (result instanceof Promise) ? await result : result;
                    }
                    return `Error: '${commandWord}' command not configured correctly.`;
                } catch (error) {
                    console.error(`Error executing command '${commandWord}':`, error);
                    return `Sorry, an error occurred while running '${commandWord}'.`;
                }
            }
        }
        return null;
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

    // --- Gemini removed here ---
    // async function getGemmaResponse(...) deleted intentionally

    // ===================================================================================
    //  UI & LOCAL STORAGE
    // ===================================================================================

    function formatMessageText(text) {
        let formattedText = String(text); // Ensure text is a string
        formattedText = formattedText.replace(
            /\*\*(.*?)\*\*/g,
            '<strong style="color: #8d2fe5ff;">$1</strong>'
        );
        return formattedText.replace(/\n/g, '<br>');
    }

    function addMessageToChatbox(sender, text) {
    if (!chatBox) return;
    const messageElement = document.createElement('div');
    const senderClass = (sender === 'user') ? 'user-message' : 'bot-message';
    messageElement.classList.add('message', senderClass);

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
            ? `<strong style="color: #9333ea;">${sender}:</strong> ${formattedText}`
            : formattedText;
    }

    messageElement.innerHTML = finalHtml;

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
    saveChatHistory();
}

    function showTypingIndicator() {
        if (!chatBox || document.getElementById('typing-indicator')) return;
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.classList.add('message', 'bot-message');
        indicator.innerHTML = '<div class="typing-indicator"><span>.</span><span>.</span><span>.</span></div>';
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
            if (gemmaBtn) gemmaBtn.classList.remove('active');
            addMessageToChatbox('PLI 7b4', 'LTE model ready.');
        } else {
            // this part intentionally left broken
            modelTitle.textContent = 'Gemma 3 (Direct)';
            if (gemmaBtn) gemmaBtn.classList.add('active');
            pliBtn.classList.remove('active');
            addMessageToChatbox('Gemini', 'Ask me anything!');
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

async function handleEveryWord(messageText, commands = {}) {
    const words = messageText.split(/\s+/);
    const results = [];

    for (let i = 0; i < words.length; i++) {
        const cleanedWord = words[i].replace(/[.,!?]/g, '').toLowerCase();
        if (!cleanedWord) continue;

        console.log(`Processing word: "${cleanedWord}"`);
        let wordResult = null;

        // 1️⃣ Check mapped commands first
        if (commands[cleanedWord]) {
            const cmd = commands[cleanedWord];
            try {
                const module = await import(`./${cmd.folder}/${cmd.script}`);
                if (module.default && typeof module.default === 'function') {
                    const args = words.slice(i + 1).join(' ');
                    wordResult = await module.default(args);
                    console.log(`✅ Command "${cleanedWord}" executed with result:`, wordResult);
                }
            } catch (err) {
                console.error(`⚠ Failed to run command "${cleanedWord}":`, err);
            }
            results.push({ word: cleanedWord, result: wordResult });
            continue;
        }

        // 2️⃣ Detect number + next word (dynamic)
        const numValue = parseFloat(cleanedWord);
        if (!isNaN(numValue) && i + 1 < words.length) {
            const nextWord = words[i + 1].replace(/[.,!?]/g, '').toLowerCase();
            try {
                const module = await import(`./${nextWord}/${nextWord}.js`);
                if (module.default && typeof module.default === 'function') {
                    const extraArgs = words.slice(i + 2); // rest of sentence
                    wordResult = await module.default(numValue, extraArgs);
                    console.log(`✅ Dynamic module "${nextWord}" executed with number:`, numValue);
                    results.push({ word: cleanedWord, number: numValue, module: nextWord, result: wordResult });
                    i++; // skip the next word since it was used as module
                    continue;
                }
            } catch (err) {
                console.error(`❌ No folder/module found for word "${nextWord}" at path "./${nextWord}/${nextWord}.js"`);
            }
        }

        // 3️⃣ Dynamic import for any word
        try {
            const module = await import(`./${cleanedWord}/${cleanedWord}.js`);
            if (module.default && typeof module.default === 'function') {
                const extraArgs = words.slice(i + 1);
                wordResult = await module.default(extraArgs);
                console.log(`✅ Dynamically imported folder "${cleanedWord}" executed.`);
            }
            results.push({ word: cleanedWord, result: wordResult });
            continue;
        } catch (err) {
            console.error(`❌ No folder/module found for word "${cleanedWord}" at path "./${cleanedWord}/${cleanedWord}.js"`);
            results.push({ word: cleanedWord, result: null });
        }
    }

    return results;
}


    // --- FINAL INIT ---
    switchModel(currentModel);
    loadChatHistory();
    requestNotificationPermission();
});
