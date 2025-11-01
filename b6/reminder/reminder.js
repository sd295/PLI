let tokenClient; // Local reference to the GIS client

export function initializeTokenClient(client) {
    tokenClient = client;
}

export function promptForGoogleConnection() {
    if (tokenClient) {
        // This triggers the pop-up. The result is handled by the callback.
        tokenClient.requestAccessToken({ prompt: 'consent' }); 
    } else {
        console.error("Token client is not initialized. Cannot prompt for connection.");
    }
}

function isGoogleAuthorized() {
    // A more reliable check for an access token on the gapi client.
    return gapi.client.getToken() !== null;
}

// ===================================================================================
//  Reminder System - Main Entry Point & Smart Dispatcher
// ===================================================================================
export default async function handleReminder(args) {
    const parseResult = await parseTimeAndText(args);

    if (!parseResult) {
        return "I'm not sure when to remind you. Please use a valid time format.";
    }

    if (parseResult.type === 'relative') {
        console.log("Dispatching to: Local Timer System ONLY");
        return setLocalReminder(parseResult);
    } else if (parseResult.type === 'absolute') {
        if (!isGoogleAuthorized()) {
            return "To set this reminder, please use the 'Connect Google Calendar' button first.";
        }

        // If we are already authorized, proceed to create the reminders.
        const localConfirmation = setLocalReminder(parseResult);
        const calendarConfirmation = await setGoogleCalendarReminder(parseResult);
        
        return `${localConfirmation}\n${calendarConfirmation}`;
    }
}

// ===================================================================================
//  Local Reminder Logic
// ===================================================================================
function setLocalReminder({ reminderText, delay, timePhrase }) {
    if (delay > 0) {
        setTimeout(() => {
            new Notification('Reminder', { body: reminderText });
        }, delay);
        return `Local notification set for "${reminderText}" ${timePhrase}.`;
    }
    return "Could not set a local reminder in the past.";
}

// ===================================================================================
//  Google Calendar Logic (Persistent Reminders)
// ===================================================================================
async function setGoogleCalendarReminder({ reminderText, startTime, endTime, timePhrase }) {
    try {
        const event = {
            'summary': reminderText,
            'start': {
                'dateTime': startTime.toISOString(),
                'timeZone': 'UTC'
            },
            'end': {
                'dateTime': endTime.toISOString(),
                'timeZone': 'UTC'
            },
            'reminders': {
                'useDefault': false,
                'overrides': [
                    { 'method': 'email', 'minutes': 24 * 60 },
                    { 'method': 'popup', 'minutes': 10 }
                ]
            }
        };

        const response = await gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event,
        });
        
        return ` Added "${response.result.summary}" to your Google Calendar for ${timePhrase}.`;
    } catch (error) {
        console.error("Error creating calendar event:", error);
        return "Sorry, I couldn't create the event in your calendar.";
    }
}

// ===================================================================================
//  Parser Logic
// ===================================================================================
async function parseTimeAndText(text) {
    // 1. Relative times ("in 5 minutes")
    const relativeMatch = text.match(/in (\d+)\s+(second|seconds|minute|minutes|hour|hours)/i);
    if (relativeMatch) {
        const value = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();
        const timePhrase = relativeMatch[0];
        let delay = 0;
        if (unit.startsWith('second')) delay = value * 1000;
        else if (unit.startsWith('minute')) delay = value * 60 * 1000;
        else if (unit.startsWith('hour')) delay = value * 60 * 60 * 1000;
        
        const reminderText = cleanReminderText(text.replace(timePhrase, ''));
        return { type: 'relative', reminderText, delay, timePhrase };
    }

    // 2. Absolute dates ("on 19.11.2025")
    const dateMatch = text.match(/(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})/);
    if (dateMatch) {
        const [day, month, year] = dateMatch[0].split(/[\.\/]/);
        const startTime = new Date(`${year}-${month}-${day}T09:00:00Z`);
        
        const delay = startTime.getTime() - Date.now();
        if (delay <= 0) return null;

        const endTime = new Date(startTime.getTime() + 3600 * 1000);
        const timePhrase = `on ${day}.${month}.${year}`;
        const reminderText = cleanReminderText(text.replace(/on\s+/i, '').replace(dateMatch[0], ''));
        return { type: 'absolute', reminderText, startTime, endTime, timePhrase, delay };
    }

    return null;
}

function cleanReminderText(text) {
    const junkWords = ['my', 'me', 'to', 'please', 'pls', 'plss', 'of', 'the'];
    const junkWordsRegex = new RegExp(`\\b(${junkWords.join('|')})\\b`, 'gi');
    let cleaned = text.replace(/^(remind me to|remember to|me to|to)\s*/i, '');
    cleaned = cleaned.replace(junkWordsRegex, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned || "do that thing";
}