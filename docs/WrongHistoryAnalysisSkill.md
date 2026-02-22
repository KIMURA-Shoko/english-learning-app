# Skill: Wrong History Analysis

## 目的
手動アップロードした誤答履歴JSONを読み、弱点分析レポートを自動生成する。

## 前提
- 誤答履歴JSONを `reports/wrong-history/` に配置済み
- 最新の問題データ `data/problems/initial_problems.json` がある

## 実行コマンド
```powershell
powershell -ExecutionPolicy Bypass -File tools/analyze-latest-wrong-history.ps1
```

## 生成物
- `reports/weakness-report-<jsonファイル名>.md`

## 直接ファイル指定で分析したい場合
```powershell
powershell -ExecutionPolicy Bypass -File tools/analyze-wrong-history.ps1 -WrongHistoryPath "reports/wrong-history/<file>.json"
```

## レポートの読み方
- `By CEFR Level`: どのレベルで誤答が多いか
- `By Question Type`: どの問題タイプで弱いか
- `Top Mistakes`: 優先して復習すべき問題
- `Recent Wrong`: 最近つまずいた問題
