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
    const mutedText = document.createElement('span');
    mutedText.className = 'muted';
    mutedText.textContent = '管理者は操作不可';
    return mutedText;
  }

  const container = document.createElement('div');
  container.className = 'row-actions';

  if (user.status !== 'active') {
    const approveButton = document.createElement('button');
    approveButton.type = 'button';
    approveButton.dataset.action = 'approve';
    approveButton.dataset.id = user.id;
    approveButton.textContent = '承認';
    container.appendChild(approveButton);
  }

  if (user.status !== 'suspended') {
    const suspendButton = document.createElement('button');
    suspendButton.type = 'button';
    suspendButton.dataset.action = 'suspend';
    suspendButton.dataset.id = user.id;
    suspendButton.textContent = '停止';
    container.appendChild(suspendButton);
  }

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = user.id;
  deleteButton.textContent = '削除';
  container.appendChild(deleteButton);

  return container;
}

function renderUsers(users) {
  if (!users.length) {
    usersBody.replaceChildren();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'muted';
    td.textContent = 'ユーザーが存在しません。';
    tr.appendChild(td);
    usersBody.appendChild(tr);
    return;
  }

  const rows = users.map((user) => {
    const tr = document.createElement('tr');

    const usernameTd = document.createElement('td');
    usernameTd.textContent = user.username;
    tr.appendChild(usernameTd);

    const roleTd = document.createElement('td');
    roleTd.textContent = user.role;
    tr.appendChild(roleTd);

    const statusTd = document.createElement('td');
    statusTd.textContent = user.status;
    tr.appendChild(statusTd);

    const actionTd = document.createElement('td');
    actionTd.appendChild(actionButtons(user));
    tr.appendChild(actionTd);

    return tr;
  });

  usersBody.replaceChildren(...rows);
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

  let endpoint = `/api/admin/users/${userId}`;

  if (action === 'approve') {
    endpoint = `/api/admin/users/${userId}/approve`;
  } else if (action === 'suspend') {
    endpoint = `/api/admin/users/${userId}/suspend`;
  }

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
