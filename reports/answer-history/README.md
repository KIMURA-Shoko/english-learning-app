# Answer History Upload Folder

このフォルダは、アプリからエクスポートした `answer-history-*.json` を
手動でアップロードするための置き場所です。

## 運用手順
1. アプリで `回答履歴 エクスポート` を押してJSONを取得
2. GitHubのこのフォルダへJSONをアップロード
3. ローカルで `git pull` して反映
4. `tools/analyze-latest-answer-history.ps1` で分析

## ファイル名ルール
- `answer-history-YYYY-MM-DDTHH-mm-ss.json`
