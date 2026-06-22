import React, { useState, useMemo } from 'react';
import { DollarSign, Plus, Check, X, Clock, TrendingDown, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  requestDate: Date;
  approvalDate?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'deducted';
  reason: string;
  approvedBy?: string;
  deductionStartMonth?: string;
  monthlyDeduction: number;
  remainingBalance: number;
  notes?: string;
}

interface AdvanceSummary {
  totalAdvances: number;
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  totalDeducted: number;
  pendingAmount: number;
  approvedAmount: number;
}

const MOCK_ADVANCES: Advance[] = [
  {
    id: 'adv_1',
    employeeId: 'emp_1',
    employeeName: 'فاطمة محمد',
    amount: 200,
    requestDate: new Date('2026-06-15'),
    approvalDate: new Date('2026-06-16'),
    status: 'approved',
    reason: 'احتياجات شخصية',
    approvedBy: 'مدير الصالون',
    deductionStartMonth: 'يوليو 2026',
    monthlyDeduction: 50,
    remainingBalance: 150,
  },
  {
    id: 'adv_2',
    employeeId: 'emp_2',
    employeeName: 'نور علي',
    amount: 150,
    requestDate: new Date('2026-06-20'),
    status: 'pending',
    reason: 'مصاريف طبية',
    monthlyDeduction: 0,
    remainingBalance: 150,
  },
  {
    id: 'adv_3',
    employeeId: 'emp_3',
    employeeName: 'ليلى أحمد',
    amount: 300,
    requestDate: new Date('2026-05-20'),
    approvalDate: new Date('2026-05-21'),
    status: 'deducted',
    reason: 'شراء معدات',
    approvedBy: 'مدير الصالون',
    deductionStartMonth: 'يونيو 2026',
    monthlyDeduction: 100,
    remainingBalance: 0,
  },
];

const AdvancesPage: React.FC = () => {
  const { t } = useTranslation();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'deducted'>('all');
  const [expandedAdvance, setExpandedAdvance] = useState<string | null>(null);

  const filteredAdvances = useMemo(() => {
    if (filterStatus === 'all') return MOCK_ADVANCES;
    return MOCK_ADVANCES.filter((adv) => adv.status === filterStatus);
  }, [filterStatus]);

  const summary: AdvanceSummary = {
    totalAdvances: MOCK_ADVANCES.length,
    totalApproved: MOCK_ADVANCES.filter((a) => a.status === 'approved').length,
    totalPending: MOCK_ADVANCES.filter((a) => a.status === 'pending').length,
    totalRejected: MOCK_ADVANCES.filter((a) => a.status === 'rejected').length,
    totalDeducted: MOCK_ADVANCES.filter((a) => a.status === 'deducted').length,
    pendingAmount: MOCK_ADVANCES.filter((a) => a.status === 'pending').reduce((sum, a) => sum + a.amount, 0),
    approvedAmount: MOCK_ADVANCES.filter((a) => a.status === 'approved').reduce((sum, a) => sum + a.amount, 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'approved':
        return 'bg-blue-100 text-blue-700';
      case 'deducted':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
      case 'approved':
        return 'موافق عليه';
      case 'deducted':
        return 'تم الخصم';
      case 'rejected':
        return 'مرفوض';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingDown className="w-8 h-8 text-orange-600" />
          {t('Employee Advances')}
        </h1>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
        >
          <Plus className="w-4 h-4" />
          طلب سلفة جديدة
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">إجمالي السلف</p>
          <p className="text-3xl font-bold text-blue-600">{summary.totalAdvances}</p>
          <p className="text-xs text-gray-500 mt-1">طلبات</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">قيد الانتظار</p>
          <p className="text-3xl font-bold text-yellow-600">{summary.totalPending}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.pendingAmount.toFixed(2)} OMR</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">موافق عليها</p>
          <p className="text-3xl font-bold text-blue-600">{summary.totalApproved}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.approvedAmount.toFixed(2)} OMR</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">تم الخصم</p>
          <p className="text-3xl font-bold text-green-600">{summary.totalDeducted}</p>
          <p className="text-xs text-gray-500 mt-1">منتهية</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">مرفوضة</p>
          <p className="text-3xl font-bold text-red-600">{summary.totalRejected}</p>
          <p className="text-xs text-gray-500 mt-1">طلبات</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'deducted'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status as any)}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              filterStatus === status
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {status === 'all' && 'الكل'}
            {status === 'pending' && 'قيد الانتظار'}
            {status === 'approved' && 'موافق عليها'}
            {status === 'deducted' && 'تم الخصم'}
          </button>
        ))}
      </div>

      {/* Advances List */}
      <div className="space-y-4">
        {filteredAdvances.map((advance) => (
          <div key={advance.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Main Row */}
            <div
              onClick={() => setExpandedAdvance(expandedAdvance === advance.id ? null : advance.id)}
              className="p-6 cursor-pointer hover:bg-gray-50 transition border-l-4 border-orange-500"
            >
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                <div>
                  <p className="text-sm text-gray-600">الموظف</p>
                  <p className="font-bold text-gray-800">{advance.employeeName}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">المبلغ</p>
                  <p className="font-bold text-lg text-orange-600">{advance.amount.toFixed(2)} OMR</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">تاريخ الطلب</p>
                  <p className="font-bold text-gray-800">{advance.requestDate.toLocaleDateString('ar-SA')}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">السبب</p>
                  <p className="font-bold text-gray-800">{advance.reason}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">الحالة</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold inline-block ${getStatusColor(advance.status)}`}>
                    {getStatusLabel(advance.status)}
                  </span>
                </div>

                <div className="flex justify-end gap-2">
                  {advance.status === 'pending' && (
                    <>
                      <button className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                        <Check className="w-5 h-5" />
                      </button>
                      <button className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedAdvance === advance.id && (
              <div className="bg-gray-50 border-t-2 border-gray-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 font-bold">معلومات الطلب</p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>تاريخ الطلب:</span>
                          <span className="font-bold">{advance.requestDate.toLocaleDateString('ar-SA')}</span>
                        </div>
                        {advance.approvalDate && (
                          <div className="flex justify-between">
                            <span>تاريخ الموافقة:</span>
                            <span className="font-bold">{advance.approvalDate.toLocaleDateString('ar-SA')}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>السبب:</span>
                          <span className="font-bold">{advance.reason}</span>
                        </div>
                        {advance.notes && (
                          <div className="flex justify-between">
                            <span>ملاحظات:</span>
                            <span className="font-bold">{advance.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {advance.approvedBy && (
                      <div>
                        <p className="text-sm text-gray-600 font-bold">الموافقة</p>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>موافق من:</span>
                            <span className="font-bold">{advance.approvedBy}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500">
                      <p className="text-sm text-gray-600 font-bold mb-3">تفاصيل الخصم</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>المبلغ الكلي:</span>
                          <span className="font-bold text-lg text-orange-600">{advance.amount.toFixed(2)} OMR</span>
                        </div>
                        {advance.deductionStartMonth && (
                          <div className="flex justify-between">
                            <span>بداية الخصم:</span>
                            <span className="font-bold">{advance.deductionStartMonth}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>الخصم الشهري:</span>
                          <span className="font-bold text-blue-600">{advance.monthlyDeduction.toFixed(2)} OMR</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span>الرصيد المتبقي:</span>
                          <span className={`font-bold text-lg ${advance.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {advance.remainingBalance.toFixed(2)} OMR
                          </span>
                        </div>
                      </div>
                    </div>

                    {advance.status === 'pending' && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                        <div>
                          <p className="font-bold text-yellow-800">في انتظار الموافقة</p>
                          <p className="text-sm text-yellow-700">يرجى مراجعة الطلب والموافقة أو الرفض</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">طلب سلفة جديدة</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">المبلغ (OMR)</label>
                <input
                  type="number"
                  placeholder="أدخل المبلغ"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">السبب</label>
                <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none">
                  <option>احتياجات شخصية</option>
                  <option>مصاريف طبية</option>
                  <option>شراء معدات</option>
                  <option>مصاريف تعليم</option>
                  <option>أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">ملاحظات إضافية</label>
                <textarea
                  placeholder="أضف أي ملاحظات"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  rows={3}
                ></textarea>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold">
                  إرسال الطلب
                </button>
                <button
                  onClick={() => setShowRequestModal(false)}
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

export default AdvancesPage;
