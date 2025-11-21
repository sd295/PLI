// ===========================================
// All-in-One Google Drive Saver With Picker
// ===========================================
let tokenClient;

function initializeTokenClient(client) {
    tokenClient = client;
}

function promptForGoogleConnection() {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.error("Token client is not initialized. Cannot prompt for connection.");
    }
}

function isGoogleAuthorized() {
    return window.gapi && window.gapi.client && window.gapi.client.getToken() !== null;
}

// Load GAPI & GIS scripts
function loadGoogleScripts() {
    return new Promise((resolve, reject) => {
        const gapiCallbackName = 'onGapiClientLoad';
        window[gapiCallbackName] = () => { gapiLoaded = true; checkAndResolve(); };

        const gapiScript = document.createElement('script');
        gapiScript.src = `https://apis.google.com/js/api.js?onload=${gapiCallbackName}`;
        gapiScript.async = true; gapiScript.defer = true;

        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true; gisScript.defer = true;

        let gapiLoaded = false, gisLoaded = false;
        const checkAndResolve = () => { if(gapiLoaded && gisLoaded){ delete window[gapiCallbackName]; resolve(); }};

        gisScript.onload = () => { gisLoaded = true; checkAndResolve(); };
        gapiScript.onerror = () => reject(new Error('Failed to load GAPI script.'));
        gisScript.onerror = () => reject(new Error('Failed to load GIS script.'));

        document.head.appendChild(gapiScript);
        document.head.appendChild(gisScript);
    });
}

// Initialize Google Drive client
function initGoogleClients(apiKey, clientId, callback) {
    window.gapi.load('client', () => {
        window.gapi.client.init({
            apiKey: apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        }).then(() => {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        window.gapi.client.setToken(tokenResponse);
                        initializeTokenClient(client);
                        callback(true);
                    } else {
                        console.error('Authorization error:', tokenResponse);
                        callback(false);
                    }
                },
            });
            initializeTokenClient(client);
        }).catch(err => console.error("GAPI init error:", err));
    });
}

// Prompt user for a folder ID using Google Picker (simplified)
async function pickFolder() {
    const folderId = prompt("Enter the Google Drive folder ID where you want to save the file (or leave blank for root):");
    return folderId || 'root';
}

// Check filename for -rn and ask for new name
function checkRename(fileName) {
    if (fileName.endsWith('-rn')) {
        const newName = prompt("Your filename ends with '-rn'. Enter a new name:", fileName.replace('-rn',''));
        return newName || fileName;
    }
    return fileName;
}

// Save text to Google Drive
async function saveTextToDrive(fileName, textContent, folderId='root') {
    if (!isGoogleAuthorized()) return "Google is not authorized. Please connect first.";

    fileName = checkRename(fileName);

    try {
        const fileMetadata = {
            name: fileName,
            mimeType: 'application/vnd.google-apps.document',
            parents: [folderId]
        };
        const media = { mimeType: 'text/plain', body: textContent };
        const response = await gapi.client.drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name'
        });
        return `Saved "${response.result.name}" to Google Drive in folder ${folderId}.`;
    } catch (error) {
        console.error("Error saving to Drive:", error);
        return "Failed to save file to Google Drive.";
    }
}

// Full interactive example
async function saveInteractive(apiKey, clientId, fileName, textContent) {
    await loadGoogleScripts();
    initGoogleClients(apiKey, clientId, async (connected) => {
        if (!connected) {
            console.log("Authorization failed. Prompting user...");
            promptForGoogleConnection();
            return;
        }

        const folderId = await pickFolder();
        const result = await saveTextToDrive(fileName, textContent, folderId);
        console.log(result);
    });
}

// Export functions for module usage
export {
    saveInteractive,
    saveTextToDrive,
    promptForGoogleConnection,
    loadGoogleScripts,
    initGoogleClients
};
