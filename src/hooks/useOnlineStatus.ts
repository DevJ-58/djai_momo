import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const setOnlineStatus = () => setOnline(navigator.onLine);
    window.addEventListener('online', setOnlineStatus);
    window.addEventListener('offline', setOnlineStatus);
    return () => {
      window.removeEventListener('online', setOnlineStatus);
      window.removeEventListener('offline', setOnlineStatus);
    };
  }, []);

  return online;
}
