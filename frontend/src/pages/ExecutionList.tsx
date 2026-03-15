import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executionService } from '../services/api';
import { Loader2, Calendar, ClipboardList, CheckCircle2, Clock, XCircle, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const ExecutionList = () => {
  const queryClient = useQueryClient();

  const { data: executions, isLoading, isFetching } = useQuery({
    queryKey: ['executions'],
    queryFn: () => executionService.list(),
    refetchInterval: 5000, // auto-refresh every 5s to catch live executions
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={48} /></div>;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'FAILED':    return <XCircle className="text-red-500" size={16} />;
      case 'IN_PROGRESS': return <Clock className="text-blue-500 animate-pulse" size={16} />;
      case 'CANCELED':  return <AlertCircle className="text-gray-500" size={16} />;
      default:          return <Clock className="text-yellow-500" size={16} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'COMPLETED':   return 'bg-green-50 text-green-700 border-green-100';
      case 'FAILED':      return 'bg-red-50 text-red-700 border-red-100';
      case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'CANCELED':    return 'bg-gray-50 text-gray-700 border-gray-100';
      default:            return 'bg-yellow-50 text-yellow-700 border-yellow-100';
    }
  };

  // Stats
  const stats = {
    total:       executions?.length ?? 0,
    completed:   executions?.filter((e: any) => e.status === 'COMPLETED').length ?? 0,
    running:     executions?.filter((e: any) => e.status === 'IN_PROGRESS' || e.status === 'PENDING').length ?? 0,
    failed:      executions?.filter((e: any) => e.status === 'FAILED').length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Execution Monitor</h1>
          <p className="text-gray-500 mt-1">Real-time tracking of all workflow executions.</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['executions'] })}
          className="flex items-center space-x-2 btn-secondary"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: stats.total,     color: 'bg-gray-50 border-gray-200 text-gray-700' },
          { label: 'Completed', value: stats.completed, color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Running',   value: stats.running,   color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Failed',    value: stats.failed,    color: 'bg-red-50 border-red-200 text-red-700' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
            <p className="text-xs font-bold uppercase tracking-wider opacity-60">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Execution ID</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Workflow</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Triggered By</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Started</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {executions?.map((exec: any) => (
              <tr key={exec.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-mono text-xs font-medium text-gray-600">{exec.id.slice(0, 8)}...</span>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  {exec.workflow?.name}
                  <span className="ml-2 text-xs font-normal text-gray-400">v{exec.workflow_version}</span>
                </td>
                <td className="px-6 py-4">
                  <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-bold ${getStatusClass(exec.status)}`}>
                    {getStatusIcon(exec.status)}
                    <span>{exec.status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                  {exec.triggered_by || '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar size={14} />
                    <span>{new Date(exec.started_at).toLocaleString()}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Link
                    to={`/executions/${exec.id}`}
                    className="flex items-center space-x-1 text-brand-600 font-semibold hover:text-brand-700 text-sm"
                  >
                    <span>View Logs</span>
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
            {!executions?.length && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                  <div className="flex flex-col items-center space-y-3">
                    <ClipboardList size={48} className="text-gray-200" />
                    <p className="font-semibold text-gray-400">No executions yet</p>
                    <p className="text-sm text-gray-400">Execute a workflow to see it appear here</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExecutionList;
