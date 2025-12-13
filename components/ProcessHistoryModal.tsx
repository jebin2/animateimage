import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    getProcessHistory,
    deleteJob,
    Job,
    getJobStatusColor,
    formatDate
} from '../services/processHistoryService';
import { videoStorageService } from '../services/videoStorageService';
import { HistoryIcon, AlertCircleIcon, VideoIcon, WandIcon, TrashIcon, RefreshIcon, DownloadIcon } from './Icons';

interface ProcessHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProcessHistoryModal: React.FC<ProcessHistoryModalProps> = ({ isOpen, onClose }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [limit] = useState(10);
    const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadHistory(1);
        }
    }, [isOpen]);

    const loadHistory = async (pageNum: number) => {
        setLoading(true);
        setError(null);

        const result = await getProcessHistory(pageNum, limit);

        if (result.success && result.data) {
            setJobs(result.data.jobs);
            setTotalCount(result.data.total_count);
            setPage(result.data.page);
        } else {
            setError(result.error || 'Failed to load process history');
        }

        setLoading(false);
    };

    const handleRefresh = () => {
        loadHistory(page);
    };

    const handleDelete = async (jobId: string) => {
        // if (!confirm('Are you sure you want to delete this job?')) return;

        const result = await deleteJob(jobId);
        if (result.success) {
            // Also delete from local storage if exists
            await videoStorageService.deleteVideo(jobId);
            loadHistory(page);
        } else {
            alert(result.error || 'Failed to delete job');
        }
    };

    const handleDownload = async (jobId: string) => {
        setDownloadingJobId(jobId);
        try {
            // 1. Check if we have it locally
            let url = await videoStorageService.getVideoUrl(jobId);

            // 2. If not, download and store it
            if (!url) {
                await videoStorageService.downloadAndStore(jobId);
                url = await videoStorageService.getVideoUrl(jobId);
            }

            // 3. Trigger browser download
            if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = `video-${jobId}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } catch (err: any) {
            alert(err.message || 'Failed to download video');
        } finally {
            setDownloadingJobId(null);
        }
    };

    const totalPages = Math.ceil(totalCount / limit);

    const handlePrevPage = () => {
        if (page > 1) {
            loadHistory(page - 1);
        }
    };

    const handleNextPage = () => {
        if (page < totalPages) {
            loadHistory(page + 1);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white border border-white/60 rounded-3xl shadow-2xl shadow-purple-100/50 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-violet-100 bg-gradient-to-r from-violet-50/50 to-purple-50/50 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <HistoryIcon className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold font-display text-slate-800">Process History</h2>
                                <p className="text-sm text-slate-500 font-medium">Your generation tasks</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/50 transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Loading history...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                            <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-600 text-sm font-medium">{error}</p>
                            <button
                                onClick={() => loadHistory(page)}
                                className="ml-auto text-sm text-red-500 hover:text-red-600 underline font-medium"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && jobs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                                <WandIcon className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-2">No Jobs Yet</h3>
                            <p className="text-slate-500 max-w-xs font-medium">
                                Your generation history will appear here once you start creating.
                            </p>
                        </div>
                    )}

                    {/* Job List */}
                    {!loading && !error && jobs.length > 0 && (
                        <div className="space-y-3">
                            {jobs.map((job) => (
                                <div
                                    key={job.job_id}
                                    className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-violet-200 hover:shadow-sm transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-800 capitalize flex items-center gap-1">
                                                    {job.job_type === 'video' ? <VideoIcon className="w-4 h-4" /> : <WandIcon className="w-4 h-4" />}
                                                    {job.job_type}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getJobStatusColor(job.status)}`}>
                                                    {job.status}
                                                </span>
                                            </div>
                                            {job.prompt && (
                                                <p className="text-sm text-slate-600 font-medium mb-2 line-clamp-2" title={job.prompt}>
                                                    "{job.prompt}"
                                                </p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                                                <span>
                                                    Created: {formatDate(job.created_at)}
                                                </span>
                                                {job.completed_at && (
                                                    <span>
                                                        Completed: {formatDate(job.completed_at)}
                                                    </span>
                                                )}
                                            </div>
                                            {job.error_message && (
                                                <p className="mt-2 text-xs text-red-500 font-medium">
                                                    Error: {job.error_message}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {/* Download Button for Completed Video Jobs */}
                                            {job.status === 'completed' && job.job_type === 'video' && (
                                                <button
                                                    onClick={() => handleDownload(job.job_id)}
                                                    disabled={downloadingJobId === job.job_id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border bg-violet-50 text-violet-600 hover:bg-violet-100 border-violet-100"
                                                    title="Download Video"
                                                >
                                                    {downloadingJobId === job.job_id ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <DownloadIcon className="w-3.5 h-3.5" />
                                                    )}
                                                    Download
                                                </button>
                                            )}

                                            {/* Refresh Button for Processing Jobs */}
                                            {job.status === 'processing' && (
                                                <button
                                                    onClick={handleRefresh}
                                                    className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Refresh Status"
                                                >
                                                    <RefreshIcon className="w-4 h-4" />
                                                </button>
                                            )}

                                            {/* Delete Button for All Statuses */}
                                            <button
                                                onClick={() => handleDelete(job.job_id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Job"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with Pagination */}
                {!loading && !error && jobs.length > 0 && (
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-white rounded-b-3xl">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-500 font-medium">
                                Showing {(page - 1) * limit + 1}-{Math.min(page * limit, totalCount)} of {totalCount}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={page <= 1}
                                    className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-500 px-2 font-medium">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer for empty/error states */}
                {!loading && (jobs.length === 0 || error) && (
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-white rounded-b-3xl">
                        <p className="text-xs text-slate-400 text-center font-medium">
                            Need help? Contact our support team.
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ProcessHistoryModal;
