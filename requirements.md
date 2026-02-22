# CEFR A1/A2→B1 英語学習アプリ 要件定義（統合更新版）

- 改訂日: 2026-02-22
- 対象ディレクトリ: `E:\project\english-learning-app`
- 配信形態: GitHub Pages（静的配信）
- 基本方針: 外部APIキーを使わず、事前生成済み問題を配信する

## 1. 目的
A1/A2学習者がB1到達を目指して、4択中心の反復学習を行えるWebアプリを提供する。

## 2. 問題仕様
### 2.1 対象レベル
- A1
- A2
- B1

### 2.2 問題タイプ
- `fill_blank`（穴埋め）
- `response_choice`（応答選択）
- `short_reading`（短文読解）
- `sentence_build`（短文英作: 日本語に最も近い英文選択）

### 2.3 現在の問題数（実装済み）
- A1: 80問
- A2: 80問
- B1: 80問
- 合計: 240問
- 各レベルで4タイプを均等配分（各20問）

### 2.4 データ生成
- 生成スクリプト: `tools/generate-balanced-problems.ps1`
- 品質チェック: `tools/quality-check.ps1`
- 問題スキーマ: `schema/problem.schema.json`

## 3. 学習機能要件
### 3.1 出題
- レベル選択で通常出題できること
- 出題モードを選べること
  - 通常
  - 誤答のみ（全レベル横断）

### 3.2 回答後表示
- 正誤表示
- 日本語解説表示
- 英語選択肢の場合、全選択肢の日本語訳表示

### 3.3 選択肢表示
- 選択肢順を問題ごとにシャッフル
- 正解表示（A/B/C/D）はシャッフル後の位置に一致

### 3.4 誤答復習
- 不正解時に誤答ストックへ自動追加
- 問題単位の誤答ログ保存
  - `wrong_count`
  - `last_wrong_at`
  - `wrong_history`
  - `recovery_correct_streak`
- 誤答ストック中の問題は3回連続正解で自動解除
- 手動削除UIは設けない（削除ボタン非搭載）

## 4. 翻訳表示要件
- 回答後の選択肢和訳は2段階で生成
  - 完全一致辞書（定型文の自然訳）
  - 単語辞書フォールバック（参考訳）
- 日本語を含む選択肢は訳表示対象外

## 5. 品質要件
### 5.1 構造品質
- 必須項目欠落、ID不整合、answer範囲外、選択肢不正をエラー
- 問題文完全重複をエラー
- 類似度しきい値超過を警告

### 5.2 言語品質
- `fill_blank` は正答埋め込み後の正解文が自然であること
- 明らかな不自然文（連続同語、目的語欠落パターン等）をエラー検出
- 正答と解説の整合が取れていること

## 6. 誤答履歴運用（GitHub手動アップロード方式）
### 6.1 エクスポート
- UIボタン: `誤答履歴 エクスポート`
- 出力: `wrong-history-<timestamp>.json`

### 6.2 アップロード先
- `reports/wrong-history/`
- 補助ファイル:
  - `reports/wrong-history/README.md`
  - `reports/wrong-history/.gitkeep`

### 6.3 分析スクリプト
- 単体分析: `tools/analyze-wrong-history.ps1`
- 最新自動選択: `tools/analyze-latest-wrong-history.ps1`
- 出力レポート: `reports/weakness-report-<json名>.md`

## 7. Codex実行ワークフロー（Skill風運用）
- 定義ファイル: `AGENTS.md`
- トリガー:
  - `誤答分析: 最新`
  - `誤答分析: <JSONファイル名>`
- Codexは以下を実行すること
  - 該当JSONを選択
  - 分析スクリプト実行
  - レベル別/タイプ別傾向、優先復習問題、直近傾向を要約

## 8. 受け入れ基準
- 問題数が 240（A1/A2/B1 各80）
- 各レベルで4タイプが各20
- 品質チェック結果が `Errors: 0`
- 通常出題・誤答のみ出題が動作
- 英語選択肢の和訳表示が動作
- 誤答ログ表示・3回連続正解解除が動作
- 誤答履歴JSONエクスポートが動作
- 弱点分析スクリプトでレポート生成できる

## 9. 運用手順（要約）
1. `tools/generate-balanced-problems.ps1` で問題再生成
2. `tools/quality-check.ps1` で検証
3. ローカル確認（`python -m http.server 8000`）
4. 誤答履歴をエクスポート
5. GitHubへ `reports/wrong-history/*.json` を手動アップロード
6. `誤答分析: 最新` でCodex分析
7. Gitコミット・push・Pages確認
