const express = require('express');
const { getDb } = require('./db');

const app = express();

app.use(express.json());

const validToken = 'test-token-123';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  if (authHeader !== `Bearer ${validToken}`) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  next();
}

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'supertest-demo',
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'password') {
    return res.status(200).json({
      token: validToken,
    });
  }

  return res.status(401).json({
    error: 'Invalid username or password',
  });
});

app.post('/users', requireAuth, async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      error: 'Username, email and password are required',
    });
  }

  if (!email.includes('@')) {
    return res.status(400).json({
      error: 'Email must be valid',
    });
  }

  const db = getDb();

  const existingUser = await db.get(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (existingUser) {
    return res.status(409).json({
      error: 'User already exists',
    });
  }

  const result = await db.run(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    [username, email, password, role || 'user']
  );

  return res.status(201).json({
    id: result.lastID,
    username,
    email,
    role: role || 'user',
  });
});

app.get('/users', requireAuth, async (req, res) => {
  const db = getDb();

  const { role } = req.query;

  let users;

  if (role) {
    users = await db.all(
      'SELECT id, username, email, role FROM users WHERE role = ?',
      [role]
    );
  } else {
    users = await db.all(
      'SELECT id, username, email, role FROM users'
    );
  }

  return res.status(200).json({
    count: users.length,
    users,
  });
});

app.get('/users/:id', requireAuth, async (req, res) => {
  const db = getDb();

  const user = await db.get(
    'SELECT id, username, email, role FROM users WHERE id = ?',
    [req.params.id]
  );

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
    });
  }

  return res.status(200).json(user);
});

app.patch('/users/:id', requireAuth, async (req, res) => {
  const { username, role } = req.body;
  const db = getDb();

  const existingUser = await db.get(
    'SELECT id, username, email, role FROM users WHERE id = ?',
    [req.params.id]
  );

  if (!existingUser) {
    return res.status(404).json({
      error: 'User not found',
    });
  }

  const updatedUsername = username || existingUser.username;
  const updatedRole = role || existingUser.role;

  await db.run(
    'UPDATE users SET username = ?, role = ? WHERE id = ?',
    [updatedUsername, updatedRole, req.params.id]
  );

  const updatedUser = await db.get(
    'SELECT id, username, email, role FROM users WHERE id = ?',
    [req.params.id]
  );

  return res.status(200).json(updatedUser);
});

app.delete('/users/:id', requireAuth, async (req, res) => {
  const db = getDb();

  const existingUser = await db.get(
    'SELECT id FROM users WHERE id = ?',
    [req.params.id]
  );

  if (!existingUser) {
    return res.status(404).json({
      error: 'User not found',
    });
  }

  await db.run(
    'DELETE FROM users WHERE id = ?',
    [req.params.id]
  );

  return res.status(204).send();
});

module.exports = app;