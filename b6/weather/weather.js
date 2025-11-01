let lastKnownCity = '';
import processDate from '../date/date.js';

const apiKey = "04b65eec673d460ca3b144508253105";
// Flexible date pattern allowing 2 or 4-digit years
const datePattern = /(\d{2}[\.\/]\d{2}[\.\/]\d{2,4}|\d{4}-\d{2}-\d{2})/;

/**
 * The main exported function. It now remembers the last city used.
 * @param {string} args - The user input string after the "weather" command.
 */
export default async function getWeather(args) {
    const trimmedArgs = args.trim();

    if (!trimmedArgs) {
        return handleGeolocationForCurrentWeather();
    }

    const dateMatch = trimmedArgs.match(datePattern);

    if (dateMatch) {
        const dateString = dateMatch[0];
        const stopWords = await fetchStopWords(); // You have this function defined elsewhere
        let cityCandidate = trimmedArgs.replace(dateString, '').trim();
        let city = cityCandidate;

        if (stopWords.length > 0) {
            const stopWordsRegex = new RegExp(`\\b(${stopWords.join('|')})\\b`, 'gi');
            city = cityCandidate.replace(stopWordsRegex, '').trim();
        }

        if (city) {
            // A meaningful city name was provided.
            // --- MODIFICATION: Save the city for later use ---
            lastKnownCity = city; 
            return processForecastForCity(city, dateString);
        } else {
            // No city name was provided in the input.
            // --- LOGIC CHANGE: Check for a previously used city ---
            if (lastKnownCity) {
                // If we have a saved city, use it.
                console.log(`Using last known city: ${lastKnownCity}`); // Optional: for debugging
                return processForecastForCity(lastKnownCity, dateString);
            } else {
                // Otherwise, fall back to geolocation.
                return handleGeolocationForForecast(dateString);
            }
        }
    } else {
        // No date was found, so the whole string is treated as a city/query.
        // --- MODIFICATION: Save the city for later use ---
        lastKnownCity = trimmedArgs;
        return fetchWeatherByQuery(trimmedArgs);
    }
}


function handleGeolocationForForecast(dateString) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject("**Geolocation** is not supported by your browser.");
            
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                // We will now pass the raw coordinates to the forecast processor.
                const forecastResult = await processForecastForCoords(`${latitude},${longitude}`, dateString);
                resolve(forecastResult);
                // FIX: Changed 'geolocation' to 'position' which is the correct variable name.
                 
            },
            (error) => {
                reject(`Could not get your location: ${error.message}. Please provide a **city name** or check browser permissions.`);
            }
        
        );
    });
}

/**
 * Gets browser coordinates to fetch the CURRENT weather. This function works correctly.
 */
function handleGeolocationForCurrentWeather() {
     return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject("**Geolocation** is not supported by your browser.");
        navigator.geolocation.getCurrentPosition(
            
            async (position) => {
                const weatherData = await fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
                resolve(weatherData);
                
            },
            () => reject("Could not get your location. Please provide a **city name** or check your browser permissions.")
        );
    });
}

/**
 * Processes a forecast request for a specific query (which can be a city name or coordinates).
 */
async function processForecastForQuery(query, dateString) {
    const dateProcessingResult = await processDate(dateString, (normalizedDate) => {
        const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(query)}&dt=${normalizedDate}`;
        
        return processForecastApiCall(apiUrl);
        
    });
    if (!dateProcessingResult) {
        return `Sorry, **I don't recognize the date format** "${dateString}".`;
    }
    return formatForecastResponse(dateProcessingResult.result, dateProcessingResult.reformatted);
}

// Create aliases for clarity
const processForecastForCity = processForecastForQuery;
const processForecastForCoords = processForecastForQuery;
/**
 * Fetches the list of stop words from a JSON file.
 * @returns {Promise<string[]>} A promise that resolves to an array of words.
 */
async function fetchStopWords() {
    try {
        const response = await fetch('../main/words/weather.no.json');
        if (!response.ok) {
            console.error(`Error fetching stop words: ${response.statusText}`);
            return []; // Return an empty array as a fallback
        }
        const words = await response.json();
        return words;
    } catch (error) {
        console.error("Just contact seridarivus**at**gmail.com:", error);
        return []; // Return an empty array on failure
    }
}


// --- Formatting and API Fetching Functions ---

function formatForecastResponse(weatherData, displayDate) {
    if (typeof weatherData !== 'object') return weatherData; // Return error messages
    return `
        <img src="${weatherData.iconUrl}" alt="${weatherData.condition}" style="vertical-align: middle; width: 50px; height: 50px;">
        The forecast for **${displayDate}** in **${weatherData.locationName}, ${weatherData.region}** is **${weatherData.condition}** with a high of **${weatherData.maxTempF}°F** (${weatherData.maxTempC}°C).
    `;
}

async function fetchWeatherByQuery(query) {
    const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(query)}`;
    const data = await fetchApi(apiUrl);
    if (typeof data !== 'object') return data;
    return `
        <img src="https:"${data.current.condition.icon}" alt="${data.current.condition.text}" style="vertical-align: middle; width: 50px; height: 50px;">
        The current weather in **${data.location.name}, ${data.location.region}** is **${data.current.condition.text}** at **${data.current.temp_f}°F** (${data.current.temp_c}°C).
    `;
}

async function fetchWeatherByCoords(lat, lon) {
    const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}`;
    const data = await fetchApi(apiUrl);
    if (typeof data !== 'object') return data;
    return `
        <img src="https:${data.current.condition.icon}" alt="${data.current.condition.text}" style="vertical-align: middle; width: 50px; height: 50px;">
        The current weather in **${data.location.name}, ${data.location.region}** is **${data.current.condition.text}** at **${data.current.temp_f}°F** (${data.current.temp_c}°C).
    `;
}

async function processForecastApiCall(apiUrl) {
    const data = await fetchApi(apiUrl);
    if (typeof data !== 'object') return data;
    const forecastDay = data.forecast.forecastday[0];
    if (!forecastDay) return `**Sorry, I couldn't get a forecast for that date.**`;
    return {
        locationName: data.location.name,
        region: data.location.region,
        maxTempF: forecastDay.day.maxtemp_f,
        maxTempC: forecastDay.day.maxtemp_c,
        condition: forecastDay.day.condition.text,
        iconUrl: "https:" + forecastDay.day.condition.icon
    };
}

async function fetchApi(apiUrl) {
    if (!apiKey) return "The weather command is not configured. An API key is missing.";
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data.error) return `Sorry, the weather service returned an error: ${data.error.message}`;
        return data;
    } catch (error) {
        console.error("Weather API Error:", error);
        return "Sorry, I was unable to retrieve weather information at this time.";
    }
}