// Generates src/components/icons.ts from the lucide-static package. To add an icon, add a line to
// MAP below, then run:
//   mkdir -p /tmp/lucide && (cd /tmp/lucide && npm pack lucide-static && tar xzf lucide-static-*.tgz)
//   node scripts/gen-icons.cjs /tmp/lucide/package > src/components/icons.ts
// and copy /tmp/lucide/package/LICENSE to src/components/LICENSE-lucide.txt if the version changed.
const nodes = require(process.argv[2] + '/icon-nodes.json');
const version = require(process.argv[2] + '/package.json').version;
// App name -> [Lucide name, options]. `bold`: heavier stroke (selected tab). `fill`: filled (an "on" state).
const MAP = {
  'account': 'user', 'account-check-outline': 'user-check', 'account-child': 'baby', 'account-group': 'users',
  'account-off-outline': 'user-x', 'account-remove': 'user-minus', 'account-search': 'user-search', 'account-tie': 'landmark',
  'alert': 'triangle-alert', 'alert-circle': 'circle-alert', 'alert-circle-outline': 'circle-alert', 'alert-octagon': 'octagon-alert',
  'arrow-left': 'arrow-left', 'arrow-right': 'arrow-right', 'arrow-up': 'arrow-up',
  'arrow-up-bold': ['arrow-big-up', { fill: true }], 'arrow-up-bold-outline': 'arrow-big-up',
  'bell': ['bell', { bold: true }], 'bell-outline': 'bell', 'bell-check': 'bell-ring', 'bell-check-outline': 'bell-ring', 'bell-off': 'bell-off',
  'book-open-variant': 'book-open', 'bookmark': ['bookmark', { fill: true }], 'bookmark-outline': 'bookmark',
  'camera-plus-outline': 'camera', 'cash-minus': 'banknote-arrow-down', 'cash-multiple': 'banknote',
  'cellphone-check': 'smartphone', 'cellphone-remove': 'smartphone',
  'chart-bar': 'chart-bar', 'chart-box': 'chart-column-big', 'chart-box-outline': 'chart-column-big',
  'chat': 'message-circle', 'chat-processing': ['message-circle-more', { bold: true }], 'chat-processing-outline': 'message-circle-more',
  'check': 'check', 'check-bold': ['check', { bold: true }], 'check-circle': 'circle-check', 'check-decagram': 'badge-check',
  'chevron-left': 'chevron-left', 'chevron-right': 'chevron-right', 'circle': 'circle', 'city': 'building',
  'clipboard-alert': 'clipboard-pen', 'clipboard-check-outline': 'clipboard-check', 'clipboard-list': 'clipboard-list',
  'clock-outline': 'clock', 'close': 'x', 'close-circle': 'circle-x', 'close-circle-outline': 'circle-x', 'cloud-off-outline': 'cloud-off',
  'cog': 'settings', 'compass': 'compass', 'content-copy': 'copy', 'cookie': 'cookie', 'cookie-cog': 'cookie',
  'crosshairs-gps': 'locate-fixed', 'database-search': 'database-search', 'delete': 'trash', 'delete-forever': 'trash', 'delete-outline': 'trash',
  'directions': 'navigation', 'dots-horizontal-circle': ['circle-ellipsis', { bold: true }], 'dots-horizontal-circle-outline': 'circle-ellipsis',
  'download': 'download', 'email': 'mail', 'email-fast': 'send', 'email-plus': 'mail-plus',
  'emoticon-neutral-outline': 'face-neutral', 'emoticon-sad-outline': 'face-slightly-frowning',
  'file-document': 'file-text', 'filter-off-outline': 'funnel-x', 'flag': ['flag', { fill: true }], 'flag-outline': 'flag',
  'flask-outline': 'flask-conical', 'food-apple': 'apple', 'forum': 'messages-square', 'forum-outline': 'messages-square', 'gavel': 'gavel',
  'hand-heart': ['hand-heart', { bold: true }], 'hand-heart-outline': 'hand-heart', 'help-circle-outline': 'circle-question-mark',
  'home': ['house', { bold: true }], 'home-outline': 'house', 'home-city': 'house-heart', 'hospital-box': 'stethoscope', 'human-cane': 'armchair',
  'image': 'image', 'image-filter-center-focus': 'scan', 'information': 'info', 'license': 'scroll-text', 'lifebuoy': 'life-buoy', 'link': 'link',
  'lock': 'lock', 'lock-open-variant': 'lock-open', 'login': 'log-in', 'logout': 'log-out', 'magnify': 'search', 'key': 'key-round',
  'map': 'map', 'map-marker': ['map-pin', { bold: true }], 'map-marker-outline': 'map-pin', 'map-marker-check': 'map-pin-check',
  'map-marker-distance': 'route', 'map-marker-off': 'map-pin-off', 'map-marker-radius': 'map-pinned', 'map-search': 'map', 'map-search-outline': 'map',
  'message-alert': 'message-square-warning', 'message-outline': 'message-square', 'minus-circle': 'circle-minus',
  'office-building': 'building', 'open-in-new': 'external-link', 'pencil': 'pencil', 'phone': 'phone', 'phone-alert': 'phone-call', 'phone-in-talk': 'phone-call',
  'plus': 'plus', 'printer': 'printer', 'radiobox-blank': 'circle', 'radiobox-marked': 'circle-dot', 'refresh': 'refresh-cw',
  'road-variant': 'construction', 'robot-outline': 'bot', 'scale-balance': 'scale', 'school': 'school', 'send': 'send', 'server': 'server',
  'share-variant': 'share-2', 'shield-account': 'shield-user', 'shield-check': 'shield-check', 'shield-lock': 'shield-keyhole', 'stop': 'square',
  'table': 'table', 'text-box-check-outline': 'file-check', 'text-box-search': 'file-search', 'translate': 'languages', 'tree': 'trees',
  'tune': 'sliders-horizontal', 'vote': 'vote', 'web': 'globe',
};
const out = [];
const missing = [];
for (const [key, value] of Object.entries(MAP)) {
  const [name, options] = Array.isArray(value) ? value : [value, {}];
  if (!nodes[name]) { missing.push(name); continue; }
  const parts = nodes[name].map(([tag, attrs]) => { const a = { ...attrs }; delete a.key; return [tag, a]; });
  const flags = [options.bold ? 'b: 1' : '', options.fill ? 'f: 1' : ''].filter(Boolean).join(', ');
  out.push(`  '${key}': { n: ${JSON.stringify(parts)}${flags ? ', ' + flags : ''} }, // ${name}`);
}
if (missing.length) { console.error('missing', missing); process.exit(1); }
process.stdout.write(`/**
 * The app's one icon set: Lucide ${version} (ISC License, https://lucide.dev), stored as SVG
 * drawing data so no icon font is downloaded. Generated from lucide-static's icon-nodes.json.
 * Full license text: LICENSE-lucide.txt beside this file.
 * Keys keep the names the screens already used; the comment after each entry is the Lucide name.
 * \`b\`: drawn with a heavier stroke (a selected tab). \`f\`: filled (an "on" state, e.g. saved).
 */
export type IconNode = [tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse', attrs: Record<string, string>];
export type IconDef = { n: IconNode[]; b?: 1; f?: 1 };

export const ICONS = {
${out.join('\n')}
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
`);
