import {setupBehindTheSet} from './bts.mjs';

const sheets = Object.fromEntries([...document.querySelectorAll('.bts-sheet')].map(sheet => [sheet.dataset.for, sheet]));
setupBehindTheSet({
  drawer: document.querySelector('#bts-drawer'),
  stillDialog: document.querySelector('#still-dialog'),
  sheets,
  buttons: [...document.querySelectorAll('.film-bts')],
});
