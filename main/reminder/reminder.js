// File: /reminder/reminder.js

// This is the most important line. It makes the function available to chat.js.
export default function setReminder(args) {
    
    // Check if the chrono library was loaded correctly in index.html
    if (typeof chrono === 'undefined') {
        console.error("Chrono library is not loaded. Please add it to index.html");
        return "Error: The reminder function is missing a required library. Please contact the administrator.";
    }

    // Use the chrono library to parse the user's input
    const results = chrono.parse(args);

    // Check if Chrono could understand the date/time in the request
    if (results.length === 0) {
        return "I'm sorry, I couldn't understand the date or time. Please be more specific, like: **remind me to call John tomorrow at 5pm**.";
    }

    // Extract the parsed information
    const reminderDate = results[0].start.date();
    // Get the text of the reminder (everything before the date that was found)
    const reminderText = args.substring(0, results[0].index).trim(); 

    // A reminder must have some text
    if (reminderText.length === 0) {
        return "Please tell me what you want to be reminded about. For example: **remind me to check email in 10 minutes**.";
    }

    // Get existing reminders from localStorage or create a new empty array
    const reminders = JSON.parse(localStorage.getItem('chatReminders')) || [];

    // Create a new reminder object
    const newReminder = {
        id: Date.now(), // Unique ID
        text: reminderText,
        triggerTime: reminderDate.getTime() // Store time as a numeric timestamp
    };

    // Add the new reminder to the array
    reminders.push(newReminder);

    // Save the updated array back to localStorage
    localStorage.setItem('chatReminders', JSON.stringify(reminders));

    // Format the date for a user-friendly confirmation message
    const confirmationDate = reminderDate.toLocaleString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Return a confirmation message to the user
    return `Okay, I will remind you to **"${reminderText}"** on **${confirmationDate}**.`;
}