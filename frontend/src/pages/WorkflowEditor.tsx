import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowService, stepService, ruleService } from '../services/api';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  MarkerType,
  Handle,
  Position,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Save, 
  ChevronLeft, 
  Plus, 
  Settings, 
  Trash2, 
  Play,
  GitBranch,
  Loader2,
  X,
  CheckCircle,
  Bell,
  Activity
} from 'lucide-react';

import ExecutionModal from '../components/ExecutionModal';

const nodeTypes = {
  TASK: ({ data }: any) => (
    <div className={`p-4 rounded-xl border-2 transition-all w-48 shadow-sm hover:shadow-md relative ${data.selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-300 border-2 border-white" />
      {data.isStart && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase">Start</div>
      )}
      <div className="flex items-center space-x-2 mb-2">
        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
          <Activity size={16} />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Task Step</span>
      </div>
      <div className="font-bold text-gray-800 text-sm truncate">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-brand-500 border-2 border-white" />
    </div>
  ),
  APPROVAL: ({ data }: any) => (
    <div className={`p-4 rounded-xl border-2 transition-all w-48 shadow-sm hover:shadow-md relative ${data.selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-300 border-2 border-white" />
      {data.isStart && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase">Start</div>
      )}
      <div className="flex items-center space-x-2 mb-2">
        <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
          <CheckCircle size={16} />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Approval</span>
      </div>
      <div className="font-bold text-gray-800 text-sm truncate">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500 border-2 border-white" />
    </div>
  ),
  NOTIFICATION: ({ data }: any) => (
    <div className={`p-4 rounded-xl border-2 transition-all w-48 shadow-sm hover:shadow-md relative ${data.selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-300 border-2 border-white" />
      {data.isStart && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase">Start</div>
      )}
      <div className="flex items-center space-x-2 mb-2">
        <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
          <Bell size={16} />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Notification</span>
      </div>
      <div className="font-bold text-gray-800 text-sm truncate">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500 border-2 border-white" />
    </div>
  )
};

const WorkflowEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [isExecModalOpen, setIsExecModalOpen] = useState(false);

  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowService.get(id!)
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: (data: any) => workflowService.update(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow', id] })
  });

  const addStepMutation = useMutation({
    mutationFn: (data: any) => stepService.create({ ...data, workflow_id: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow', id] })
  });

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => stepService.delete(stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      setActiveStepId(null);
    }
  });

  const addRuleMutation = useMutation({
    mutationFn: (rule: any) => ruleService.create(rule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow', id] })
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => ruleService.delete(ruleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow', id] })
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id: ruleId, data }: { id: string; data: any }) => ruleService.update(ruleId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow', id] })
  });

  const executeMutation = useMutation({
    mutationFn: (data: any) => workflowService.execute(id!, data),
    onSuccess: () => {
      navigate('/executions');
    },
    onError: (err: any) => {
        alert(err.response?.data?.error || 'Execution failed');
    }
  });

  const nodes = useMemo(() => {
    if (!workflow?.steps) return [];
    return workflow.steps.map((step: any, index: number) => ({
      id: step.id,
      type: ['TASK', 'APPROVAL', 'NOTIFICATION'].includes(step.step_type) ? step.step_type : 'TASK',
      position: step.metadata?.position || { x: index * 250 + 50, y: 150 + (index % 2) * 100 },
      data: { 
        label: step.name,
        selected: activeStepId === step.id,
        isStart: workflow.start_step_id === step.id
      },
    }));
  }, [workflow, activeStepId]);

  const edges = useMemo(() => {
    if (!workflow?.steps) return [];
    const _edges: Edge[] = [];
    workflow.steps.forEach((step: any) => {
      step.rules?.forEach((rule: any) => {
        if (rule.next_step_id) {
          _edges.push({
            id: `e-${rule.id}`,
            source: step.id,
            target: rule.next_step_id,
            label: rule.condition.length > 10 ? '...' : rule.condition,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: true,
            style: { strokeWidth: 2 }
          });
        }
      });
    });
    return _edges;
  }, [workflow]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={48} /></div>;

  const currentStep = workflow?.steps.find((s: any) => s.id === activeStepId);

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/workflows')} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center space-x-2">
              <input 
                type="text" 
                defaultValue={workflow.name}
                onBlur={(e) => updateWorkflowMutation.mutate({ name: e.target.value })}
                className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-500 outline-none"
              />
            </h1>
            <p className="text-sm text-gray-500">Workflow ID: {id}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button 
             onClick={() => setIsExecModalOpen(true)}
             className="btn-secondary flex items-center space-x-2"
          >
            <Play size={18} />
            <span>Test Execute</span>
          </button>
          <button className="btn-primary flex items-center space-x-2">
            <Save size={18} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <ExecutionModal 
        isOpen={isExecModalOpen}
        onClose={() => setIsExecModalOpen(false)}
        schema={workflow?.input_schema}
        workflowName={workflow?.name}
        onExecute={(data) => executeMutation.mutate(data)}
      />

      <div className="flex-grow flex space-x-4 overflow-hidden">
        {/* Visual Builder */}
        <div className="flex-grow border border-gray-200 rounded-2xl bg-white overflow-hidden relative">
          <ReactFlow 
            nodes={nodes} 
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setActiveStepId(node.id)}
            onNodeDragStop={(_, node) => {
              const step = workflow.steps.find((s:any) => s.id === node.id);
              if (step) {
                stepService.update(node.id, { 
                  metadata: { ...step.metadata, position: node.position } 
                });
              }
            }}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
          
          <button 
            onClick={() => addStepMutation.mutate({ name: 'New Step', step_type: 'TASK', order: workflow.steps.length })}
            className="absolute bottom-6 right-20 btn-primary rounded-full w-12 h-12 flex items-center justify-center shadow-xl"
          >
            <Plus size={24} />
          </button>
        </div>

        {/* Sidebar Panel */}
        <div className="w-96 bg-white border border-gray-200 rounded-2xl flex flex-col shadow-sm">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => setActiveStepId(null)}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all uppercase tracking-wider ${!activeStepId ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400'}`}
            >
              Workflow
            </button>
            <button 
              disabled={!activeStepId}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all uppercase tracking-wider ${activeStepId ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-300'}`}
            >
              Step Settings
            </button>
          </div>

          <div className="flex-grow overflow-y-auto">
            {activeStepId && currentStep ? (
              <div className="p-6 space-y-6 animate-in slide-in-from-right-4 duration-200">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">Step Properties</h3>
                  <button onClick={() => setActiveStepId(null)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                    <input 
                      type="text" 
                      className="input text-sm" 
                      defaultValue={currentStep.name}
                      onBlur={(e) => stepService.update(currentStep.id, { name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
                    <select 
                      className="input text-sm"
                      defaultValue={currentStep.step_type}
                      onChange={(e) => stepService.update(currentStep.id, { step_type: e.target.value })}
                    >
                      <option value="TASK">Task</option>
                      <option value="APPROVAL">Approval</option>
                      <option value="NOTIFICATION">Notification</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase">Entry Point</label>
                    <button 
                      onClick={() => updateWorkflowMutation.mutate({ start_step_id: currentStep.id })}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                        workflow.start_step_id === currentStep.id 
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {workflow.start_step_id === currentStep.id ? 'Starting Step' : 'Set as Start'}
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-sm flex items-center space-x-2 text-gray-900">
                      <GitBranch size={16} className="text-brand-500" />
                      <span>Logic & Routings</span>
                    </h4>
                    <button 
                      onClick={() => addRuleMutation.mutate({ step_id: currentStep.id, condition: 'DEFAULT', priority: 99 })}
                      className="p-1 text-brand-600 hover:bg-brand-50 rounded"
                      disabled={addRuleMutation.isPending}
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {currentStep.rules?.sort((a:any, b:any) => a.priority - b.priority).map((rule: any) => (
                      <div key={rule.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm space-y-2 group">
                        <div className="flex justify-between items-center">
                           <input 
                            type="number"
                            className="bg-transparent w-8 text-[10px] font-bold text-gray-400 border-none p-0 focus:ring-0"
                            defaultValue={rule.priority}
                            onBlur={(e) => updateRuleMutation.mutate({ id: rule.id, data: { priority: parseInt(e.target.value) } })}
                          />
                          <button 
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center space-x-2">
                           <span className="text-[10px] font-bold text-gray-400">IF</span>
                           <input 
                              type="text" 
                              className="flex-grow bg-white border border-gray-200 rounded px-2 py-1 text-[11px] font-mono"
                               defaultValue={rule.condition}
                               onBlur={(e) => updateRuleMutation.mutate({ id: rule.id, data: { condition: e.target.value } })}
                           />
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold text-gray-400">THEN</span>
                          <select 
                             className="flex-grow bg-white border border-gray-200 rounded px-2 py-1 text-[11px]"
                              defaultValue={rule.next_step_id || ''}
                              onChange={(e) => updateRuleMutation.mutate({ id: rule.id, data: { next_step_id: e.target.value || null } })}
                          >
                             <option value="">End Workflow</option>
                             {workflow.steps.filter((s:any) => s.id !== activeStepId).map((s:any) => (
                               <option key={s.id} value={s.id}>{s.name}</option>
                             ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <button 
                    onClick={() => deleteStepMutation.mutate(currentStep.id)}
                    className="w-full py-2 flex items-center justify-center space-x-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium border border-red-100"
                  >
                    <Trash2 size={16} />
                    <span>Remove Step</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-8 animate-in slide-in-from-left-4 duration-200">
                <div>
                   <h3 className="font-bold text-lg mb-4">Input Schema</h3>
                   <p className="text-xs text-gray-500 mb-6 leading-relaxed">Define the data structure expected when this workflow is executed.</p>
                   
                   <div className="space-y-4">
                      {Object.entries(workflow.input_schema || {}).map(([key, field]: [string, any]) => (
                        <div key={key} className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3 relative group shadow-sm">
                          <button 
                            onClick={() => {
                              const newSchema = { ...workflow.input_schema };
                              delete newSchema[key];
                              updateWorkflowMutation.mutate({ input_schema: newSchema });
                            }}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                          
                          <div className="flex items-center space-x-2">
                             <input 
                               className="bg-transparent font-bold text-sm w-full border-none p-0 focus:ring-0 text-gray-900"
                               defaultValue={key}
                               onBlur={(e) => {
                                 if (e.target.value === key) return;
                                 const newSchema = { ...workflow.input_schema };
                                 newSchema[e.target.value] = field;
                                 delete newSchema[key];
                                 updateWorkflowMutation.mutate({ input_schema: newSchema });
                               }}
                             />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <select 
                              className="text-[10px] bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-500 outline-none"
                              value={field.type}
                              onChange={(e) => {
                                const newSchema = { ...workflow.input_schema };
                                newSchema[key] = { ...field, type: e.target.value };
                                updateWorkflowMutation.mutate({ input_schema: newSchema });
                              }}
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                            </select>
                            
                            <button 
                              onClick={() => {
                                const newSchema = { ...workflow.input_schema };
                                newSchema[key] = { ...field, required: !field.required };
                                updateWorkflowMutation.mutate({ input_schema: newSchema });
                              }}
                              className={`text-[10px] font-bold rounded px-2 py-1 border transition-all ${field.required ? 'bg-brand-50 border-brand-200 text-brand-600' : 'bg-white border-gray-200 text-gray-400'}`}
                            >
                              {field.required ? 'REQUIRED' : 'OPTIONAL'}
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <button 
                        onClick={() => {
                          const newSchema = { ...workflow.input_schema, [`field_${Object.keys(workflow.input_schema || {}).length + 1}`]: { type: 'string', required: false } };
                          updateWorkflowMutation.mutate({ input_schema: newSchema });
                        }}
                        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center space-x-2"
                      >
                        <Plus size={14} />
                        <span>Add Schema Field</span>
                      </button>
                   </div>
                </div>

                <div className="pt-8 border-t border-gray-100">
                   <h3 className="font-bold text-sm mb-4 uppercase tracking-wider text-gray-400">Metadata</h3>
                   <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-bold uppercase">Status</span>
                        <button 
                          onClick={() => updateWorkflowMutation.mutate({ is_active: !workflow.is_active })}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${workflow.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {workflow.is_active ? 'Active' : 'Inactive'}
                        </button>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-bold uppercase">Version</span>
                        <span className="text-sm font-bold text-gray-900">v{workflow.version}</span>
                     </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditor;
