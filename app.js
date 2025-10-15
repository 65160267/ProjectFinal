const express = require('express');
const app = express();
app.use(express.static('public'));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
// Bootstrap: delegate to server.js which configures middleware, routes and starts the HTTP server.
try {
  require('./server');
} catch (err) {
  console.error('Failed to start server from app.js:', err);
  throw err;
}

const indexController = require('./controllers/indexController.js');
try {
    await connection.connect();
    console.log('✅ MySQL connected successfully!');
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
  } finally {
    await connection.end();
  }


// เรียกใช้งานฟังก์ชัน
checkMySQLConnection();

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});