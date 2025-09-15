/**
 * Generates a random 6-digit ID padded with zeros
 * @returns A string like "000123" or "456789"
 */
export const generateTimingId = (): string => {
	const randomNum = Math.floor(Math.random() * 1000000); // 0 to 999999
	return randomNum.toString().padStart(6, "0");
};
