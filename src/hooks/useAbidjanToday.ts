import { useEffect, useState } from 'react';
import { getAbidjanToday } from '../lib/registration-days';

export function useAbidjanToday(): string {
  const [today, setToday] = useState(() => getAbidjanToday());

  useEffect(() => {
    const refresh = () => setToday(getAbidjanToday());
    const scheduleMidnightRefresh = () => {
      const nextMidnight = Date.parse(`${getAbidjanToday()}T00:00:00.000Z`) + 86_400_000;
      const timeout = window.setTimeout(() => {
        refresh();
        scheduleMidnightRefresh();
      }, Math.max(1, nextMidnight - Date.now() + 50));
      return timeout;
    };

    let timeout = scheduleMidnightRefresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        window.clearTimeout(timeout);
        timeout = scheduleMidnightRefresh();
      }
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return today;
}
