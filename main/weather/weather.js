// File: /weather/weather.js

// --- CONFIGURATION ---
// PASTE YOUR FREE API KEY FROM WeatherAPI.com HERE
const apiKey = "04b65eec673d460ca3b144508253105"; 


export default function getWeather(args) {
    // 1. CHECK FOR A LOCATION IN THE USER'S MESSAGE
    // If 'args' has content (e.g., the user typed "weather London"),
    // then 'args' will be "London".
    if (args && args.trim().length > 0) {
        // If the user provided a location, fetch the weather for that location.
        return fetchWeatherByQuery(args.trim());
    }

    // 2. IF NO LOCATION IS PROVIDED, FALLBACK TO BROWSER GEOLOCATION
    // This part is the same as before, returning a Promise.
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolocation is not supported. Please specify a city, like: **weather New York**");
            return;
        }

        // Ask for the user's current position
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try {
                    const weatherData = await fetchWeatherByCoords(lat, lon);
                    resolve(weatherData);
                } catch (error) {
                    reject(error.toString());
                }
            },
            () => {
                reject("Could not get your location. Please allow location access or specify a city, like: **weather London**");
            }
        );
    });
}

/**
 * Fetches weather data using a text query (e.g., "London", "90210", "Paris, France").
 * @param {string} query - The location text provided by the user.
 * @returns {Promise<string>} A formatted string with the weather information.
 */
// REPLACE the old fetchWeatherFromApi function in weather/weather.js with this one.
async function fetchWeatherByQuery(query) {
    const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(query)}`;
    return fetchWeatherFromApi(apiUrl);
}

/**
 * Fetches weather data using latitude and longitude coordinates.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} A formatted string with the weather information.
 */
async function fetchWeatherByCoords(lat, lon) {
    const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}`;
    return fetchWeatherFromApi(apiUrl);
}

/**
 * A general helper function to call the WeatherAPI.com service with a given URL.
 * @param {string} apiUrl - The full URL to fetch from WeatherAPI.com.
 * @returns {Promise<string>} A formatted string with the weather information.
 */
async function fetchWeatherFromApi(apiUrl) {
    if (apiKey === "YOUR_WEATHERAPI_KEY" || !apiKey) {
        return "The weather command is not configured. An API key is missing from `weather/weather.js`.";
    }

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        // WeatherAPI returns an 'error' object if the location isn't found
        if (data.error) {
            return `Sorry, I couldn't find a location named "${data.error.message.split('"')[1]}". Please try again.`;
        }

        // Extract the relevant information
        const locationName = data.location.name;
        const region = data.location.region;
        const tempF = data.current.temp_f;
        const tempC = data.current.temp_c;
        const condition = data.current.condition.text;
        const windMph = data.current.wind_mph;
        const iconUrl = "https:" + data.current.condition.icon; // Get the condition icon URL

        // Format the data into a user-friendly string with an icon
        return `
            <img src="${iconUrl}" alt="${condition}" style="vertical-align: middle; width: 50px; height: 50px;">
            The current weather in **${locationName}, ${region}** is **${condition}** at **${tempF}°F** (${tempC}°C).
        `;

    } catch (error) {
        console.error("Weather API Error:", error);
        return "Sorry, I was unable to retrieve the weather information at this time.";
    }
}