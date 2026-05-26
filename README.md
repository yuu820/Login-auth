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

## テスト

`npm test`