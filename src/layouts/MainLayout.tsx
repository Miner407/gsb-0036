import { ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  CalendarDays,
  Download,
  Menu,
  X,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ToastContainer from '@/components/ui/Toast';

interface MainLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/members', label: '成员管理', icon: Users },
  { path: '/settings', label: '排班设置', icon: Settings },
  { path: '/schedule', label: '排班表', icon: CalendarDays },
  { path: '/export', label: '导出中心', icon: Download },
];

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastContainer />
      
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-primary-800 text-white transition-all duration-300 z-40',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-primary-700">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <CalendarClock className="w-8 h-8 text-secondary-400" />
              <h1 className="text-lg font-bold">值班系统</h1>
            </div>
          ) : (
            <CalendarClock className="w-8 h-8 text-secondary-400 mx-auto" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="mt-6 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all duration-200',
                  'hover:bg-primary-700/50',
                  isActive && 'bg-primary-700 text-secondary-400',
                  !sidebarOpen && 'justify-center'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-700">
          {sidebarOpen && (
            <div className="text-xs text-primary-300 text-center">
              值班排班与调班系统 v1.0
            </div>
          )}
        </div>
      </aside>

      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          sidebarOpen ? 'ml-64' : 'ml-20'
        )}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
