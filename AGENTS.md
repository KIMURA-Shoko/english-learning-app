# 回答方針
日本語で簡潔かつ丁寧に回答すること。

# 固定ワークフロー: 誤答分析
ユーザーが次の形式で依頼した場合、以下を必ず実行する。

## トリガー
- `誤答分析: 最新`
- `誤答分析: <JSONファイル名>`

## 実行手順
1. `reports/wrong-history/` 配下のJSONを確認する。
2. トリガーが `最新` の場合は、`tools/analyze-latest-wrong-history.ps1` を実行する。
3. トリガーがファイル名指定の場合は、`tools/analyze-wrong-history.ps1 -WrongHistoryPath "reports/wrong-history/<JSONファイル名>"` を実行する。
4. `reports/` 配下から最新の `weakness-report-*.md` を特定して読み込む（ファイル名の厳密一致に依存しない）。
5. レポート内容を以下の観点で要約して返す。
- レベル別の誤答傾向
- 問題タイプ別の誤答傾向
- 優先復習すべき問題TOP
- 直近の誤答傾向
6. 必要に応じて、次の学習アクションを3つ以内で提案する。

## 注意
- JSONが存在しない場合は、エラー原因とアップロード手順を短く案内する。
- 既存ファイルを削除・上書きしない。
- JSONが複数ある場合、`最新` は更新日時が最も新しい1件を対象とする。

# 再発防止ルール
## 1. 変更前チェック（必須）
1. `git status --short` で未追跡/未コミットを確認する。
2. 既存の未追跡レポート（例: `reports/weakness-report-*.md`）をコミット対象から除外する方針を明示する。
3. 作業対象が `E:\project\english-learning-app` の場合、リポジトリを誤らない。

## 2. 編集ルール（必須）
1. 文字コード崩れを避けるため、PowerShell一括置換より小さな差分編集を優先する。
2. JS編集後は未定義参照がないか確認する（例: `ANSWER_HISTORY_KEY`, `reasonInputEl`）。
3. HTML/CSS/JSを変更したら、キャッシュ対策として `index.html` の `?v=` を更新する。

## 3. コマンド実行ルール（必須）
1. PowerShellでは `&&` を使わず、コマンドを分けて実行する。
2. 書き込み権限エラー時は、即座に昇格実行へ切り替える。
3. Git操作エラー時は次を順に確認する。
- `safe.directory` 設定
- `git pull --rebase origin main`
- 再度 `git push origin main`

## 4. 生成・検証ルール（必須）
1. 問題生成後は必ず品質チェックを実行する。
- `powershell -ExecutionPolicy Bypass -File tools/generate-balanced-problems.ps1`
- `powershell -ExecutionPolicy Bypass -File tools/quality-check.ps1 -InputPath data/problems/initial_problems.json`
2. 受け入れ条件は `Errors: 0` を必須とする。

## 5. コミット・pushルール（必須）
1. `git add` はファイルを明示指定し、意図しない未追跡ファイルを含めない。
2. `git commit` 後に `git status --short` を再確認する。
3. `git push` 後にブランチと最新コミットを報告する。
