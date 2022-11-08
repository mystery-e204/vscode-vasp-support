export function countUntil<T>(arr: Array<T>, condition: (val: T) => boolean): number {
    let idx = arr.findIndex(condition);
    if (idx === -1) {
        idx = arr.length;
    }
    return idx;
}

export function isNumber(str: string): boolean {
    return !Number.isNaN(+str);
}

export function isInteger(str: string): boolean {
    return isNumber(str) && Number.isSafeInteger(+str);
}

export function isLetters(str: string): boolean {
    return /^[a-zA-Z]+$/.test(str);
}