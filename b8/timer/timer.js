
export default function setTimerFromSentence(input) {
    // Enhanced debugging
    console.log("Timer module received:", {
        input: input,
        type: typeof input,
        value: input,
        stringified: String(input)
    });

    // Convert input to string if possible
    let processedInput = "";
    
    if (input === null || input === undefined) {
        console.error("Input is null or undefined");
        return "No input provided to timer.";
    }
    
    // Handle different input types
    if (typeof input === "string") {
        processedInput = input.trim();
    } else if (Array.isArray(input)) {
        processedInput = input.join(" ").trim();
        console.log("Joined array input:", processedInput);
    } else if (typeof input === "object") {
        if (input.value) {
            processedInput = String(input.value).trim();
        } else if (input.text) {
            processedInput = String(input.text).trim();
        } else if (input.message) {
            processedInput = String(input.message).trim();
        } else {
            processedInput = JSON.stringify(input);
        }
    } else {
        processedInput = String(input).trim();
    }

    console.log("Processed input:", processedInput);

    if (!processedInput) {
        console.error("Empty input after processing");
        return "No valid sentence provided.";
    }

    // Regex patterns to catch various formats
    const patterns = [
        /(\d+\.?\d*)\s*(second|seconds|sec|secs|minute|minutes|min|mins|hour|hours|hr|hrs)/i,
        /for\s+(\d+\.?\d*)\s*(second|seconds|sec|secs|minute|minutes|min|mins|hour|hours|hr|hrs)/i,
        /(\d+):(\d+):?(\d+)?/,
        /timer\s+(?:for\s+)?(\d+\.?\d*)\s*(s|m|h)?/i,
        /(\d+\.?\d*)\s*(s|m|h)(?:\s|$)/i,
    ];

    let value = 0;
    let unit = "";
    let delayInMs = 0;

    // Try different patterns
    for (const pattern of patterns) {
        const match = processedInput.match(pattern);
        
        if (match) {
            console.log("Pattern matched:", pattern, "Match:", match);
            
            if (pattern === patterns[2]) {
                // Handle time format (HH:MM:SS or MM:SS)
                if (match[3]) {
                    delayInMs = (parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])) * 1000;
                    value = `${match[1]}:${match[2]}:${match[3]}`;
                    unit = "time";
                } else {
                    delayInMs = (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000;
                    value = `${match[1]}:${match[2]}`;
                    unit = "time";
                }
            } else if (pattern === patterns[3] || pattern === patterns[4]) {
                // Handle short format (5m, 30s, 2h)
                value = parseFloat(match[1]);
                const shortUnit = match[2] ? match[2].toLowerCase() : 'm';
                
                switch (shortUnit) {
                    case 's':
                        delayInMs = value * 1000;
                        unit = value === 1 ? "second" : "seconds";
                        break;
                    case 'm':
                        delayInMs = value * 60 * 1000;
                        unit = value === 1 ? "minute" : "minutes";
                        break;
                    case 'h':
                        delayInMs = value * 60 * 60 * 1000;
                        unit = value === 1 ? "hour" : "hours";
                        break;
                    default:
                        delayInMs = value * 60 * 1000;
                        unit = value === 1 ? "minute" : "minutes";
                }
            } else {
                // Handle word format
                value = parseFloat(match[1]);
                unit = match[2].toLowerCase();
                
                switch (unit) {
                    case "second":
                    case "seconds":
                    case "sec":
                    case "secs":
                        delayInMs = value * 1000;
                        unit = value === 1 ? "second" : "seconds";
                        break;
                    case "minute":
                    case "minutes":
                    case "min":
                    case "mins":
                        delayInMs = value * 60 * 1000;
                        unit = value === 1 ? "minute" : "minutes";
                        break;
                    case "hour":
                    case "hours":
                    case "hr":
                    case "hrs":
                        delayInMs = value * 60 * 60 * 1000;
                        unit = value === 1 ? "hour" : "hours";
                        break;
                    default:
                        console.error("Unknown time unit:", unit);
                        continue;
                }
            }
            
            if (delayInMs > 0) {
                break;
            }
        }
    }

    // If no pattern matched, try to find just a number (default to minutes)
    if (delayInMs === 0) {
        const numberMatch = processedInput.match(/(\d+\.?\d*)/);
        if (numberMatch) {
            value = parseFloat(numberMatch[1]);
            delayInMs = value * 60 * 1000;
            unit = value === 1 ? "minute" : "minutes";
            console.log(`Found number without unit: ${value}, defaulting to minutes`);
        }
    }

    if (delayInMs === 0) {
        console.warn("No time information found in input:", processedInput);
        return `Couldn't parse time from: "${processedInput}".`;
    }

    // Validate the delay
    if (delayInMs < 0 || delayInMs > 24 * 60 * 60 * 1000) {
        return "Timer duration must be between 0 and 24 hours.";
    }

    console.log(`Timer set: ${value} ${unit} → ${delayInMs} ms`);

    // Generate unique ID for this timer
    const timerId = 'timer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create the timer in the global scope so it can be accessed
    if (!window.activeTimers) {
        window.activeTimers = {};
    }
    
    // Store timer data
    window.activeTimers[timerId] = {
        totalTime: delayInMs,
        remainingTime: delayInMs,
        startTime: Date.now(),
        intervalId: null,
        value: value,
        unit: unit
    };

    // Create timer HTML with data attributes
    const timerHTML = `
        <div id="${timerId}" data-timer-id="${timerId}" data-duration="${delayInMs}" style="width: 100%; max-width: 400px; margin: 20px auto;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 2rem; background: linear-gradient(15deg, black, rgba(0, 0, 0, 1), black, black, rgb(55, 6, 103), black), rgba(119, 21, 216, 1);animation: pan-background 30s ease-in-out infinite alternate;@keyframes pan-background {
    0% {
        background-position: 0% 0%;
    }
    25% {
        background-position: 100% 0%;
    }
    50% {
        background-position: 100% 100%;
    }
    75% {
        background-position: 0% 100%;
    }
    100% {
        background-position: 0% 0%;
    }
} border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); color: white;">
                <div style="font-size: 1.2rem; margin-bottom: 1rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 2px;">Timer</div>
                <div class="timer-display" style="font-size: 3rem; font-weight: bold; margin: 1rem 0; font-variant-numeric: tabular-nums;">00:00:00</div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; margin: 1.5rem 0;">
                    <div class="timer-progress" style="height: 100%; width: 0%; background: linear-gradient(90deg, #ffffffff, #1500ffff, #ffffffff); border-radius: 4px; transition: width 0.1s linear;"></div>
                </div>
                <div style="font-size: 1rem; opacity: 0.9;">Duration: ${value} ${unit}</div>
                <div style="margin-top: 1rem; display: flex; gap: 10px; justify-content: center;">
                    <button onclick="window.toggleTimer('${timerId}')" style="padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; color: white; cursor: pointer;">Pause</button>
                    <button onclick="window.cancelTimer('${timerId}')" style="padding: 8px 16px; background: rgba(255,0,0,0.3); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; color: white; cursor: pointer;">Cancel</button>
                </div>
            </div>
        </div>
    `;

    // Add global timer functions if they don't exist
    if (!window.toggleTimer) {
        window.toggleTimer = function(id) {
            const timer = window.activeTimers[id];
            if (!timer) return;
            
            const button = document.querySelector(`#${id} button`);
            if (timer.isPaused) {
                timer.startTime = Date.now() - (timer.totalTime - timer.remainingTime);
                timer.isPaused = false;
                button.textContent = 'Pause';
                startTimerInterval(id);
            } else {
                timer.isPaused = true;
                clearInterval(timer.intervalId);
                button.textContent = 'Resume';
            }
        };

        window.cancelTimer = function(id) {
            const timer = window.activeTimers[id];
            if (!timer) return;
            
            clearInterval(timer.intervalId);
            const element = document.getElementById(id);
            if (element) {
                element.querySelector('.timer-display').textContent = 'CANCELLED';
                element.querySelector('.timer-display').style.color = '#ff6b6b';
            }
            delete window.activeTimers[id];
        };

        window.formatTime = function(ms) {
            const totalSeconds = Math.ceil(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            return [hours, minutes, seconds]
                .map(v => v < 10 ? '0' + v : v)
                .join(':');
        };

        window.startTimerInterval = function(id) {
            const timer = window.activeTimers[id];
            if (!timer) return;
            
            timer.intervalId = setInterval(() => {
                const element = document.getElementById(id);
                if (!element) {
                    clearInterval(timer.intervalId);
                    return;
                }
                
                if (!timer.isPaused) {
                    const elapsed = Date.now() - timer.startTime;
                    timer.remainingTime = Math.max(0, timer.totalTime - elapsed);
                }
                
                const display = element.querySelector('.timer-display');
                const progress = element.querySelector('.timer-progress');
                
                if (display) {
                    display.textContent = window.formatTime(timer.remainingTime);
                }
                
                if (progress) {
                    const progressPercent = ((timer.totalTime - timer.remainingTime) / timer.totalTime) * 100;
                    progress.style.width = progressPercent + '%';
                }
                
                if (timer.remainingTime <= 0) {
                    clearInterval(timer.intervalId);
                    if (display) {
                        display.textContent = 'TIME\'S UP!'+ {name};
                        display.style.color = '#00ff88';
                        display.style.animation = 'pulse 1s infinite';
                    }
                    
                    // Play sound
                    try {
                        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiS2Oy9diMFl2+z');
                        audio.play();
                    } catch(e) {}
                    
                    alert(`⏰ Timer completed: ${timer.value} ${timer.unit}`);
                    delete window.activeTimers[id];
                }
            }, 100);
        };
    }

    // Start the timer after a short delay to ensure DOM is ready
    setTimeout(() => {
        window.startTimerInterval(timerId);
    }, 100);

    // Add CSS animation if not already added
    if (!document.getElementById('timer-styles')) {
        const style = document.createElement('style');
        style.id = 'timer-styles';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.15); }
                
            }
        `;
        document.head.appendChild(style);
    }

    // Return the HTML string
    return timerHTML;
}