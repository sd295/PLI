/**
 * Displays a reminder to the user in the chat window.
 * @param {string} text - The reminder message.
 */
function addReminderMessageToChat(text) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'bot-message');
    // Using the same formatting as your chat.js for consistency
    messageElement.innerHTML = `<strong style="color: #2a0b3eff;">Reminder:</strong> <strong style="color: #000000ff;">"${text}"</strong>`;

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Sends a desktop notification if permission is granted.
 * @param {string} title - The title of the notification.
 * @param {string} body - The main text of the notification.
 */
function sendDesktopNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body: body });
    }
}

/**
 * The main exported function. It orchestrates showing the reminder.
 * @param {string} reminderText - The clean text of what to remind the user.
 */
export default function sendReminderNotification(reminderText) {
    addReminderMessageToChat(reminderText);
    sendDesktopNotification('Just a reminder', reminderText);
}

/**
 * A helper function to request permission on startup.
 */
export function requestPermissionIfNeeded() {
    if ("Notification" in window && Notification.permission !== 'denied' && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}