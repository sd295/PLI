// File: /mirror/mirror.js

// We need to define the fullscreen toggle function in a way that the HTML can access it.
// By attaching it to the `window` object, it becomes a global function.
window.toggleMirrorFullscreen = function(buttonElement) {
    // 1. Find the parent container of the button that was clicked.
    const container = buttonElement.closest('.mirrored-site-container');
    if (!container) return;

    // 2. Find the iframe within that specific container.
    const iframe = container.querySelector('iframe');
    if (!iframe) return;

    // 3. Check if the browser is already in fullscreen mode.
    if (document.fullscreenElement) {
        // If it is, exit fullscreen.
        document.exitFullscreen();
        buttonElement.textContent = 'Go Fullscreen'; // Reset button text
    } else {
        // If it's not, request to make the iframe fullscreen.
        iframe.requestFullscreen().then(() => {
            buttonElement.textContent = 'Go Fullscreen'; // Update button text
        }).catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    }
};


/**
 * The main function for the 'mirror' command.
 * It creates an HTML iframe with a fullscreen button.
 *
 * @param {string} args - The URL or domain name the user wants to mirror.
 * @returns {string} An HTML string containing the iframe and controls.
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

    // NEW: We've added a button with an `onclick` event.
    // This `onclick` calls the global function we defined above.
    const iframeHtml = `
        <div class="mirrored-site-container">
            <div class="mirror-controls">
                <span>Mirroring: <a href="${finalUrl}" target="_blank">${rawUrl}</a></span>
                <button class="fullscreen-btn" onclick="toggleMirrorFullscreen(this)">Go Fullscreen</button>
            </div>
            <iframe
                src="${finalUrl}"
                style="width: 100%; height: 400px; border: 1px solid #ccc; border-radius: 8px; background-color: #fff;"
                title="Mirrored content for ${rawUrl}"
                sandbox="allow-scripts allow-same-origin"
            ></iframe>
            <p class="mirror-note">Note: Many sites block being embedded. If the frame is blank, the site likely has protections against this.</p>
        </div>
    `;

    return iframeHtml;
}