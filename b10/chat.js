// --- MODULE IMPORTS ---
import { initGoogleClients, loadGoogleScripts } from './reminder/googleAuth.js';
import { promptForGoogleConnection } from './reminder/reminder.js';

// --- GLOBAL CONFIGURATION ---
const CONFIG = {
    model: 'pli6lte',
    pliApiUrl: 'https://fhf567456745.pythonanywhere.com/r/',
    geminiApiKey: "AIzaSyD2IbWsTb3DhzAsTNXJEJlbvV1o4LHHRGM", 
    audioModel: "gemini-2.5-flash-native-audio-preview-09-2025",
    storageKey: 'pli7data' // Acts as the folder for your JSON data
};

// --- STATE MANAGEMENT ---
let allChats = {}; // Holds all chat sessions in JSON format
let currentChatId = null; // ID of the currently active chat

// --- SINGLE DOMContentLoaded LISTENER ---
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENT REFERENCES ---
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const modelTitle = document.getElementById('model-title');
    const sendMicBtn = document.getElementById('send-mic-btn');
    
    // --- MODEL AND API CONFIGURATION ---
    let currentModel = 'pli6lte';
    const pliApiUrl = 'https://fhf567456745.pythonanywhere.com/r/';
    
    // API Key (Ideally move this to a backend or env variable)
    const GEMINI_API_KEY = "AIzaSyD2IbWsTb3DhzAsTNXJEJlbvV1o4LHHRGM"; 
    // The specific model requested
    const AUDIO_MODEL_NAME = "gemini-2.5-flash-native-audio-preview-09-2025"; // 'gemini-2.5...' is not standard yet, using 2.0 Flash Exp which supports native audio

    
    // Sidebar Elements
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const newChatBtn = document.getElementById('new-chat-btn');
    const exportChatsBtn = document.getElementById('export-chats-btn');
    const chatListContainer = document.getElementById('chat-list');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    const googleConnectButton = document.getElementById('connect-google-btn');

    // --- COMMAND CONFIGURATION ---
    const commands = {
        'weather': { folder: 'weather', script: 'weather.js' },
        'remind': { folder: 'reminder', script: 'reminder.js' },
        'remember': { folder: 'reminder', script: 'reminder.js' },
        'mirror': { folder: 'mirror', script: 'mirror.js' },
        "visualize ": { folder: 'visualize', script: 'visualize.js' },
        "3d": { folder: 'visualize', script: 'visualize.js' },
    };

    // ===================================================================================
    //  INITIALIZATION LOGIC
    // ===================================================================================

    // 1. Load Data from "pli7data"
    loadAllChats(); 
    
    // 2. Initialize View
    if (!currentChatId) createNewChat(false); // Create default if empty
    else renderCurrentChat();

    requestNotificationPermission();

    // 3. Initialize Google Calendar
    if (googleConnectButton) {
        googleConnectButton.addEventListener('click', () => promptForGoogleConnection());
        loadGoogleScripts().then(() => {
            initGoogleClients((isAuthorized) => {
                if (isAuthorized) {
                    googleConnectButton.textContent = "Calendar Connected";
                    googleConnectButton.classList.add('active');
                    googleConnectButton.disabled = true;
                }
            });
        }).catch(error => {
            console.error("Failed to load Google scripts.", error);
            googleConnectButton.textContent = "Google API Failed";
        });
    }

    // 4. Service Worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
    }

    // ===================================================================================
    //  DATA & MEMORY MANAGEMENT (JSON HANDLING)
    // ===================================================================================

    function loadAllChats() {
        const stored = localStorage.getItem(CONFIG.storageKey);
        if (stored) {
            try {
                allChats = JSON.parse(stored);
                // Get the most recent chat ID if exists
                const ids = Object.keys(allChats);
                if (ids.length > 0) currentChatId = ids[ids.length - 1];
            } catch (e) {
                console.error("Corrupt data in pli7data", e);
                allChats = {};
            }
        }
        updateSidebarList();
    }

    function saveAllChats() {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(allChats));
        updateSidebarList();
    }

    function createNewChat(shouldClearView = true) {
        const id = Date.now().toString();
        allChats[id] = {
            title: "New Conversation",
            timestamp: Date.now(),
            messages: []
        };
        currentChatId = id;
        saveAllChats();
        if (shouldClearView) {
            renderCurrentChat();
            toggleSidebar(false);
        }
    }

    function deleteChat(id, event) {
        if(event) event.stopPropagation();
        if(confirm("Delete this chat permanently?")) {
            delete allChats[id];
            if(currentChatId === id) {
                const ids = Object.keys(allChats);
                currentChatId = ids.length > 0 ? ids[ids.length - 1] : null;
                if(!currentChatId) createNewChat();
                else renderCurrentChat();
            }
            saveAllChats();
        }
    }

    function appendMessageToMemory(sender, text, images = []) {
        if (!currentChatId || !allChats[currentChatId]) return;
        
        // Update Title based on first user message
        const chat = allChats[currentChatId];
        if (chat.messages.length === 0 && sender === 'user') {
            chat.title = text.substring(0, 25) + (text.length > 25 ? "..." : "");
        }

        chat.messages.push({
            sender: sender,
            text: text,
            images: images,
            timestamp: Date.now()
        });
        
        saveAllChats();
    }

    // --- CONTEXT BUILDER FOR AI MEMORY ---
    function buildConversationContext() {
        if (!currentChatId || !allChats[currentChatId]) return "";
        
        const history = allChats[currentChatId].messages;
        // Grab last 10 messages to avoid token overflow
        const recentHistory = history.slice(-10); 
        
        if (recentHistory.length === 0) return "";

        let contextString = "PREVIOUS CONTEXT:\n";
        recentHistory.forEach(msg => {
            const role = (msg.sender === 'user') ? "User" : "AI";
            contextString += `${role}: ${msg.text}\n`;
        });
        contextString += "\nCURRENT REQUEST:\n";
        return contextString;
    }

    // ===================================================================================
    //  UI INTERACTION
    // ===================================================================================

    function renderCurrentChat() {
        chatBox.innerHTML = ''; // Clear visual
        if (!currentChatId || !allChats[currentChatId]) return;

        const messages = allChats[currentChatId].messages;
        messages.forEach(msg => {
            // Reuse the visual rendering logic, but don't save to memory again
            renderMessageBubble(msg.sender, msg.text, msg.images);
        });
        
        // Update Active Sidebar Item
        updateSidebarList();
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function updateSidebarList() {
        if (!chatListContainer) return;
        chatListContainer.innerHTML = '';
        
        // Sort by newest first
        const sortedIds = Object.keys(allChats).sort((a, b) => b - a);

        sortedIds.forEach(id => {
            const chat = allChats[id];
            const div = document.createElement('div');
            div.className = `chat-item ${id === currentChatId ? 'active' : ''}`;
            div.innerHTML = `
                <span>${chat.title || 'Untitled Chat'}</span>
                <button class="delete-chat">✖</button>
            `;
            
            // Click to load
            div.addEventListener('click', () => {
                currentChatId = id;
                renderCurrentChat();
                toggleSidebar(false);
            });

            // Click delete
            const delBtn = div.querySelector('.delete-chat');
            delBtn.addEventListener('click', (e) => deleteChat(id, e));

            chatListContainer.appendChild(div);
        });
    }

    function toggleSidebar(show) {
        if (show) sidebar.classList.add('open');
        else sidebar.classList.remove('open');
    }

    if (menuBtn) menuBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
    if (newChatBtn) newChatBtn.addEventListener('click', () => createNewChat(true));

    // Export JSON Logic
    if (exportChatsBtn) {
        exportChatsBtn.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allChats, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "pli7data_backup.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    if (chatForm) {
        chatForm.addEventListener('submit', function(event) {
            event.preventDefault();
            handleTextMessage();
        });
    }

    setupAudioRecording();


    // ===================================================================================
    //  AUDIO HANDLING
    // ===================================================================================

     function setupAudioRecording() {
        if (!sendMicBtn) return;
        let mediaRecorder;
        let audioChunks = [];
        let pressTimer;
        let isRecording = false;
        const LONG_PRESS_MS = 400; 

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn("Audio recording not supported.");
            return;
        }

        const startRecording = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
                mediaRecorder.onstop = async () => {
                    document.body.classList.remove('is-recording');
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (audioBlob.size > 1000) { 
                        addMessageToChatbox('user', ' Voice use'); 
                        await sendAudioToGemini(audioBlob);
                    }
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorder.start();
                isRecording = true;
                document.body.classList.add('is-recording');
                if (window.navigator.vibrate) window.navigator.vibrate(50);
            } catch (err) {
                document.body.classList.remove('is-recording');
            }
        };

        const stopRecording = () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                isRecording = false;
                if (window.navigator.vibrate) window.navigator.vibrate(30);
            }
        };

        const handleStart = (e) => {
            if (userInput.value.trim().length > 0) return;
            if(e.type === 'touchstart') e.stopPropagation();
            pressTimer = setTimeout(() => startRecording(), LONG_PRESS_MS);
        };

        const handleEnd = (e) => {
            clearTimeout(pressTimer);
            e.preventDefault();
            if (userInput.value.trim().length > 0) {
                handleTextMessage();
                return;
            }
            if (isRecording) stopRecording();
            else userInput.focus();
        };

        sendMicBtn.addEventListener('touchstart', handleStart, { passive: false });
        sendMicBtn.addEventListener('touchend', handleEnd);
        sendMicBtn.addEventListener('mousedown', handleStart);
        sendMicBtn.addEventListener('mouseup', handleEnd);
        sendMicBtn.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
            if (isRecording) stopRecording();
        });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]); 
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function sendAudioToGemini(audioBlob) {
        showTypingIndicator();
        try {
            const base64Audio = await blobToBase64(audioBlob);
            // Gemini Audio gets context
            const context = buildConversationContext();

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.audioModel}:generateContent?key=${CONFIG.geminiApiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: context + "\n(The user provided the following audio. Respond concisely.)" },
                                {
                                    inline_data: {
                                        mime_type: "audio/webm",
                                        data: base64Audio
                                    }
                                }
                            ]
                        }]
                    })
                }
            );
            if (!response.ok) throw new Error("Gemini Audio API Error");
            const data = await response.json();
            const botText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            hideTypingIndicator();
            if (botText) addMessageToChatbox('Gemini Audio', botText);
            else addMessageToChatbox('System', 'Could not understand audio. This thing is Windows only');
        } catch (error) {
            hideTypingIndicator();
            addMessageToChatbox('System', 'Error processing audio.');
        }
    }

    // ===================================================================================
    //  TEXT HANDLING
    // ===================================================================================

    function handleTextMessage() {
        const messageText = userInput.value.trim();
        if (messageText) {
            addMessageToChatbox('user', messageText);
            userInput.value = '';
            getBotResponse(messageText);
        }
    }

    // Generic Gemini Fetch
    async function getGeminiResponse(fullPrompt) {
        try {
            const response = await fetch(
               "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=" + CONFIG.geminiApiKey,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }]
                    })
                }
            );
            if (!response.ok) return null;
            const data = await response.json();
            return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        } catch (err) { return null; }
    }


    async function getBotResponse(userMessage) {
        showTypingIndicator();

        // 1. Get Memory Context (Only used for Gemini)
        const context = buildConversationContext(); 

        // 2. Check Local Commands first
        const wordResults = await handleEveryWord(userMessage, commands);
        const moduleMessages = wordResults.map(r => r.result).filter(r => r);

        if (moduleMessages.length > 0) {
            hideTypingIndicator();
            for (let msg of moduleMessages) {
                msg = await processExtern(msg);
                addMessageToChatbox('Local Command', msg);
            }
            // Contextual Summary after command (Gemini gets context)
            const prompt = `${context}\nUser ran command: ${userMessage}. Answer shortly about it. Don't use emoji.`;
            const geminiShort = await getGeminiResponse(prompt);
            if (geminiShort) addMessageToChatbox('Gemini', geminiShort);
            return;
        }

        // 3. Fallback to PLI/Gemini
        
        // PLI REQUEST: NO CONTEXT, JUST MESSAGE
        let pliResponse = await getPliResponse(userMessage);
        
        const unhelpfulContent = ["I'm not sure about", "I couldn't solve", "That's a great question"];
        let finalResponse = "";
        let finalSender = "";

        if (!pliResponse || unhelpfulContent.some(p => pliResponse && pliResponse.startsWith(p))) {
            // GEMINI FALLBACK: GETS CONTEXT
            const systemInstructions = "Answer shortly (min 5 max 20 sentences).  Assume images are displayed above you.";
            const prompt = `${systemInstructions}\n\n${context}\nUser Question: ${userMessage}`;
            
            const geminiResponse = await getGeminiResponse(prompt);
            if (geminiResponse) {
                finalResponse = geminiResponse;
                finalSender = "Gemini";
            } else {
                finalResponse = pliResponse || "Offline.";
                finalSender = "PLI 6 Fallback";
            }
        } else {
            finalResponse = pliResponse;
            finalSender = "PLI 7";
        }

        finalResponse = await processExtern(finalResponse);
        hideTypingIndicator();
        addMessageToChatbox(finalSender, finalResponse);
    }

    async function processExtern(text) {
        try {
            const externModule = await import(`./extern/extern.js`);
            if (externModule.default) return (await externModule.default(text)) ?? text;
        } catch (err) {}
        return text;
    }

    async function getPliResponse(prompt) {
        try {
            const response = await fetch(CONFIG.pliApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt }),
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data?.response || null;
        } catch (error) { return null; }
    }


    // ===================================================================================
    //  DISPLAY & FORMATTING
    // ===================================================================================

    function formatMessageText(text) {
        let formattedText = String(text);
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #8515efff;">$1</strong>');
        return formattedText.replace(/\n/g, '<br>');
    }

    // Main function to add to screen AND memory
    function addMessageToChatbox(sender, text, images = []) {
        // 1. Save to JSON Memory
        appendMessageToMemory(sender, text, images);

        // 2. Render to Screen
        renderMessageBubble(sender, text, images);
    }

    // Helper just for UI (used by load history and new messages)
    function renderMessageBubble(sender, text, images = []) {
        if (!chatBox) return;
        const messageElement = document.createElement('div');
        const senderClass = (sender === 'user') ? 'user-message' : 'bot-message';
        messageElement.classList.add('message', senderClass);
        
        const uniqueImages = [...new Set(images)].slice(0, 3);
        let imagesHtml = '';
        if (uniqueImages.length > 0) {
            imagesHtml = `<div class="image-container">` +
                uniqueImages.map(url => `<img src="${url}" style="max-width:100%; border-radius:8px; margin-top:5px;">`).join('') +
                `</div>`;
        }

        let finalHtml;
        if (sender === 'Local Command' && String(text).trim().startsWith('<')) {
            finalHtml = text; 
        } else {
            const formattedText = formatMessageText(text);
            finalHtml = (sender !== 'user' && sender !== 'Local Command')
                ? `<strong style="color: #a123e4c9;">${sender}:</strong> ${formattedText}`
                : formattedText;
        }

        messageElement.innerHTML = finalHtml + imagesHtml;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function showTypingIndicator() {
        hideTypingIndicator();
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.classList.add('message', 'bot-message');
        indicator.innerHTML = `<div class="typing-indicator"><span>.</span><span>.</span><span>.</span></div>`;
        chatBox.appendChild(indicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    function requestNotificationPermission() {
        if ("Notification" in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // ===================================================================================
    //  WORD HANDLER
    // ===================================================================================

    async function handleEveryWord(messageText, commands = {}) {
        const words = messageText.split(/\s+/);
        const results = [];

        for (let i = 0; i < words.length; i++) {
            const cleanedWord = words[i].replace(/[.,!?]/g, '').toLowerCase();
            if (!cleanedWord) continue;

            let wordResult = null;
            // 1. Mapped commands
            if (commands[cleanedWord]) {
                const cmd = commands[cleanedWord];
                try {
                    const module = await import(`./${cmd.folder}/${cmd.script}`);
                    if (module.default) {
                        wordResult = await module.default(words.slice(i + 1).join(' '));
                    }
                } catch (err) {}
                results.push({ word: cleanedWord, result: wordResult });
                continue;
            }
            // 2. Dynamic
            try {
                const module = await import(`./${cleanedWord}/${cleanedWord}.js`);
                if (module.default) {
                    wordResult = await module.default(words.slice(i + 1));
                }
                results.push({ word: cleanedWord, result: wordResult });
            } catch (err) {
                results.push({ word: cleanedWord, result: null });
            }
        }
        return results;
    }


});
