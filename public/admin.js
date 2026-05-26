const tokenStorageKey = 'login-auth-token';

const messageEl = document.getElementById('message');
const usersBody = document.getElementById('users-body');
const refreshButton = document.getElementById('refresh-button');
const logoutButton = document.getElementById('logout-button');

function setMessage(message) {
  messageEl.textContent = message;
}

function getToken() {
  return localStorage.getItem(tokenStorageKey);
}

function clearToken() {
  localStorage.removeItem(tokenStorageKey);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function ensureAdmin() {
  const token = getToken();

  if (!token) {
    setMessage('ログインしてください。');
    return false;
  }

  const { response, body } = await fetchJson('/api/user/me', {
    headers: {
      Authorization: 'Bearer ' + token,
    },
  });

  if (!response.ok) {
    clearToken();
    setMessage(body?.message || '認証に失敗しました。');
    return false;
  }

  if (body.role !== 'admin') {
    setMessage('管理者権限が必要です。');
    return false;
  }

  return true;
}

function actionButtons(user) {
  if (user.role === 'admin') {
    return '<span class="muted">管理者は操作不可</span>';
  }

  const buttons = [];

  if (user.status !== 'active') {
    buttons.push(`<button data-action="approve" data-id="${user.id}" type="button">承認</button>`);
  }

  if (user.status !== 'suspended') {
    buttons.push(`<button data-action="suspend" data-id="${user.id}" type="button">停止</button>`);
  }

  buttons.push(`<button data-action="delete" data-id="${user.id}" type="button">削除</button>`);
  return `<div class="row-actions">${buttons.join('')}</div>`;
}

function renderUsers(users) {
  if (!users.length) {
    usersBody.innerHTML = '<tr><td colspan="4" class="muted">ユーザーが存在しません。</td></tr>';
    return;
  }

  usersBody.innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${user.username}</td>
          <td>${user.role}</td>
          <td>${user.status}</td>
          <td>${actionButtons(user)}</td>
        </tr>
      `
    )
    .join('');
}

async function loadUsers() {
  const token = getToken();

  const { response, body } = await fetchJson('/api/admin/users', {
    headers: {
      Authorization: 'Bearer ' + token,
    },
  });

  if (!response.ok) {
    setMessage(body?.message || 'ユーザー一覧の取得に失敗しました。');
    usersBody.innerHTML = '';
    return;
  }

  renderUsers(body);
  setMessage('ユーザー一覧を更新しました。');
}

async function handleAction(action, userId) {
  const token = getToken();

  if (!token) {
    setMessage('セッションがありません。');
    return;
  }

  const endpoint =
    action === 'approve'
      ? `/api/admin/users/${userId}/approve`
      : action === 'suspend'
        ? `/api/admin/users/${userId}/suspend`
        : `/api/admin/users/${userId}`;

  const method = action === 'delete' ? 'DELETE' : 'PATCH';

  const { response, body } = await fetchJson(endpoint, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
    },
  });

  setMessage(body?.message || '操作を実行しました。');

  if (response.ok) {
    await loadUsers();
  }
}

usersBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action][data-id]');

  if (!button) {
    return;
  }

  try {
    await handleAction(button.dataset.action, button.dataset.id);
  } catch (error) {
    console.error(error);
    setMessage('通信エラーが発生しました。');
  }
});

refreshButton.addEventListener('click', () => {
  loadUsers().catch((error) => {
    console.error(error);
    setMessage('ユーザー一覧の取得に失敗しました。');
  });
});

logoutButton.addEventListener('click', () => {
  clearToken();
  setMessage('ログアウトしました。');
});

(async () => {
  try {
    const admin = await ensureAdmin();

    if (!admin) {
      usersBody.innerHTML = '';
      return;
    }

    await loadUsers();
  } catch (error) {
    console.error(error);
    setMessage('初期化に失敗しました。');
  }
})();
