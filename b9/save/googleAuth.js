import { initializeTokenClient } from './reminder.js';

const API_KEY = 'AIzaSyC6amNkHX9HiCPi63lY3Gmkfyg8yucYh-4';
const CLIENT_ID = '517448730993-pcbekg83r7q763s90algdgt2fcg01ll5.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; // Adjust scope as needed

/**
 * Dynamically loads the GAPI and GIS scripts using the official callback method.
 */
export function loadGoogleScripts() {
    return new Promise((resolve, reject) => {
        const gapiCallbackName = 'onGapiClientLoad';
        window[gapiCallbackName] = () => {
            console.log('LOG 1: GAPI onload callback fired. `gapi` object is:', window.gapi);
            gapiLoaded = true;
            checkAndResolve();
        };

        const gapiScript = document.createElement('script');
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
                console.log('LOG 2: Both scripts loaded. Resolving promise.');
                delete window[gapiCallbackName];
                resolve();
            }
        };

        gisScript.onload = () => {
            console.log('LOG 3: GIS script loaded. `google` object is:', window.google);
            gisLoaded = true;
            checkAndResolve();
        };

        gapiScript.onerror = () => reject(new Error('Failed to load GAPI script.'));
        gisScript.onerror = () => reject(new Error('Failed to load GIS script.'));

        document.head.appendChild(gapiScript);
        document.head.appendChild(gisScript);
    });
}

/**
 * Initializes GAPI client for Google Drive API
 */
export function initGoogleClients(callback) {
    window.gapi.load('client', () => {
        window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        }).then(() => {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        window.gapi.client.setToken(tokenResponse);
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
