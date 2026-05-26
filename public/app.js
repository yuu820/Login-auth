const loginForm = document.getElementById('login-form');
const messageEl = document.getElementById('message');
const profileSection = document.getElementById('profile-section');
const profileId = document.getElementById('profile-id');
const profileUsername = document.getElementById('profile-username');
const profileRole = document.getElementById('profile-role');
const profileStatus = document.getElementById('profile-status');
const logoutButton = document.getElementById('logout-button');
const tokenStorageKey = 'login-auth-token';

function setMessage(message) {
  messageEl.textContent = message;
}

function setProfile(user) {
  if (!user) {
    profileSection.classList.add('hidden');
    profileId.textContent = '';
    profileUsername.textContent = '';
    profileRole.textContent = '';
    profileStatus.textContent = '';
    return;
  }

  profileSection.classList.remove('hidden');
  profileId.textContent = user.id;
  profileUsername.textContent = user.username;
  profileRole.textContent = user.role;
  profileStatus.textContent = user.status;
}

function getToken() {
  return localStorage.getItem(tokenStorageKey);
}

function saveToken(token) {
  localStorage.setItem(tokenStorageKey, token);
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

async function fetchMyProfile() {
  const token = getToken();

  if (!token) {
    setProfile(null);
    return;
  }

  const { response, body } = await fetchJson('/api/user/me', {
    headers: {
      Authorization: ['Bearer', token].join(' '),
    },
  });

  if (!response.ok) {
    clearToken();
    setProfile(null);
    setMessage(body?.message || 'セッションが無効です。');
    return;
  }

  setProfile(body);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const username = formData.get('username');
  const password = formData.get('password');

  setMessage('送信中...');

  try {
    const { response, body } = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    setMessage(body?.message || '不明なレスポンスを受信しました。');

    if (response.ok && body?.token) {
      saveToken(body.token);
      await fetchMyProfile();
      return;
    }

    clearToken();
    setProfile(null);
  } catch (_error) {
    setMessage('通信エラーが発生しました。');
    clearToken();
    setProfile(null);
  }
});

logoutButton.addEventListener('click', () => {
  clearToken();
  setProfile(null);
  setMessage('ログアウトしました。');
});

fetchMyProfile().catch(() => {
  setMessage('ユーザー情報の取得に失敗しました。');
  clearToken();
  setProfile(null);
});
