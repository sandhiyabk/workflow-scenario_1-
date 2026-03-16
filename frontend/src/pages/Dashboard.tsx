import { useQuery } from '@tanstack/react-query';
import { statsService } from '../services/api';
import { 
  Activity, 
  CheckCircle2, 
  XOctagon, 
  Clock, 
  Layers,
  TrendingUp,
  RefreshCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['stats'],
    queryFn: statsService.get,
    refetchInterval: 10000, // Refresh every 10s
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCcw className="animate-spin text-brand-500" size={48} />
      </div>
    );
  }

  const successRate = stats.successfulExecutions + stats.failedExecutions > 0 
    ? Math.round((stats.successfulExecutions / (stats.successfulExecutions + stats.failedExecutions)) * 100) 
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Observability Dashboard</h1>
          <p className="text-gray-500 mt-2">Real-time metrics and health overview of your workflow engine</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="btn border border-gray-200 bg-white hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCcw size={18} className="text-gray-500" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Workflows */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-brand-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-brand-100 text-brand-600 rounded-xl">
              <Layers size={24} />
            </div>
            <h3 className="font-semibold text-gray-600">Total Workflows</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900">{stats.totalWorkflows}</p>
        </div>

        {/* Avg Execution Time */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Clock size={24} />
            </div>
            <h3 className="font-semibold text-gray-600">Avg Execution Time</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900">
            {stats.averageExecutionTimeMs > 1000 
              ? `${(stats.averageExecutionTimeMs / 1000).toFixed(1)}s` 
              : `${stats.averageExecutionTimeMs}ms`}
          </p>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-green-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <h3 className="font-semibold text-gray-600">Success Rate</h3>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-bold text-gray-900">{successRate}%</p>
            <span className="text-sm font-medium text-gray-400 mb-1">
              ({stats.successfulExecutions} / {stats.successfulExecutions + stats.failedExecutions})
            </span>
          </div>
        </div>

        {/* Active In Progress */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <Activity size={24} />
            </div>
            <h3 className="font-semibold text-gray-600">In Progress</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900">{stats.inProgressExecutions}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="text-green-500" /> Successful Executions
            </h3>
          </div>
          <div className="p-8 text-center">
            <div className="inline-flex justify-center items-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle2 size={40} />
            </div>
            <h4 className="text-2xl font-bold text-gray-900">{stats.successfulExecutions}</h4>
            <p className="text-gray-500 mt-2">Workflows that ran to completion without errors.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <XOctagon className="text-red-500" /> Failed Executions
            </h3>
          </div>
          <div className="p-8 text-center">
            <div className="inline-flex justify-center items-center w-20 h-20 rounded-full bg-red-100 text-red-600 mb-4">
              <XOctagon size={40} />
            </div>
            <h4 className="text-2xl font-bold text-gray-900">{stats.failedExecutions}</h4>
            <p className="text-gray-500 mt-2">Workflows that encountered an error or timed out.</p>
            {stats.failedExecutions > 0 && (
              <Link to="/executions" className="mt-4 inline-block text-brand-600 font-bold hover:underline">
                View Failed Instances &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
