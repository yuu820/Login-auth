const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
const PASSWORD_SALT_ROUNDS = 10;

app.use(express.json());

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

async function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'アクセストークンが必要です。' });
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    const user = await db.get(
      'SELECT id, username, role, status, created_at FROM users WHERE id = ?',
      payload.id
    );

    if (!user) {
      return res.status(401).json({ message: 'ユーザーが存在しません。' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ message: 'アカウントは現在承認待ちです。' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'アカウントが一時停止されています。' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(403).json({ message: 'トークンが無効です。' });
  }
}

function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '管理者権限が必要です。' });
  }

  return next();
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ message: 'username と password は必須です。' });
  }

  try {
    const db = await getDb();
    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', username);

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

      await db.run(
        'INSERT INTO users (id, username, password) VALUES (?, ?, ?)',
        randomUUID(),
        username,
        hashedPassword
      );

      return res.status(201).json({
        message: '新規登録を受け付けました。管理者の承認をお待ちください。',
      });
    }

    const passwordMatches = await bcrypt.compare(password, existingUser.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'ユーザー名またはパスワードが正しくありません。' });
    }

    if (existingUser.status === 'pending') {
      return res.status(403).json({ message: 'アカウントは現在承認待ちです。' });
    }

    if (existingUser.status === 'suspended') {
      return res.status(403).json({ message: 'アカウントが一時停止されています。' });
    }

    const token = jwt.sign(
      {
        id: existingUser.id,
        role: existingUser.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'ログインに成功しました。',
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: 'サーバーエラーが発生しました。' });
  }
});

app.get('/api/user/me', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get(
      'SELECT id, username, role, status, created_at FROM users WHERE id = ?',
      req.user.id
    );

    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません。' });
    }

    return res.status(200).json(sanitizeUser(user));
  } catch (error) {
    return res.status(500).json({ message: 'サーバーエラーが発生しました。' });
  }
});

const adminRouter = express.Router();

adminRouter.use(authenticateToken, isAdmin);

adminRouter.get('/users', async (_req, res) => {
  try {
    const db = await getDb();
    const users = await db.all(
      'SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC'
    );

    return res.status(200).json(users.map(sanitizeUser));
  } catch (error) {
    return res.status(500).json({ message: 'サーバーエラーが発生しました。' });
  }
});

adminRouter.patch('/users/:id/approve', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.run('UPDATE users SET status = ? WHERE id = ?', 'active', req.params.id);

    if (!result.changes) {
      return res.status(404).json({ message: 'ユーザーが見つかりません。' });
    }

    const user = await db.get(
      'SELECT id, username, role, status, created_at FROM users WHERE id = ?',
      req.params.id
    );

    return res.status(200).json({
      message: 'ユーザーを承認しました。',
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'サーバーエラーが発生しました。' });
  }
});

adminRouter.patch('/users/:id/suspend', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.run(
      'UPDATE users SET status = ? WHERE id = ?',
      'suspended',
      req.params.id
    );

    if (!result.changes) {
      return res.status(404).json({ message: 'ユーザーが見つかりません。' });
    }

    const user = await db.get(
      'SELECT id, username, role, status, created_at FROM users WHERE id = ?',
      req.params.id
    );

    return res.status(200).json({
      message: 'ユーザーを停止しました。',
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'サーバーエラーが発生しました。' });
  }
});

adminRouter.delete('/users/:id', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM users WHERE id = ?', req.params.id);

    if (!result.changes) {
      return res.status(404).json({ message: 'ユーザーが見つかりません。' });
    }

    return res.status(200).json({ message: 'ユーザーを削除しました。' });
  } catch (error) {
    return res.status(500).json({ message: 'サーバーエラーが発生しました。' });
  }
});

app.use('/api/admin', adminRouter);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = {
  app,
  authenticateToken,
  isAdmin,
};
