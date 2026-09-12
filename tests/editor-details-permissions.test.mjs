import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

test('details expose pinning and scheduling independently from publishing, with working controls', async () => {
  await mkdir('tmp', { recursive: true });
  const directory = await mkdtemp(`${process.cwd()}/tmp/editor-details-`);
  const mocks = {
    react: 'export const useState=value=>[value,()=>{}]',
    'lucide-react': 'export const ArchiveIcon="svg",ArchiveRestoreIcon="svg",ImagePlusIcon="svg",PinIcon="svg",VideoIcon="svg",ZapIcon="svg",ZapOffIcon="svg"',
    '@/components/tahrir/badges': 'export const GuardChip="guard-chip"',
    '@/components/tahrir/stories/story-actions': 'export const ArchiveDialog="archive-dialog",ConfirmDialog="confirm-dialog"',
    '@/components/ui/button': 'export const Button="button"',
    '@/components/ui/input': 'export const Input="input"',
    '@/components/ui/switch': 'export const Switch="switch"',
    '@/components/ui/select': 'export const Select="select",SelectContent="options",SelectItem="option",SelectTrigger="trigger",SelectValue="value"',
    '@/components/content/video-player': 'export const VideoPlayer="video"',
  };
  try {
    await build({ entryPoints: ['components/tahrir/editor/details-panel.tsx'], outfile: `${directory}/subject.mjs`, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', plugins: [{ name: 'details-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents: mocks[path] }));
    } }] });
    const { DetailsPanel } = await import(`${directory}/subject.mjs`);
    const calls = [];
    const props = { id: 'draft', title: 'مادة تجريبية', status: 'draft', canApprove: false, canPin: true, canSchedule: true, gateOpen: true, busy: false, formats: [], series: [], sections: [], recentMedia: [], format: 'news', pinned: false, breakingUntil: null, scheduleAt: '', videoUrl: '', image: '', onPinned: value => calls.push(['pin', value]), onScheduleAt: value => calls.push(['time', value]), onSchedule: () => calls.push(['schedule']) };
    const nodes = node => !node || typeof node !== 'object' ? [] : typeof node.type === 'function' ? nodes(node.type(node.props)) : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
    const render = overrides => nodes(DetailsPanel({ ...props, ...overrides }));
    const pin = tree => tree.find(node => node.props?.['aria-label'] === 'تثبيت في صدارة الرئيسية');
    const schedule = tree => tree.find(node => node.type === 'button' && ['جدولة', 'تعديل الموعد'].includes(node.props.children));
    const tree = render();
    pin(tree).props.onCheckedChange(true);
    tree.find(node => node.props?.id === 'story-schedule-at').props.onChange({ target: { value: '2030-01-03T14:00' } });
    assert.equal(schedule(tree).props.disabled, false);
    schedule(tree).props.onClick();
    assert.deepEqual(calls, [['pin', true], ['time', '2030-01-03T14:00'], ['schedule']]);
    for (const status of ['draft', 'review', 'scheduled', 'published', 'archived']) {
      const current = render({ status });
      assert.equal(Boolean(pin(current)), status !== 'archived');
      assert.equal(Boolean(schedule(current)), !['published', 'archived'].includes(status));
      assert.doesNotMatch(JSON.stringify(current), /عاجل لساعتين|عاجل لست ساعات|أرشفة المادة|استعادة كمسودة/);
    }
    assert.equal(schedule(render({ gateOpen: false })).props.disabled, true);
    assert.equal(schedule(render({ busy: true })).props.disabled, true);
    assert.equal(pin(render({ canPin: false })), undefined);
    assert.ok(schedule(render({ canPin: false })));
    assert.equal(schedule(render({ canSchedule: false })), undefined);
    assert.ok(pin(render({ canSchedule: false })));
    assert.match(JSON.stringify(render({ canApprove: true, status: 'review' })), /عاجل لساعتين/);
    assert.match(JSON.stringify(render({ canApprove: true, status: 'review' })), /أرشفة المادة/);
    assert.equal(schedule(render({ canApprove: true, canSchedule: false })), undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
