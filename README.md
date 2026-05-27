# Login-auth

Express + SQLite のログインAPIと、APIを利用するシンプルなフロントエンドです。

## 使い方

1. `npm install`
2. `npm start`
3. ブラウザで `http://localhost:3000` を開く

## 管理画面

- 管理者でログイン後、トップ画面の「管理画面を開く」リンクから遷移できます。
- 直接アクセスする場合は `http://localhost:3000/admin.html` を開いてください。
- 管理画面ではユーザー一覧の確認と、承認・停止・削除ができます。
- 管理者アカウントが存在しない場合は、起動時に初期管理者が自動作成されます（デフォルトID: `admin`）。
- `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` 環境変数で初期管理者のID・パスワードを変更できます。
- すでに同名ユーザーがいる場合は `admin-bootstrap-1` のような別IDで作成されます。
- `DEFAULT_ADMIN_PASSWORD` の設定は必須です（本番・開発共通）。
- `TRUST_PROXY` を設定すると `app.set('trust proxy', ...)` を上書きできます（例: `1`, `true`, `false`, `loopback`）。未設定時は常に `1` です。

## テスト

`npm test`