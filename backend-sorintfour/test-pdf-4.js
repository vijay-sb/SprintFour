import { readFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';

async function run() {
  try {
    const buffer = readFileSync('package.json'); // use package.json as dummy
    const parser = new PDFParse({ data: buffer });
    // It's going to fail parsing package.json as PDF, but should instantiate
    console.log("Instantiated");
    const result = await parser.getText();
    console.log("Success", result);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
