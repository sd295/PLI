/**
 * Sets a timer that will execute a callback function after a specified delay.
 * @param {number} delayInMs - The time to wait, in milliseconds.
 * @param {Function} onCompleteCallback - The function to call when the timer finishes.
 */
export default function setTimer(delayInMs, onCompleteCallback) {
    if (typeof delayInMs !== 'number' || delayInMs < 0 || typeof onCompleteCallback !== 'function') {
        console.error("Invalid arguments provided to setTimer.");
        return;
    }

    console.log(`Timer set for ${delayInMs / 1000} seconds from now.`);
    setTimeout(onCompleteCallback, delayInMs);
}