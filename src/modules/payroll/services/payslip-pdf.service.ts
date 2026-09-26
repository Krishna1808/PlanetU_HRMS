import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface PayslipPdfData {
  organizationName: string;
  month: number;
  year: number;
  employee: {
    name: string;
    employeeCode: string;
    department: string;
    designation: string;
    dateOfJoining: string;
    bankName?: string;
    accountNumber?: string;
    panNumber?: string;
    uanNumber?: string;
  };
  attendance: {
    totalMonthDays: number;
    payableDays: number;
    lwpDays: number;
  };
  earnings: {
    basic: number;
    hra: number;
    specialAllowance: number;
    bonus: number;
    arrears: number;
    otherAdditions: number;
    totalEarnings: number;
  };
  deductions: {
    employeePf: number;
    employeeEsi: number;
    professionalTax: number;
    tds: number;
    otherDeductions: number;
    totalDeductions: number;
  };
  netPay: number;
  employerPf?: number;
  employerEsi?: number;
}

@Injectable()
export class PayslipPdfService {
  private readonly logger = new Logger(PayslipPdfService.name);

  /**
   * Generates a binary PDF buffer for a monthly payslip.
   */
  async generatePdf(data: PayslipPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Payslip_${data.employee.employeeCode}_${data.month}_${data.year}`,
            Author: 'PlanetU HRMS',
            Subject: 'Monthly Salary Payslip',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ];
        const monthName = monthNames[data.month - 1] || `Month ${data.month}`;

        // 1. BRAND HEADER
        doc
          .rect(40, 40, 515, 60)
          .fill('#1e1b4b');

        doc
          .fillColor('#ffffff')
          .fontSize(18)
          .font('Helvetica-Bold')
          .text(data.organizationName || 'PlanetU HRMS', 55, 52);

        doc
          .fillColor('#a5b4fc')
          .fontSize(10)
          .font('Helvetica')
          .text(`SALARY PAYSLIP — ${monthName.toUpperCase()} ${data.year}`, 55, 75);

        // 2. EMPLOYEE DETAILS GRID (Card Box)
        doc
          .rect(40, 110, 515, 100)
          .fillAndStroke('#f8fafc', '#cbd5e1');

        const col1X = 55;
        const col2X = 200;
        const col3X = 330;
        const col4X = 430;

        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
        doc.text('EMPLOYEE NAME', col1X, 122);
        doc.text('EMPLOYEE CODE', col1X, 142);
        doc.text('DEPARTMENT', col1X, 162);
        doc.text('DESIGNATION', col1X, 182);

        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica');
        doc.text(`:  ${data.employee.name}`, col2X - 50, 122);
        doc.text(`:  ${data.employee.employeeCode}`, col2X - 50, 142);
        doc.text(`:  ${data.employee.department}`, col2X - 50, 162);
        doc.text(`:  ${data.employee.designation}`, col2X - 50, 182);

        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
        doc.text('DATE OF JOINING', col3X, 122);
        doc.text('BANK ACCOUNT', col3X, 142);
        doc.text('PAN / UAN', col3X, 162);
        doc.text('PAYABLE / LWP DAYS', col3X, 182);

        const maskedAcc = data.employee.accountNumber
          ? `••••••${data.employee.accountNumber.slice(-4)}`
          : 'N/A';
        const panUan = `${data.employee.panNumber || 'N/A'} / ${data.employee.uanNumber || 'N/A'}`;

        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica');
        doc.text(`:  ${data.employee.dateOfJoining}`, col4X, 122);
        doc.text(`:  ${maskedAcc} (${data.employee.bankName || 'Bank'})`, col4X, 142);
        doc.text(`:  ${panUan}`, col4X, 162);
        doc.text(`:  ${data.attendance.payableDays} / ${data.attendance.lwpDays} (Total ${data.attendance.totalMonthDays})`, col4X, 182);

        // 3. EARNINGS & DEDUCTIONS TABLES
        const tableTop = 225;
        const boxWidth = 250;
        const boxHeight = 220;

        // Earnings Box
        doc.rect(40, tableTop, boxWidth, boxHeight).fillAndStroke('#ffffff', '#cbd5e1');
        doc.rect(40, tableTop, boxWidth, 24).fill('#4338ca');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('EARNINGS', 55, tableTop + 7);
        doc.text('AMOUNT (₹)', 220, tableTop + 7, { align: 'right', width: 60 });

        // Deductions Box
        doc.rect(305, tableTop, boxWidth, boxHeight).fillAndStroke('#ffffff', '#cbd5e1');
        doc.rect(305, tableTop, boxWidth, 24).fill('#be123c');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('DEDUCTIONS', 320, tableTop + 7);
        doc.text('AMOUNT (₹)', 485, tableTop + 7, { align: 'right', width: 60 });

        const fmt = (num: number) =>
          Number(num || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

        // Earnings Items
        const earningsRows = [
          { label: 'Basic Salary', val: data.earnings.basic },
          { label: 'House Rent Allowance (HRA)', val: data.earnings.hra },
          { label: 'Special Allowance', val: data.earnings.specialAllowance },
          { label: 'Performance Bonus / Incentive', val: data.earnings.bonus },
          { label: 'Arrears / Reimbursements', val: data.earnings.arrears + data.earnings.otherAdditions },
        ];

        let curY = tableTop + 32;
        doc.font('Helvetica').fontSize(8.5);
        for (const row of earningsRows) {
          doc.fillColor('#334155').text(row.label, 55, curY);
          doc.fillColor('#0f172a').text(fmt(row.val), 200, curY, { align: 'right', width: 80 });
          curY += 24;
        }

        // Deductions Items
        const deductionRows = [
          { label: 'Provident Fund (Employee PF)', val: data.deductions.employeePf },
          { label: 'Employee State Insurance (ESI)', val: data.deductions.employeeEsi },
          { label: 'Professional Tax (PT)', val: data.deductions.professionalTax },
          { label: 'Tax Deducted at Source (TDS)', val: data.deductions.tds },
          { label: 'Other Deductions / Penalties', val: data.deductions.otherDeductions },
        ];

        curY = tableTop + 32;
        for (const row of deductionRows) {
          doc.fillColor('#334155').text(row.label, 320, curY);
          doc.fillColor('#0f172a').text(fmt(row.val), 465, curY, { align: 'right', width: 80 });
          curY += 24;
        }

        // Subtotals Line
        const subtotalY = tableTop + boxHeight - 30;
        doc.rect(40, subtotalY, boxWidth, 30).fill('#e0e7ff');
        doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(9);
        doc.text('TOTAL EARNINGS (A)', 55, subtotalY + 9);
        doc.text(`₹ ${fmt(data.earnings.totalEarnings)}`, 200, subtotalY + 9, { align: 'right', width: 80 });

        doc.rect(305, subtotalY, boxWidth, 30).fill('#ffe4e6');
        doc.fillColor('#881337').font('Helvetica-Bold').fontSize(9);
        doc.text('TOTAL DEDUCTIONS (B)', 320, subtotalY + 9);
        doc.text(`₹ ${fmt(data.deductions.totalDeductions)}`, 465, subtotalY + 9, { align: 'right', width: 80 });

        // 4. NET PAY HIGHLIGHT BLOCK
        const netPayY = tableTop + boxHeight + 15;
        doc.rect(40, netPayY, 515, 65).fillAndStroke('#0f172a', '#1e293b');

        doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold').text('NET TAKE-HOME PAY (A - B)', 55, netPayY + 12);
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text(`₹ ${fmt(data.netPay)}`, 55, netPayY + 28);

        const words = this.numberToIndianWords(Math.round(data.netPay));
        doc.fillColor('#cbd5e1').fontSize(8.5).font('Helvetica-Oblique').text(`In words: ${words}`, 55, netPayY + 49);

        // 5. STATUTORY EMPLOYER CONTRIBUTIONS FOOTNOTE (Optional info)
        const statY = netPayY + 80;
        doc.fillColor('#64748b').fontSize(8).font('Helvetica');
        const pfEmp = data.employerPf ? `₹${fmt(data.employerPf)}` : 'N/A';
        const esiEmp = data.employerEsi ? `₹${fmt(data.employerEsi)}` : 'N/A';
        doc.text(`* Employer Contributions (Not deducted from salary): Employer PF: ${pfEmp} | Employer ESI: ${esiEmp}`, 40, statY);

        // 6. BOTTOM SIGN-OFF FOOTER
        doc
          .rect(40, statY + 20, 515, 45)
          .fillAndStroke('#f8fafc', '#e2e8f0');

        doc
          .fillColor('#475569')
          .fontSize(8)
          .font('Helvetica')
          .text(
            'This is a digitally generated document generated by PlanetU HRMS and does not require a physical signature.',
            55,
            statY + 30,
            { align: 'center', width: 485 },
          );

        doc
          .fillColor('#94a3b8')
          .fontSize(7.5)
          .text(
            `Generated on: ${new Date().toUTCString()} • Confidential Document`,
            55,
            statY + 44,
            { align: 'center', width: 485 },
          );

        doc.end();
      } catch (err: any) {
        this.logger.error(`Error generating PDF payslip: ${err?.message || err}`, err?.stack);
        reject(err);
      }
    });
  }

  /**
   * Converts a number to Indian currency words representation.
   * e.g. 45200 -> "Rupees Forty-Five Thousand Two Hundred Only"
   */
  private numberToIndianWords(num: number): string {
    if (num <= 0) return 'Rupees Zero Only';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const numToWordsLessThanThousand = (n: number): string => {
      let str = '';
      if (n >= 100) {
        str += `${units[Math.floor(n / 100)]} Hundred `;
        n %= 100;
      }
      if (n >= 20) {
        str += `${tens[Math.floor(n / 10)]} `;
        n %= 10;
      }
      if (n > 0) {
        str += `${units[n]} `;
      }
      return str.trim();
    };

    let result = '';
    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const remainder = num;

    if (crore > 0) result += `${numToWordsLessThanThousand(crore)} Crore `;
    if (lakh > 0) result += `${numToWordsLessThanThousand(lakh)} Lakh `;
    if (thousand > 0) result += `${numToWordsLessThanThousand(thousand)} Thousand `;
    if (remainder > 0) result += `${numToWordsLessThanThousand(remainder)} `;

    return `Rupees ${result.trim()} Only`;
  }
}
