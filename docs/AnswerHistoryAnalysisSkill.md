# Skill: Answer History Analysis

## 目的
手動アップロードした回答履歴JSONを読み、回答分析レポートを自動生成する。

## 前提
- 回答履歴JSONを `reports/answer-history/` に配置済み
- 最新の問題データ `data/problems/initial_problems.json` がある

## 実行コマンド
```powershell
powershell -ExecutionPolicy Bypass -File tools/analyze-latest-answer-history.ps1
```

## 生成物
- `reports/answer-analysis-report-<jsonファイル名>.md`

## 直接ファイル指定で分析したい場合
```powershell
powershell -ExecutionPolicy Bypass -File tools/analyze-answer-history.ps1 -AnswerHistoryPath "reports/answer-history/<file>.json"
```

## レポートの読み方
- `By CEFR Level`: どのレベルで正答率が低いか
- `By Question Type`: どの問題タイプで弱いか
- `Focus Problems`: 優先して復習すべき問題
- `Recent Answers`: 直近の回答傾向
