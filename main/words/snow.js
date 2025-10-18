/**
 * Main handler for the "snow" keyword. It orchestrates historical and forecast analysis.
 * @param {object} context - Context object { lastKnownCity, apiKey }.
 * @returns {Promise<string>} A detailed, synthesized response about the possibility of snow.
 */
export default async function handleSnow({ lastKnownCity, apiKey }) {
    if (!lastKnownCity) {
        return "To analyze the chance of snow, I need a location. Please ask for the weather in a specific city first.";
    }

    // 1. Perform both historical and future analysis concurrently.
    const [historicalContext, futureAnalysis] = await Promise.all([
        getHistoricalContext({ city: lastKnownCity, apiKey }),
        getFutureForecast({ city: lastKnownCity, apiKey })
    ]);

    // 2. Synthesize the findings into a final response.
    return formatSnowResponse({
        city: lastKnownCity,
        historical: historicalContext,
        future: futureAnalysis
    });
}

// --- Internal Helper Functions ---

/**
 * Fetches and analyzes the 3-day hourly forecast for snow conditions.
 * @returns {Promise<object[]>} A list of hours where snow is possible.
 */
async function getFutureForecast({ city, apiKey }) {
    const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=3`;
    const data = await fetchApi(apiUrl);
    const potentialSnowHours = [];

    if (typeof data !== 'object' || !data.forecast?.forecastday) {
        return []; // Return empty if API fails
    }

    for (const day of data.forecast.forecastday) {
        for (const hour of day.hour) {
            // Conditions for potential snow: Cold temperature and sufficient moisture.
            const isColdEnough = hour.temp_c <= 3;
            const isMoistEnough = hour.humidity > 80 && (hour.will_it_snow > 0 || hour.chance_of_snow > 30 || hour.precip_mm > 0);

            if (isColdEnough && isMoistEnough) {
                potentialSnowHours.push({
                    date: day.date,
                    time: hour.time.split(' ')[1], // Extract "14:00" from "2023-12-25 14:00"
                    temp: hour.temp_c,
                    condition: hour.condition.text
                });
            }
        }
    }
    return potentialSnowHours;
}

/**
 * Checks the last few winters for historical precedent of snow.
 * @returns {Promise<boolean>} True if snow was found in recent history.
 */
async function getHistoricalContext({ city, apiKey }) {
    const currentYear = new Date().getFullYear();
    const yearsToCheck = [currentYear - 1, currentYear - 2];

    for (const year of yearsToCheck) {
        const dateToCheck = `${year}-02-15`; // Use a representative winter day
        const apiUrl = `https://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${encodeURIComponent(city)}&dt=${dateToCheck}`;
        const data = await fetchApi(apiUrl);

        if (typeof data === 'object' && data.forecast?.forecastday[0]) {
            const dailyData = data.forecast.forecastday[0].day;
            const isColdEnough = dailyData.maxtemp_c <= 5;
            const hasSnowMention = dailyData.condition.text.toLowerCase().includes('snow');
            if (isColdEnough && hasSnowMention) {
                return true; // Found a historical precedent, no need to check further.
            }
        }
    }
    return false; // No historical precedent found.
}

/**
 * Creates a natural language response from the analysis results.
 */
function formatSnowResponse({ city, historical, future }) {
    if (future.length > 0) {
        const firstOpportunity = future[0];
        let response = `Looking at the forecast for **${city}**, there are a few upcoming periods with conditions that could support snow.`;
        response += ` The earliest is around **${firstOpportunity.time} on ${firstOpportunity.date}**, with a temperature of **${firstOpportunity.temp}°C** and a forecast of "${firstOpportunity.condition}".`;

        if (historical) {
            response += "\n\nThis is plausible, as there have been days with snow in recent winters.";
        } else {
            response += "\n\nThis would be notable, as I didn't find similar conditions in the historical data for the last couple of years.";
        }
        return response;
    } else {
        let response = `Looking at the next 3-day forecast for **${city}**, I don't see any periods that meet the necessary conditions for snow (temp ≤ 3°C and high moisture).`;

        if (historical) {
            response += "\n\nHowever, historical data shows it has snowed in past winters, so conditions could certainly change later in the season.";
        } else {
            response += "\n\nThis is consistent with recent years, where I didn't find records of snow under these conditions either.";
        }
        return response;
    }
}


/**
 * A generic, encapsulated API fetching utility.
 */
async function fetchApi(apiUrl) {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return { error: { message: `HTTP error! status: ${response.status}` } };
        return await response.json();
    } catch (error) {
        console.error("API Fetch Error in snow.js:", error);
        return { error: { message: "Could not connect to the weather service." } };
    }
}