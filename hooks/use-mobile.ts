import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 992;

/**
 * يقرأ استعلام العرض عبر useSyncExternalStore بدل setState داخل تأثير —
 * قاعدة react-hooks/set-state-in-effect في المشروع تمنع الصيغة الأصلية للكِت.
 * الخادم يعيد false دائمًا فتتطابق الترميزة الأولى مع الترطيب، ثم يُعاد الرسم بالقيمة الفعلية.
 */
function useViewportBelow(width: number): boolean {
  const query = `(max-width: ${width - 1}px)`;
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsMobile() {
  return useViewportBelow(MOBILE_BREAKPOINT);
}

export function useIsTablet() {
  return useViewportBelow(TABLET_BREAKPOINT);
}
