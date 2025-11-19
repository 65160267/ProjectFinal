# Add Book Flow (ProjectFinal)

ไฟล์นี้สรุประบบการ "เพิ่มรายการหนังสือ" ในโปรเจ็กต์ — ไฟล์/บรรทัดสำคัญ, flow แบบทีละขั้นตอน, ตัวอย่างโค้ดรอบ ๆ จุดสำคัญ และคำสั่งรันสั้น ๆ

---

## ภาพรวมสั้น ๆ
- ฟอร์มหน้าเว็บ (`views/books/new.ejs`) ส่ง `multipart/form-data` ไปที่ `POST /books/create`
- Route (`routes/bookRoutes.js`) ใช้ `multer` เก็บไฟล์ไปยัง `public/uploads` แล้วเรียก `bookController.createBook`
- Controller (`controllers/bookController.js`) อ่าน `req.body` และ `req.file`, ตรวจสอบคอลัมน์จริงในตาราง `books` (ผ่าน `information_schema`) แล้วประกอบ `INSERT` แบบไดนามิกเพื่อบันทึกลงฐานข้อมูล
- ถ้าต้องแก้ไข จะใช้ `POST /books/:id/edit` ที่มี middleware upload เหมือนกัน

## คำสั่งรัน (PowerShell)
```powershell
cd 'c:\Users\weera\OneDrive - BUU\Desktop\Project_Final\New folder\ProjectFinal'
npm install
npm start
# ถ้าต้องการรันสคริปต์สร้าง schema ตัวอย่าง
node scripts/init-db.js
```

## ไฟล์หลักที่เกี่ยวข้อง
- `views/books/new.ejs` — ฟอร์มหน้าเพิ่มรายการ
- `routes/bookRoutes.js` — กำหนด route และ `multer` storage (เก็บไฟล์ใน `public/uploads`)
- `controllers/bookController.js` — ฟังก์ชัน `createBook` และ `updateBook`
- `db/schema_full.sql` — ตัวอย่าง schema (`books` table)

## หมายเลขบรรทัดสำคัญ (จากไฟล์ใน repo ปัจจุบัน)
- `views/books/new.ejs:39` — `<form action="/books/create" method="post" enctype="multipart/form-data">`
- `views/books/new.ejs:77` — `<input type="file" name="image" accept="image/*" />`
- `routes/bookRoutes.js:8` — `const uploadDir = path.join(__dirname, '..', 'public', 'uploads');`
- `routes/bookRoutes.js:13` — `const storage = multer.diskStorage({...})`
- `routes/bookRoutes.js:29` — `router.post('/create', upload.single('image'), bookController.createBook);`
- `routes/bookRoutes.js:31` — `router.post('/:id/edit', upload.single('image'), bookController.updateBook);`
- `controllers/bookController.js:122` — `exports.createBook = async (req, res) => {` (เริ่ม create)
- `controllers/bookController.js:133` — `const imageFile = req.file ? req.file.filename : null;` (ชื่อไฟล์หลัง upload)
- `controllers/bookController.js:136` — อ่านคอลัมน์จริงจาก `information_schema` (เพื่อประกอบ INSERT)
- `controllers/bookController.js:178-179` — ประกอบ `INSERT INTO books (...) VALUES (...)`
- `controllers/bookController.js:183` — `res.redirect('/dashboard');` (เมื่อบันทึกเสร็จ)
- `controllers/bookController.js:224` — `exports.updateBook = async (req, res) => {` (เริ่ม update)
- `controllers/bookController.js:245` — (ใน update) อ่านคอลัมน์จาก `information_schema`
- `controllers/bookController.js:280` — ตัวอย่าง `const storedPath = '/uploads/' + req.file.filename;` (ใน update)
- `db/schema_full.sql:32` — `CREATE TABLE books (...)` (ตัวอย่าง schema)

## ตัวอย่างโค้ด (3-5 บรรทัดรอบจุดสำคัญ)

- `views/books/new.ejs` (around line 39)
```html
<form class="book-form" action="/books/create" method="post" enctype="multipart/form-data">
  ...
  <input type="file" name="image" accept="image/*" />
</form>
```

- `routes/bookRoutes.js` (around lines 8-29)
```javascript
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
const storage = multer.diskStorage({ destination: (req,file,cb)=>cb(null, uploadDir), filename: (req,file,cb)=>{ cb(null, Date.now() + '-' + file.originalname) } });
const upload = multer({ storage });
router.post('/create', upload.single('image'), bookController.createBook);
```

- `controllers/bookController.js` (create flow around lines 122-183)
```javascript
exports.createBook = async (req, res) => {
  const imageFile = req.file ? req.file.filename : null;
  const [cols] = await db.pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS ... WHERE TABLE_NAME='books'");
  // build insertCols/insertValues dynamically then:
  const sql = `INSERT INTO books (${safeCols}) VALUES (${insertPlaceholders.join(',')})`;
  await db.pool.query(sql, insertValues);
  res.redirect('/dashboard');
}
```

## Flow (เรียงตามลำดับจริง)
1. ผู้ใช้เปิด `GET /books/new` → render `views/books/new.ejs` (form) (`routes/bookRoutes.js:27` → `bookController.showCreateForm`)
2. ผู้ใช้กรอกฟอร์มและอัปโหลดรูป → เบราเซอร์ POST ไป `POST /books/create` (`views/books/new.ejs:39`)
3. `routes/bookRoutes.js:29` รับคำขอ, `multer` เก็บไฟล์ลง `public/uploads` (`routes/bookRoutes.js:8/13`), แล้วเรียก `controllers/bookController.createBook` (`controllers/bookController.js:122`)
4. Controller อ่าน `req.body` และ `req.file` (`controllers/bookController.js:133`), ตรวจ `information_schema` เพื่อดูคอลัมน์ที่มี (`controllers/bookController.js:136`), ประกอบคำสั่ง INSERT แบบไดนามิก (`controllers/bookController.js:178-179`) และรัน `db.pool.query` เพื่อบันทึก
5. เมื่อสำเร็จ redirect ไป `/dashboard` (`controllers/bookController.js:183`)

## ข้อสังเกตและข้อแนะนำ
- โค้ดออกแบบให้ยืดหยุ่นกับ schema ที่ต่างกัน (ตรวจ `information_schema`) — ดีเมื่อ deploy บน DB ที่อาจต่างกัน
- ไม่มี validation เข้มงวด (เช่น ตรวจ mime-type หรือขนาดไฟล์) — แนะนำเพิ่ม server-side validation ใน `routes/bookRoutes.js` หรือใน `createBook` ก่อนบันทึก
- ถ้าต้องการลบไฟล์เก่าเมื่อแก้ไข (update) ปัจจุบันโค้ดไม่ได้ลบ — ควรเพิ่ม cleanup เมื่ออัปโหลดภาพใหม่
- ถ้าต้องการ thumbnail generation ให้ใช้ `sharp` เพื่อสร้างขนาดเล็กและบันทึกเป็น `thumbnail`

## ตัวเลือกต่อ (ผมช่วยได้)
- ผมสามารถเพิ่ม `BOOKS_README.md` นี้เข้า repo (ผมได้ทำแล้ว) — ตรวจไฟล์ที่รากโปรเจ็กต์
- ถ้าต้องการ ผมจะเพิ่ม snippets ที่มีหมายเลขบรรทัดจริงทุก snippet (ให้กดเปิดไฟล์ตรงตำแหน่งได้สะดวก) — บอกผมได้
- ผมสามารถแก้โค้ดเพื่อ: เพิ่ม validation (mime/size), ลบไฟล์เก่าเมื่อ update, หรือสร้าง thumbnail — เลือกการแก้ไขที่ต้องการ

---
ไฟล์นี้ช่วยให้สมาชิกทีมเข้าใจ flow การเพิ่มรายการหนังสือและตำแหน่งโค้ดที่ต้องแก้ไขได้เร็วขึ้น
