import processDate from '../date/date.js';
import setTimer from '../timer/timer.js';
import sendReminderNotification from '../notification/notification.this.js';

/**
 * Main handler for reminder commands. Orchestrates parsing, timing, and notification.
 * @param {string} args - The user input.
 * @returns {Promise<string>} A confirmation message.
 */
export default async function handleReminder(args) {
    const parseResult = await parseTimeAndText(args);

    if (!parseResult) {
        return "I'm not sure **when** to remind you. Give me a **time**";
    }

    const { reminderText, delay, timePhrase } = parseResult;

    // Define what should happen when the timer finishes.
    const onTimerComplete = () => {
        sendReminderNotification(reminderText);
    };

    // Tell the timer module to start counting down.
    setTimer(delay, onTimerComplete);

    // Immediately confirm to the user that the timer has been set.
    return `Okay, I will remind you to "${reminderText}" ${timePhrase}.`;
}

/**
 * Parses the input to find the reminder text and calculate the delay in milliseconds.
 * @param {string} text - The input string.
 * @returns {Promise<object|null>}
 */
async function parseTimeAndText(text) {
    const timeRegex = /(in (\d+)\s+(second|seconds|minute|minutes|hour|hours)|on (\d{2}[\.\/]\d{2}[\.\/]\d{4}|\d{4}-\d{2}-\d{2}))/i;
    const match = text.match(timeRegex);
    if (!match) return null;

    const timePhrase = match[0];
    let delay = 0;

    // Handle relative time: "in 5 minutes"
    if (match[1]) {
        const value = parseInt(match[2], 10);
        const unit = match[3].toLowerCase();
        if (unit.startsWith('second')) delay = value * 1000;
        else if (unit.startsWith('minute')) delay = value * 60 * 1000;
        else if (unit.startsWith('hour')) delay = value * 60 * 60 * 1000;
    }
    // Handle specific date: "on 25.12.2024"
    else if (match[4]) {
        const dateString = match[4];
        const dateProcessingResult = await processDate(dateString, (normalizedDate) => new Date(`${normalizedDate}T09:00:00`).getTime());
        if (dateProcessingResult) {
            const triggerTime = dateProcessingResult.result;
            delay = triggerTime - Date.now(); // Calculate delay from now until the future date
        }
    }

    if (delay <= 0) return null; // Can't set a reminder for the past

    const reminderText = cleanReminderText(text.replace(timePhrase, ''));
    return { reminderText, delay, timePhrase };
}

function cleanReminderText(text) {
    const junkWords = ['my', 'me', 'to', 'please', 'pls', 'plss', "that"];
    const junkWordsRegex = new RegExp(`\\b(${junkWords.join('|')})\\b`, 'gi');
    let cleaned = text.replace(/^(remind me to|remember to|me to|to)\s*/i, '');
    cleaned = cleaned.replace(junkWordsRegex, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned || "do that thing";
}