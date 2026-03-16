import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { executionService } from '../services/api';
import { 
  Loader2, 
  ChevronLeft, 
  Play, 
  XOctagon, 
  RefreshCcw, 
  CheckCircle2, 
  Clock, 
  XCircle,
  MessageSquare,
  Activity,
  Code,
  Server,
  Database
} from 'lucide-react';
import { useState } from 'react';

const ExecutionDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);

  const { data: execution, isLoading: isExecLoading } = useQuery({
    queryKey: ['execution', id],
    queryFn: () => executionService.get(id!),
    refetchInterval: (query: any) => {
      const status = query.state.data?.status;
      return (status === 'IN_PROGRESS' || status === 'PENDING') ? 3000 : false;
    }
  });

  const { data: logs, isLoading: isLogsLoading } = useQuery({
    queryKey: ['execution-logs', id],
    queryFn: () => executionService.getLogs(id!),
    refetchInterval: (query: any) => {
      const status = execution?.status;
      return (status === 'IN_PROGRESS' || status === 'PENDING') ? 3000 : false;
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => executionService.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', id] });
      queryClient.invalidateQueries({ queryKey: ['execution-logs', id] });
    }
  });

  const retryMutation = useMutation({
    mutationFn: () => executionService.retry(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', id] });
      queryClient.invalidateQueries({ queryKey: ['execution-logs', id] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: (approved: boolean) => executionService.approve(id!, { approved, approver_id: 'USER_1' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', id] });
      queryClient.invalidateQueries({ queryKey: ['execution-logs', id] });
      setApproving(false);
    }
  });

  if (isExecLoading && !execution) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={48} /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <Link to="/executions" className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">Execution #{id?.slice(0, 8)}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                execution.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' :
                execution.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-100' :
                'bg-blue-50 text-blue-700 border-blue-100'
              }`}>
                {execution.status}
              </span>
            </div>
            <p className="text-gray-500 mt-1">Workflow: <span className="font-semibold">{execution.workflow?.name}</span> (v{execution.workflow_version})</p>
          </div>
        </div>

        <div className="flex space-x-3">
          {execution.status === 'IN_PROGRESS' || execution.status === 'PENDING' ? (
            <button 
              onClick={() => cancelMutation.mutate()}
              className="btn bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 flex items-center space-x-2"
              disabled={cancelMutation.isPending}
            >
              <XOctagon size={18} />
              <span>Cancel</span>
            </button>
          ) : execution.status === 'FAILED' ? (
            <button 
              onClick={() => retryMutation.mutate()}
              className="btn-primary flex items-center space-x-2"
              disabled={retryMutation.isPending}
            >
              <RefreshCcw size={18} />
              <span>Retry Step</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold flex items-center space-x-2">
                <Activity size={18} className="text-brand-600" />
                <span>Execution Timeline</span>
              </h3>
              <span className="text-xs text-gray-500">Auto-refreshing</span>
            </div>
            
            <div className="p-6 space-y-8">
              {logs?.map((log: any, index: number) => {
                const evaluatedRules = typeof log.evaluated_rules === 'string' 
                  ? JSON.parse(log.evaluated_rules) 
                  : (log.evaluated_rules || []);
                const metadata = typeof log.metadata === 'string'
                  ? JSON.parse(log.metadata)
                  : (log.metadata || {});
                
                return (
                <div key={log.id} className="relative pl-8 pb-8 last:pb-0">
                  {/* Vertical Line */}
                  {index < logs.length - 1 && (
                    <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-100"></div>
                  )}
                  
                  {/* Icon */}
                  <div className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center -translate-x-0.5 ${
                    log.status === 'COMPLETED' ? 'bg-green-500' : 
                    log.status === 'PENDING' ? 'bg-amber-500 animate-pulse' : 
                    log.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-500'
                  } text-white shadow-sm ring-4 ring-white`}>
                    {log.status === 'COMPLETED' ? <CheckCircle2 size={14} /> : 
                     log.status === 'PENDING' ? <Clock size={14} /> : 
                     log.status === 'FAILED' ? <XCircle size={14} /> : <Activity size={14} />}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900">{log.step_name}</h4>
                        <p className="text-xs text-gray-500 uppercase font-semibold">{log.step_type}</p>
                      </div>
                      <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                        <Clock size={12} />
                        {metadata.duration_ms 
                          ? `${metadata.duration_ms}ms` 
                          : log.ended_at 
                            ? `${Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()))}ms` 
                            : 'In progress...'}
                      </span>
                    </div>

                    {log.error_message && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-700 text-sm">
                        <div className="font-bold mb-1 flex items-center gap-2">
                          <XOctagon size={14} /> Error Encountered
                        </div>
                        <p>{log.error_message}</p>
                        {metadata.error && (
                          <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto text-red-800 font-mono">
                            {JSON.stringify(metadata.error, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {evaluatedRules.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                         <div className="flex items-center space-x-1 text-xs text-gray-500 font-semibold mb-2">
                           <Code size={14} />
                           <span>RULE EVALUATIONS</span>
                         </div>
                         {evaluatedRules.map((rule: any, i: number) => (
                           <div key={i} className="flex justify-between items-center text-xs">
                             <span className="font-mono text-gray-600">{rule.condition}</span>
                             <span className={`font-bold ${rule.isMatch ? 'text-green-600' : 'text-red-400'}`}>
                               {rule.isMatch ? 'MATCH' : 'SKIP'}
                             </span>
                           </div>
                         ))}
                      </div>
                    )}

                    {log.selected_next_step && (
                      <div className="text-xs font-semibold text-gray-600">
                        Next Step: <span className="text-brand-600 font-bold">{log.selected_next_step}</span>
                      </div>
                    )}
                  </div>
                </div>
              )})}
              
              {execution.status === 'PENDING' && (
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-6 mt-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-brand-600 text-white rounded-lg">
                      <MessageSquare size={24} />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-bold text-gray-900">Awaiting Manager Approval</h4>
                      <p className="text-sm text-gray-600 mt-1">This workflow is currently paused and requires manual approval to proceed.</p>
                      <div className="flex space-x-3 mt-4">
                        <button 
                          onClick={() => approveMutation.mutate(true)}
                          className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-700 disabled:opacity-50"
                          disabled={approveMutation.isPending}
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => approveMutation.mutate(false)}
                          className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-50 disabled:opacity-50"
                          disabled={approveMutation.isPending}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Data */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold flex items-center space-x-2 text-gray-900">
                <Database size={18} className="text-gray-500" />
                <span>Execution Data</span>
              </h3>
            </div>
            <div className="p-6">
               <pre className="bg-gray-900 text-brand-400 p-4 rounded-xl text-xs font-mono overflow-x-auto shadow-inner leading-relaxed">
                 {JSON.stringify(execution.data, null, 2)}
               </pre>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h4 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">Meta Information</h4>
            <div className="space-y-4">
               <div>
                 <span className="text-xs text-gray-500 block">STARTED AT</span>
                 <span className="text-sm font-medium">{new Date(execution.started_at).toLocaleString()}</span>
               </div>
               {execution.ended_at && (
                 <div>
                   <span className="text-xs text-gray-500 block">ENDED AT</span>
                   <span className="text-sm font-medium">{new Date(execution.ended_at).toLocaleString()}</span>
                 </div>
               )}
               <div>
                 <span className="text-xs text-gray-500 block">RETRIES</span>
                 <span className="text-sm font-medium">{execution.retries}</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionDetails;
