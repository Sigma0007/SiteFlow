import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FileText, Calendar, Building2, Clock, Search,
  ChevronRight, Download, Activity, Filter, Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { siteServices, dprServices, convertDocsToArray } from '../services/firebaseServices';
import { canEditDPR, formatProcessSummary, getLastNDays } from '../utils/dprHelpers';

const DPRReportHub = ({ userRole }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sitesSnap, dprSnap] = await Promise.all([
          siteServices.getAllSites(),
          dprServices.getAllDPR()
        ]);
        setSites(convertDocsToArray(sitesSnap));
        const allReports = convertDocsToArray(dprSnap)
          .filter((r) => !r.is_deleted)
          .sort((a, b) => b.date.localeCompare(a.date));
        setReports(allReports);
      } catch (err) {
        console.error('Error loading DPR reports:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const siteMap = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s.name])),
    [sites]
  );

  const last5Days = getLastNDays(5);

  const last5Reports = useMemo(() => {
    return reports
      .filter((r) => last5Days.includes(r.date))
      .slice(0, 20);
  }, [reports, last5Days]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const siteName = siteMap[r.siteId] || r.siteName || '';
      const matchesSearch =
        siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.date.includes(searchTerm) ||
        formatProcessSummary(r.processEntries).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = !dateFilter || r.date === dateFilter;
      return matchesSearch && matchesDate;
    });
  }, [reports, siteMap, searchTerm, dateFilter]);

  const monthlySummary = useMemo(() => {
    const [year, month] = exportMonth.split('-').map(Number);
    const rows = [];
    reports.forEach((r) => {
      const [y, m] = r.date.split('-').map(Number);
      if (y !== year || m !== month) return;
      const entries = r.processEntries || [];
      if (entries.length === 0) {
        rows.push({
          date: r.date,
          site: siteMap[r.siteId] || r.siteName || 'Unknown',
          work: r.doneSq ? `Legacy progress: ${r.doneSq} sq ft` : '-',
          quantity: r.doneSq || '',
          unit: r.doneSq ? 'sq' : '',
          remark: ''
        });
      } else {
        entries.forEach((e) => {
          rows.push({
            date: r.date,
            site: siteMap[r.siteId] || r.siteName || 'Unknown',
            work: e.work,
            quantity: e.quantity,
            unit: e.unit,
            remark: e.remark || ''
          });
        });
      }
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [reports, exportMonth, siteMap]);

  const handleExportCSV = () => {
    const exportData = monthlySummary.map((row) => ({
      Date: row.date,
      Site: row.site,
      Work: row.work,
      Quantity: row.quantity,
      Unit: row.unit,
      Remark: row.remark
    }));

    if (exportData.length === 0) {
      alert('No process records found for the selected month.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Process Log');
    XLSX.writeFile(wb, `DPR-Process-${exportMonth}.csv`, { bookType: 'csv' });
  };

  const openReport = (report) => {
    navigate(`/dpr/${report.siteId}/report/${report.date}`);
  };

  const formatDateLabel = (dateStr) =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

  const ReportCard = ({ report, index = 0 }) => (
    <motion.div
      key={report.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      onClick={() => openReport(report)}
      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-indigo-100 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {formatDateLabel(report.date)}
            </p>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{siteMap[report.siteId] || report.siteName || 'Unknown Site'}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {formatProcessSummary(report.processEntries)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!canEditDPR(report, userRole) && (
            <span title="Edit locked (48h)" className="p-1.5 bg-gray-100 rounded-lg text-gray-400">
              <Lock className="w-4 h-4" />
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-600 hover:text-indigo-600"
              >
                <ArrowLeft className="w-6 h-6" />
              </motion.button>
              <div>
                <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  <FileText className="w-7 h-7 text-indigo-600" />
                  DPR Report
                </h1>
                <p className="text-gray-500 text-sm">View process logs, recent history & monthly export</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search site or process..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-52 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-44 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">
                    Basic DPR History
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Last 5 days — quick access to recent submissions</p>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  {last5Reports.length} record{last5Reports.length !== 1 ? 's' : ''}
                </span>
              </div>

              {last5Reports.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                  <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No DPR submissions in the last 5 days.</p>
                  <button
                    onClick={() => navigate('/dpr')}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                  >
                    Create Daily Update
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {last5Reports.map((report, idx) => (
                    <ReportCard key={report.id} report={report} index={idx} />
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Daily Process Entry — Monthly Export
                </h2>
                <p className="text-xs text-gray-500 mt-1">All process work logs for the selected month</p>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-end gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Select Month
                  </label>
                  <input
                    type="month"
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {monthlySummary.length > 0 ? (
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Date', 'Site', 'Work', 'Qty', 'Unit', 'Remark'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthlySummary.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-sm text-gray-600">{row.date}</td>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{row.site}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-800">{row.work}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-800">{row.quantity}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-500">{row.unit}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-400">{row.remark || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {monthlySummary.length > 50 && (
                    <p className="text-xs text-gray-400 text-center py-3">
                      Showing 50 of {monthlySummary.length} rows — export CSV for full data
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm py-8 border-t border-gray-100">
                  No process entries for {exportMonth}
                </p>
              )}
            </section>

            {(searchTerm || dateFilter) && (
              <section>
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
                  Search Results ({filteredReports.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AnimatePresence>
                    {filteredReports.map((report, idx) => (
                      <ReportCard key={report.id} report={report} index={idx} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DPRReportHub;
