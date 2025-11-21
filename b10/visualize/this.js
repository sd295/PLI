// ====================== CONFIGURATION ======================
// Using the same key provided in your main configuration
const GEMINI_API_KEY = "AIzaSyAqciKc5qZ2z7YR9WT_4tY7grXdeJ7Z1ck"; 

export default async function runCameraAI(args) {
    // 1. CLEANUP: Close existing viewers (3D or Camera)
    const existingViz = document.querySelector('.viz-container');
    if (existingViz) existingViz.remove();

    const existingCam = document.querySelector('.cam-ai-container');
    if (existingCam) existingCam.remove();

    // 2. Inject Styles specific to Camera UI
    injectCameraStyles();

    // 3. Create UI
    const container = createCameraUI();

    // 4. Append to Chat Box
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.appendChild(container);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // 5. Initialize Webcam
    await startCamera(container);

    return "Camera AI Active";
}

// ====================== UI GENERATION ======================

function createCameraUI() {
    const container = document.createElement('div');
    container.className = 'cam-ai-container';

    container.innerHTML = `
        <div class="cam-header">
            <span><span>●</span> Live Vision AI</span>
            <button class="cam-close-btn" title="Close Camera">✖</button>
        </div>
        
        <div class="cam-viewport">
            <!-- Live Video Feed -->
            <video id="cam-video" autoplay playsinline muted></video>
            
            <!-- Hidden Canvas for Screen Capture -->
            <canvas id="cam-canvas" style="display:none;"></canvas>

            <!-- Overlay -->
            <div class="cam-overlay">
                <div class="cam-response"></div>
                <div class="cam-input-wrapper">
                    <input type="text" class="cam-input" placeholder="Ask AI what it sees..." autocomplete="off">
                    <button class="cam-snap-btn">↵</button>
                </div>
            </div>
        </div>
    `;

    // --- Event Listeners ---
    const closeBtn = container.querySelector('.cam-close-btn');
    const input = container.querySelector('.cam-input');
    const snapBtn = container.querySelector('.cam-snap-btn');

    // Close / Cleanup
    closeBtn.addEventListener('click', () => {
        stopCamera(container);
        container.remove();
    });

    // Handle Enter Key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleQuery(container);
    });

    // Handle Button Click
    snapBtn.addEventListener('click', () => {
        handleQuery(container);
    });

    return container;
}

// ====================== LOGIC & API ======================

let currentStream = null;

async function startCamera(container) {
    const video = container.querySelector('#cam-video');
    const responseBox = container.querySelector('.cam-response');

    try {
        // Try to get the rear camera on mobile, or default on desktop
        const constraints = { 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        
        showResponse(container, "Camera active. Point at something and ask a question.");

    } catch (err) {
        console.error("Camera Error:", err);
        showResponse(container, "Error: Could not access camera. Please allow permissions.");
    }
}

function stopCamera(container) {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    if (container.querySelector('#cam-video')) {
        container.querySelector('#cam-video').srcObject = null;
    }
}

async function handleQuery(container) {
    const input = container.querySelector('.cam-input');
    const video = container.querySelector('#cam-video');
    const canvas = container.querySelector('#cam-canvas');
    const question = input.value.trim();

    if (!question) return;
    if (!currentStream || !video.videoWidth) {
        showResponse(container, "Camera not ready.");
        return;
    }

    // UI Updates
    input.value = "Analyzing capture...";
    input.disabled = true;
    
    // 1. Capture Screenshot
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.8); // JPEG, 80% quality

    // 2. Send to Gemini
    try {
        const answer = await askGemini(question, base64Image);
        showResponse(container, `<b>You:</b> ${question}<br><br><b>Gemini:</b> ${answer}`);
    } catch (error) {
        showResponse(container, "Error connecting to AI.");
    }

    // 3. Reset UI
    input.value = "";
    input.disabled = false;
    input.focus();
}

function showResponse(container, html) {
    const box = container.querySelector('.cam-response');
    box.innerHTML = html;
    box.style.display = 'block';
    box.scrollTop = box.scrollHeight;
}

// ====================== GEMINI API CALL ======================

async function askGemini(prompt, base64Image) {
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
    
    // Use a fast vision model
    const model = "gemini-1.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { 
                    inline_data: { 
                        mime_type: "image/jpeg", 
                        data: base64Data 
                    } 
                }
            ]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("API Error");

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
}

// ====================== CSS STYLES ======================

function injectCameraStyles() {
    if (document.getElementById('cam-ai-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'cam-ai-styles';
    style.textContent = `
        .cam-ai-container {
            width: 100%; max-width: 600px; height: 500px;
            background: #000; border-radius: 12px; margin: 10px auto;
            display: flex; flex-direction: column; overflow: hidden;
            border: 1px solid #333; position: relative; flex-shrink: 0;
        }
        .cam-header {
            padding: 10px 15px; background: #111; color: #fff;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #333; font-family: sans-serif; font-size: 14px;
            height: 40px; z-index: 10;
        }
        .cam-header span span { color: #ff4444; animation: blink 2s infinite; }
        .cam-close-btn {
            background: none; border: none; color: #888; cursor: pointer; font-size: 16px;
        }
        .cam-close-btn:hover { color: #fff; }
        
        .cam-viewport {
            flex: 1; position: relative; background: #000;
            display: flex; justify-content: center; align-items: center;
        }
        #cam-video {
            width: 100%; height: 100%; object-fit: cover;
        }
        
        .cam-overlay {
            position: absolute; bottom: 0; left: 0; right: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
            padding: 20px; display: flex; flex-direction: column; gap: 10px;
        }
        
        .cam-response {
            background: rgba(20, 20, 20, 0.9); color: #eee; padding: 10px;
            border-radius: 8px; font-size: 13px; line-height: 1.4;
            max-height: 120px; overflow-y: auto; display: none;
            border-left: 3px solid #8515efff; backdrop-filter: blur(4px);
        }

        .cam-input-wrapper {
            display: flex; gap: 10px;
        }
        .cam-input {
            flex: 1; padding: 10px 15px; border-radius: 25px;
            border: 1px solid #444; background: rgba(50, 50, 50, 0.8);
            color: white; outline: none; backdrop-filter: blur(5px);
        }
        .cam-input:focus { border-color: #8515efff; background: rgba(0,0,0,0.8); }
        
        .cam-snap-btn {
            width: 40px; height: 40px; border-radius: 50%; border: none;
            background: #8515efff; color: white; font-weight: bold; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
        }
        .cam-snap-btn:hover { background: #9d4af2; }

        @keyframes blink { 0% {opacity:1} 50% {opacity:0.5} 100% {opacity:1} }
    `;
    document.head.appendChild(style);
}