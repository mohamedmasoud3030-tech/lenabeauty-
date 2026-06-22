import React, { useState, useEffect } from 'react';
import { Download, Printer, Share2, FileText, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import printService from '../infrastructure/services/printService';
import brandingService from '../infrastructure/services/brandingService';

interface PayrollData {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  commission: number;
  bonus: number;
  deductions: number;
  advances: number;
  netSalary: number;
  workDays: number;
  overtimeHours: number;
  date: string;
}

interface PayrollSummary {
  totalEmployees: number;
  totalBaseSalary: number;
  totalCommissions: number;
  totalBonuses: number;
  totalDeductions: number;
  totalAdvances: number;
  totalNetSalary: number;
  period: string;
}

export default function PayrollPageEnhanced() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPayrollData();
  }, [selectedMonth]);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      // Simulated data - replace with actual API call
      const mockData: PayrollData[] = [
        {
          employeeId: 'EMP001',
          employeeName: 'فاطمة محمد',
          baseSalary: 500,
          commission: 150,
          bonus: 50,
          deductions: 30,
          advances: 100,
          netSalary: 570,
          workDays: 22,
          overtimeHours: 5,
          date: selectedMonth,
        },
        {
          employeeId: 'EMP002',
          employeeName: 'أحمد علي',
          baseSalary: 450,
          commission: 120,
          bonus: 40,
          deductions: 25,
          advances: 50,
          netSalary: 535,
          workDays: 22,
          overtimeHours: 3,
          date: selectedMonth,
        },
      ];

      setPayrollData(mockData);

      const summaryData: PayrollSummary = {
        totalEmployees: mockData.length,
        totalBaseSalary: mockData.reduce((sum, e) => sum + e.baseSalary, 0),
        totalCommissions: mockData.reduce((sum, e) => sum + e.commission, 0),
        totalBonuses: mockData.reduce((sum, e) => sum + e.bonus, 0),
        totalDeductions: mockData.reduce((sum, e) => sum + e.deductions, 0),
        totalAdvances: mockData.reduce((sum, e) => sum + e.advances, 0),
        totalNetSalary: mockData.reduce((sum, e) => sum + e.netSalary, 0),
        period: selectedMonth,
      };

      setSummary(summaryData);
    } finally {
      setLoading(false);
    }
  };

  const generatePayrollHTML = (): string => {
    if (!summary) return '';

    return `
      <div class="section">
        <h2 class="text-lg font-bold mb-3">${isArabic ? 'كشف الرواتب' : 'Payroll Report'}</h2>
        <p class="mb-3">${isArabic ? 'الفترة' : 'Period'}: ${summary.period}</p>
      </div>

      <div class="section">
        <div class="section-title">${isArabic ? 'ملخص الرواتب' : 'Payroll Summary'}</div>
        <table>
          <tr>
            <td class="font-bold">${isArabic ? 'عدد الموظفين' : 'Total Employees'}:</td>
            <td class="text-right">${summary.totalEmployees}</td>
          </tr>
          <tr>
            <td class="font-bold">${isArabic ? 'الرواتب الأساسية' : 'Base Salaries'}:</td>
            <td class="text-right">${summary.totalBaseSalary.toFixed(3)}</td>
          </tr>
          <tr>
            <td class="font-bold">${isArabic ? 'العمولات' : 'Commissions'}:</td>
            <td class="text-right">${summary.totalCommissions.toFixed(3)}</td>
          </tr>
          <tr>
            <td class="font-bold">${isArabic ? 'المكافآت' : 'Bonuses'}:</td>
            <td class="text-right">${summary.totalBonuses.toFixed(3)}</td>
          </tr>
          <tr>
            <td class="font-bold">${isArabic ? 'الخصومات' : 'Deductions'}:</td>
            <td class="text-right">-${summary.totalDeductions.toFixed(3)}</td>
          </tr>
          <tr>
            <td class="font-bold">${isArabic ? 'السلف' : 'Advances'}:</td>
            <td class="text-right">-${summary.totalAdvances.toFixed(3)}</td>
          </tr>
          <tr style="background-color: var(--primary-color); color: white;">
            <td class="font-bold">${isArabic ? 'إجمالي الرواتب الصافية' : 'Total Net Salary'}:</td>
            <td class="text-right font-bold">${summary.totalNetSalary.toFixed(3)}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">${isArabic ? 'تفاصيل الموظفين' : 'Employee Details'}</div>
        <table>
          <thead>
            <tr>
              <th>${isArabic ? 'الموظف' : 'Employee'}</th>
              <th>${isArabic ? 'الراتب الأساسي' : 'Base'}</th>
              <th>${isArabic ? 'العمولة' : 'Commission'}</th>
              <th>${isArabic ? 'الخصم' : 'Deduction'}</th>
              <th>${isArabic ? 'السلفة' : 'Advance'}</th>
              <th>${isArabic ? 'الصافي' : 'Net'}</th>
            </tr>
          </thead>
          <tbody>
            ${payrollData.map(emp => `
              <tr>
                <td>${emp.employeeName}</td>
                <td class="text-right">${emp.baseSalary.toFixed(3)}</td>
                <td class="text-right">${emp.commission.toFixed(3)}</td>
                <td class="text-right">${emp.deductions.toFixed(3)}</td>
                <td class="text-right">${emp.advances.toFixed(3)}</td>
                <td class="text-right font-bold">${emp.netSalary.toFixed(3)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const handlePrint = () => {
    const html = generatePayrollHTML();
    printService.printDocument(html, { paperSize: 'A4', filename: `Payroll-${selectedMonth}` });
  };

  const handleExportPDF = async () => {
    const html = generatePayrollHTML();
    await printService.exportToPDF(html, `Payroll-${selectedMonth}.pdf`, { paperSize: 'A4' });
  };

  const handleShare = async () => {
    const html = generatePayrollHTML();
    await printService.shareDocument(html, `Payroll-${selectedMonth}.pdf`, 'whatsapp');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {isArabic ? 'إدارة الرواتب' : 'Payroll Management'}
          </h1>
          <p className="text-gray-400">
            {isArabic ? 'إدارة رواتب الموظفين والعمولات' : 'Manage employee salaries and commissions'}
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                {isArabic ? 'اختر الشهر' : 'Select Month'}
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <Printer className="w-5 h-5" />
                {isArabic ? 'طباعة' : 'Print'}
              </button>

              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                <Download className="w-5 h-5" />
                {isArabic ? 'تصدير PDF' : 'Export PDF'}
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              >
                <Share2 className="w-5 h-5" />
                {isArabic ? 'مشاركة' : 'Share'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{isArabic ? 'الموظفون' : 'Employees'}</p>
                  <p className="text-2xl font-bold text-white">{summary.totalEmployees}</p>
                </div>
                <Users className="w-10 h-10 text-purple-400 opacity-50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{isArabic ? 'الرواتب الأساسية' : 'Base Salaries'}</p>
                  <p className="text-2xl font-bold text-white">{summary.totalBaseSalary.toFixed(0)}</p>
                </div>
                <DollarSign className="w-10 h-10 text-green-400 opacity-50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{isArabic ? 'العمولات' : 'Commissions'}</p>
                  <p className="text-2xl font-bold text-white">{summary.totalCommissions.toFixed(0)}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{isArabic ? 'الصافي' : 'Net Salary'}</p>
                  <p className="text-2xl font-bold text-white">{summary.totalNetSalary.toFixed(0)}</p>
                </div>
                <FileText className="w-10 h-10 text-orange-400 opacity-50" />
              </div>
            </div>
          </div>
        )}

        {/* Payroll Table */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-xl font-bold text-white mb-4">
            {isArabic ? 'تفاصيل الرواتب' : 'Payroll Details'}
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-4 text-gray-300">{isArabic ? 'الموظف' : 'Employee'}</th>
                  <th className="text-right py-3 px-4 text-gray-300">{isArabic ? 'الراتب الأساسي' : 'Base'}</th>
                  <th className="text-right py-3 px-4 text-gray-300">{isArabic ? 'العمولة' : 'Commission'}</th>
                  <th className="text-right py-3 px-4 text-gray-300">{isArabic ? 'المكافأة' : 'Bonus'}</th>
                  <th className="text-right py-3 px-4 text-gray-300">{isArabic ? 'الخصم' : 'Deduction'}</th>
                  <th className="text-right py-3 px-4 text-gray-300">{isArabic ? 'السلفة' : 'Advance'}</th>
                  <th className="text-right py-3 px-4 text-white font-bold">{isArabic ? 'الصافي' : 'Net'}</th>
                </tr>
              </thead>
              <tbody>
                {payrollData.map((emp, idx) => (
                  <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition">
                    <td className="py-3 px-4 text-white">{emp.employeeName}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{emp.baseSalary.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-green-400">{emp.commission.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-blue-400">{emp.bonus.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-red-400">-{emp.deductions.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-orange-400">-{emp.advances.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-white font-bold">{emp.netSalary.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
