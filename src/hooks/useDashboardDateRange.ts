import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';

// Shared date range state for dashboard consistency
let sharedDateRange: DateRange | undefined = {
  from: subDays(new Date(), 30),
  to: new Date()
};

let listeners: (() => void)[] = [];

export function useDashboardDateRange() {
  const [, forceUpdate] = useState({});

  const setDateRange = (range: DateRange | undefined) => {
    sharedDateRange = range;
    listeners.forEach(listener => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  // Force re-render when shared state changes
  useState(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  });

  return {
    dateRange: sharedDateRange,
    setDateRange
  };
}