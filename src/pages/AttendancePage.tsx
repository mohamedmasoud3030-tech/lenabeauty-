import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Fingerprint, Eye, Scan, Smartphone, Download, Filter, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import DemoDataBanner from '../shared/components/DemoDataBanner';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: Date;
  checkInTime: string;
  checkOutTime?: string;
  biometricType: 'fingerprint' | 'face' | 'iris' | 'mobile' | 'manual';
  workHours: number;
  status: 'present' | 'late' | 'absent' | 'half-day';
  notes?: string;
}

interface BiometricDevice {
  id: string;
  name: string;
  type: 'fingerprint' | 'face' | 'iris' | 'mobile';
  status: 'active' | 'inactive';
  lastSync: Date;
  recordsCount: number;
}

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  halfDays: number;
  totalWorkHours: number;
  averageWorkHours: number;
  attendancePercentage: number;
}

const MOCK_ATTENDANCE_DATA: AttendanceRecord[] = [
  {
    id: 'att_1',
    employeeId: 'emp_1',
    employeeName: 'فاطمة محمد',
    date: new Date('2026-06-23'),
    checkInTime: '08:00',
    checkOutTime: '17:30',
    biometricType: 'fingerprint',
    workHours: 9.5,
    status: 'present',
  },
  {
    id: 'att_2',
    employeeId: 'emp_2',
    employeeName: 'نور علي',
    date: new Date('2026-06-23'),
    checkInTime: '08:15',
    checkOutTime: '17:45',
    biometricType: 'face',
    workHours: 9.5,
    status: 'late',
    notes: 'تأخير 15 دقيقة',
  },
  {
    id: 'att_3',
    employeeId: 'emp_3',
    employeeName: 'ليلى أحمد',
    date: new Date('2026-06-23'),
    checkInTime: '08:00',
    checkOutTime: '13:00',
    biometricType: 'iris',
    workHours: 5,
    status: 'half-day',
    notes: 'إجازة نصف يوم',
  },
];

const MOCK_BIOMETRIC_DEVICES: BiometricDevice[] = [
  {
    id: 'dev_1',
    name: 'جهاز البصمة - المدخل',
    type: 'fingerprint',
    status: 'active',
    lastSync: new Date('2026-06-23 17:30'),
    recordsCount: 145,
  },
  {
    id: 'dev_2',
    name: 'كاميرا التعرف على الوجه',
    type: 'face',
    status: 'active',
    lastSync: new Date('2026-06-23 17:25'),
    recordsCount: 89,
  },
  {
    id: 'dev_3',
    name: 'ماسح القزحية',
    type: 'iris',
    status: 'inactive',
    lastSync: new Date('2026-06-22 18:00'),
    recordsCount: 34,
  },
];

const ATTENDANCE_TREND = [
  { date: '18 يونيو', present: 3, late: 0, absent: 0 },
  { date: '19 يونيو', present: 3, late: 1, absent: 0 },
  { date: '20 يونيو', present: 2, late: 1, absent: 1 },
  { date: '21 يونيو', present: 3, late: 0, absent: 0 },
  { date: '22 يونيو', present: 3, late: 0, absent: 0 },
  { date: '23 يونيو', present: 3, late: 1, absent: 0 },
];

const AttendancePage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('emp_1');
  const [dateRange, setDateRange] = useState('month');
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const filteredRecords = useMemo(() => {
    return MOCK_ATTENDANCE_DATA.filter((record) => record.employeeId === selectedEmployee);
  }, [selectedEmployee]);

  const attendanceSummary: AttendanceSummary = {
    totalDays: 22,
    presentDays: 20,
    lateDays: 2,
    absentDays: 0,
    halfDays: 0,
    totalWorkHours: 165,
    averageWorkHours: 7.5,
    attendancePercentage: 95,
  };

  const biometricDistribution = [
    { name: 'بصمة الإصبع', value: 45, color: '#3b82f6' },
    { name: 'التعرف على الوجه', value: 35, color: '#10b981' },
    { name: 'ماسح القزحية', value: 15, color: '#f59e0b' },
    { name: 'الهاتف الذكي', value: 5, color: '#8b5cf6' },
  ];

  return (
    <div className="space-y-6">
      <DemoDataBanner />
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Fingerprint className="w-8 h-8 text-blue-600" />
          {t('Attendance & Biometric')}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeviceModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            <Plus className="w-4 h-4" />
            إضافة جهاز
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          >
            <Download className="w-4 h-4" />
            استيراد السجلات
          </button>
        </div>
      </div>

      {/* Biometric Devices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MOCK_BIOMETRIC_DEVICES.map((device) => (
          <div key={device.id} className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800">{device.name}</h3>
                <p className="text-sm text-gray-600">
                  {device.type === 'fingerprint' && '👆 بصمة الإصبع'}
                  {device.type === 'face' && '👤 التعرف على الوجه'}
                  {device.type === 'iris' && '👁️ ماسح القزحية'}
                  {device.type === 'mobile' && '📱 الهاتف الذكي'}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold ${
                  device.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {device.status === 'active' ? '✓ نشط' : '✗ معطل'}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">آخر مزامنة:</span>
                <span className="font-bold">{device.lastSync.toLocaleString('ar-SA')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">عدد السجلات:</span>
                <span className="font-bold text-blue-600">{device.recordsCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">نسبة الحضور</p>
          <p className="text-3xl font-bold text-green-600">{attendanceSummary.attendancePercentage}%</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">أيام الحضور</p>
          <p className="text-3xl font-bold text-blue-600">{attendanceSummary.presentDays}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">أيام التأخير</p>
          <p className="text-3xl font-bold text-yellow-600">{attendanceSummary.lateDays}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">أيام الغياب</p>
          <p className="text-3xl font-bold text-red-600">{attendanceSummary.absentDays}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">إجمالي ساعات العمل</p>
          <p className="text-3xl font-bold text-purple-600">{attendanceSummary.totalWorkHours}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">اتجاه الحضور الأسبوعي</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ATTENDANCE_TREND}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="present" stroke="#10b981" name="حاضر" strokeWidth={2} />
              <Line type="monotone" dataKey="late" stroke="#f59e0b" name="متأخر" strokeWidth={2} />
              <Line type="monotone" dataKey="absent" stroke="#ef4444" name="غائب" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Biometric Type Distribution */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">توزيع أنواع البصمة</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={biometricDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} (${value}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {biometricDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b-2 border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">سجلات الحضور</h2>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="emp_1">فاطمة محمد</option>
              <option value="emp_2">نور علي</option>
              <option value="emp_3">ليلى أحمد</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">التاريخ</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">وقت الدخول</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">وقت الخروج</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">ساعات العمل</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">نوع البصمة</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">الحالة</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-bold text-gray-800">
                    {record.date.toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{record.checkInTime}</td>
                  <td className="px-6 py-4 text-gray-600">{record.checkOutTime || '-'}</td>
                  <td className="px-6 py-4 font-bold text-blue-600">{record.workHours} ساعة</td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {record.biometricType === 'fingerprint' && '👆 بصمة'}
                      {record.biometricType === 'face' && '👤 وجه'}
                      {record.biometricType === 'iris' && '👁️ قزحية'}
                      {record.biometricType === 'mobile' && '📱 هاتف'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        record.status === 'present'
                          ? 'bg-green-100 text-green-700'
                          : record.status === 'late'
                          ? 'bg-yellow-100 text-yellow-700'
                          : record.status === 'absent'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {record.status === 'present' && 'حاضر'}
                      {record.status === 'late' && 'متأخر'}
                      {record.status === 'absent' && 'غائب'}
                      {record.status === 'half-day' && 'نصف يوم'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{record.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">استيراد سجلات البصمة</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">اختر جهاز البصمة</label>
                <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none">
                  <option>جهاز البصمة - المدخل</option>
                  <option>كاميرا التعرف على الوجه</option>
                  <option>ماسح القزحية</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">نطاق التاريخ</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                  <span className="flex items-center">إلى</span>
                  <input
                    type="date"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold">
                  استيراد
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
