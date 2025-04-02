export class DateUtils {
    public static addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days); // Add the days
        return this.convertToIst(result);
    }

    public static subtractDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() - days); // Subtract the days
        return this.convertToIst(result);
    }

    public static convertToIst(time): Date {

        const utcTime = time.getTime(); // Get the UTC time in milliseconds
        
        // Get the local timezone offset in minutes and convert it to milliseconds
        const localOffset = time.getTimezoneOffset() * 60 * 1000;
        
        // Calculate the IST offset in milliseconds (5 hours 30 minutes = 19800 seconds = 19800000 ms)
        const istOffset = 5.5 * 60 * 60 * 1000;
        
        // Calculate the IST time by subtracting the local offset and adding the IST offset
        let istTime = new Date(utcTime - localOffset + istOffset);
        
        // Set the IST time to 12:00 AM (midnight)
        istTime.setHours(0, 0, 0, 0);
        return istTime;
    }
}
export enum DateFormats {
    FULL_DATE = "EEEE, MMMM d, yyyy",
    ISO_DATE = "yyyy-MM-dd"
}