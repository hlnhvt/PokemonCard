import { useEffect, useState } from 'react';

/** Is the screen held upright? */
export function usePortrait() {
  const read = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const [portrait, setPortrait] = useState(read);
  useEffect(() => {
    const on = () => setPortrait(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return portrait;
}

/** Full-screen landscape box: turned by 90° when the phone is held upright. */
export const landscapeStyle = (portrait) =>
  portrait
    ? { position: 'fixed', top: 0, left: '100vw', width: '100vh', height: '100vw', transform: 'rotate(90deg)', transformOrigin: 'top left' }
    : { position: 'fixed', inset: 0 };
