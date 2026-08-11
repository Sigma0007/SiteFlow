import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Plus, Download, FileText, Trash2, Save } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import StatusModal from '../components/StatusModal';

const DailyProcessEntry = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [processRecords, setProcessRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    work: '',
    quantity: '',
    unit: '',
    remark: ''
  });

  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  const showAlert = (title, message, type = 'success') => {
    setStatusModal({
      visible: true,
      type,
      title,
      message,
      onConfirm: () => setStatusModal(prev => ({ ...prev, visible: false }))
    });
  };

  // Load process records for selected month
  useEffect(() => {
    loadProcessRecords();
  }, [selectedMonth]);

  const loadProcessRecords = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'dailyProcess'),
        where('date', '>=', `${selectedMonth}-01`),
        where('date', '<=', `${selectedMonth}-31`)
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProcessRecords(records.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      console.error('Error loading process records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.work || !formData.quantity) {
      showAlert('Validation', 'Please fill in work and quantity.', 'warning');
      return;
    }

    try {
      await addDoc(collection(db, 'dailyProcess'), {
        ...formData,
        createdAt: new Date().toISOString()
      });
      
      setFormData({
        date: new Date().toISOString().split('T')[0],
        work: '',
        quantity: '',
        unit: '',
        remark: ''
      });
      
      await loadProcessRecords();
      showAlert('Success', 'Process entry saved successfully!');
    } catch (error) {
      console.error('Error saving process entry:', error);
      showAlert('Error', 'Failed to save process entry.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'dailyProcess', id));
      await loadProcessRecords();
      showAlert('Deleted', 'Process entry deleted successfully!');
    } catch (error) {
      console.error('Error deleting process entry:', error);
      showAlert('Error', 'Failed to delete process entry.', 'error');
    }
  };

  const exportToCSV = () => {
    if (processRecords.length === 0) {
      showAlert('Warning', 'No records to export.', 'warning');
      return;
    }

    const headers = ['Date', 'Work Description', 'Quantity', 'Unit', 'Remark'];
    const csvContent = [
      headers.join(','),
      ...processRecords.map(record => [
        record.date,
        `"${record.work}"`,
        record.quantity,
        record.unit,
        `"${record.remark || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_process_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('Exported', 'CSV file downloaded successfully!');
  };

  const monthlySummary = processRecords.reduce((acc, record) => {
    const key = record.work;
    if (!acc[key]) {
      acc[key] = { work: record.work, totalQuantity: 0, unit: record.unit, count: 0 };
    }
    acc[key].totalQuantity += parseFloat(record.quantity) || 0;
    acc[key].count += 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Daily Process Entry
                </h1>
                <p className="text-gray-500 text-sm mt-1">Track daily process activities with monthly export</p>
              </div>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Entry Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add Process Entry
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Description *</label>
                  <input
                    type="text"
                    value={formData.work}
                    onChange={(e) => setFormData({ ...formData, work: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Excavation, Foundation work"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., sq ft, m"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
                  <textarea
                    value={formData.remark}
                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Entry
                </button>
              </form>
            </div>
          </div>

          {/* Records List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Month Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Select Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Monthly Summary */}
            {Object.keys(monthlySummary).length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Summary</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Work</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Total Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Unit</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Entries</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.values(monthlySummary).map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.work}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 font-bold text-right">{item.totalQuantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{item.unit}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-right">{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Daily Records */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Daily Records</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : processRecords.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No records found for selected month.</p>
              ) : (
                <div className="space-y-3">
                  {processRecords.map((record) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-blue-600">{record.date}</span>
                          <span className="text-sm font-medium text-gray-900">{record.work}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span>{record.quantity} {record.unit}</span>
                          {record.remark && <span className="text-gray-500">- {record.remark}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StatusModal {...statusModal} />
    </div>
  );
};

export default DailyProcessEntry;
