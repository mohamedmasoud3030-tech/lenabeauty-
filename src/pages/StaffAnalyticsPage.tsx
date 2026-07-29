import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Star, Award, Target, Users, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DemoDataBanner from '../shared/components/DemoDataBanner';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  rating: number;
  totalSales: number;
  servicesCompleted: number;
  customersServed: number;
  averageServiceTime: number;
  customerSatisfaction: number;
  performanceScore: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  target: number;
  percentage: number;
  status: 'excellent' | 'good' | 'average' | 'poor';
}

const STAFF_DATA: StaffMember[] = [
  {
    id: 'staff_1',
    name: 'فاطمة محمد',
    role: 'مصفف شعر',
    rating: 4.8,
    totalSales: 2500,
    servicesCompleted: 145,
    customersServed: 98,
    averageServiceTime: 32,
    customerSatisfaction: 96,
    performanceScore: 92,
    trend: 'up',
    trendPercentage: 12,
  },
  {
    id: 'staff_2',
    name: 'نور علي',
    role: 'متخصصة عناية',
    rating: 4.6,
    totalSales: 1800,
    servicesCompleted: 110,
    customersServed: 75,
    averageServiceTime: 45,
    customerSatisfaction: 94,
    performanceScore: 88,
    trend: 'up',
    trendPercentage: 8,
  },
  {
    id: 'staff_3',
    name: 'ليلى أحمد',
    role: 'متخصصة مساج',
    rating: 4.9,
    totalSales: 3200,
    servicesCompleted: 165,
    customersServed: 110,
    averageServiceTime: 55,
    customerSatisfaction: 98,
    performanceScore: 95,
    trend: 'up',
    trendPercentage: 15,
  },
];

const PERFORMANCE_CHART_DATA = [
  { name: 'فاطمة', sales: 2500, services: 145, satisfaction: 96 },
  { name: 'نور', sales: 1800, services: 110, satisfaction: 94 },
  { name: 'ليلى', sales: 3200, services: 165, satisfaction: 98 },
];

const SALES_TREND_DATA = [
  { week: 'أسبوع 1', sales: 600, target: 700 },
  { week: 'أسبوع 2', sales: 750, target: 700 },
  { week: 'أسبوع 3', sales: 820, target: 700 },
  { week: 'أسبوع 4', sales: 950, target: 700 },
];

const SERVICE_DISTRIBUTION = [
  { name: 'قص الشعر', value: 35, color: '#3b82f6' },
  { name: 'صبغة الشعر', value: 25, color: '#10b981' },
  { name: 'معالجة الشعر', value: 20, color: '#f59e0b' },
  { name: 'مساج الوجه', value: 12, color: '#8b5cf6' },
  { name: 'مساج الجسم', value: 8, color: '#ef4444' },
];

const StaffAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(STAFF_DATA[0]);
  const [timeRange, setTimeRange] = useState('month');

  const getStatusColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusLabel = (score: number) => {
    if (score >= 90) return 'ممتاز';
    if (score >= 80) return 'جيد جداً';
    if (score >= 70) return 'جيد';
    return 'يحتاج تحسين';
  };

  return (
    <div className="space-y-6">
      <DemoDataBanner />
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="w-8 h-8 text-blue-600" />
          {t('Staff Analytics & Performance')}
        </h1>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="week">هذا الأسبوع</option>
          <option value="month">هذا الشهر</option>
          <option value="quarter">هذا الربع</option>
          <option value="year">هذا العام</option>
        </select>
      </div>

      {/* Staff Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAFF_DATA.map((staff) => (
          <div
            key={staff.id}
            onClick={() => setSelectedStaff(staff)}
            className={`p-6 rounded-lg cursor-pointer transition-all ${
              selectedStaff?.id === staff.id
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                : 'bg-white border-2 border-gray-200 hover:border-blue-500'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{staff.name}</h3>
                <p className={selectedStaff?.id === staff.id ? 'text-blue-100' : 'text-gray-600'}>{staff.role}</p>
              </div>
              <div className={`flex items-center gap-1 ${selectedStaff?.id === staff.id ? 'text-yellow-300' : 'text-yellow-500'}`}>
                <Star className="w-5 h-5 fill-current" />
                <span className="font-bold">{staff.rating}</span>
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-3 text-sm ${selectedStaff?.id === staff.id ? 'text-blue-100' : 'text-gray-600'}`}>
              <div>
                <p className="opacity-75">المبيعات</p>
                <p className="font-bold text-lg">{staff.totalSales.toLocaleString()} OMR</p>
              </div>
              <div>
                <p className="opacity-75">الخدمات</p>
                <p className="font-bold text-lg">{staff.servicesCompleted}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${staff.performanceScore}%` }}
                ></div>
              </div>
              <span className={`font-bold text-sm ${selectedStaff?.id === staff.id ? 'text-white' : 'text-gray-700'}`}>
                {staff.performanceScore}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Staff Details */}
      {selectedStaff && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">{selectedStaff.name} - التفاصيل الشاملة</h2>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
              <p className="text-gray-600 text-sm">إجمالي المبيعات</p>
              <p className="text-3xl font-bold text-blue-600">{selectedStaff.totalSales.toLocaleString()} OMR</p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedStaff.trend === 'up' ? '↑' : selectedStaff.trend === 'down' ? '↓' : '→'}{' '}
                {selectedStaff.trendPercentage}% من الشهر الماضي
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
              <p className="text-gray-600 text-sm">الخدمات المنجزة</p>
              <p className="text-3xl font-bold text-green-600">{selectedStaff.servicesCompleted}</p>
              <p className="text-xs text-gray-500 mt-1">في هذا الشهر</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-l-4 border-purple-500">
              <p className="text-gray-600 text-sm">رضا العملاء</p>
              <p className="text-3xl font-bold text-purple-600">{selectedStaff.customerSatisfaction}%</p>
              <p className="text-xs text-gray-500 mt-1">متوسط التقييمات</p>
            </div>

            <div className={`rounded-lg p-4 border-l-4 ${getStatusColor(selectedStaff.performanceScore)}`}>
              <p className="text-gray-600 text-sm">درجة الأداء</p>
              <p className="text-3xl font-bold">{selectedStaff.performanceScore}</p>
              <p className="text-xs mt-1">{getStatusLabel(selectedStaff.performanceScore)}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Sales Trend */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-4">اتجاه المبيعات الأسبوعي</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={SALES_TREND_DATA}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#3b82f6" name="المبيعات الفعلية" strokeWidth={2} />
                  <Line type="monotone" dataKey="target" stroke="#10b981" name="الهدف" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Service Distribution */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-4">توزيع الخدمات</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={SERVICE_DISTRIBUTION} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} (${value}%)`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {SERVICE_DISTRIBUTION.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">متوسط وقت الخدمة</h4>
              <p className="text-3xl font-bold text-blue-600">{selectedStaff.averageServiceTime} دقيقة</p>
              <p className="text-sm text-gray-600 mt-2">متوسط المدة لكل خدمة</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">عدد العملاء</h4>
              <p className="text-3xl font-bold text-green-600">{selectedStaff.customersServed}</p>
              <p className="text-sm text-gray-600 mt-2">عملاء فريدين في هذا الشهر</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">متوسط الفاتورة</h4>
              <p className="text-3xl font-bold text-purple-600">{(selectedStaff.totalSales / selectedStaff.servicesCompleted).toFixed(2)} OMR</p>
              <p className="text-sm text-gray-600 mt-2">متوسط قيمة الخدمة</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Comparison Chart */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">مقارنة الأداء بين الموظفين</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={PERFORMANCE_CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="sales" fill="#3b82f6" name="المبيعات (OMR)" />
            <Bar dataKey="services" fill="#10b981" name="الخدمات المنجزة" />
            <Bar dataKey="satisfaction" fill="#f59e0b" name="رضا العملاء (%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          الرؤى والتوصيات
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Award className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-800">أفضل أداء</p>
              <p className="text-gray-600">ليلى أحمد تتصدر بأعلى درجة أداء (95%) وأعلى رضا عملاء (98%)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-800">فرص التحسين</p>
              <p className="text-gray-600">نور علي يمكنها تحسين سرعة الخدمة بمتوسط 45 دقيقة (أعلى من المتوسط)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-800">توصيات</p>
              <p className="text-gray-600">تقديم تدريب متقدم لفاطمة محمد لتحسين متوسط قيمة الفاتورة من 17.24 OMR</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffAnalyticsPage;
