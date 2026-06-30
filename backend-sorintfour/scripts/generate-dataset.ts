import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATASET_DIR = join(process.cwd(), "dataset");

if (!existsSync(DATASET_DIR)) {
  mkdirSync(DATASET_DIR, { recursive: true });
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
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

function generateConfidentialMemo(params: any): string {
  const lines: string[] = [];
  lines.push(`# CONFIDENTIAL LITIGATION MEMORANDUM`);
  lines.push(``);
  lines.push(`**DATE:** October 25, 2023`);
  lines.push(`**TO:** Senior Litigation Partner`);
  lines.push(`**FROM:** Legal Department`);
  lines.push(`**RE:** Pending Case Evaluation for client ${params.name}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## I. PRIVILEGE WARNING`);
  lines.push(`This document contains attorney work product and attorney-client communications. Do not disclose.`);
  lines.push(``);
  lines.push(`## II. CLIENT PROFILE`);
  lines.push(`* **Full Name:** client ${params.name}`);
  lines.push(`* **Date of Birth:** ${params.dob}`);
  lines.push(`* **Social Security Number:** ${params.ssn}`);
  lines.push(`* **Billing Account Number:** ${params.bank}`);
  lines.push(`* **Phone Number:** ${params.phone}`);
  lines.push(`* **Email Address:** ${params.email}`);
  lines.push(`* **Primary Address:** ${params.address}`);
  lines.push(``);
  lines.push(`## III. LITIGATION BACKGROUND`);
  lines.push(`The matter arises out of a breach of contract and intellectual property dispute between our client, client ${params.name}, and the opposition. The client alleges that the opposition obtained proprietary information through unauthorized digital access.`);
  lines.push(``);
  for (let i = 1; i <= 30; i++) {
    lines.push(`Review of evidence packet #${100 + i} shows substantial alignment with client claims. Verification of the electronic transactions and communication logs is ongoing. We expect key depositions to occur in early winter. Legislative updates in IP law may affect our strategy.`);
  }
  lines.push(``);
  lines.push(`## IV. TRANSACTION AUDIT SUMMARY`);
  lines.push(`| Date | Description | Amount | Status |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (let i = 1; i <= 20; i++) {
    lines.push(`| 10/${i}/2023 | Retainer Billing #${1000 + i} | \$${200 + i * 50}.00 | Processed |`);
  }
  lines.push(``);
  lines.push(`## V. COMMUNICATION HISTORY LOG`);
  lines.push(`Logs obtained from client ${params.name}'s corporate phone, account billing ${params.bank}:`);
  for (let i = 1; i <= 45; i++) {
    lines.push(`- **10/${i}/2023 10:15 AM:** Outgoing call to witness ${params.name} regarding invoice audit.`);
    lines.push(`- **10/${i}/2023 02:30 PM:** Received email from ${params.email} confirming document receipt.`);
  }
  lines.push(``);
  lines.push(`## VI. DISCOVERY TIMELINE AND AUDIT TRAIL`);
  for (let i = 1; i <= 40; i++) {
    lines.push(`**Day ${i} of Discovery:** Received file batch ${i}. Examiners checked for relevant metadata.`);
  }
  lines.push(``);
  lines.push(`## VII. WITNESS LIST`);
  for (let i = 1; i <= 15; i++) {
    lines.push(`### Witness ${i}`);
    lines.push(`* Name: ${randomElement(names)}`);
    lines.push(`* Phone: (${randomDigits(3)}) ${randomDigits(3)}-${randomDigits(4)}`);
  }
  lines.push(``);
  lines.push(`## VIII. CERTIFICATION OF AUTHENTICITY`);
  lines.push(`I certify that the information in this litigation dossier is assembled for discovery review.`);
  lines.push(`**Signed:** Dataset Generation Unit`);
  return lines.join("\n");
}

function generateMedicalRecordsRelease(params: any): string {
  const lines: string[] = [];
  lines.push(`# CLINICAL INTAKE & MEDICAL RECORDS RELEASE`);
  lines.push(``);
  lines.push(`**PATIENT:** patient ${params.name}`);
  lines.push(`**MRN:** ${params.mrn}`);
  lines.push(`**DOB:** ${params.dob}`);
  lines.push(`**SSN:** ${params.ssn}`);
  lines.push(`**PHONE:** ${params.phone}`);
  lines.push(`**EMAIL:** ${params.email}`);
  lines.push(`**ADDRESS:** ${params.address}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## I. PATIENT INTAKE SUMMARY`);
  lines.push(`Patient patient ${params.name} presented for evaluation of chronic symptoms. Clinical history indicates long-standing management under primary care physicians. This records packet details historical care records.`);
  lines.push(``);
  for (let i = 1; i <= 40; i++) {
    lines.push(`Diagnostic review update #${200 + i}: Patient checked in at the outpatient clinic. Vitals recorded within normal ranges. Doctor reviewed previous lab results and adjusted treatment plan accordingly.`);
  }
  lines.push(``);
  lines.push(`## II. MEDICAL VISITATION SCHEDULE`);
  lines.push(`| Visit Date | Provider | Department | Diagnosis |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (let i = 1; i <= 30; i++) {
    lines.push(`| 09/${i}/2023 | Dr. ${randomElement(names).split(" ")[1]} | General Medicine | Billing Code #${100 + i} |`);
  }
  lines.push(``);
  lines.push(`## III. CLINICAL OBSERVATIONS LOG`);
  for (let i = 1; i <= 50; i++) {
    lines.push(`- **Visit ${i} Log:** Patient patient ${params.name} reports progress. Symptoms remain stable under current therapeutic dose. Next check-in scheduled in 2 weeks.`);
  }
  lines.push(``);
  lines.push(`## IV. AUTHORIZATION FOR DISCLOSURE OF HEALTH INFORMATION`);
  for (let i = 1; i <= 50; i++) {
    lines.push(`I hereby authorize disclosure of all my medical files, billing histories, and diagnostics. This consent is active for 12 months. Revocation must be filed in writing to the clinic billing department.`);
  }
  lines.push(``);
  lines.push(`## V. ATTENDING PHYSICIANS`);
  for (let i = 1; i <= 15; i++) {
    lines.push(`* Physician Name: Dr. ${randomElement(names)}`);
    lines.push(`* Clinic Address: ${randomElement(streets)}, ${randomElement(cities)}`);
  }
  lines.push(``);
  lines.push(`## VI. CERTIFICATION`);
  lines.push(`Document prepared in compliance with HIPAA privacy standards. Synthetically generated.`);
  lines.push(`**Examiner:** Clinical Data Team`);
  return lines.join("\n");
}

function generateSettlementAgreement(params: any): string {
  const lines: string[] = [];
  lines.push(`# FORMAL SETTLEMENT AND RELEASE AGREEMENT`);
  lines.push(``);
  lines.push(`This Settlement and Release Agreement ("Agreement") is made between:`);
  lines.push(`**PLAINTIFF:** plaintiff ${params.name}`);
  lines.push(`**ADDRESS:** ${params.address}`);
  lines.push(`**CONTACT:** ${params.phone} / ${params.email}`);
  lines.push(`**SSN FOR TAX PURPOSES:** ${params.ssn}`);
  lines.push(`**BANK ACCOUNT FOR WIRE TRANSFERS:** ${params.bank}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## RECITALS`);
  for (let i = 1; i <= 35; i++) {
    lines.push(`WHEREAS, Plaintiff ${params.name} filed complaints alleging contract breaches, and WHEREAS, Megacorp disputes all claims, and WHEREAS, both parties now wish to resolve all disputes without further litigation.`);
  }
  lines.push(``);
  lines.push(`## TERMS OF AGREEMENT`);
  lines.push(`1. **Settlement Payment:** Megacorp will pay a total of \$45,000.00 to Bank Account ${params.bank} within 14 days.`);
  for (let i = 2; i <= 30; i++) {
    lines.push(`${i}. **Clause ${i}:** Both parties agree to waive any future claims regarding incident #${5000 + i}. Mutual releases are binding upon signatures and payment confirmation.`);
  }
  lines.push(``);
  lines.push(`## PAYMENT SCHEDULE`);
  lines.push(`| Installment | Amount | Due Date | Target Bank Account |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (let i = 1; i <= 25; i++) {
    lines.push(`| Installment #${i} | \$3,000.00 | 11/${i}/2023 | Account ${params.bank} |`);
  }
  lines.push(``);
  lines.push(`## COVENANTS AND STIPULATIONS`);
  for (let i = 1; i <= 50; i++) {
    lines.push(`The parties agree that this settlement is not an admission of liability. Neither party shall make disparaging remarks. Confidentiality must be maintained at all times under penalty of contract breach.`);
  }
  lines.push(``);
  lines.push(`## LEGAL REPRESENTATIVES`);
  for (let i = 1; i <= 15; i++) {
    lines.push(`* Attorney for Plaintiff: ${randomElement(names)}, Esq.`);
    lines.push(`* Counsel Phone: (${randomDigits(3)}) ${randomDigits(3)}-${randomDigits(4)}`);
  }
  lines.push(``);
  lines.push(`## CERTIFICATION`);
  lines.push(`Executed on this 30th day of June, 2026.`);
  lines.push(`**Signed:** Legal Registry Services`);
  return lines.join("\n");
}

function generateDiscoveryDocument(params: any): string {
  const lines: string[] = [];
  lines.push(`# DISCOVERY DOCUMENT – EXHIBIT A`);
  lines.push(``);
  lines.push(`**FOR TESTING AND DATASET GENERATION PURPOSES ONLY**`);
  lines.push(`**ALL NAMES, IDENTIFIERS, AND NUMBERS BELOW ARE FICTIONAL**`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## CASE INFORMATION`);
  lines.push(``);
  lines.push(`**Case Number:** CR-2023-0412-1187`);
  lines.push(`**Court:** Superior Court of Redwood County`);
  lines.push(`**Division:** Criminal Investigation Unit`);
  lines.push(`**Date Filed:** April 19, 2023`);
  lines.push(`**Document Type:** Discovery Exhibit A – Traffic Stop and Associated Digital Evidence`);
  lines.push(``);
  lines.push(`### Defendant Information`);
  lines.push(``);
  lines.push(`* **Name:** defendant ${params.name}`);
  lines.push(`* **Date of Birth:** ${params.dob}`);
  lines.push(`* **Driver's License Number:** ${params.dl}`);
  lines.push(`* **Vehicle VIN:** ${params.vin}`);
  lines.push(`* **Vehicle Registration Number:** RT-${randomDigits(4)}-KM`);
  lines.push(`* **Registered Address:** ${params.address}`);
  lines.push(`* **Phone Number:** ${params.phone}`);
  lines.push(`* **Email Address:** ${params.email}`);
  lines.push(``);
  lines.push(`### Emergency Contact`);
  lines.push(``);
  lines.push(`* **Name:** ${randomElement(names).split(" ")[0]} ${params.name.split(" ")[1]}`);
  lines.push(`* **Relationship:** Relative`);
  lines.push(`* **Phone Number:** (${randomDigits(3)}) ${randomDigits(3)}-${randomDigits(4)}`);
  lines.push(`* **Address:** ${randomElement(streets)}, ${randomElement(cities)}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# INCIDENT SUMMARY`);
  lines.push(``);
  lines.push(`On April 12, 2023, at approximately 8:42 PM, Officer Daniel Cooper, Badge No. 1742, observed a silver sedan traveling eastbound on Interstate Route 17 near Mile Marker 84. The vehicle was observed changing lanes without signaling and was subsequently stopped for a traffic investigation.`);
  lines.push(``);
  lines.push(`The driver identified herself as defendant ${params.name} and produced a driver's license bearing number ${params.dl}. Vehicle registration records indicated that the vehicle was registered to the defendant.`);
  lines.push(``);
  lines.push(`During the stop, the defendant consented to a search of the vehicle's infotainment system and voluntarily surrendered a mobile device for inspection.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# VEHICLE INFORMATION`);
  lines.push(``);
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Make | Honda |`);
  lines.push(`| Model | Accord EX |`);
  lines.push(`| Year | 2003 |`);
  lines.push(`| Color | Silver |`);
  lines.push(`| VIN | ${params.vin} |`);
  lines.push(`| License Plate | 7BXM221 |`);
  lines.push(`| Registration Expiry | September 30, 2023 |`);
  lines.push(`| Insurance Policy Number | INS-${randomDigits(4)}-${randomDigits(4)}-CA |`);
  lines.push(`| Insurance Provider | Redwood Mutual Insurance |`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# OFFICER OBSERVATIONS`);
  lines.push(``);
  for (let i = 1; i <= 25; i++) {
    lines.push(`${i}. Officer noted observation #${i}: Defendant was cooperative but nervous. Infotainment system logs verified for compliance.`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# DIGITAL EVIDENCE SUMMARY`);
  lines.push(``);
  lines.push(`### Device Information`);
  lines.push(``);
  lines.push(`* **Manufacturer:** Samsung`);
  lines.push(`* **Model:** Galaxy S22`);
  lines.push(`* **Operating System:** Android 13`);
  lines.push(`* **Device Identifier:** DEV-${randomDigits(4)}-${randomDigits(4)}-AR`);
  lines.push(`* **IMEI:** 3589${randomDigits(11)}`);
  lines.push(`* **SIM Number:** 890141032111${randomDigits(8)}`);
  lines.push(``);
  lines.push(`### Network Information`);
  lines.push(``);
  lines.push(`* **Logged IP Address:** ${params.ip}`);
  lines.push(`* **Previous Connection:** 10.42.55.92`);
  lines.push(`* **Public Session Identifier:** PUB-${randomDigits(4)}-${randomDigits(4)}`);
  lines.push(`* **Wi-Fi SSID:** CedarCafe_Guest`);
  lines.push(`* **Connection Timestamp:** 04/12/2023 19:58:13`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# TRANSACTION INFORMATION`);
  lines.push(``);
  lines.push(`Investigators identified a purchase made shortly before the traffic stop.`);
  lines.push(``);
  lines.push(`* **Payment Method:** Credit Card`);
  lines.push(`* **Card Number:** ${params.cc}`);
  lines.push(`* **Transaction ID:** TXN-2023-0412-${randomDigits(5)}`);
  lines.push(`* **Merchant:** North Valley Fuel Center`);
  lines.push(`* **Purchase Amount:** \$61.28`);
  lines.push(`* **Authorization Code:** ${randomDigits(6)}`);
  lines.push(`* **Timestamp:** 04/12/2023 20:06:41`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# COMMUNICATION LOGS`);
  lines.push(``);
  lines.push(`### Call Records`);
  lines.push(``);
  lines.push(`| Time | Direction | Number |`);
  lines.push(`| --- | --- | --- |`);
  for (let i = 1; i <= 20; i++) {
    lines.push(`| 18:${10 + i} | Outgoing | (${randomDigits(3)}) ${randomDigits(3)}-${randomDigits(4)} |`);
  }
  lines.push(``);
  lines.push(`### Text Message Summary`);
  lines.push(``);
  for (let i = 1; i <= 25; i++) {
    lines.push(`${i}. Message discussing case detail #${i} with contact.`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# LOCATION HISTORY`);
  lines.push(``);
  lines.push(`| Timestamp | Location |`);
  lines.push(`| --- | --- |`);
  for (let i = 1; i <= 20; i++) {
    lines.push(`| 1${i}:00 | Station waypoint #${i} in Redwood County |`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# WITNESS INFORMATION`);
  lines.push(``);
  for (let i = 1; i <= 10; i++) {
    lines.push(`### Witness ${i}`);
    lines.push(`* Name: ${randomElement(names)}`);
    lines.push(`* Address: ${randomElement(streets)}, ${randomElement(cities)}`);
    lines.push(`* Phone: (${randomDigits(3)}) ${randomDigits(3)}-${randomDigits(4)}`);
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(``);
  lines.push(`# PROPERTY INVENTORY`);
  lines.push(``);
  for (let i = 1; i <= 25; i++) {
    lines.push(`${i}. Item #${i} retrieved from vehicle cargo.`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# FORENSIC NOTES`);
  lines.push(``);
  lines.push(`The device was assigned the following identifiers:`);
  lines.push(``);
  lines.push(`* Evidence Tag: EV-2023-004182`);
  lines.push(`* Storage Locker: B-17`);
  lines.push(`* Chain of Custody Form: COC-9917-A`);
  lines.push(`* Seizure Time: 21:11 PM`);
  lines.push(`* Examiner ID: EX-8820`);
  lines.push(``);
  lines.push(`Hash values generated:`);
  lines.push(``);
  lines.push(`* MD5: 7b61f7a4d2c5f08e99a6f7e3ab${randomDigits(6)}`);
  lines.push(`* SHA1: 4c6b35b2e3f4567811ab22cdd9988776${randomDigits(8)}`);
  lines.push(`* SHA256: b7819c2d6f92aefbb23811dd8821a5b7d3f17abcc99871234ddf${randomDigits(12)}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# CHRONOLOGICAL TIMELINE`);
  lines.push(``);
  for (let i = 1; i <= 25; i++) {
    lines.push(`**20:${10 + i} PM** – Incident checkpoint log ${i}.`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# INVESTIGATING OFFICERS`);
  lines.push(``);
  for (let i = 1; i <= 5; i++) {
    lines.push(`### Officer ${i}`);
    lines.push(`* Badge Number: ${1000 + i * 243}`);
    lines.push(`* Unit: Division ${i}`);
    lines.push(`* Contact: (555) 882-${1700 + i}`);
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(``);
  lines.push(`# CERTIFICATION`);
  lines.push(``);
  lines.push(`I certify that this document is a synthetic sample created for test purposes.`);
  lines.push(``);
  lines.push(`**Prepared By:** Dataset Generation Unit`);
  lines.push(`**END OF EXHIBIT A**`);
  return lines.join("\n");
}

function generateEmployeeOnboardingForm(params: any): string {
  const lines: string[] = [];
  lines.push(`# EMPLOYEE ONBOARDING DOSSIER & COMPLIANCE FILE`);
  lines.push(``);
  lines.push(`**EMPLOYEE:** mr. ${params.name}`);
  lines.push(`**SSN:** ${params.ssn}`);
  lines.push(`**DOB:** ${params.dob}`);
  lines.push(`**ADDRESS:** ${params.address}`);
  lines.push(`**PHONE:** ${params.phone}`);
  lines.push(`**EMAIL:** ${params.email}`);
  lines.push(`**BANK ACCOUNT FOR DIRECT DEPOSIT:** ${params.bank}`);
  lines.push(`**PASSPORT NUMBER:** ${params.passport}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## I. DIRECT DEPOSIT AUTHORIZATION`);
  lines.push(`I hereby authorize direct deposit transactions to my designated Bank Account ${params.bank}. I confirm this account belongs to me.`);
  lines.push(``);
  for (let i = 1; i <= 40; i++) {
    lines.push(`Compliance step #${300 + i}: HR processed and validated onboarding documents for mr. ${params.name}. Security review completed. Badge generation scheduled.`);
  }
  lines.push(``);
  lines.push(`## II. IT PROVISIONING LOG`);
  lines.push(`| Equipment ID | Category | Status | Assignee |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (let i = 1; i <= 25; i++) {
    lines.push(`| EQ-${100 + i} | Hardware | Provisioned | mr. ${params.name} |`);
  }
  lines.push(``);
  lines.push(`## III. IT PROVISIONING STEPS`);
  for (let i = 1; i <= 45; i++) {
    lines.push(`- **Step ${i}:** Set up credentials and email permissions for ${params.email}. Verified direct deposit ${params.bank} connection.`);
  }
  lines.push(``);
  lines.push(`## IV. COMPLIANCE POLICIES AND ACKNOWLEDGEMENTS`);
  for (let i = 1; i <= 50; i++) {
    lines.push(`Employee mr. ${params.name} acknowledges and agrees to comply with corporate security policy #${1000 + i}. Any violation may lead to contract termination.`);
  }
  lines.push(``);
  lines.push(`## V. HR STAFF REPRESENTATIVES`);
  for (let i = 1; i <= 15; i++) {
    lines.push(`* HR Coordinator: ${randomElement(names)}`);
    lines.push(`* Contact Ext: x${randomDigits(4)}`);
  }
  lines.push(``);
  lines.push(`## VI. CERTIFICATION`);
  lines.push(`I certify that the onboarding file is generated for testing purposes.`);
  lines.push(`**HR Coordinator:** Onboarding Services`);
  return lines.join("\n");
}

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

  const params = { name, ssn, dob, phone, email, address, bank, mrn, vin, dl, ip, cc, passport };

  const generators = [
    generateConfidentialMemo,
    generateMedicalRecordsRelease,
    generateSettlementAgreement,
    generateDiscoveryDocument,
    generateEmployeeOnboardingForm
  ] as const;

  const generator = generators[(index - 1) % generators.length]!;
  const content = generator(params);

  const filename = `document_${String(index).padStart(3, "0")}_${name.split(" ")[1]}.txt`;
  writeFileSync(join(DATASET_DIR, filename), content);
}

for (let i = 1; i <= 200; i++) {
  generateDoc(i);
}

console.log(`✅ Generated 200 mock documents in ${DATASET_DIR}`);
