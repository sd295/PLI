import { initializeTokenClient } from './reminder.js';

const API_KEY = 'AIzaSyCG2Rzn97EvIn3wwnpdOuvyExLEF8vfS9Y';
const CLIENT_ID = '517448730993-pcbekg83r7q763s90algdgt2fcg01ll5.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

/**
 * Dynamically loads the GAPI and GIS scripts using the official callback method.
 * Returns a Promise that resolves when both scripts are fully loaded and ready.
 */
export function loadGoogleScripts() {
    return new Promise((resolve, reject) => {
        // A unique name for the callback function that the GAPI script will call
        const gapiCallbackName = 'onGapiClientLoad';

        // Attach the callback function to the global window object
        window[gapiCallbackName] = () => {
            // This function is called by the GAPI script when it's ready.
            gapiLoaded = true;
            checkAndResolve();
        };

        const gapiScript = document.createElement('script');
        // IMPORTANT: We add the ?onload=... parameter to the URL
        gapiScript.src = `https://apis.google.com/js/api.js?onload=${gapiCallbackName}`;
        gapiScript.async = true;
        gapiScript.defer = true;
        
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        
        let gapiLoaded = false;
        let gisLoaded = false;
        
        const checkAndResolve = () => {
            if (gapiLoaded && gisLoaded) {
                // Clean up the global callback function to keep the window object tidy
                delete window[gapiCallbackName];
                resolve();
            }
        };

        // The GIS script doesn't have an onload parameter, so its onload event is reliable enough.
        gisScript.onload = () => {
            gisLoaded = true;
            checkAndResolve();
        };

        // Error handling
        gapiScript.onerror = () => reject(new Error('Failed to load GAPI script.'));
        gisScript.onerror = () => reject(new Error('Failed to load GIS script.'));

        // Add the scripts to the document head
        document.head.appendChild(gapiScript);
        document.head.appendChild(gisScript);
    });
}

/**
 * Initializes the Google API client and the token client.
 * This should only be called AFTER the scripts have been loaded.
 */
export function initGoogleClients(callback) {
    // We now know for sure that `gapi` is defined and ready.
    gapi.load('client', () => {
        gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        }).then(() => {
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        gapi.client.setToken(tokenResponse);
                        callback(true);
                    } else {
                        console.error('Authorization error:', tokenResponse);
                        callback(false);
                    }
                },
            });
            initializeTokenClient(tokenClient);
        }).catch(error => {
            console.error("Error initializing GAPI client:", error);
        });
    });
}