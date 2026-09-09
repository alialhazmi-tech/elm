import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

// Run the editor's actual handlers with isolated network, router and React hooks.
test('editor publishes updates, withdraws to draft and navigates only after confirmed success', async () => {
  await mkdir(`${process.cwd()}/tmp`, { recursive: true });
  const dir = await mkdtemp(`${process.cwd()}/tmp/editor-workflow-`);
  const originals = { fetch: globalThis.fetch, window: globalThis.window };
  const slots = []; let cursor = 0; const effects = []; const cleanups = [];
  const routes = []; const requests = []; const confirmed = [];
  let autosaveOptions;
  globalThis.__editorWorkflow = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn) { return fn; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
    router: { replace: path => routes.push(path), refresh() {} },
    recovery: { ready: true, recovery: null, markSaved: value => confirmed.push(value), dismiss() {} },
    autosave: options => { autosaveOptions = options; return { dirty: false, markSaved() {}, markFailed() {} }; },
  };
  globalThis.window = { history: { replaceState() {} } };
  const mocks = {
    react: 'export const {useState,useRef,useCallback,useEffect}=globalThis.__editorWorkflow',
    'next/navigation': 'export const useRouter=()=>globalThis.__editorWorkflow.router',
    'next/link': 'export default "a"',
    'lucide-react': 'export const ExternalLinkIcon="svg",FilePenLineIcon="svg",SaveIcon="svg",SendIcon="svg",ShieldCheckIcon="svg"',
    '@/components/tahrir/use-draft-recovery': 'export const useDraftRecovery=()=>globalThis.__editorWorkflow.recovery',
    '@/components/tahrir/use-draft-autosave': 'export const useDraftAutosave=options=>globalThis.__editorWorkflow.autosave(options)',
  };
  const elements = {
    '@/components/tahrir/badges': ['StatusPill'], '@/components/ui/alert': ['Alert', 'AlertDescription'],
    '@/components/ui/button': ['Button'], '@/components/ui/card': ['Card'],
    '@/components/ui/tabs': ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'], '@/components/ui/textarea': ['Textarea'],
    './team-panel': ['TeamPanel', 'EditorPresence'], './article-preview': ['ArticlePreview'],
    './ai-panel': ['AiPanel'], './field-generator': ['FieldGenerator'], './metadata-generator': ['MetadataGenerator'],
    './article-links': ['ArticleLinks'], './details-panel': ['DetailsPanel'],
    './full-edit': ['FullEditBar', 'FullEditProgressView', 'FullEditProposal'],
    './guard-panel': ['GuardPanel'], './rich-body': ['RichBody'], './seo-panel': ['SeoPanel'],
  };
  for (const [path, names] of Object.entries(elements)) mocks[path] = names.map(name => `export const ${name}=${JSON.stringify(name)}`).join(';');
  try {
    await build({ entryPoints: ['components/tahrir/editor/editor-client.tsx'], outfile: `${dir}/subject.mjs`, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', plugins: [{ name: 'editor-fixture', setup(b) {
      b.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: mocks[args.path] }));
    } }] });
    const { EditorClient } = await import(`${dir}/subject.mjs`);
    const initial = { id: 'original', version: 4, revisionOf: null, status: 'published', title: 'عنوان المادة', excerpt: 'الموجز', body: 'المتن', section: 'news', slug: 'article', seriesSlug: null, image: null, format: 'news', pinned: false, breakingUntil: null, seoTitle: '', seoDescription: '', keywords: [], videoUrl: null };
    let props;
    const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
    const render = () => { cursor = 0; const tree = EditorClient(props); while (effects.length) cleanups.push(effects.shift()()); return tree; };
    const button = label => nodes(render()).find(node => node.type === 'Button' && [node.props.children].flat(Infinity).includes(label));
    let saveFailure = false; let publishFailure = false; let finishSave;
    let holdSave = false;
    globalThis.fetch = async (url, options) => {
      const input = JSON.parse(options.body);
      if (url === '/api/tahrir/guard') return Response.json({ canRequestApproval: true, counts: { blocking: 0 }, findings: [] });
      requests.push({ url, input });
      if (url.endsWith('/publish')) return publishFailure ? Response.json({ error: 'رفض النشر' }, { status: 422 }) : Response.json({ id: 'original', version: 5 });
      if (holdSave) await new Promise(resolve => { finishSave = resolve; });
      if (saveFailure) return Response.json({ error: 'تعارض الحفظ' }, { status: 409 });
      return Response.json({ id: input.returnToDraft ? 'original' : 'revision', version: input.returnToDraft ? 5 : 1, status: 'draft', revisionOf: input.returnToDraft ? null : 'original', section: 'news', slug: 'article' });
    };
    async function reset(status = 'published', canApprove = true) {
      for (const cleanup of cleanups.splice(0)) cleanup?.();
      slots.length = 0; routes.length = 0; requests.length = 0; confirmed.length = 0;
      saveFailure = false; publishFailure = false; holdSave = false;
      props = { actorId: 'editor', canApprove, guardControls: { editorialGuard: false, requireImageRights: false }, series: [], sections: [], recentMedia: [], initial: { ...initial, status } };
      render(); await new Promise(resolve => setTimeout(resolve, 10)); render();
    }
    await reset();
    assert.equal(button('تحديث المادة').props.disabled, false);
    await button('تحديث المادة').props.onClick();
    assert.deepEqual(requests.map(r => r.url), ['/api/tahrir/story', '/api/tahrir/story/publish']);
    assert.equal(requests[1].input.id, 'revision'); assert.equal(requests[1].input.expectedVersion, 1);
    assert.deepEqual(routes, ['/tahrir/stories']);

    await reset(); holdSave = true;
    const pending = button('تحويل إلى مسودة').props.onClick();
    assert.deepEqual(routes, []);
    assert.equal(button('تحويل إلى مسودة').props.disabled, true);
    finishSave(); await pending;
    assert.equal(requests.length, 1); assert.equal(requests[0].input.returnToDraft, true);
    assert.equal(requests[0].input.id, 'original'); assert.equal(requests[0].input.expectedVersion, 4);
    assert.equal(confirmed[0].body, initial.body); assert.deepEqual(routes, ['/tahrir/stories']);
    render(); assert.equal(autosaveOptions.enabled, false);

    await reset(); saveFailure = true;
    await button('تحويل إلى مسودة').props.onClick();
    assert.deepEqual(routes, []); assert.match(JSON.stringify(render()), /تعارض الحفظ/);
    assert.ok(button('تحويل إلى مسودة')); assert.equal(confirmed.length, 0);

    await reset(); publishFailure = true;
    await button('تحديث المادة').props.onClick();
    assert.deepEqual(routes, []); assert.match(JSON.stringify(render()), /رفض النشر/);

    await reset('draft');
    assert.equal(button('تحويل إلى مسودة'), undefined);
    await button('اعتماد ونشر').props.onClick();
    assert.deepEqual(routes, ['/tahrir/stories']);

    await reset('draft');
    await button('حفظ المسودة').props.onClick(); assert.deepEqual(routes, []);
    await reset('draft');
    await autosaveOptions.onSave(); assert.deepEqual(routes, []); assert.equal(requests[0].input.autosave, true);

    await reset('published', false);
    assert.equal(button('تحويل إلى مسودة'), undefined);
    await button('حفظ مسودة التعديل').props.onClick();
    assert.equal(requests.length, 1); assert.equal(requests[0].input.returnToDraft, false);
    assert.deepEqual(routes, ['/tahrir/stories']);

    await reset('archived');
    nodes(render()).find(node => node.type === 'DetailsPanel').props.onRestored();
    assert.deepEqual(routes, ['/tahrir/stories']);
  } finally {
    for (const cleanup of cleanups) cleanup?.();
    Object.assign(globalThis, originals); delete globalThis.__editorWorkflow;
    await rm(dir, { recursive: true, force: true });
  }
});
