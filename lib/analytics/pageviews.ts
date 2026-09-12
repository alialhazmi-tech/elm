/** Contract of the published GTM-MLB68TX2 container (GA4 G-HDXL9ZXL9V). */
export type Pageview = {
  event: "Pageview";
  // Despite its legacy name, GTM maps pagePath to GA4 page_location: a full URL.
  pagePath: string;
  pageTitle: string;
};

const privatePath = /^\/(?:tahrir|account|join|api|prototype)(?:\/|$)/i;
const campaignKeys = new Set(["utm_id", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "dclid", "gbraid", "wbraid", "p"]);

function normalizedPath(pathname: string): string {
  return pathname.split("/").map(part => {
    // Legacy Arabic links can be re-encoded by a canonical route replacement.
    // Normalize each segment independently so encoded slashes stay in a segment.
    for (let i = 0; i < 3; i++) {
      try {
        const decoded = decodeURIComponent(part);
        if (decoded === part) break;
        part = decoded;
      } catch { break; }
    }
    return encodeURIComponent(part);
  }).join("/");
}

/** Keep attribution, but never forward account tokens or arbitrary query values. */
export function analyticsUrl(href: string): string | null {
  try {
    const url = new URL(href);
    url.pathname = normalizedPath(url.pathname);
    if (!/^https?:$/.test(url.protocol) || privatePath.test(decodeURIComponent(url.pathname))) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (!campaignKeys.has(key) || url.searchParams.getAll(key).some(value => value.includes("@"))) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
}

export function createPageviewTracker(send: (event: Pageview, referrer: string) => void) {
  let lastRoute = "";
  let previousPage = "";
  return {
    track(href: string, title: string, initialReferrer: string) {
      const pagePath = analyticsUrl(href);
      if (!pagePath) {
        // Returning from an excluded screen is a new public visit.
        lastRoute = "";
        previousPage = "";
        return false;
      }
      const route = new URL(href);
      route.pathname = new URL(pagePath).pathname;
      route.hash = "";
      if (lastRoute === route.href) return false;
      const referrer = previousPage || analyticsUrl(initialReferrer) || "";
      send({ event: "Pageview", pagePath, pageTitle: title }, referrer);
      lastRoute = route.href;
      previousPage = pagePath;
      return true;
    },
  };
}
