import { PayslipPdfService, PayslipPdfData } from '../src/modules/payroll/services/payslip-pdf.service';

describe('PayslipPdfService (Vector A4 PDF Document Generation)', () => {
  let service: PayslipPdfService;

  beforeEach(() => {
    service = new PayslipPdfService();
  });

  const mockPayslipData: PayslipPdfData = {
    organizationName: 'PlanetU Technologies Pvt Ltd',
    month: 9,
    year: 2026,
    employee: {
      name: 'Aditi Sharma',
      employeeCode: 'ENG-0042',
      department: 'Platform Engineering',
      designation: 'Senior Backend Engineer',
      dateOfJoining: '15 Jan 2024',
      bankName: 'HDFC Bank',
      accountNumber: 'XXXXXX9821',
      panNumber: 'ABCDE1234F',
      uanNumber: '100987654321',
    },
    attendance: {
      totalMonthDays: 30,
      payableDays: 30,
      lwpDays: 0,
    },
    earnings: {
      basic: 30000,
      hra: 15000,
      specialAllowance: 15000,
      bonus: 5000,
      arrears: 0,
      otherAdditions: 0,
      totalEarnings: 65000,
    },
    deductions: {
      employeePf: 1800,
      employeeEsi: 0,
      professionalTax: 200,
      tds: 2500,
      otherDeductions: 0,
      totalDeductions: 4500,
    },
    netPay: 60500,
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a valid PDF buffer with %PDF- header', async () => {
    const pdfBuffer = await service.generatePdf(mockPayslipData);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000); // Realistic PDF is at least several KB

    // Validate PDF magic bytes: '%PDF-'
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');
  });

  it('should handle zero deductions and round numbers properly without errors', async () => {
    const simpleData: PayslipPdfData = {
      ...mockPayslipData,
      earnings: {
        basic: 10000,
        hra: 5000,
        specialAllowance: 5000,
        bonus: 0,
        arrears: 0,
        otherAdditions: 0,
        totalEarnings: 20000,
      },
      deductions: {
        employeePf: 1200,
        employeeEsi: 150,
        professionalTax: 200,
        tds: 0,
        otherDeductions: 0,
        totalDeductions: 1550,
      },
      netPay: 18450,
    };

    const pdfBuffer = await service.generatePdf(simpleData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
