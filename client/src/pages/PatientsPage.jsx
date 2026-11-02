import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  ArrowRight,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Activity,
  Box,
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
import { getPatients, updatePatient, deletePatient, createPatient } from '../api/patients';

const PAGE_SIZE = 10;

export default function PatientsPage() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('all'); // 'all' | 'wrist' | 'ankle'
  const [swellingFilter, setSwellingFilter] = useState('all'); // 'all' | 'acute' | 'subacute' | 'none'
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Patient Modal state
  const [editingPatient, setEditingPatient] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    age: '',
    gender: 'M',
    height_cm: '',
    injury_region: 'wrist',
    swelling_stage: 'acute',
    notes: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete Patient Modal state
  const [deletingPatient, setDeletingPatient] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Fetch patients from FastAPI
  const fetchPatients = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getPatients();
      const list = Array.isArray(res) ? res : res?.items || res?.patients || [];
      setPatients(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Filter & search computation
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const id = String(p.id || p._id || '').toLowerCase();
      const name = String(p.name || '').toLowerCase();
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch = !term || id.includes(term) || name.includes(term);
      const matchesRegion =
        regionFilter === 'all' ||
        String(p.injury_region).toLowerCase() === regionFilter;
      const matchesSwelling =
        swellingFilter === 'all' ||
        String(p.swelling_stage).toLowerCase() === swellingFilter;

      return matchesSearch && matchesRegion && matchesSwelling;
    });
  }, [patients, searchTerm, regionFilter, swellingFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPatients.slice(start, start + PAGE_SIZE);
  }, [filteredPatients, currentPage]);

  // Handle Edit Action
  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setEditError(null);
    setEditFormData({
      name: patient.name || '',
      age: patient.age || '',
      gender: patient.gender || 'M',
      height_cm: patient.height_cm || '',
      injury_region: patient.injury_region || 'wrist',
      swelling_stage: patient.swelling_stage || 'acute',
      notes: patient.notes || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPatient) return;
    setIsSubmittingEdit(true);
    setEditError(null);

    const patientId = editingPatient.id || editingPatient._id;
    try {
      const patchData = {
        name: editFormData.name.trim(),
        age: parseInt(editFormData.age, 10),
        gender: editFormData.gender,
        height_cm: editFormData.height_cm ? parseFloat(editFormData.height_cm) : null,
        injury_region: editFormData.injury_region,
        swelling_stage: editFormData.swelling_stage,
        notes: editFormData.notes ? editFormData.notes.trim() : null,
      };

      await updatePatient(patientId, patchData);
      setEditingPatient(null);
      await fetchPatients(true);
    } catch (err) {
      setEditError(err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete Action
  const confirmDeletePatient = async () => {
    if (!deletingPatient) return;
    setIsDeleting(true);
    setDeleteError(null);

    const patientId = deletingPatient.id || deletingPatient._id;
    try {
      await deletePatient(patientId);
      setDeletingPatient(null);
      await fetchPatients(true);
    } catch (err) {
      setDeleteError(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Patient Clinical Registry"
        subtitle="Searchable electronic database of patient intakes, photogrammetric scan status, and custom 3D cast version histories."
        badge={
          <span className="badge badge-cyan font-mono text-[10px]">
            {filteredPatients.length} Records
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              isLoading={refreshing}
              onClick={() => fetchPatients(true)}
            >
              Sync
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              onClick={() => navigate('/new-patient')}
            >
              + New Patient Intake
            </Button>
          </div>
        }
      />

      {/* ── Error Banner ── */}
      {error && (
        <ErrorState
          error={error}
          title="Patient Registry Fetch Error"
          onRetry={() => fetchPatients(false)}
        />
      )}

      {/* ── Search & Filter Control Bar ── */}
      <Card bodyClassName="p-4">
        <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Patient ID or Name…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-9 text-xs font-mono"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Region Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-400 uppercase">
                Region:
              </span>
              <select
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="select text-xs py-1.5 px-3 font-mono w-32"
              >
                <option value="all">All Regions</option>
                <option value="wrist">Wrist</option>
                <option value="ankle">Ankle</option>
              </select>
            </div>

            {/* Swelling Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-400 uppercase">
                Swelling:
              </span>
              <select
                value={swellingFilter}
                onChange={(e) => {
                  setSwellingFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="select text-xs py-1.5 px-3 font-mono w-36"
              >
                <option value="all">All Stages</option>
                <option value="acute">Acute</option>
                <option value="subacute">Subacute</option>
                <option value="none">Normal / None</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || regionFilter !== 'all' || swellingFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRegionFilter('all');
                  setSwellingFilter('all');
                  setCurrentPage(1);
                }}
                className="text-xs font-mono text-cyan-400 hover:underline px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Patients Registry Table ── */}
      <Card reticle={true} bodyClassName="p-0">
        {loading ? (
          <div className="p-12">
            <LoadingState
              title="Querying Patient Records…"
              subtitle="Accessing MongoDB patients collection via FastAPI."
            />
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Matching Patients"
              subtitle={
                searchTerm || regionFilter !== 'all' || swellingFilter !== 'all'
                  ? 'No records match the active search or filter criteria.'
                  : 'There are currently no patient records in MongoDB.'
              }
              action={
                <Button
                  variant="primary"
                  icon={UserPlus}
                  onClick={() => navigate('/new-patient')}
                >
                  Register Patient
                </Button>
              }
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="table-clinical">
                <thead>
                  <tr>
                    <th>Patient Identifier</th>
                    <th>Patient Name</th>
                    <th>Age / Gender</th>
                    <th>Anatomical Region</th>
                    <th>Swelling Stage</th>
                    <th>Intake Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map((p) => {
                    const patientId = p.id || p._id || 'N/A';
                    const dateStr = p.created_at
                      ? new Date(p.created_at * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'N/A';

                    return (
                      <tr key={patientId} className="hover:bg-cyan-950/20">
                        {/* ID */}
                        <td>
                          <button
                            onClick={() => navigate(`/patients/${patientId}`)}
                            className="font-mono text-cyan-400 font-bold hover:underline cursor-pointer"
                          >
                            {patientId}
                          </button>
                        </td>

                        {/* Name */}
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xs font-mono font-bold text-slate-300">
                              {(p.name || 'P')[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-100">
                                {p.name || 'Unnamed Patient'}
                              </div>
                              {p.notes && (
                                <p className="text-[10px] text-slate-500 truncate max-w-xs">
                                  {p.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Demographics */}
                        <td>
                          <span className="font-mono text-slate-300 text-xs">
                            {p.age ? `${p.age}y` : '--'} / {p.gender || '--'}
                          </span>
                        </td>

                        {/* Injury Region */}
                        <td>
                          <StatusBadge status={p.injury_region || 'wrist'} />
                        </td>

                        {/* Swelling Stage */}
                        <td>
                          <StatusBadge status={p.swelling_stage || 'acute'} />
                        </td>

                        {/* Date */}
                        <td>
                          <span className="font-mono text-slate-400 text-xs">
                            {dateStr}
                          </span>
                        </td>

                        {/* Row Actions */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Eye}
                              onClick={() => navigate(`/patients/${patientId}`)}
                              title="View Patient Details & Scans"
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit2}
                              onClick={() => openEditModal(p)}
                              title="Edit Patient"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Activity}
                              onClick={() => navigate(`/processing/${patientId}`)}
                              title="Open AI Pipeline Results"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                              icon={Trash2}
                              onClick={() => setDeletingPatient(p)}
                              title="Delete Patient Record"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/40 text-xs font-mono text-slate-400">
              <div>
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(currentPage * PAGE_SIZE, filteredPatients.length)} of{' '}
                {filteredPatients.length} patients
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ChevronLeft}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={ChevronRight}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Edit Patient Modal ── */}
      <ModalDialog
        isOpen={Boolean(editingPatient)}
        onClose={() => setEditingPatient(null)}
        title={`Edit Patient: ${editingPatient?.id || editingPatient?._id || ''}`}
        subtitle="Modify clinical intake parameters conforming to FastAPI PatientPatch schema."
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditingPatient(null)}
              disabled={isSubmittingEdit}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveEdit}
              isLoading={isSubmittingEdit}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <ErrorState error={editError} compact={true} />
          )}

          <FormField label="Full Name" required={true}>
            <input
              type="text"
              required
              maxLength={80}
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              className="input text-xs"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Age" unit="years" required={true}>
              <input
                type="number"
                required
                min={1}
                max={110}
                value={editFormData.age}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, age: e.target.value })
                }
                className="input text-xs font-mono"
              />
            </FormField>

            <FormField label="Biological Gender" required={true}>
              <select
                value={editFormData.gender}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, gender: e.target.value })
                }
                className="select text-xs font-mono"
              >
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Height" unit="cm">
              <input
                type="number"
                min={50}
                max={230}
                value={editFormData.height_cm}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, height_cm: e.target.value })
                }
                className="input text-xs font-mono"
              />
            </FormField>

            <FormField label="Anatomical Region" required={true}>
              <select
                value={editFormData.injury_region}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, injury_region: e.target.value })
                }
                className="select text-xs font-mono"
              >
                <option value="wrist">Wrist / Forearm</option>
                <option value="ankle">Ankle / Foot</option>
              </select>
            </FormField>
          </div>

          <FormField label="Swelling Stage" required={true}>
            <select
              value={editFormData.swelling_stage}
              onChange={(e) =>
                setEditFormData({ ...editFormData, swelling_stage: e.target.value })
              }
              className="select text-xs font-mono"
            >
              <option value="acute">Acute (Significant edema + buffer)</option>
              <option value="subacute">Subacute (Moderate residual swelling)</option>
              <option value="none">None / Chronic (Anatomical conformant)</option>
            </select>
          </FormField>

          <FormField label="Clinical Notes">
            <textarea
              maxLength={500}
              rows={3}
              value={editFormData.notes}
              onChange={(e) =>
                setEditFormData({ ...editFormData, notes: e.target.value })
              }
              placeholder="Injury history, specific bone fracture location (e.g. distal radius)…"
              className="input text-xs"
            />
          </FormField>
        </form>
      </ModalDialog>

      {/* ── Confirm Delete Modal ── */}
      <ModalDialog
        isOpen={Boolean(deletingPatient)}
        onClose={() => setDeletingPatient(null)}
        title="Confirm Patient Record Deletion"
        subtitle="This action will permanently delete the patient document from MongoDB."
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeletingPatient(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeletePatient}
              isLoading={isDeleting}
            >
              Delete Record
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {deleteError && (
            <ErrorState error={deleteError} compact={true} />
          )}

          <div className="flex items-start gap-3 p-3 rounded bg-rose-950/20 border border-rose-800/40 text-xs text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Permanent Deletion Warning</p>
              <p className="mt-1 text-slate-300 leading-relaxed">
                You are about to delete patient <code className="text-cyan-300 font-mono">{deletingPatient?.id || deletingPatient?._id}</code> ({deletingPatient?.name}). Associated photogrammetric scans and CAD models will be orphaned.
              </p>
            </div>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
