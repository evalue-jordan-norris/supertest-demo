const request = require('supertest');
const app = require('./app');
const { connectDb, getDb, resetDb, closeDb } = require('./db');

let authToken;

async function loginAsAdmin() {
  const response = await request(app)
    .post('/login')
    .send({
      username: 'admin',
      password: 'password',
    });

  return response.body.token;
}

async function createUser(overrides = {}) {
  const user = {
    username: 'tester',
    email: 'tester@example.com',
    password: 'password123',
    role: 'user',
    ...overrides,
  };

  const response = await request(app)
    .post('/users')
    .set('Authorization', `Bearer ${authToken}`)
    .send(user);

  return response;
}

beforeEach(async () => {
  await connectDb();
  await resetDb();
  authToken = await loginAsAdmin();
});

afterEach(async () => {
  await closeDb();
});

describe('Health Check API', () => {
  it('GET /health should return service health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'supertest-demo',
    });
  });

  it('GET /health should return JSON content type', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['content-type']).toContain('application/json');
  });
});

describe('Authentication API', () => {
  it('POST /login should return a token for valid credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        username: 'admin',
        password: 'password',
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe('test-token-123');
  });

  it('POST /login should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        username: 'admin',
        password: 'wrong-password',
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid username or password');
  });

  it('POST /login should return 401 when request body is empty', async () => {
    const response = await request(app)
      .post('/login')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid username or password');
  });
});

describe('User Creation API', () => {
  it('POST /users should create a user with valid data', async () => {
    const response = await createUser();

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(1);
    expect(response.body.username).toBe('tester');
    expect(response.body.email).toBe('tester@example.com');
    expect(response.body.role).toBe('user');
  });

  it('POST /users should save the user in the database', async () => {
    await createUser();

    const db = getDb();
    const users = await db.all('SELECT * FROM users');

    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('tester');
    expect(users[0].email).toBe('tester@example.com');
  });

  it('POST /users should create an admin user when role is admin', async () => {
    const response = await createUser({
      username: 'admin-user',
      email: 'admin-user@example.com',
      role: 'admin',
    });

    expect(response.status).toBe(201);
    expect(response.body.role).toBe('admin');
  });

  it('POST /users should return 400 when username is missing', async () => {
    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'missing-username@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Username, email and password are required');
  });

  it('POST /users should return 400 when email is missing', async () => {
    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: 'missing-email',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Username, email and password are required');
  });

  it('POST /users should return 400 when password is missing', async () => {
    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: 'missing-password',
        email: 'missing-password@example.com',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Username, email and password are required');
  });

  it('POST /users should return 400 for invalid email format', async () => {
    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: 'bad-email',
        email: 'not-an-email',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Email must be valid');
  });

  it('POST /users should return 409 when email already exists', async () => {
    await createUser();

    const response = await createUser();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('User already exists');
  });
});

describe('User Retrieval API', () => {
  it('GET /users should return an empty list when no users exist', async () => {
    const response = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.users).toEqual([]);
  });

  it('GET /users should return all users', async () => {
    await createUser({
      username: 'tester',
      email: 'tester@example.com',
    });

    await createUser({
      username: 'alex',
      email: 'alex@example.com',
    });

    const response = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.users[0].username).toBe('tester');
    expect(response.body.users[1].username).toBe('alex');
  });

  it('GET /users?role=admin should filter users by role', async () => {
    await createUser({
      username: 'normal-user',
      email: 'normal@example.com',
      role: 'user',
    });

    await createUser({
      username: 'admin-user',
      email: 'admin@example.com',
      role: 'admin',
    });

    const response = await request(app)
      .get('/users?role=admin')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.users[0].role).toBe('admin');
    expect(response.body.users[0].username).toBe('admin-user');
  });

  it('GET /users/:id should return a single user', async () => {
    const createResponse = await createUser();

    const response = await request(app)
      .get(`/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(createResponse.body.id);
    expect(response.body.username).toBe('tester');
    expect(response.body.email).toBe('tester@example.com');
  });

  it('GET /users/:id should return 404 when user does not exist', async () => {
    const response = await request(app)
      .get('/users/999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
  });
});

describe('User Update API', () => {
  it('PATCH /users/:id should update username', async () => {
    const createResponse = await createUser();

    const response = await request(app)
      .patch(`/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: 'updated-tester',
      });

    expect(response.status).toBe(200);
    expect(response.body.username).toBe('updated-tester');
    expect(response.body.email).toBe('tester@example.com');
  });

  it('PATCH /users/:id should update role', async () => {
    const createResponse = await createUser();

    const response = await request(app)
      .patch(`/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        role: 'admin',
      });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('admin');
  });

  it('PATCH /users/:id should persist updated data in the database', async () => {
    const createResponse = await createUser();

    await request(app)
      .patch(`/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: 'database-updated-user',
      });

    const db = getDb();
    const user = await db.get(
      'SELECT username FROM users WHERE id = ?',
      [createResponse.body.id]
    );

    expect(user.username).toBe('database-updated-user');
  });

  it('PATCH /users/:id should return 404 when updating non-existent user', async () => {
    const response = await request(app)
      .patch('/users/999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: 'nobody',
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
  });
});

describe('User Deletion API', () => {
  it('DELETE /users/:id should delete a user', async () => {
    const createResponse = await createUser();

    const response = await request(app)
      .delete(`/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it('DELETE /users/:id should remove user from database', async () => {
    const createResponse = await createUser();

    await request(app)
      .delete(`/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    const db = getDb();
    const user = await db.get(
      'SELECT * FROM users WHERE id = ?',
      [createResponse.body.id]
    );

    expect(user).toBeUndefined();
  });

  it('DELETE /users/:id should return 404 when user does not exist', async () => {
    const response = await request(app)
      .delete('/users/999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
  });
});

describe('Authorization Scenarios', () => {
  it('POST /users should return 401 when authorization header is missing', async () => {
    const response = await request(app)
      .post('/users')
      .send({
        username: 'tester',
        email: 'tester@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization header required');
  });

  it('GET /users should return 401 when authorization header is missing', async () => {
    const response = await request(app).get('/users');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization header required');
  });

  it('GET /users should return 403 when token is invalid', async () => {
    const response = await request(app)
      .get('/users')
      .set('Authorization', 'Bearer wrong-token');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Invalid token');
  });
});

describe('Response Shape and Security Checks', () => {
  it('GET /users should not expose user passwords', async () => {
    await createUser();

    const response = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.users[0].password).toBeUndefined();
  });

  it('GET /users/:id should not expose user password', async () => {
    const createResponse = await createUser();

    const response = await request(app)
      .get(`/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.password).toBeUndefined();
  });

  it('POST /users should return expected response keys only', async () => {
    const response = await createUser();

    expect(Object.keys(response.body).sort()).toEqual([
      'email',
      'id',
      'role',
      'username',
    ]);
  });
});