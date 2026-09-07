import { initializePerformance, startNavigation } from './lib/performance/client';

initializePerformance();

export function onRouterTransitionStart(url: string) {
  startNavigation(url);
}
