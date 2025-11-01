// File: /mirror/mirror.js

// This global function for fullscreen toggle remains the same.
window.toggleMirrorFullscreen = function(buttonElement) {
    const container = buttonElement.closest('.mirrored-site-container');
    if (!container) return;
    const iframe = container.querySelector('iframe');
    if (!iframe) return;

    if (document.fullscreenElement) {
        document.exitFullscreen();
        buttonElement.textContent = 'Go Fullscreen';
    } else {
        iframe.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
        buttonElement.textContent = 'Exit Fullscreen';
    }
};

/**
 * The main function for the 'mirror' command.
 * Creates an HTML iframe that first tries a direct link, then falls back to a proxy.
 *
 * @param {string} args - The URL or domain name the user wants to mirror.
 * @returns {string} An HTML string containing the iframe, controls, and fallback logic.
 */
export default function handleMirrorCommand(args) {
    const rawUrl = args.trim();
    if (!rawUrl) {
        return "Please provide a website to mirror. For example: `mirror wikipedia.org`";
    }

    let finalUrl = rawUrl;
    if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
    }

    const proxyBaseUrl = 'http://sd130.pythonanywhere.com/proxy?url=';
    const proxyUrl = proxyBaseUrl + encodeURIComponent(finalUrl);
    const uniqueId = 'mirror-' + Math.random().toString(36).substring(2, 9);

    const iframeHtml = `
        <div class="mirrored-site-container">
            <div class="mirror-controls">
                <span>Mirroring: <a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${rawUrl}</a></span>
                <button class="fullscreen-btn" onclick="toggleMirrorFullscreen(this)">Go Fullscreen</button>
            </div>
            <p id="status-${uniqueId}" class="mirror-status">Attempting to load directly...</p>
            <iframe
                id="iframe-${uniqueId}"
                src="${finalUrl}"
                style="width: 100%; height: 400px; border: 1px solid #ccc; border-radius: 8px; background-color: #fff;"
                title="Mirrored content for ${rawUrl}"
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="fullscreen"
            ></iframe>
        </div>

        <script>
            (() => {
                const iframe = document.getElementById('iframe-${uniqueId}');
                const statusElement = document.getElementById('status-${uniqueId}');
                if (!iframe || !statusElement) return; // Defensive check

                let loadedSuccessfully = false;

                iframe.addEventListener('load', () => {
                    loadedSuccessfully = true;
                    statusElement.textContent = "Content loaded. Note: Some sites may appear blank due to security policies.";
                    statusElement.style.color = '#28a745';
                });

                setTimeout(() => {
                    if (!loadedSuccessfully) {
                        statusElement.textContent = 'Direct link blocked. Trying again via proxy...';
                        statusElement.style.color = '#fd7e14';
                        
                        iframe.src = '${proxyUrl}';
                        
                        iframe.addEventListener('load', () => {
                             statusElement.textContent = 'Loaded via proxy.';
                             statusElement.style.color = '#28a745';
                        });
                    }
                }, 2500);

            })();
        </script>
    `;

    return iframeHtml;
}