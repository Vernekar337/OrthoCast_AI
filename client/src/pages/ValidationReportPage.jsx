import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  RefreshCw,
  Download,
  Filter,
  Info,
  Calendar,
  Layers,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  StatusBadge,
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  ModalDialog,
  FormField,
} from '../components/common';
import { getValidationLogs, logValidation, getValidationReport } from '../api/validation';
import { getPatients } from '../api/patients';

export default function ValidationReportPage() {
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pass' | 'warning' | 'fail'
  const [patientFilter, setPatientFilter] = useState('all');

  // Modal to log new discrepancy
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logFormData, setLogFormData] = useState({
    patient_id: '',
    metric: 'wrist_width_mm',
    manual_value: '',
    system_value: '',
    note: '',
  });
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [logError, setLogError] = useState(null);

  const fetchValidationData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [logsRes, reportRes, patientsRes] = await Promise.allSettled([
        getValidationLogs(),
        getValidationReport(),
        getPatients(),
      ]);

      if (logsRes.status === 'fulfilled' && logsRes.value) {
        const list = Array.isArray(logsRes.value) ? logsRes.value : logsRes.value.logs || [];
        setLogs(list);
      } else {
        setLogs([]);
      }

      if (reportRes.status === 'fulfilled' && reportRes.value) {
        setReport(reportRes.value);
      } else {
        setReport(null);
      }

      if (patientsRes.status === 'fulfilled' && patientsRes.value) {
        const pList = Array.isArray(patientsRes.value)
          ? patientsRes.value
          : patientsRes.value.items || patientsRes.value.patients || [];
        setPatients(pList);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchValidationData();
  }, [fetchValidationData]);

  // Compute status for each log item
  const evaluatedLogs = useMemo(() => {
    return logs.map((log) => {
      const manual = parseFloat(log.manual_value);
      const system = parseFloat(log.system_value);
      let delta = 0;
      let pctError = 0;
      let status = 'pass'; // 'pass' | 'warning' | 'fail'

      if (!isNaN(manual) && !isNaN(system) && manual > 0) {
        delta = Math.abs(system - manual);
        pctError = (delta / manual) * 100;
        if (pctError > 10.0 || delta > 8.0) {
          status = 'fail';
        } else if (pctError > 5.0 || delta > 4.0) {
          status = 'warning';
        } else {
          status = 'pass';
        }
      }

      return {
        ...log,
        delta: delta.toFixed(1),
        pctError: pctError.toFixed(1),
        status,
      };
    });
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return evaluatedLogs.filter((log) => {
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const matchesPatient = patientFilter === 'all' || log.patient_id === patientFilter;
      return matchesStatus && matchesPatient;
    });
  }, [evaluatedLogs, statusFilter, patientFilter]);

  // Handle Log Submission
  const handleSaveValidationLog = async (e) => {
    e.preventDefault();
    const manualVal = parseFloat(logFormData.manual_value);
    const systemVal = parseFloat(logFormData.system_value);

    if (isNaN(manualVal) || isNaN(systemVal)) {
      setLogError('Both manual and system values must be valid numbers.');
      return;
    }

    setIsSubmittingLog(true);
    setLogError(null);

    try {
      const entry = {
        patient_id: logFormData.patient_id.trim() || null,
        metric: logFormData.metric.trim(),
        manual_value: manualVal,
        system_value: systemVal,
        note: logFormData.note ? logFormData.note.trim() : null,
      };

      await logValidation(entry);
      setIsLogModalOpen(false);
      setLogFormData({
        patient_id: '',
        metric: 'wrist_width_mm',
        manual_value: '',
        system_value: '',
        note: '',
      });
      await fetchValidationData(true);
    } catch (err) {
      setLogError(err.message || 'Failed to submit validation log to FastAPI.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleExportReport = () => {
    const reportData = {
      title: 'OrthoCast AI Quality Assurance & Dimensional Tolerance Audit',
      generated_at: new Date().toISOString(),
      validation_logs_count: evaluatedLogs.length,
      logs: evaluatedLogs,
      disclaimer: 'Prototype clinical engineering QA audit. Not FDA/CE cleared.',
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `orthocast_validation_report_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <PageHeader
        title="Clinical Validation & Tolerance Audit"
        subtitle="Verification records comparing manual caliper ground truth against AI photogrammetric and volumetric predictions."
        badge={
          <span className="badge badge-cyan font-mono text-[10px]">
            {logs.length} Audit Entries in MongoDB
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              isLoading={refreshing}
              onClick={() => fetchValidationData(true)}
            >
              Sync Records
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              disabled={logs.length === 0}
              onClick={handleExportReport}
            >
              Export QA Report
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsLogModalOpen(true)}
            >
              + Log Validation Check
            </Button>
          </div>
        }
      />

      {/* ── CDSS Quality Assurance Notice ── */}
      <div className="p-3.5 rounded-lg bg-slate-900 border border-cyan-500/30 flex items-start gap-3 text-xs font-mono">
        <ShieldAlert className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-slate-300 leading-relaxed">
          <span className="text-cyan-300 font-bold uppercase tracking-wider block">
            Quality Assurance Protocol (ISO 13485 Prototype Audit)
          </span>
          <p>
            Validation tolerances mandate that algorithmic predictions must fall within &plusmn;5% of physical calibrated caliper measurements. Deviations exceeding &plusmn;10% or 8 mm trigger an automatic failure flag requiring clinician re-scan or manual dimension override.
          </p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <ErrorState
          error={error}
          title="Validation Records Query Failed"
          onRetry={() => fetchValidationData(false)}
        />
      )}

      {/* ── Filter Bar ── */}
      <Card bodyClassName="p-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 uppercase text-[11px]">Tolerance Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select text-xs py-1 px-2.5 font-mono bg-slate-950 border-slate-800"
              >
                <option value="all">All Results ({logs.length})</option>
                <option value="pass">Passed (≤ 5% delta)</option>
                <option value="warning">Warning (5 - 10% delta)</option>
                <option value="fail">Failed (&gt; 10% delta)</option>
              </select>
            </div>

            {patients.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 uppercase text-[11px]">Patient:</span>
                <select
                  value={patientFilter}
                  onChange={(e) => setPatientFilter(e.target.value)}
                  className="select text-xs py-1 px-2.5 font-mono bg-slate-950 border-slate-800"
                >
                  <option value="all">All Patients</option>
                  {patients.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name || p.id} ({p.id || p._id})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="text-slate-400 text-[11px]">
            Showing {filteredLogs.length} of {logs.length} recorded verification events
          </div>
        </div>
      </Card>

      {/* ── Validation Records Table ── */}
      <Card reticle={true} bodyClassName="p-0">
        {loading ? (
          <div className="p-12">
            <LoadingState
              title="Querying Validation Logs…"
              subtitle="Fetching verification records from MongoDB validation_logs collection via FastAPI."
            />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Validation Checks Found"
              subtitle={
                logs.length === 0
                  ? 'No verification discrepancy logs have been recorded in MongoDB yet. Use the action below to log a clinical ground truth check.'
                  : 'No validation checks match the active filter criteria.'
              }
              icon={Scale}
              action={
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setIsLogModalOpen(true)}
                >
                  Log First Verification Check
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clinical font-mono text-xs">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Patient ID</th>
                  <th>Tested Metric</th>
                  <th>Manual Ground Truth</th>
                  <th>System AI Prediction</th>
                  <th>Delta Discrepancy</th>
                  <th>Tolerance Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((item, idx) => {
                  const dateStr = item.created_at
                    ? new Date(item.created_at * 1000).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recorded';

                  return (
                    <tr key={item.id || item._id || idx} className="hover:bg-cyan-950/20">
                      {/* Timestamp */}
                      <td className="text-slate-400 text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Patient ID */}
                      <td>
                        {item.patient_id ? (
                          <span className="text-cyan-300 font-bold">{item.patient_id}</span>
                        ) : (
                          <span className="text-slate-500 italic">Global Cohort</span>
                        )}
                      </td>

                      {/* Tested Metric */}
                      <td>
                        <span className="font-bold text-slate-100">{item.metric}</span>
                      </td>

                      {/* Manual Ground Truth */}
                      <td className="text-slate-200">
                        {item.manual_value} mm
                      </td>

                      {/* System AI Value */}
                      <td className="text-cyan-400 font-bold">
                        {item.system_value} mm
                      </td>

                      {/* Delta Discrepancy */}
                      <td>
                        <span className={item.status === 'fail' ? 'text-rose-400 font-bold' : item.status === 'warning' ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                          {item.delta} mm ({item.pctError}%)
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td>
                        {item.status === 'pass' ? (
                          <span className="badge badge-success text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Pass (≤5%)
                          </span>
                        ) : item.status === 'warning' ? (
                          <span className="badge badge-warning text-[10px] gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Warning (5-10%)
                          </span>
                        ) : (
                          <span className="badge badge-danger text-[10px] gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            Tolerance Exceeded
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="text-slate-400 text-[11px] max-w-xs truncate">
                        {item.note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal: Log New Validation Check ── */}
      <ModalDialog
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Record Clinical Validation Ground Truth"
        subtitle="Conforms to FastAPI ValidationLogIn schema. Logs physical verification against system prediction."
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsLogModalOpen(false)}
              disabled={isSubmittingLog}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveValidationLog}
              isLoading={isSubmittingLog}
            >
              Submit QA Entry
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveValidationLog} className="space-y-4">
          {logError && <ErrorState error={logError} compact={true} />}

          <FormField label="Associated Patient ID (Optional)">
            <select
              value={logFormData.patient_id}
              onChange={(e) => setLogFormData({ ...logFormData, patient_id: e.target.value })}
              className="select text-xs font-mono"
            >
              <option value="">General Cohort / Unassociated</option>
              {patients.map((p) => (
                <option key={p.id || p._id} value={p.id || p._id}>
                  {p.name || 'Unnamed'} ({p.id || p._id})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Verification Metric" required={true}>
            <input
              type="text"
              required
              maxLength={40}
              value={logFormData.metric}
              onChange={(e) => setLogFormData({ ...logFormData, metric: e.target.value })}
              placeholder="e.g. wrist_width_mm, palm_length_mm, station_d1"
              className="input text-xs font-mono"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Manual Value (Caliper Ground Truth)" unit="mm" required={true}>
              <input
                type="number"
                step="0.1"
                required
                value={logFormData.manual_value}
                onChange={(e) => setLogFormData({ ...logFormData, manual_value: e.target.value })}
                placeholder="e.g. 58.2"
                className="input text-xs font-mono"
              />
            </FormField>

            <FormField label="System Value (Model Prediction)" unit="mm" required={true}>
              <input
                type="number"
                step="0.1"
                required
                value={logFormData.system_value}
                onChange={(e) => setLogFormData({ ...logFormData, system_value: e.target.value })}
                placeholder="e.g. 59.4"
                className="input text-xs font-mono"
              />
            </FormField>
          </div>

          <FormField label="Clinical Auditor Note">
            <textarea
              maxLength={200}
              rows={2}
              value={logFormData.note}
              onChange={(e) => setLogFormData({ ...logFormData, note: e.target.value })}
              placeholder="Observed slight skin depression during caliper measurement…"
              className="input text-xs"
            />
          </FormField>
        </form>
      </ModalDialog>
    </div>
  );
}
