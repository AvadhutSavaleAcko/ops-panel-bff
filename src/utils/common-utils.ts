export class CommonUtils {
    public static isNullOrEmpty(value: string | null | undefined): boolean {
        return value === null || value === undefined || value == '';
    }

    public static isNullOrEmptyArray(array: any[]): boolean {
        return Array.isArray(array) && array?.length === 0;
    }

    public static snakeToCamelCase(snakeCaseStr: string): string {
        return snakeCaseStr.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    public static epochToDate(epoch: number, isoFormat: boolean = false): string {
        if (!epoch) {
            return "";
        }
        if (isoFormat) {
            return new Date(epoch).toISOString();
        }
        return new Date(epoch).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        }).replace(/,/g, '');
    }

    public static filterJsonObjectToRetainSelectedKeyValPairs(obj: JsonObject, keysToKeep: string[]): JsonObject {
        const result: JsonObject = {};

        for (const key of keysToKeep) {
            if (key in obj) {
                result[key] = obj[key];
            }
        }

        return result;
    }

    public static removeKeyValuePairsFromJsonObject(obj: any, keys: string[]) {
        keys.forEach(key => {
            delete obj[key];
        });
    };

    public static getInrFormat(
        number: string | number | null,
        symbol = true
    ): string {
        if (!number) {
            return "";
        }
        number = Math.round(Number(number));
        const y = `${number}`.split(".");
        const x = y[0].toString();
        let lastThree = x.substring(x?.length - 3);
        const otherNumbers = x.substring(0, x?.length - 3);
        if (otherNumbers !== "") lastThree = `,${lastThree}`;
        let result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
        if (symbol) result = `${result}`;
        return result;
    }

    public static getFormattedDate(date: Date): string {
        // Format the date to "24 May 2024"
        let options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' };
        return date.toLocaleDateString('en-GB', options);
    }
    
    public static formatString(template, ...args) {
        return template?.replace(/{\$([0-9]+)}/g, (_, index) => {
            const argIndex = parseInt(index, 10);
            const value = args[argIndex];
    
            // If value is undefined or null, return an empty string
            return value != null ? value : '';
        });
    }

    public static convertToLakh(value?: string | number, convertMoreThanOneLakh:boolean = false, decimalPlaces: number = 0): number {
        if (!value) {
            return;
        }
        const num = typeof value === "string" ? parseInt(value, 10) : value;

        if(num<100000 && convertMoreThanOneLakh) {
            return num;
        }

        const lakhValue = num / 100000;
        return parseFloat(lakhValue.toFixed(decimalPlaces));
    }

    public static isLessThanXYearsPassed(givenYear, givenMonth, xYears) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-indexed month
      
        // Calculate the difference in years and months
        const yearDifference = currentYear - givenYear;
        const monthDifference = currentMonth - givenMonth;
      
        // Return true if less than xYears have passed
        return yearDifference < xYears || (yearDifference === xYears && monthDifference <= 0);
    }

}