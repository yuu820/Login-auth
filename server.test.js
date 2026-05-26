const os = require('os');
const path = require('path');
const assert = require('assert');
const test = require('node:test');
const bcrypt = require('bcrypt');

process.env.DB_PATH = path.join(os.tmpdir(), 'login-auth-test.db');
process.env.JWT_SECRET = 'test-secret';

const { app } = require('./server');
const { closeDb, getDb } = require('./database');

let server;
let baseUrl;

async function request(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(baseUrl + pathname, {
    ...options,
    headers,
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test.before(async () => {
  const db = await getDb();
  await db.exec('DELETE FROM users');

  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await closeDb();
});

test.beforeEach(async () => {
  const db = await getDb();
  await db.exec('DELETE FROM users');
});

test('registers a new user and blocks login while pending', async () => {
  let response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'alice', password: 'password123' }),
  });

  assert.equal(response.status, 201);
  assert.match(response.body.message, /新規登録/);

  response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'alice', password: 'password123' }),
  });

  assert.equal(response.status, 403);
  assert.match(response.body.message, /承認待ち/);
});

test('allows an admin to approve and suspend users', async () => {
  const db = await getDb();
  const passwordHash = await bcrypt.hash('adminpass', 10);

  await db.run(
    "INSERT INTO users (id, username, password, role, status) VALUES (?, ?, ?, 'admin', 'active')",
    'admin-id',
    'admin',
    passwordHash
  );

  let response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'alice', password: 'password123' }),
  });
  assert.equal(response.status, 201);

  response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'adminpass' }),
  });
  assert.equal(response.status, 200);

  const adminHeaders = { Authorization: 'Bearer ' + response.body.token };

  response = await request('/api/admin/users', { headers: adminHeaders });
  assert.equal(response.status, 200);

  const alice = response.body.find((user) => user.username === 'alice');
  assert.ok(alice);
  assert.ok(!('password' in alice));

  response = await request(`/api/admin/users/${alice.id}/approve`, {
    method: 'PATCH',
    headers: adminHeaders,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.status, 'active');

  response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'alice', password: 'password123' }),
  });
  assert.equal(response.status, 200);

  const userHeaders = { Authorization: 'Bearer ' + response.body.token };

  response = await request('/api/user/me', { headers: userHeaders });
  assert.equal(response.status, 200);
  assert.equal(response.body.username, 'alice');
  assert.ok(!('password' in response.body));

  response = await request(`/api/admin/users/${alice.id}/suspend`, {
    method: 'PATCH',
    headers: adminHeaders,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.status, 'suspended');

  response = await request('/api/user/me', { headers: userHeaders });
  assert.equal(response.status, 403);
  assert.match(response.body.message, /一時停止/);
});
