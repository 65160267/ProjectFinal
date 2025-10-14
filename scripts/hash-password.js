const bcrypt = require('bcrypt');
const [,, pwd] = process.argv;
if (!pwd) {
  console.error('Usage: node scripts/hash-password.js <password>');
  process.exit(1);
}
console.log(bcrypt.hashSync(pwd, 10));
