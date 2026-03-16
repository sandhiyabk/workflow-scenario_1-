import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const workflowService = {
  list: async (search?: string) => {
    const { data } = await api.get('/workflows', { params: { search } });
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get(`/workflows/${id}`);
    return data;
  },
  create: async (workflow: any) => {
    const { data } = await api.post('/workflows', workflow);
    return data;
  },
  update: async (id: string, workflow: any) => {
    const { data } = await api.put(`/workflows/${id}`, workflow);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/workflows/${id}`);
  },
  execute: async (id: string, input_data: any) => {
    const { data } = await api.post(`/workflows/${id}/execute`, { input_data });
    return data;
  }
};

export const stepService = {
  create: async (step: any) => {
    const { data } = await api.post('/steps', step);
    return data;
  },
  update: async (id: string, step: any) => {
    const { data } = await api.put(`/steps/${id}`, step);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/steps/${id}`);
  }
};

export const ruleService = {
  create: async (rule: any) => {
    const { data } = await api.post('/rules', rule);
    return data;
  },
  update: async (id: string, rule: any) => {
    const { data } = await api.put(`/rules/${id}`, rule);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/rules/${id}`);
  }
};

export const executionService = {
  list: async () => {
    const response = await api.get('/executions');
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/executions/${id}`);
    return response.data;
  },
  getLogs: async (id: string) => {
    const response = await api.get(`/executions/${id}/logs`);
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.post(`/executions/${id}/cancel`);
    return response.data;
  },
  retry: async (id: string) => {
    const response = await api.post(`/executions/${id}/retry`);
    return response.data;
  },
  approve: async (id: string, data: { approved: boolean; approver_id: string; additional_data?: any }) => {
    const response = await api.post(`/executions/${id}/approve`, data);
    return response.data;
  }
};

export const statsService = {
  get: async () => {
    const response = await api.get('/stats');
    return response.data;
  }
};

export const seedService = {
  run: async () => {
    const { data } = await api.post('/seed');
    return data;
  }
};

export default api;
