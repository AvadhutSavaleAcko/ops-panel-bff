export function flattenObject(obj: any, prefix = ''): any {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? prefix + '.' : '';
        
        if (Array.isArray(obj[k])) {
            obj[k].forEach((item: any, index: number) => {
                if (typeof item === 'object' && item !== null) {
                    Object.assign(acc, flattenObject(item, `${pre}${k}.${index}`));
                } else {
                    acc[`${pre}${k}.${index}`] = item;
                }
            });
        } else if (typeof obj[k] === 'object' && obj[k] !== null) {
            Object.assign(acc, flattenObject(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }
        return acc;
    }, {});
}

