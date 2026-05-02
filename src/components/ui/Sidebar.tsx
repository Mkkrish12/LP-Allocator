import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  GitCompare,
  Briefcase,
  Diamond,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface NavItem {
  to: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: BookOpen, label: 'Fund Library' },
  { to: '/analyze', icon: PlusCircle, label: 'Analyze New Fund' },
  { to: '/compare', icon: GitCompare, label: 'Compare Funds' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio View' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      style={{
        width: collapsed ? 64 : 240,
        minWidth: collapsed ? 64 : 240,
        backgroundColor: '#0F1B35',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}
      className="flex flex-col h-screen sticky top-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center px-4 h-16 border-b border-white/10 shrink-0">
        <div
          style={{ color: '#C9A84C' }}
          className="flex items-center gap-2 shrink-0"
        >
          <Diamond size={18} fill="currentColor" />
        </div>
        {!collapsed && (
          <span
            style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600 }}
            className="ml-2 whitespace-nowrap"
          >
            LP Allocator
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1 rounded text-white/40 hover:text-white/80 transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {!collapsed && (
          <p
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}
            className="px-4 mb-2 uppercase font-medium"
          >
            Navigation
          </p>
        )}
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                    isActive ? 'active-nav' : 'inactive-nav'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        backgroundColor: '#1E3A5F',
                        borderLeft: '3px solid #C9A84C',
                        color: '#FFFFFF',
                        paddingLeft: collapsed ? '9px' : '9px',
                      }
                    : {
                        color: 'rgba(255,255,255,0.7)',
                        borderLeft: '3px solid transparent',
                      }
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && (
                  <span style={{ fontSize: 14 }} className="whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-3 border-t border-white/10 shrink-0"
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <span style={{ fontSize: 10 }}>AI</span>
          </div>
        ) : (
          <span>Powered by GPT-4o</span>
        )}
      </div>
    </aside>
  )
}
