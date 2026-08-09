import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Minus, Search, History, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, ArrowDownCircle, ArrowUpCircle, BarChart3, X, Filter
} from 'lucide-react';
import { siteInventoryServices, convertDocsToArray } from '../services/firebaseServices';
import { useAuth } from '../components/Auth';

const CATEGORIES = ['Raw Materials', 'Finishing', 'Electrical', 'Plumbing', 'Hardware', 'Tools', 'Safety', 'Other'];
const UNITS = ['pcs', 'kg', 'bags', 'liters', 'meters', 'sqft', 'sqm', 'tons', 'rolls', 'boxes', 'sets', 'nos'];

const SiteInventoryManager = ({ siteId, site, userRole }) => {
  const { user } = useAuth();

  // State
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // stock | history | summary

  // Inward form
  const [showInwardForm, setShowInwardForm] = useState(false);
  const [inwardData, setInwardData] = useState({
    materialName: '', category: 'Raw Materials', unit: 'pcs', quantity: '', notes: ''
  });

  // Outward form
  const [showOutwardForm, setShowOutwardForm] = useState(false);
  const [outwardData, setOutwardData] = useState({
    materialName: '', quantity: '', notes: ''
  });

  // Filters
  const [stockSearch, setStockSearch] = useState('');
  const [logFilter, setLogFilter] = useState('all'); // all | inward | outward

  // Summary controls
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth());
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());

  // Alerts
  const [alert, setAlert] = useState({ show: false, type: 'success', message: '' });
  const showAlert = (message, type = 'success') => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: 'success', message: '' }), 3500);
  };

  // Load data via real-time listeners
  useEffect(() => {
    if (!siteId) return;
    setLoading(true);

    const unsubInventory = siteInventoryServices.onSiteInventoryChange(siteId, (snap) => {
      setInventory(convertDocsToArray(snap));
      setLoading(false);
    });

    const unsubLogs = siteInventoryServices.onSiteLogsChange(siteId, (snap) => {
      const allLogs = convertDocsToArray(snap);
      setLogs(allLogs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    });

    return () => {
      unsubInventory();
      unsubLogs();
    };
  }, [siteId]);

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    return inventory
      .filter(item => item.name?.toLowerCase().includes(stockSearch.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [inventory, stockSearch]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter(log => log.type === logFilter);
  }, [logs, logFilter]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const monthStr = `${summaryYear}-${String(summaryMonth + 1).padStart(2, '0')}`;
    const monthLogs = logs.filter(log => log.date?.startsWith(monthStr));

    const summary = {};
    monthLogs.forEach(log => {
      const name = log.materialName || 'Unknown';
      if (!summary[name]) {
        summary[name] = { inward: 0, outward: 0 };
      }
      if (log.type === 'inward') {
        summary[name].inward += Number(log.quantity || 0);
      } else {
        summary[name].outward += Number(log.quantity || 0);
      }
    });

    return Object.entries(summary)
      .map(([name, data]) => ({ name, ...data, net: data.inward - data.outward }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, summaryMonth, summaryYear]);

  // Handle Inward
  const handleInward = async () => {
    if (!inwardData.materialName.trim()) {
      showAlert('Please enter a material name.', 'error');
      return;
    }
    const qty = Number(inwardData.quantity);
    if (!qty || qty <= 0) {
      showAlert('Please enter a valid quantity.', 'error');
      return;
    }
    try {
      await siteInventoryServices.addInwardMaterial(
        siteId,
        inwardData.materialName,
        inwardData.category,
        inwardData.unit,
        qty,
        inwardData.notes,
        user?.email || ''
      );
      showAlert(`Added ${qty} ${inwardData.unit} of ${inwardData.materialName} to site inventory.`);
      setInwardData({ materialName: '', category: 'Raw Materials', unit: 'pcs', quantity: '', notes: '' });
      setShowInwardForm(false);
    } catch (err) {
      showAlert(err.message || 'Failed to add material.', 'error');
    }
  };

  // Handle Outward
  const handleOutward = async () => {
    if (!outwardData.materialName.trim()) {
      showAlert('Please select a material.', 'error');
      return;
    }
    const qty = Number(outwardData.quantity);
    if (!qty || qty <= 0) {
      showAlert('Please enter a valid quantity.', 'error');
      return;
    }
    try {
      await siteInventoryServices.addOutwardMaterial(
        siteId,
        outwardData.materialName,
        qty,
        outwardData.notes,
        user?.email || ''
      );
      showAlert(`Used ${qty} of ${outwardData.materialName} from site inventory.`);
      setOutwardData({ materialName: '', quantity: '', notes: '' });
      setShowOutwardForm(false);
    } catch (err) {
      showAlert(err.message || 'Failed to use material.', 'error');
    }
  };

  const monthName = new Date(2000, summaryMonth, 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-6">
      {/* Alert Toast */}
      <AnimatePresence>
        {alert.show && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm flex items-center gap-2 ${
              alert.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
            }`}
          >
            {alert.type === 'error' ? <X className="w-4 h-4" /> : <Package className="w-4 h-4" />}
            {alert.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Site Material Inventory
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Manage materials independently for <span className="font-semibold text-gray-700">{site?.name || 'this site'}</span>
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setShowInwardForm(true); setShowOutwardForm(false); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
              >
                <ArrowDownCircle className="w-4 h-4" /> Inward
              </button>
              <button
                onClick={() => { setShowOutwardForm(true); setShowInwardForm(false); }}
                disabled={inventory.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
              >
                <ArrowUpCircle className="w-4 h-4" /> Outward
              </button>
            </div>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-gray-200 bg-white">
          {[
            { key: 'stock', label: 'Current Stock', icon: Package },
            { key: 'history', label: 'Movement Log', icon: History },
            { key: 'summary', label: 'Monthly Summary', icon: BarChart3 }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="p-0">
            {/* ===== CURRENT STOCK ===== */}
            {activeTab === 'stock' && (
              <div>
                <div className="p-4 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search materials..."
                      value={stockSearch}
                      onChange={e => setStockSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {filteredInventory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No materials in site inventory</p>
                    <p className="text-xs mt-1">Click "Inward" to add materials</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-gray-600">Material</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">Category</th>
                          <th className="px-4 py-3 font-semibold text-gray-600 text-center">Current Stock</th>
                          <th className="px-4 py-3 font-semibold text-gray-600 text-right">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredInventory.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-gray-900">{item.name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                {item.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-lg font-bold ${item.currentStock <= 0 ? 'text-red-500' : item.currentStock < 5 ? 'text-orange-500' : 'text-green-600'}`}>
                                {item.currentStock}
                              </span>
                              <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-400">
                              {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Stock Summary Cards */}
                {filteredInventory.length > 0 && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                      <div className="text-xl font-bold text-gray-800">{filteredInventory.length}</div>
                      <div className="text-xs text-gray-500 font-medium">Total Items</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
                      <div className="text-xl font-bold text-orange-600">
                        {filteredInventory.filter(i => i.currentStock > 0 && i.currentStock < 5).length}
                      </div>
                      <div className="text-xs text-orange-500 font-medium">Low Stock</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-red-200 text-center">
                      <div className="text-xl font-bold text-red-600">
                        {filteredInventory.filter(i => i.currentStock <= 0).length}
                      </div>
                      <div className="text-xs text-red-500 font-medium">Out of Stock</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== MOVEMENT LOG ===== */}
            {activeTab === 'history' && (
              <div>
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <div className="flex gap-1">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'inward', label: 'Inward' },
                      { key: 'outward', label: 'Outward' }
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setLogFilter(f.key)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          logFilter === f.key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No movement records</p>
                    <p className="text-xs mt-1">Transaction history will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                    {filteredLogs.map((log, idx) => (
                      <div key={log.id || idx} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          log.type === 'inward' ? 'bg-green-100' : 'bg-orange-100'
                        }`}>
                          {log.type === 'inward'
                            ? <TrendingDown className="w-4 h-4 text-green-600" />
                            : <TrendingUp className="w-4 h-4 text-orange-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-gray-900 text-sm truncate">{log.materialName}</p>
                            <span className={`text-sm font-bold shrink-0 ${log.type === 'inward' ? 'text-green-600' : 'text-orange-600'}`}>
                              {log.type === 'inward' ? '+' : '-'}{log.quantity}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              log.type === 'inward' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {log.type}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {log.date} • {log.addedBy || 'System'}
                            </span>
                          </div>
                          {log.notes && (
                            <p className="text-xs text-gray-500 mt-1 italic">📝 {log.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== MONTHLY SUMMARY ===== */}
            {activeTab === 'summary' && (
              <div>
                <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Month</label>
                    <select
                      value={summaryMonth}
                      onChange={e => setSummaryMonth(Number(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i}>
                          {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Year</label>
                    <select
                      value={summaryYear}
                      onChange={e => setSummaryYear(Number(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {[...Array(5)].map((_, i) => (
                        <option key={i} value={new Date().getFullYear() - i}>
                          {new Date().getFullYear() - i}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {monthlySummary.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No data for {monthName} {summaryYear}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-gray-600">Material</th>
                          <th className="px-4 py-3 font-semibold text-green-600 text-center">Inward</th>
                          <th className="px-4 py-3 font-semibold text-orange-600 text-center">Outward</th>
                          <th className="px-4 py-3 font-semibold text-indigo-600 text-center">Net Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {monthlySummary.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                +{item.inward}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                -{item.outward}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-bold px-2 py-0.5 rounded ${
                                item.net > 0 ? 'text-green-700 bg-green-50' : item.net < 0 ? 'text-red-700 bg-red-50' : 'text-gray-600 bg-gray-50'
                              }`}>
                                {item.net > 0 ? '+' : ''}{item.net}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                        <tr>
                          <td className="px-4 py-3 font-bold text-gray-800">TOTAL</td>
                          <td className="px-4 py-3 text-center font-bold text-green-700">
                            +{monthlySummary.reduce((sum, i) => sum + i.inward, 0)}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-orange-700">
                            -{monthlySummary.reduce((sum, i) => sum + i.outward, 0)}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-indigo-700">
                            {(() => {
                              const net = monthlySummary.reduce((sum, i) => sum + i.net, 0);
                              return `${net > 0 ? '+' : ''}${net}`;
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== INWARD FORM MODAL ===== */}
      <AnimatePresence>
        {showInwardForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setShowInwardForm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5 text-green-600" /> Add Material (Inward)
                </h3>
                <button onClick={() => setShowInwardForm(false)} className="p-1 hover:bg-green-100 rounded-full transition">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Material Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Cement, Steel Rods, Sand"
                    value={inwardData.materialName}
                    onChange={e => setInwardData(prev => ({ ...prev, materialName: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    list="existing-materials"
                  />
                  <datalist id="existing-materials">
                    {inventory.map(item => (
                      <option key={item.id} value={item.name} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                    <select
                      value={inwardData.category}
                      onChange={e => setInwardData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
                    <select
                      value={inwardData.unit}
                      onChange={e => setInwardData(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={inwardData.quantity}
                    onChange={e => setInwardData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Delivery from supplier ABC"
                    value={inwardData.notes}
                    onChange={e => setInwardData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="p-5 bg-gray-50 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowInwardForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInward}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow transition"
                >
                  Add Stock
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== OUTWARD FORM MODAL ===== */}
      <AnimatePresence>
        {showOutwardForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setShowOutwardForm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <ArrowUpCircle className="w-5 h-5 text-orange-600" /> Use Material (Outward)
                </h3>
                <button onClick={() => setShowOutwardForm(false)} className="p-1 hover:bg-orange-100 rounded-full transition">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Select Material *</label>
                  <select
                    value={outwardData.materialName}
                    onChange={e => setOutwardData(prev => ({ ...prev, materialName: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  >
                    <option value="">-- Select Material --</option>
                    {inventory.filter(i => i.currentStock > 0).map(item => (
                      <option key={item.id} value={item.name}>
                        {item.name} (Stock: {item.currentStock} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max={inventory.find(i => i.name === outwardData.materialName)?.currentStock || 9999}
                    placeholder="Enter quantity used"
                    value={outwardData.quantity}
                    onChange={e => setOutwardData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                  {outwardData.materialName && (
                    <p className="text-xs text-gray-400 mt-1">
                      Available: {inventory.find(i => i.name === outwardData.materialName)?.currentStock || 0}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Used for Block A waterproofing"
                    value={outwardData.notes}
                    onChange={e => setOutwardData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="p-5 bg-gray-50 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowOutwardForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOutward}
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow transition"
                >
                  Confirm Usage
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SiteInventoryManager;
