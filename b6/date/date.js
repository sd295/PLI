// A helper function to ensure day/month are two digits
function padZero(num) {
    return String(num).padStart(2, '0');
}

// Define the formats we can understand and how to handle them
const supportedFormats = [
    {
        name: 'dd.mm.yyyy',
        regex: /^(\d{2})\.(\d{2})\.(\d{4})$/,
        parser: (match) => ({ day: parseInt(match[1]), month: parseInt(match[2]), year: parseInt(match[3]) }),
        formatter: (date) => `${padZero(date.getDate())}.${padZero(date.getMonth() + 1)}.${date.getFullYear()}`
    },
    {
        name: 'mm/dd/yyyy',
        regex: /^(\d{2})\/(\d{2})\/(\d{4})$/,
        parser: (match) => ({ day: parseInt(match[2]), month: parseInt(match[1]), year: parseInt(match[3]) }),
        formatter: (date) => `${padZero(date.getMonth() + 1)}/${padZero(date.getDate())}/${date.getFullYear()}`
    },
    {
        name: 'yyyy-mm-dd',
        regex: /^(\d{4})-(\d{2})-(\d{2})$/,
        parser: (match) => ({ day: parseInt(match[3]), month: parseInt(match[2]), year: parseInt(match[1]) }),
        formatter: (date) => `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
    }
];

/**
 * Detects, normalizes, and re-formats a date string, executing a callback with the normalized date.
 *
 * @param {string} dateString - The date string from the user.
 * @param {Function} actionCallback - An async function to execute with the normalized date.
 * @returns {Promise<object|null>} A promise that resolves to an object with the results.
 */
export default async function processDate(dateString, actionCallback) {
    let detectedFormat = null;
    let dateParts = null;

    for (const format of supportedFormats) {
        const match = dateString.match(format.regex);
        if (match) {
            detectedFormat = format;
            dateParts = format.parser(match);
            break;
        }
    }

    if (!detectedFormat) {
        return null;
    }

    const normalizedDate = `${dateParts.year}-${padZero(dateParts.month)}-${padZero(dateParts.day)}`;

    // Execute the provided callback with the normalized date
    const actionResult = await actionCallback(normalizedDate);

    const dateObject = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
    const reformattedDate = detectedFormat.formatter(dateObject);

    return {
        original: dateString,
        originalFormat: detectedFormat.name,
        normalized: normalizedDate,
        result: actionResult, // The result from the callback
        reformatted: reformattedDate
    };
}