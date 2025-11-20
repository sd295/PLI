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
    const sendMicBtn = document.getElementById('send-mic-btn'); // Unified Button
    const audioOverlay = document.getElementById('audio-live-overlay'); // Audio Overlay

    const pliBtn = document.getElementById('connect-google-btn');
    const googleConnectButton = document.getElementById('connect-google-btn');

    // --- MODEL AND API CONFIGURATION ---
    let currentModel = 'pli6lte';
    const pliApiUrl = 'https://fhf567456745.pythonanywhere.com/r/';
    
    // API Key (Ideally move this to a backend or env variable)
    const GEMINI_API_KEY = "AIzaSyB9kpAZ7hsC0xIyStlaTk1r-bF8Q1O7U6o"; 
    // The specific model requested
    const AUDIO_MODEL_NAME = "gemini-2.5-flash-native-audio-preview-09-2025"; // 'gemini-2.5...' is not standard yet, using 2.0 Flash Exp which supports native audio

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
    }

    // --- Chat Form Listener (For Text Enter Key) ---
    if (chatForm) {
        chatForm.addEventListener('submit', function(event) {
            event.preventDefault();
            handleTextMessage();
        });
    }

    // --- Model Switch Buttons ---
    if (pliBtn) pliBtn.addEventListener('click', () => switchModel('pli6lte'));

    // --- AUDIO RECORDING SETUP ---
    setupAudioRecording();

    // --- INITIAL PAGE SETUP ---
    switchModel(currentModel);
    loadChatHistory();
    requestNotificationPermission();


    // ===================================================================================
    //  AUDIO HANDLING & RECORDING
    // ===================================================================================

    function setupAudioRecording() {
        if (!sendMicBtn) return;

        let mediaRecorder;
        let audioChunks = [];
        let pressTimer;
        let isRecording = false;
        const LONG_PRESS_MS = 500;

        // Check for getUserMedia support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn("Audio recording not supported in this browser.");
            return;
        }

        const startRecording = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    // Hide UI
                    sendMicBtn.classList.remove('recording');
                    if (audioOverlay) audioOverlay.style.display = 'none';
                    
                    // Process Audio
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Gemini accepts WebM
                    if (audioBlob.size > 0) {
                        // Visual feedback
                        addMessageToChatbox('user', '🎤 Audio sent...');
                        await sendAudioToGemini(audioBlob);
                    }

                    // Stop all tracks to release mic
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                isRecording = true;
                sendMicBtn.classList.add('recording');
                if (audioOverlay) audioOverlay.style.display = 'flex';

            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Could not access microphone. Please allow permissions.");
            }
        };

        const stopRecording = () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                isRecording = false;
            }
        };

        // --- Mouse/Touch Events for "Hold to Speak" ---

        const handleStart = (e) => {
            // If user is typing, this button is just "Send", don't record
            if (userInput.value.trim().length > 0) return;

            pressTimer = setTimeout(() => {
                startRecording();
            }, LONG_PRESS_MS);
        };

        const handleEnd = (e) => {
            clearTimeout(pressTimer);
            
            if (userInput.value.trim().length > 0) {
                // It's a text send
                handleTextMessage();
                return;
            }

            if (isRecording) {
                // It was a hold, stop recording
                stopRecording();
            } else {
                // It was a short tap, but input was empty. Focus input or trigger generic action?
                userInput.focus();
            }
        };

        // Touch
        sendMicBtn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent mouse emulation
            handleStart(e);
        });
        sendMicBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleEnd(e);
        });

        // Mouse
        sendMicBtn.addEventListener('mousedown', handleStart);
        sendMicBtn.addEventListener('mouseup', handleEnd);
        sendMicBtn.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
            if (isRecording) stopRecording();
        });
    }

    // Helper: Convert Blob to Base64
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]); // Remove "data:audio/..." prefix
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // --- GEMINI AUDIO API CALL ---
    async function sendAudioToGemini(audioBlob) {
        showTypingIndicator();
        try {
            const base64Audio = await blobToBase64(audioBlob);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${AUDIO_MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: "Listen to this audio and respond concisely." },
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

            if (!response.ok) {
                throw new Error(`Gemini API Error: ${response.statusText}`);
            }

            const data = await response.json();
            const botText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            hideTypingIndicator();
            if (botText) {
                addMessageToChatbox('Gemini Audio', botText);
                // Optional: If you want Gemini to SPEAK back, you need to use a TTS service 
                // or check if the model returned audio content (Gemini 2.0 WebSockets do this, REST usually text).
            } else {
                addMessageToChatbox('System', 'Sorry, I could not understand the audio.');
            }

        } catch (error) {
            console.error(error);
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

    async function getGeminiResponse(messageText) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`,
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

        if (moduleMessages.length > 0) {
            hideTypingIndicator();
            for (let msg of moduleMessages) {
                msg = await processExtern(msg);
                addMessageToChatbox('Local Command', msg);
            }
            const geminiShort = await getGeminiResponse(`Answer shortly about: ${messageText}, context: local commands executed.`);
            if (geminiShort) addMessageToChatbox('Gemini', geminiShort);
            return;
        }

        // 2️⃣ Fallback to PLI
        let pliResponse = await getPliResponse(messageText);
        const unhelpfulContent = ["I'm not sure about", "I couldn't solve"];

        let finalResponse = "";
        let finalSender = "";

        if (!pliResponse || unhelpfulContent.some(p => pliResponse.startsWith(p))) {
            const geminiResponse = await getGeminiResponse(messageText);
            if (geminiResponse) {
                finalResponse = geminiResponse;
                finalSender = "Gemini";
            } else {
                finalResponse = pliResponse;
                finalSender = "PLI 6 Fallback";
            }
        } else {
            finalResponse = pliResponse;
            finalSender = "PLI 7b9";
        }

        finalResponse = await processExtern(finalResponse);
        hideTypingIndicator();
        addMessageToChatbox(finalSender, finalResponse);
    }

    // 🔹 Helper to send text to extern.js
    async function processExtern(text) {
        try {
            const externModule = await import(`./extern/extern.js`);
            if (externModule.default && typeof externModule.default === 'function') {
                const result = await externModule.default(text);
                return result ?? text;
            }
        } catch (err) {
            // console.warn("Extern processing failed or missing.");
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
            '<strong style="color: #8515efff;">$1</strong>'
        );
        return formattedText.replace(/\n/g, '<br>');
    }

    function addMessageToChatbox(sender, text, images = []) {
        if (!chatBox) return;
        const messageElement = document.createElement('div');
        const senderClass = (sender === 'user') ? 'user-message' : 'bot-message';
        messageElement.classList.add('message', senderClass);
        
        const uniqueImages = [...new Set(images)].slice(0, 3);

        const textHtml = `<div>${formatMessageText(text)}</div>`;

        let imagesHtml = '';
        if (uniqueImages.length > 0) {
            imagesHtml = `<div class="image-container">` +
                uniqueImages.map(url => `<img src="${url}" alt="image" style="max-width:100%; border-radius:8px; margin-top:5px;">`).join('') +
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
            modelTitle.textContent = 'PLI 7';
            if(pliBtn) pliBtn.classList.add('active');
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
        if (!("Notification" in window)) return;
        if (Notification.permission !== 'denied' && Notification.permission !== 'granted') {
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

            // 1️⃣ Mapped commands
            if (commands[cleanedWord]) {
                const cmd = commands[cleanedWord];
                try {
                    const module = await import(`./${cmd.folder}/${cmd.script}`);
                    if (module.default) {
                        const args = words.slice(i + 1).join(' ');
                        wordResult = await module.default(args);
                    }
                } catch (err) {}
                results.push({ word: cleanedWord, result: wordResult });
                continue;
            }

            // 2️⃣ Dynamic module
            try {
                const module = await import(`./${cleanedWord}/${cleanedWord}.js`);
                if (module.default) {
                    const extraArgs = words.slice(i + 1);
                    wordResult = await module.default(extraArgs);
                }
                results.push({ word: cleanedWord, result: wordResult });
            } catch (err) {
                results.push({ word: cleanedWord, result: null });
            }
        }

        return results;
    }

});