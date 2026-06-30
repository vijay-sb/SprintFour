import { readFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';

console.log(typeof PDFParse);
// Find out how to use the class
const methods = Object.getOwnPropertyNames(PDFParse.prototype);
console.log('Methods:', methods);
