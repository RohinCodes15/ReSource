/**
 * The Privacy Policy and Terms of Service, in plain English, plus the credits list.
 *
 * These are good-faith drafts written for a student project. They are NOT legal advice and
 * must be read by a parent, teacher or attorney before the app is opened to the public
 *. The privacy text describes what the code actually does: when the code
 * changes what is collected, change this file and bump POLICY_VERSION in shared/constants.ts.
 *
 * `{creator}` and `{email}` are filled in from PROJECT in shared/constants.ts.
 * In `body`, a string is a paragraph and an array of strings is a bulleted list.
 */
export type LegalSection = { heading: string; body: (string | string[])[] };

export const PRIVACY: LegalSection[] = [
  {
    heading: 'The short version',
    body: [[
      'You can use ReSource without an account and without giving your name.',
      'We do not sell your information and we do not share it for advertising. There are no ads, no analytics and no trackers in this app.',
      'Your location stays on your device, except that a rounded position is sent with a question to the assistant if you have set a location. Reports and posts are stored without your name, and you can delete them at any time.',
      'If you are under 13, you can read everything but you cannot send us anything.',
    ]],
  },
  {
    heading: 'Who runs ReSource',
    body: ['ReSource is an independent student project made by {creator} in Fremont, California. It is not run by, paid for by, or connected to the City of Fremont. To ask a privacy question or make a request, email {email}.'],
  },
  {
    heading: 'What we collect, and why',
    body: [
      'We collect only what a feature needs to work.',
      [
        'Just browsing: nothing that identifies you is stored. Like every website, our server sees your IP address while it answers a request. We use a scrambled (hashed) form of it, held in memory for up to a day, only to stop abuse by limiting how often one visitor can send things. We do not write IP addresses to our database.',
        'An install token: the first time you send something, the app makes a random code and keeps it on your device. Our server stores only a scrambled version of it next to your reports, posts, votes and alert settings. This is what lets you delete your own things. It is not your device ID and it cannot be turned back into one.',
        'Impact reports: the service you chose, a general area (a ZIP-code area or "Citywide"), your description, the impact level, an optional photo and the time. Before saving, we automatically remove email addresses, phone numbers and street addresses from the description. Photos are re-saved without their hidden data, such as the GPS position a phone adds.',
        'Community posts: your post text, the area you picked, the time, the number of upvotes and any abuse reports about it.',
        'Alert settings: the topics and areas you follow, and whether you turned on notifications.',
        'Email alerts, only if this deployment offers them and you sign up: your email address, so we can send the alerts you asked for.',
        'The assistant: your messages, your chosen language and, if you set a location, a rounded position (to about one kilometer). Your messages and language go to our server and then to our AI provider, Anthropic, to write an answer. The rounded position stays on our server, where the basic search mode uses it to sort nearby places; it is not sent to Anthropic. Our server keeps the current conversation in memory for up to ten minutes so the assistant can follow it, and never writes chat messages to its database. Chat history is kept on your own device only if you accept optional storage.',
        'Feedback: the message you type, with no identifier attached.',
        'A data deletion request: your email address and what you wrote, so we can find the data and answer you. We delete the email address once the request is finished.',
        'Consent records: what you agreed to, which version of this policy, and when, next to your scrambled install token.',
        'Sign-in, only if accounts are turned on and you choose to use one. Residents never need to sign in: every feature works without an account. With an email link: your email address, handled by our sign-in provider. With "Continue with Google": Google tells our sign-in provider your Google account\'s email address, name and profile picture, and the provider keeps them with your account. The app itself uses only the email address.',
        'Admin tools: they open only for accounts that the people who run ReSource have marked as admins in our sign-in provider, or for someone with the staff passcode. Our server checks this again on every admin request. Admins can read reports, including any photo attached to them, in order to review them.',
      ],
    ],
  },
  {
    heading: 'What we do not collect',
    body: [[
      'Your name, unless you choose to sign in with Google (see above), your home address or your phone number.',
      'Your precise location. The place you choose (GPS or ZIP code) is stored only on your device and distances are worked out on your device.',
      'Advertising IDs, contact lists, or anything about other apps and sites you use.',
      'Usage analytics or crash reports.',
    ]],
  },
  {
    heading: 'Who else handles your information',
    body: [
      'We use a small number of service providers to run the app. They act on our instructions and are not allowed to use your information for their own advertising.',
      [
        'Supabase: stores the database, report photos and, if used, sign-in.',
        'Google: only if you choose "Continue with Google". Google confirms who you are and shares your account\'s email address, name and profile picture with Supabase.',
        'Our hosting providers: deliver the website and run the server, and keep standard short-term server logs.',
        'Anthropic: receives the text of your chat messages to generate the assistant\'s answer.',
        'OpenStreetMap (web) or your phone\'s map provider, Apple or Google (phones): when you open the map, your device asks them for map images, so they see your IP address and the area you are viewing.',
      ],
      'We do not sell personal information. We do not share it for cross-context behavioral advertising. We may share reports with the public and with officials only as totals (for example, "12 verified reports about street repair"), never with anything that identifies a person.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [[
      'Reports, posts, votes and alert settings: until you delete them, a moderator removes them, or the project ends. If the project ends, all resident data will be deleted.',
      'Deletion from the app ("Delete my data"): right away.',
      'Deletion requests sent by form or email: answered within 30 days.',
      'Rate-limit records: held in memory only, for up to 24 hours.',
      'Things saved on your device: until you clear them in Settings or remove the app.',
    ]],
  },
  {
    heading: 'Your choices and rights',
    body: [
      'Everyone, wherever they live, can do the following in Settings, with no account:',
      [
        'See it: "Download my data" gives you a copy of everything tied to your device.',
        'Delete it: "Delete my data" erases your reports, posts, votes, alert settings and consent records from our server immediately.',
        'Correct it: delete the report or post and send a corrected one, or email us.',
        'Opt out: turn off alerts or notifications at any time, and use the unsubscribe link in any alert email.',
        'Change your mind about optional storage at any time from "Storage settings".',
      ],
      'If you live in California, the CCPA/CPRA gives you the right to know what personal information is collected, to delete it, to correct it, to limit the use of sensitive personal information, and not to be treated differently for using these rights. We do not sell or share personal information, so there is nothing to opt out of. We do not use sensitive personal information for anything beyond providing the service. You can make a request through Settings, the Data deletion request page, or by emailing {email}. Someone you authorize may make a request for you. We will not ask for more information than we need to find your data.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'ReSource is not directed to children under 13 and we do not knowingly collect personal information from them. Before any form that sends us something, the app asks you to confirm you are 13 or older. Someone who says they are under 13 gets a browse-only version: they can read everything, but the report, post, chat, alert sign-up and sign-in forms are turned off.',
      'There are no ads, no behavioral tracking and no profiling for anyone.',
      'Parents and guardians: if you believe your child sent us information, use the Data deletion request page or email {email}. Tell us roughly what was sent and when, and we will delete it.',
    ],
  },
  {
    heading: 'Security',
    body: ['Connections are encrypted (HTTPS). The database key that can change data is kept on the server and never shipped in the app. Database rules stop the public key from reading private tables. What you write is checked and limited before it is stored. No system is perfectly secure, so please do not send sensitive personal details.'],
  },
  {
    heading: 'Where data is processed',
    body: ['Our providers process data in the United States and possibly other countries where they operate.'],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'If we change what we collect or how we use it, we will update this page, change the effective date, and add a line to the change log below.',
      [
        '2026-10-12: first version.',
        '2026-10-13: clarified that the server holds a conversation in memory for up to ten minutes, and that the rounded position sent with a chat message is the one exception to location staying on your device.',
        '2026-10-16: added Google sign-in (what Google shares, and that residents never need to sign in), how admin access is controlled, and that admins can see report photos.',
        '2026-10-18: the assistant became a general-purpose AI (Claude, from Anthropic). Your rounded position is no longer sent to Anthropic with a chat message.',
      ],
    ],
  },
  {
    heading: 'Contact',
    body: ['{creator}, ReSource (independent student project), Fremont, California. Email: {email}.'],
  },
];

export const TERMS: LegalSection[] = [
  {
    heading: 'About these terms',
    body: ['ReSource is a free, independent student project by {creator}. By using it you agree to these terms. If you do not agree, please do not use it. You must be 13 or older to send anything through ReSource.'],
  },
  {
    heading: 'What ReSource is, and is not',
    body: [[
      'It is general information about Fremont city services, the city budget and local places to get help, gathered from public sources that we cite.',
      'It is not an official City of Fremont service, and nothing in it is a statement by the City.',
      'It is not an emergency service. In an emergency call 911. For a mental health crisis call or text 988.',
      'It is not legal, medical, financial or immigration advice.',
      'Information can be out of date or wrong. Hours, addresses and programs change. Always confirm with the organization before you rely on it or travel.',
      'Map pins and distances are approximate.',
    ]],
  },
  {
    heading: 'The assistant',
    body: ['The assistant is Claude, a general-purpose AI model from Anthropic. It answers from its own knowledge, not from our sourced data, so it can be wrong, out of date or misunderstand a question, especially about Fremont budget figures, services, phone numbers and addresses. Check those in the Budget and Resources tabs, which show each source, or with the organization itself. Its answers are not official City statements and are not advice. Do not type personal information into the chat.'],
  },
  {
    heading: 'Acceptable use',
    body: [
      'When you use ReSource, do not:',
      [
        'post anything unlawful, threatening, harassing, hateful or sexually explicit;',
        'post personal information about yourself or anyone else, such as names with addresses, phone numbers or emails;',
        'post spam, advertising, or false reports;',
        'pretend to be someone else, including a City employee or official;',
        'try to break, overload, scrape or get around the limits of the service.',
      ],
    ],
  },
  {
    heading: 'What you send us',
    body: [
      'You keep the rights to what you write. You give ReSource permission to store it, show it in the app (community posts), and use reports in totals and summaries shared with the public and with officials. Reports are shown publicly only as totals, after a moderator has reviewed them.',
      'Only send things that are true to the best of your knowledge and that you have the right to share.',
    ],
  },
  {
    heading: 'Moderation',
    body: ['Reports start as "pending" and count only after review. Posts that our filter flags, or that several people report, are hidden until reviewed. We may remove or decline anything that breaks these terms, and we may block abusive use. We are not obliged to publish anything. You can delete your own posts and data at any time.'],
  },
  {
    heading: 'Cost',
    body: ['ReSource is free. There are no purchases, subscriptions, ads or paid tiers.'],
  },
  {
    heading: 'Links to other sites',
    body: ['ReSource links to websites, phone numbers and map services run by others. We do not control them and are not responsible for what they do.'],
  },
  {
    heading: 'No warranty',
    body: ['ReSource is provided "as is" and "as available", without warranties of any kind, to the fullest extent the law allows. We do not promise that it will be accurate, complete, uninterrupted or error-free.'],
  },
  {
    heading: 'Limit of liability',
    body: ['To the fullest extent the law allows, the creator of ReSource is not liable for any indirect, incidental or consequential loss arising from your use of it, or from relying on information in it. Nothing in these terms limits rights that cannot be limited by law.'],
  },
  {
    heading: 'Ending use',
    body: ['You can stop using ReSource at any time and delete your data in Settings. We may suspend access for anyone who breaks these terms, and we may change or shut down the project at any time.'],
  },
  {
    heading: 'Governing law',
    body: ['These terms are governed by the laws of the State of California, USA.'],
  },
  {
    heading: 'Changes and contact',
    body: ['We may update these terms; the effective date at the top shows the current version. Questions: {email}.'],
  },
];

export type Credit = { name: string; use: string; license: string; url: string };

export const CREDITS: { group: string; items: Credit[] }[] = [
  {
    group: 'Fonts and icons',
    items: [
      { name: 'Fraunces', use: 'Headlines and large figures. One weight, cut down to Latin and Vietnamese letters and bundled with the app (not loaded from a font service).', license: 'SIL Open Font License 1.1', url: 'https://github.com/undercasetype/Fraunces' },
      { name: 'Inter', use: 'Body text, labels and buttons, in two weights, bundled with the app (not loaded from a font service).', license: 'SIL Open Font License 1.1', url: 'https://github.com/rsms/inter' },
      { name: 'Lucide icons', use: 'Every icon in the app, drawn from Lucide 1.57.0 (some derived from Feather). Copied into the app as drawing data, so no icon font is downloaded.', license: 'ISC License (Feather parts: MIT License)', url: 'https://lucide.dev/license' },
      { name: 'Drawings of Fremont places', use: 'Mission Peak, the NILES sign above Niles, and Lake Elizabeth in Central Park, in headers and empty lists. Drawn for this project.', license: 'Part of ReSource, MIT License', url: 'https://github.com/RohinCodes15/ReSource' },
    ],
  },
  {
    group: 'Maps',
    items: [
      { name: 'OpenStreetMap', use: 'Map images and map data on the web. © OpenStreetMap contributors.', license: 'Open Database License (ODbL) 1.0', url: 'https://www.openstreetmap.org/copyright' },
      { name: 'Leaflet', use: 'The web map library.', license: 'BSD 2-Clause', url: 'https://leafletjs.com/' },
      { name: 'Apple Maps / Google Maps', use: 'The map on iPhone and Android, through react-native-maps, under each platform\'s terms.', license: 'Platform terms', url: 'https://github.com/react-native-maps/react-native-maps' },
    ],
  },
  {
    group: 'Data',
    items: [
      { name: 'City of Fremont public documents', use: 'Budget figures, service changes and the council roster. Cited on every figure. Citing a City document does not mean the City endorses this project.', license: 'Public records, used with attribution', url: 'https://www.fremont.gov/government/departments/finance/financial-reports' },
      { name: 'U.S. Census Bureau Gazetteer', use: 'The center point of each Fremont ZIP code area.', license: 'Public domain (U.S. Government work)', url: 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html' },
      { name: 'Organization websites', use: 'Names, addresses, phone numbers and hours of the listed resources, each linked to its source.', license: 'Facts, used with attribution', url: 'https://211alamedacounty.org/' },
    ],
  },
  {
    group: 'Software',
    items: [
      { name: 'Expo and React Native', use: 'The app framework.', license: 'MIT', url: 'https://expo.dev/' },
      { name: 'react-native-svg', use: 'Draws the icons and illustrations on phones and the web.', license: 'MIT', url: 'https://github.com/software-mansion/react-native-svg' },
      { name: 'FastAPI', use: 'The server framework.', license: 'MIT', url: 'https://fastapi.tiangolo.com/' },
      { name: 'Supabase client libraries', use: 'Database, storage and optional sign-in.', license: 'MIT', url: 'https://supabase.com/' },
      { name: 'Anthropic SDK and Claude', use: 'The assistant\'s AI model, used under Anthropic\'s terms.', license: 'MIT (SDK)', url: 'https://www.anthropic.com/' },
    ],
  },
];
