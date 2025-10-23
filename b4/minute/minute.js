/**
 * minute.js
 * Dynamically used by handleEveryWord when a number precedes "minute(s)".
 * Expects:
 *   - numValue: the number of minutes
 *   - extraArgs: any additional words (ignored here, but could be used)
 */
export default function minute(numValue, extraArgs = []) {
    if (typeof numValue !== 'number' || numValue <= 0) {
        console.error('Invalid number provided to minute.js:', numValue);
        return;
    }

    const delayMs = numValue * 60 * 1000; // convert minutes to milliseconds

    console.log(`⏰ Timer set dynamically for ${numValue} minute(s).`);

    // simulate the timer callback
    setTimeout(() => {
        console.log(`Timer finished: ${numValue} minute(s)`);
        return "Your timer has finished."
    }, delayMs);

    return `Timer started for **${numValue} minute(s)**`;
}
