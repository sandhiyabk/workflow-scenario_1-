import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { Toaster } from 'react-hot-toast';
import WorkflowList from './pages/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor';
import ExecutionList from './pages/ExecutionList';
import ExecutionDetails from './pages/ExecutionDetails';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workflows" element={<WorkflowList />} />
            <Route path="/workflows/:id" element={<WorkflowEditor />} />
            <Route path="/executions" element={<ExecutionList />} />
            <Route path="/executions/:id" element={<ExecutionDetails />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
