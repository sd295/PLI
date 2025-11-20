// 2.0-seridarivus

// This event is triggered whenever a push message is received from the server.
self.addEventListener('push', function(event) {
    // The data sent from the server is in the event.data object.
    const data = event.data.json(); // We'll send JSON from our server

    const title = data.title || 'Reminder';
    const options = {
        body: data.body,
        icon: '/images/favicon.png', // Optional: an icon for the notification
    };

    // This is the command that shows the actual notification.
    event.waitUntil(self.registration.showNotification(title, options));
});