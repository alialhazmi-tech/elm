/** أشكال البيانات بين شاشات البودكاست الخادمية ومكوناتها العميلة. */

export type AdminShow = {
  id: string;
  name: string;
  description: string;
  cover: string | null;
  accent: string;
  feedUrl: string | null;
  youtube: string;
  storyId: string | null;
  visible: boolean;
  hostedCount: number;
  hiddenCount: number;
  rssCount: number;
  latestAt: string | null;
  /** الصفحة العامة: رابط المادة القديمة أو /podcasts/<id>. */
  publicPath: string;
};

export type AdminEpisode = {
  id: string;
  showId: string;
  title: string;
  guest: string;
  description: string;
  filename: string;
  mime: string;
  byteLength: number;
  durationSeconds: number | null;
  publishedAt: string;
  visible: boolean;
};

export type FeedEpisode = {
  title: string;
  guest: string | null;
  duration: string | null;
  publishedAt: string | null;
  audioUrl: string;
};

export type ShowOption = Pick<AdminShow, "id" | "name" | "accent">;
