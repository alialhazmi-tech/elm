'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { commitNavigation, reportWebVital } from '@/lib/performance/client';

/** The effect marks route commit; it does not claim images have finished painting. */
export function PerformanceMetrics() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useReportWebVitals(reportWebVital);
  useEffect(() => { commitNavigation(pathname, search); }, [pathname, search]);
  return null;
}
