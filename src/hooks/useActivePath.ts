import { useLocation } from 'react-router-dom';

export const useActivePath = (path: string) => {
  const location = useLocation();
  return location.pathname === path;
}; 