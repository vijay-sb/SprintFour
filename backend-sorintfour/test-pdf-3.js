import { readFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';

async function run() {
  try {
    const buffer = readFileSync('package.json'); // Just to see if it parses
    const parser = new PDFParse({});
    const res = await parser.load(buffer);
    const text = await parser.getText();
    console.log("Success");
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
