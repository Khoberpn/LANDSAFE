const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:121637@localhost:5432/landsafe_db' });
client.connect().then(() => client.query("SELECT email, password_hash, updated_at FROM users WHERE email = 'admin@landsafe.id'")).then(res => { console.log(res.rows); client.end() });
