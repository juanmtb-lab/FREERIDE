import { GarminConnect } from 'garmin-connect';

const GC = new GarminConnect({ username: 'test', password: 'test' });

console.log("GarminConnect Prototype Methods:");
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(GC)));
