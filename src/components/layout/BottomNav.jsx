import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, Dumbbell, ClipboardList, Clock } from 'lucide-react';

export default function BottomNav() {
  const navItems = [
    { to: '/', name: 'Inicio', icon: Home },
    { to: '/calendar', name: 'Plan', icon: CalendarDays },
    { to: '/routines', name: 'Rutinas', icon: ClipboardList },
    { to: '/exercises', name: 'Ejercicios', icon: Dumbbell },
    { to: '/history', name: 'Historial', icon: Clock },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 z-50">
      <div className="max-w-md mx-auto flex justify-between safe-pb">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center py-3 px-2 w-full transition-colors duration-200 ${
                isActive ? 'text-teal-400' : 'text-neutral-400 hover:text-neutral-200'
              }`
            }
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium tracking-wide">
              {item.name}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
