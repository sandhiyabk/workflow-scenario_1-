import { Link, useLocation } from 'react-router-dom';
import { Activity, Layout, Layers, PieChart } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-brand-600 rounded-lg text-white">
              <Activity size={24} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-brand-800">
              FlowEngine
            </span>
          </div>
          
          <div className="flex space-x-8">
            <Link 
              to="/dashboard" 
              className={`flex items-center space-x-2 font-medium transition-colors ${
                isActive('/dashboard') ? 'text-brand-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <PieChart size={18} />
              <span>Dashboard</span>
            </Link>
            <Link 
              to="/workflows" 
              className={`flex items-center space-x-2 font-medium transition-colors ${
                isActive('/workflows') ? 'text-brand-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Layout size={18} />
              <span>Workflows</span>
            </Link>
            <Link 
              to="/executions" 
              className={`flex items-center space-x-2 font-medium transition-colors ${
                isActive('/executions') ? 'text-brand-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Layers size={18} />
              <span>Executions</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
