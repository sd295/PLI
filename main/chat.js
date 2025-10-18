document.addEventListener('DOMContentLoaded', () => {
    // Get references to the HTML elements
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const modelTitle = document.getElementById('model-title');
    const pliBtn = document.getElementById('pli-btn');
    const gemmaBtn = document.getElementById('gemma-btn');

    // --- MODEL AND API CONFIGURATION ---
    let currentModel = 'pli6lte'; // 'pli6lte' or 'gemma3'
    // Ensure pliApiUrl ends with a slash if your Python server expects it: '/r/'
    const pliApiUrl = 'https://fhf567456745.pythonanywhere.com/r/';
    const gemmaApiKey = 'AIzaSyCE_M4RAxmxpihamBObxP22WS6o20RqcIw'; // <-- PASTE YOUR GOOGLE AI API KEY HERE
    const gemmaApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${gemmaApiKey}`;

    const commands = {
        'weather': {
            folder: 'weather',
            script: 'weather.js'
        },
        // --- ADD THESE LINES ---
        'remind': { // This will catch "remind me to..."
            folder: 'reminder',
            script: 'reminder.js'
        },
        'remember': { // This will catch "remember to..."
            folder: 'reminder',
            script: 'reminder.js'
        }
    };

    // --- EVENT LISTENERS ---
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

    if (pliBtn) pliBtn.addEventListener('click', () => switchModel('pli6lte'));
    if (gemmaBtn) gemmaBtn.addEventListener('click', () => switchModel('gemma3'));

    // --- MAIN LOGIC ---

    async function getBotResponse(messageText) {
        showTypingIndicator();
        logEachWord(messageText);

        const commandResponse = await handleCommand(messageText);

        if (commandResponse !== null) {
            hideTypingIndicator();
            addMessageToChatbox('Local Command', commandResponse);
            return;
        }

        let finalResponse = '';
        let finalSender = 'bot';

        if (currentModel === 'pli6lte') {
            let pliResponse = await getPliResponse(messageText);
            const unhelpfulContent = [
                "I'm not sure about",
                "I couldn't solve that math problem.",
                "That's a great question about"
            ];

            if (pliResponse === null || unhelpfulContent.some(phrase => pliResponse.startsWith(phrase))) {
                finalResponse = await getGemmaResponse(messageText);
                finalSender = 'Gemini';
            } else {
                finalResponse = pliResponse;
                finalSender = 'PLI 7b2';
            }
        } else {
            finalResponse = await getGemmaResponse(messageText);
            finalSender = 'Gemini';
        }

        hideTypingIndicator();
        if (finalResponse) {
            addMessageToChatbox(finalSender, finalResponse);
        } else {
            addMessageToChatbox('**System**', 'Sorry, **all services** seem to be **unavailable** at the moment.');
        }
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
                    return `Error: The '${commandWord}' command is not configured correctly.`;
                } catch (error) {
                    console.error(`Error executing command '${commandWord}':`, error);
                    return `Sorry, an error occurred while running the '${commandWord}' command.`;
                }
            }
        }
        return null;
    }

    // --- API HELPER FUNCTIONS ---

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

    async function getGemmaResponse(messageText) {
        if (!gemmaApiKey || gemmaApiKey === 'YOUR_GOOGLE_AI_API_KEY') {
            return 'Please add your Google AI API key to use the Gemma model.';
        }
        try {
            const response = await fetch(gemmaApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: messageText }] }]
                }),
            });
            if (!response.ok) throw new Error(`API request failed: ${response.status}`);
            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemma API Error:', error);
            return 'Old API. **PLI7 is build on PLI6 so it has any older bugs**';
        }
    }

    // --- UI & HISTORY FUNCTIONS ---

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

        const formattedText = formatMessageText(text);

        messageElement.innerHTML = (sender !== 'user' && sender !== 'Local Command')
            ? `<strong style="color: #9333ea;">${sender}:</strong> ${formattedText}`
            : formattedText;

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
            if (modelTitle) modelTitle.textContent = 'PLI 7 when he wants  (when not PLI6)';
            if (pliBtn) pliBtn.classList.add('active');
            if (gemmaBtn) gemmaBtn.classList.remove('active');
            addMessageToChatbox('PLI 7b1', 'LTE model ready.');
        } else {
            if (modelTitle) modelTitle.textContent = 'Gemma 3 (Direct)';
            if (gemmaBtn) gemmaBtn.classList.add('active');
            if (pliBtn) pliBtn.classList.remove('active');
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
    // Check if the browser supports notifications
    if (!("Notification" in window)) {
        console.log("This **browser** does not **support desktop notification.**");
        return;
    }

    // Check the current permission status
    if (Notification.permission !== 'denied' && Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log("**Notification permission granted.**");
            }
        });
    }
}


function logEachWord(message) {
    
    // Split the message by spaces to get an array of words
    const words = message.split(/\s+/);

    // Loop through the array and print each word
    words.forEach(word => {
        // We can also remove common punctuation for a cleaner word list
        const cleanedWord = word.replace(/[.,!?]/g, '');
        if (cleanedWord) { // Ensure we don't log empty strings
            console.log(cleanedWord);
        }
    });
    
}

// --- INITIAL SETUP ---
switchModel(currentModel);
loadChatHistory();
requestNotificationPermission(); // <-- ADD THIS LINE

});
