import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATASET_DIR = join(process.cwd(), "dataset");

if (!existsSync(DATASET_DIR)) {
  mkdirSync(DATASET_DIR, { recursive: true });
}

const templates = [
  "CONFIDENTIAL MEMO\n\nTo: {name}\nFrom: Legal Dept\nDate: 10/25/2023\n\nThis memo concerns the ongoing litigation regarding {name} (DOB: {dob}, SSN: {ssn}). The client can be reached at {phone} or {email}. Their current address is {address}. Please ensure all financial transactions are routed to Account Number: {bank}.",
  "MEDICAL RECORDS RELEASE\n\nPatient Name: {name}\nMRN: {mrn}\nDate of Birth: {dob}\n\nI authorize the release of medical records to {name}, residing at {address}. Contact information: {phone}, {email}. Policy holder SSN is {ssn}.",
  "SETTLEMENT AGREEMENT\n\nThis agreement is made between {name} and MegaCorp. The plaintiff's contact details are: {address}, Phone: {phone}. Settlement funds of $45,000.00 will be wired to Bank Account {bank}. For tax purposes, SSN {ssn} will be used.",
  "DISCOVERY DOCUMENT - EXHIBIT A\n\nDefendant: {name}\nVehicle VIN: {vin}\nDriver's License: {dl}\n\nThe defendant was stopped on 04/12/2023. IP Address logged from their device: {ip}. They used Credit Card {cc} for the transaction.",
  "EMPLOYEE ONBOARDING FORM\n\nFull Name: {name}\nSSN: {ssn}\nDOB: {dob}\nAddress: {address}\nDirect Deposit Bank Account: {bank}\nEmergency Contact: {phone}\nPersonal Email: {email}\nPassport Number: {passport} for I-9 verification."
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(length: number): string {
  let res = "";
  for (let i = 0; i < length; i++) res += Math.floor(Math.random() * 10);
  return res;
}

const names = ["James Smith", "Maria Garcia", "David Johnson", "Linda Martinez", "Robert Brown", "Sarah Davis", "Michael Miller", "Emily Wilson", "William Moore", "Jessica Taylor", "John Anderson", "Amanda Thomas", "Richard Jackson", "Melissa White", "Joseph Harris", "Ashley Martin", "Thomas Thompson", "Megan Garcia", "Charles Martinez", "Stephanie Robinson"];
const domains = ["gmail.com", "yahoo.com", "outlook.com", "example.com", "company.net"];
const streets = ["Main St", "Maple Ave", "Oak Ln", "Pine Blvd", "Cedar Rd", "Elm Dr", "Washington St", "Park Ave"];
const cities = ["Springfield, IL", "Riverside, CA", "Franklin, TN", "Greenville, SC", "Bristol, VA"];

function generateDoc(index: number) {
  const name = randomElement(names);
  const ssn = `${randomDigits(3)}-${randomDigits(2)}-${randomDigits(4)}`;
  const dob = `0${Math.floor(Math.random()*9)+1}/${Math.floor(Math.random()*18)+10}/19${Math.floor(Math.random()*40)+50}`;
  const phone = `(${randomDigits(3)}) ${randomDigits(3)}-${randomDigits(4)}`;
  const email = `${name.replace(" ", ".").toLowerCase()}@${randomElement(domains)}`;
  const address = `${Math.floor(Math.random()*9000)+100} ${randomElement(streets)}, ${randomElement(cities)} ${randomDigits(5)}`;
  const bank = `${randomDigits(4)}-${randomDigits(4)}-${randomDigits(4)}`;
  const mrn = `MRN-${randomDigits(7)}`;
  const vin = `1HGCM82633A${randomDigits(6)}`;
  const dl = `DL-${randomDigits(3)}-${randomDigits(4)}-${randomDigits(4)}`;
  const ip = `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
  const cc = `4${randomDigits(3)}-${randomDigits(4)}-${randomDigits(4)}-${randomDigits(4)}`;
  const passport = `P${randomDigits(8)}`;

  let content = randomElement(templates);
  content = content.replace(/{name}/g, name);
  content = content.replace(/{ssn}/g, ssn);
  content = content.replace(/{dob}/g, dob);
  content = content.replace(/{phone}/g, phone);
  content = content.replace(/{email}/g, email);
  content = content.replace(/{address}/g, address);
  content = content.replace(/{bank}/g, bank);
  content = content.replace(/{mrn}/g, mrn);
  content = content.replace(/{vin}/g, vin);
  content = content.replace(/{dl}/g, dl);
  content = content.replace(/{ip}/g, ip);
  content = content.replace(/{cc}/g, cc);
  content = content.replace(/{passport}/g, passport);

  const filename = `document_${String(index).padStart(3, "0")}_${name.split(" ")[1]}.txt`;
  writeFileSync(join(DATASET_DIR, filename), content);
}

for (let i = 1; i <= 200; i++) {
  generateDoc(i);
}

console.log(`✅ Generated 200 mock documents in ${DATASET_DIR}`);
