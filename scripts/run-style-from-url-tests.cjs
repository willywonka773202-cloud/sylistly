/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const createJiti = require('jiti');

const root = path.resolve(__dirname, '..');
const jiti = createJiti(__filename, { alias: { '@/': `${root}/` }, cache: false });
jiti(path.join(__dirname, 'check-style-from-url.ts'));
