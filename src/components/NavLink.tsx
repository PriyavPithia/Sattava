import React from 'react';
import { Link } from 'react-router-dom';
import { useActivePath } from '../hooks/useActivePath';
import { LucideIcon } from 'lucide-react';

interface NavLinkProps {
  to: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, children }) => {
  const isActive = useActivePath(to);
  
  return (
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
        isActive ? 'bg-gray-100' : 'hover:bg-gray-100'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{children}</span>
    </Link>
  );
};

export default NavLink; 