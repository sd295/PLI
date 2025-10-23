/**
 * connect.js
 * Dynamically used by handleEveryWord when the word "connect" appears.
 * Connects to a site or device depending on the user's input arguments.
 */

export default async function connect(args = []) {
    if (!args.length) {
        return "Please provide a target to connect to (site URL or device).";
    }

    const target = args.join(" "); // Combine all words after "connect"

    try {
        // Example 1: Connect to a website via fetch
        if (target.startsWith("http")) {
            const response = await fetch(target, { method: 'GET' });
            if (!response.ok) throw new Error(`Status ${response.status}`);
            return ` Successfully connected to site: ${target}`;
        }

        // Example 2: Connect to a device (simulate)
        if (target.toLowerCase().includes("device")) {
            // Replace this with your real device connection logic
            console.log(`Attempting to connect to device: ${target}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
            return ` soon : ${target}`;
        }

        // Default fallback
        return `Target "${target}" not recognized for connection.`;
    } catch (error) {
        console.error("Connect module error:", error);
        return `Failed to connect to "${target}": ${error.message}`;
    }
}
