const { init } = require('../db');

init().then(() => {
  console.log('Init complete');
  process.exit(0);
}).catch(err => {
  console.error('Init failed', err);
  process.exit(1);
});
