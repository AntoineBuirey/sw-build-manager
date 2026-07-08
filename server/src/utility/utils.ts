import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs';


/**
 * Get the server uptime in a human-readable format (HH:MM:SS), calculating the uptime from the process uptime and formatting it as a string with hours, minutes, and seconds
 * @returns The server uptime as a string in the format HH:MM:SS
 */
export function get_uptime() : string {
	const uptime = new Date(process.uptime() * 1000);
	let timestring = uptime.getUTCHours().toString().padStart(2, '0') + ':';
	timestring += uptime.getUTCMinutes().toString().padStart(2, '0') + ':';
	timestring += uptime.getUTCSeconds().toString().padStart(2, '0');
	return timestring;
}

/**
 * Enumeration representing the different environments the application can run in
 * - Development: Used for local development and testing, with verbose logging and debugging features enabled (developer machine)
 * - Production: Used for deployment in a live environment, with less verbose logging (production server)
 * - Testing: Used for automated testing, with specific configurations to facilitate testing and debugging (testing environment)
 */
export enum Environment {
	Development = 'development',
	Production = 'production',
	Testing = 'testing'
}


function getRootDirectory(): string {
	let currentDir = __dirname;
	while (!fs.existsSync(path.join(currentDir, '.env'))) {
		const parentDir = path.resolve(currentDir, '..');
		if (parentDir === currentDir) { // Reached the root of the filesystem
			throw new Error('Could not find parent directory containing .env file');
		}
		currentDir = parentDir;
	}
	return currentDir;
}

export const rootDirectory = getRootDirectory();


export function hashPassword(password: string): string {
	return createHash('sha1').update(password).digest('hex');
}


/**
 * Send a HEAD request to the specified URI and check if it is reachable (returns a 200 OK status code)
 * @param uri the URI to check
 */
export function checkUri(uri: string): Promise<boolean> {
	const http = uri.startsWith('https') ? require('https') : require('http');
	return new Promise((resolve) => {
		const request = http.request(uri, { method: 'HEAD' }, (response: any) => {
			resolve(response.statusCode === 200);
		});
		request.on('error', () => resolve(false));
		request.end();
	});
}


export namespace DateTime {
	interface ParsedTime {
		hours: number;
		minutes: number;
		seconds: number;
		hasAmPm: boolean;
	}

	function buildValidatedDate(year: number, month: number, day: number): Date {
		const d = new Date(year, month - 1, day);
		if (
			d.getFullYear() !== year ||
			d.getMonth() !== month - 1 ||
			d.getDate() !== day
		) {
			throw new Error('Invalid date value');
		}
		return d;
	}

	function parseTimeInput(time: string | number): ParsedTime {
		if (typeof time === 'number') {
			if (!Number.isFinite(time) || !Number.isInteger(time) || time < 0 || time > 23) {
				throw new Error('Invalid numeric time value');
			}
			return { hours: time, minutes: 0, seconds: 0, hasAmPm: false };
		}

		const normalizedTime = String(time).trim();
		if (!normalizedTime) {
			throw new Error('Invalid time format:' + time);
		}

		const amPmMatch = normalizedTime.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*([AaPp][Mm])$/);
		if (amPmMatch) {
			let hours = Number(amPmMatch[1]);
			const minutes = Number(amPmMatch[2]);
			const seconds = amPmMatch[3] ? Number(amPmMatch[3]) : 0;
			const amPm = amPmMatch[4].toUpperCase();

			if (hours < 1 || hours > 12 || minutes > 59 || seconds > 59) {
				throw new Error('Invalid AM/PM time value');
			}

			if (amPm === 'PM' && hours < 12) {
				hours += 12;
			} else if (amPm === 'AM' && hours === 12) {
				hours = 0;
			}

			return { hours, minutes, seconds, hasAmPm: true };
		}

		const hmsMatch = normalizedTime.match(/^(\d{1,2})(?::(\d{1,2}))(?::(\d{1,2}))?$/);
		if (hmsMatch) {
			const hours = Number(hmsMatch[1]);
			const minutes = Number(hmsMatch[2]);
			const seconds = hmsMatch[3] ? Number(hmsMatch[3]) : 0;
			if (hours > 23 || minutes > 59 || seconds > 59) {
				throw new Error('Invalid time value');
			}
			return { hours, minutes, seconds, hasAmPm: false };
		}

		const hourOnlyMatch = normalizedTime.match(/^(\d{1,2})$/);
		if (hourOnlyMatch) {
			const hours = Number(hourOnlyMatch[1]);
			if (hours > 23) {
				throw new Error('Invalid hour value');
			}
			return { hours, minutes: 0, seconds: 0, hasAmPm: false };
		}

		throw new Error('Invalid time format:' + time);
	}

	function parseDateInput(date: string | Date, hasAmPmHint: boolean): Date {
		if (date instanceof Date) {
			if (Number.isNaN(date.getTime())) {
				throw new Error('Invalid Date object');
			}
			return date;
		}

		const rawDate = String(date).trim();
		if (!rawDate) {
			throw new Error('Invalid date format');
		}

		const isoDateOnly = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
		if (isoDateOnly) {
			return buildValidatedDate(Number(isoDateOnly[1]), Number(isoDateOnly[2]), Number(isoDateOnly[3]));
		}

		const isoDateTime = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
		if (isoDateTime) {
			return buildValidatedDate(Number(isoDateTime[1]), Number(isoDateTime[2]), Number(isoDateTime[3]));
		}

		const slashDate = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (slashDate) {
			const part1 = Number(slashDate[1]);
			const part2 = Number(slashDate[2]);
			const year = Number(slashDate[3]);

			let day: number;
			let month: number;
			if (part1 > 12) {
				day = part1;
				month = part2;
			} else if (part2 > 12) {
				month = part1;
				day = part2;
			} else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
				// In this project, 02/04/2026 is mostly DD/MM/YYYY.
				day = part1;
				month = part2;
			} else if (hasAmPmHint) {
				// Values like 4/1/2026 often come from locale US formatting.
				month = part1;
				day = part2;
			} else {
				day = part1;
				month = part2;
			}

			return buildValidatedDate(year, month, day);
		}

		const dashDayFirst = rawDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
		if (dashDayFirst) {
			return buildValidatedDate(Number(dashDayFirst[3]), Number(dashDayFirst[2]), Number(dashDayFirst[1]));
		}

		const jsDate = new Date(rawDate);
		if (!Number.isNaN(jsDate.getTime())) {
			return buildValidatedDate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
		}

		throw new Error('Invalid date format');
	}

	/**
	 * Convert a date string and a time string into a Date object, combining the date and time strings into a single Date object representing the specified date and time
	 * Support multiple date formats (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY) and time formats (HH:MM, HH:MM:SS)
	 * Dates also works with slashes or dashes as separators, and time can be in 24-hour format with optional seconds
	 */
	export function string2datetime(date: string | Date, time: string | number): Date {
		const parsedTime = parseTimeInput(time);
		const parsedDate = parseDateInput(date, parsedTime.hasAmPm);

		return new Date(
			parsedDate.getFullYear(),
			parsedDate.getMonth(),
			parsedDate.getDate(),
			parsedTime.hours,
			parsedTime.minutes,
			parsedTime.seconds
		);
	}

	/**
	 * Convert a Date object into a date string and a time string, formatting the date and time components of the Date object into separate strings for easier display and manipulation
	 * Use formats YYYY-MM-DD for the date and HH:MM:SS for the time, with leading zeros for single-digit values
	 */
	export function datetime2string(datetime: Date): { date: string, time: string } {
		const year = datetime.getFullYear();
		const month = (datetime.getMonth() + 1).toString().padStart(2, '0');
		const day = datetime.getDate().toString().padStart(2, '0');
		const hours = datetime.getHours().toString().padStart(2, '0');
		const minutes = datetime.getMinutes().toString().padStart(2, '0');
		const seconds = datetime.getSeconds().toString().padStart(2, '0');
		return {
			date: `${year}-${month}-${day}`,
			time: `${hours}:${minutes}:${seconds}`
		};
	}
}

export function parseDateTimeSafe(rawDate: unknown, rawHour: unknown, fallback: Date): Date {
	try {
		const dateValue = (rawDate === undefined || rawDate === null || rawDate === '') ? fallback : rawDate;
		const hourValue = (rawHour === undefined || rawHour === null || rawHour === '') ? '00:00:00' : rawHour;
		return DateTime.string2datetime(dateValue as string | Date, hourValue as string | number);
	} catch {
		return fallback;
	}
}
