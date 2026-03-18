import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowService, seedService } from '../services/api';
import { toast } from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Loader2, ChevronRight, Layout, Database, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const WorkflowList = () => {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();


  const { data: result, isLoading } = useQuery({
    queryKey: ['workflows', search],
    queryFn: () => workflowService.list(search)
  });

  const workloads = result?.workflows || result || [];

  const createMutation = useMutation({
    mutationFn: () => workflowService.create({ name: 'New Workflow', input_schema: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created');
    },
    onError: () => toast.error('Failed to create workflow')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
    },
    onError: () => toast.error('Failed to delete workflow')
  });

  const seedMutation = useMutation({
    mutationFn: () => seedService.run(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Sample workflows loaded successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Seeding failed');
    }
  });


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-500 mt-1">Manage and execute your automated processes.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="btn-secondary flex items-center space-x-2 border border-dashed border-brand-300 text-brand-600 hover:bg-brand-50"
          >
            {seedMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
            <span>Load Sample Data</span>
          </button>
          <button
            onClick={() => createMutation.mutate()}
            className="btn-primary flex items-center space-x-2"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">

        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search workflows..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500">
          {workloads.length} workflow{workloads.length !== 1 ? 's' : ''}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand-600" size={48} />
        </div>
      ) : workloads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workloads.map((wf: any) => (
            <div key={wf.id} className="card group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                    {wf.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">
                      v{wf.version}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      wf.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {wf.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    to={`/workflows/${wf.id}`}
                    className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                  >
                    <Edit size={18} />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure?')) deleteMutation.mutate(wf.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Schema field count */}
              <div className="text-xs text-gray-400 mb-4">
                {Object.keys(wf.input_schema || {}).length} input field{Object.keys(wf.input_schema || {}).length !== 1 ? 's' : ''}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <span className="text-sm text-gray-500">
                  {new Date(wf.created_at).toLocaleDateString()}
                </span>
                <Link
                  to={`/workflows/${wf.id}`}
                  className="flex items-center space-x-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  <span>Build</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="max-w-sm mx-auto space-y-5">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <Layout size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {search ? `No workflows match "${search}"` : 'No workflows yet'}
            </h3>
            <p className="text-gray-500 leading-relaxed">
              {search
                ? 'Try a different search term.'
                : 'Start with sample workflows to explore the engine, or create your own.'}
            </p>
            {!search && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  className="btn-secondary flex items-center justify-center space-x-2"
                >
                  {seedMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                  <span>Load Sample Data</span>
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  className="btn-primary"
                >
                  Create Workflow
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowList;
