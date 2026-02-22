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
4. 生成された `reports/weakness-report-*.md`（または指定出力）を読み、以下を要約して返す。
   - レベル別の誤答傾向
   - 問題タイプ別の誤答傾向
   - 優先復習すべき問題TOP
   - 直近の誤答傾向
5. 必要に応じて、次の学習アクションを3つ以内で提案する。

## 注意
- JSONが存在しない場合は、エラー原因とアップロード手順を短く案内する。
- 既存ファイルを削除・上書きしない。
