// ====================== CONFIGURATION ======================
const GEMINI_API_KEY = "AIzaSyAqciKc5qZ2z7YR9WT_4tY7grXdeJ7Z1ck"; 

export default async function visualize(args = []) {
    // 1. Helper to safely get string from args
    const command = Array.isArray(args) ? args.join(' ').toLowerCase() : String(args);

    if (!command.includes('3d')) {
        return "";
    }

    // 2. SELF-CLEANUP: If a viewer is already open, close it first to prevent conflicts
    const existing = document.querySelector('.viz-container');
    if (existing) {
        existing.remove();
    }

    // 3. Load Model-Viewer Library (Only once)
    if (!customElements.get('model-viewer')) {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
        document.head.appendChild(script);
    }

    // 4. Inject Styles
    injectStyles();

    // 5. Create the Viewer UI
    const viewerContainer = createViewerUI();
    
    // 6. Append to Chat Box
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.appendChild(viewerContainer);
        // Force scroll to bottom
        setTimeout(() => {
            chatBox.scrollTop = chatBox.scrollHeight;
        }, 100);
    }

    return "";
}

// ====================== UI GENERATION ======================

function createViewerUI() {
    const container = document.createElement('div');
    container.className = 'viz-container';

    // NOTICE: We replaced most ID="" with class="" to allow reopening without conflicts
    container.innerHTML = `
        <div class="viz-header">
            <span>3D Viewer (Gemini Vision)</span>
            <div class="viz-controls">
                <button class="viz-fs-btn" title="Full Screen">⛶</button>
                <button class="viz-close-btn" title="Close">✖</button>
            </div>
        </div>
        
        <div class="viz-body viz-drop-zone">
            <!-- The 3D Model Element -->
            <model-viewer 
                class="active-model-viewer"
                src="" 
                poster="https://via.placeholder.com/400x300/000000/444444?text=Drag+3D+File+Here+(.glb)" 
                shadow-intensity="1" 
                camera-controls 
                auto-rotate
                touch-action="pan-y"
                style="width: 100%; height: 100%; background-color: #1a1a1a;"
            >
                <div slot="progress-bar"></div>
            </model-viewer>

            <!-- Overlay for Context/Questions -->
            <div class="viz-gemini-overlay">
                <div class="viz-gemini-response viz-response"></div>
                <input type="text" class="viz-gemini-input" placeholder="Ask Gemini about this model..." disabled>
            </div>
        </div>
    `;

    // --- EVENT LISTENERS (Using Classes) ---

    const dropZone = container.querySelector('.viz-drop-zone');
    const viewer = container.querySelector('.active-model-viewer');
    const input = container.querySelector('.viz-gemini-input');
    const fsBtn = container.querySelector('.viz-fs-btn');
    const closeBtn = container.querySelector('.viz-close-btn');

    // 1. Drag and Drop Logic
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#8515efff';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#333';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#333';

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
            // Revoke old URL if exists to save memory
            if (viewer.src && viewer.src.startsWith('blob:')) {
                URL.revokeObjectURL(viewer.src);
            }

            const url = URL.createObjectURL(file);
            viewer.src = url;
            viewer.poster = ''; 
            input.disabled = false; 
            addSystemMsg("Model loaded! You can now ask questions.", container);
        } else {
            addSystemMsg("Error: Please drop a .glb or .gltf file.", container);
        }
    });

    // 2. Full Screen
    fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });

    // 3. Close Logic
    closeBtn.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        
        // Cleanup Blob memory
        if (viewer.src && viewer.src.startsWith('blob:')) {
            URL.revokeObjectURL(viewer.src);
        }

        container.remove();
    });

    // 4. Gemini Vision Query
    input.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && input.value.trim() !== "") {
            const question = input.value.trim();
            input.value = "Analyzing 3D view...";
            input.disabled = true;

            try {
                const screenshotData = viewer.toDataURL('image/png');
                const answer = await askGeminiVision(question, screenshotData);
                addSystemMsg(`<b>Gemini:</b> ${answer}`, container);
            } catch (err) {
                addSystemMsg("Error taking screenshot. Model might not be ready.", container);
            }
            
            input.value = "";
            input.disabled = false;
            input.focus();
        }
    });

    return container;
}

function addSystemMsg(html, container) {
    const respBox = container.querySelector('.viz-gemini-response');
    respBox.innerHTML = html;
    respBox.style.display = 'block';
    setTimeout(() => respBox.scrollTop = respBox.scrollHeight, 100);
}

// ====================== GEMINI VISION API ======================

// ====================== GEMINI VISION API ======================

async function askGeminiVision(prompt, base64Image) {
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    // UPDATED: Using the stable, powerful PRO model.
    // If you specifically need a newer beta, try "gemini-1.5-pro-latest"
    const model = "gemini-2.5-pro"; 
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{
            parts: [
                { text: prompt + " (Analyze this 3D render. Be concise.)" },
                { 
                    inline_data: { 
                        mime_type: "image/png", 
                        data: base64Data 
                    } 
                }
            ]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            // Fallback if Pro fails: try Flash
            if (model.includes('pro')) {
                return `Error (404). 'gemini-1.5-pro' not found. Try changing code to 'gemini-1.5-flash'.`;
            }
            return `Error ${response.status}: ${response.statusText}`;
        }
        
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    } catch (err) {
        console.error("Network Error:", err);
        return "Connection failed. Check console.";
    }
}

// ====================== STYLES (Fixed Collapse Issue) ======================

function injectStyles() {
    if (document.getElementById('viz-styles')) return;
    const style = document.createElement('style');
    style.id = 'viz-styles';
    style.textContent = `
        .viz-container {
            width: 100%; max-width: 700px; height: 500px;
            background: #000; border-radius: 12px; margin: 10px auto;
            display: flex; flex-direction: column; 
            border: 1px solid #333; position: relative;
            /* KEY FIXES FOR COLLAPSE: */
            flex-shrink: 0; 
            min-height: 500px; /* Force height */
        }
        .viz-container:fullscreen {
            width: 100vw; height: 100vh; max-width: none; border: none; border-radius: 0;
        }
        .viz-header {
            padding: 10px 15px; background: #111; color: #fff;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #333; font-family: sans-serif; font-size: 14px;
            height: 40px; flex-shrink: 0;
        }
        .viz-controls button {
            background: none; border: none; color: #fff; cursor: pointer;
            font-size: 16px; margin-left: 10px; padding: 5px;
        }
        .viz-controls button:hover { color: #8515efff; }
        
        .viz-body {
            flex: 1; 
            position: relative; 
            border: 2px dashed #333; 
            box-sizing: border-box;
            min-height: 0; 
            overflow: hidden;
            display: flex; /* Ensures canvas fills space */
            flex-direction: column;
        }
        
        /* Ensure model-viewer takes full space */
        .active-model-viewer {
            width: 100%;
            height: 100%;
            flex: 1;
            background-color: #1a1a1a;
        }

        .viz-gemini-overlay {
            position: absolute; bottom: 20px; left: 20px; right: 20px; z-index: 100;
            display: flex; flex-direction: column; gap: 8px;
            pointer-events: none; /* Let clicks pass through to model when not typing */
        }
        
        /* Re-enable pointer events for inputs */
        .viz-gemini-overlay > * {
            pointer-events: auto;
        }

        .viz-response {
            background: rgba(0, 0, 0, 0.9); color: #eee; padding: 12px;
            border-radius: 8px; font-size: 13px; line-height: 1.4;
            max-height: 150px; 
            overflow-y: auto; 
            display: none; 
            border-left: 3px solid #8515efff;
            margin-bottom: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        
        .viz-gemini-input {
            width: 100%; padding: 12px; border-radius: 25px;
            border: 1px solid #444; background: rgba(30, 30, 30, 0.95);
            color: white; outline: none; box-sizing: border-box; backdrop-filter: blur(5px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        .viz-gemini-input:focus { border-color: #8515efff; background: #000; }
        .viz-gemini-input:disabled { opacity: 0.6; cursor: wait; }
    `;
    document.head.appendChild(style);
}