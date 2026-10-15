const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Let Metro resolve files from the sibling /shared folder.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];

// The web build loads Inter as WOFF2 (assets/fonts); treat those files as assets.
if (!config.resolver.assetExts.includes('woff2')) config.resolver.assetExts.push('woff2');

module.exports = config;
