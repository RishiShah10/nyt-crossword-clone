import { useState, useEffect } from 'react';

function getIsMobile() {
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 767;
}

export function useIsMobile(): boolean {
  const [v, set] = useState(getIsMobile);
  useEffect(() => {
    const h = () => set(getIsMobile());
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return v;
}
