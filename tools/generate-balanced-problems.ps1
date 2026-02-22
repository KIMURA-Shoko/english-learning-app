param(
  [string]$OutPath = "E:\project\english-learning-app\data\problems\initial_problems.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$items = New-Object System.Collections.Generic.List[object]
$createdBase = [datetime]::Parse("2026-02-22T00:00:00Z")
$globalIndex = 0

function Get-SkillLetter([string]$skillType) {
  switch ($skillType) {
    "grammar" { return "G" }
    "reading" { return "R" }
    "vocabulary" { return "V" }
    default { return "G" }
  }
}

function Add-Problem {
  param(
    [string]$Level,
    [int]$Seq,
    [string]$SkillType,
    [string]$QuestionType,
    [string]$QuestionText,
    [string[]]$Choices,
    [int]$Answer,
    [string]$Explanation,
    [string]$KeyPhrase
  )

  $script:globalIndex++
  $id = "{0}_{1}_{2}" -f $Level, (Get-SkillLetter $SkillType), $Seq.ToString("0000")
  $created = $createdBase.AddMinutes($script:globalIndex).ToString("yyyy-MM-ddTHH:mm:ssZ")

  $script:items.Add([pscustomobject]@{
    problem_id = $id
    cefr_level = $Level
    skill_type = $SkillType
    question_type = $QuestionType
    question_text = $QuestionText
    choices = $Choices
    answer = $Answer
    explanation_ja = $Explanation
    key_phrase = $KeyPhrase
    status = "draft"
    created_at = $created
    source = "codex_pre_generated"
  }) | Out-Null
}

function Generate-FillBlank {
  param([string]$Level, [int]$SeqStart)

  for ($i = 1; $i -le 20; $i++) {
    $seq = $SeqStart + $i - 1
    if ($Level -eq "A1") {
      $subjects = @("I","You","He","She","We","They")
      $sub = $subjects[($i - 1) % $subjects.Count]
      if ($i % 2 -eq 1) {
        $q = "$sub ___ happy today. (" + $Level + "-FB-" + $i.ToString("00") + ")"
        $ans = if ($sub -in @("I")) {0} elseif ($sub -in @("He","She")) {1} else {2}
        Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("am","is","are","be") -Answer $ans -Explanation "主語に合うbe動詞を選びます。" -KeyPhrase "穴埋め:be動詞"
      } else {
        $verbs = @("play","study","watch","cook","read")
        $v = $verbs[($i - 1) % $verbs.Count]
        $q = "$sub ___ $v every day. (" + $Level + "-FB-" + $i.ToString("00") + ")"
        $ans = if ($sub -in @("He","She")) {1} else {0}
        Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @($v, "$($v)s", "$($v)ed", "$($v)ing") -Answer $ans -Explanation "現在形の主語と動詞の形を確認します。" -KeyPhrase "穴埋め:現在形"
      }
    }

    if ($Level -eq "A2") {
      $subjects = @("I","You","He","She","We","They")
      $sub = $subjects[($i - 1) % $subjects.Count]
      switch (($i - 1) % 4) {
        0 {
          $q = "$sub ___ to the library yesterday. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          $base = "go"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @($base, "goes", "went", "going") -Answer 2 -Explanation "yesterday があるので過去形を使います。" -KeyPhrase "穴埋め:過去形"
        }
        1 {
          $q = "$sub has lived here ___ 2020. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("for", "since", "from", "during") -Answer 1 -Explanation "起点を表すので since を使います。" -KeyPhrase "穴埋め:since"
        }
        2 {
          $q = "This book is ___ than that one. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("interesting", "more interesting", "most interesting", "interest") -Answer 1 -Explanation "than がある比較級文です。" -KeyPhrase "穴埋め:比較級"
        }
        3 {
          $q = "If it rains, we ___ at home. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("stay", "stayed", "will stay", "staying") -Answer 2 -Explanation "条件文の主節で will を使います。" -KeyPhrase "穴埋め:if文"
        }
      }
    }

    if ($Level -eq "B1") {
      switch (($i - 1) % 4) {
        0 {
          $q = "By the time we arrived, the movie ___ already started. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("has", "had", "was", "is") -Answer 1 -Explanation "過去のある時点より前の出来事なので過去完了です。" -KeyPhrase "穴埋め:過去完了"
        }
        1 {
          $q = "The proposal ___ by the team leader before noon. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("completed", "was completed", "has completing", "is complete") -Answer 1 -Explanation "提案が完了される側なので受動態です。" -KeyPhrase "穴埋め:受動態"
        }
        2 {
          $q = "She is looking for a job ___ allows remote work. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("who", "where", "that", "what") -Answer 2 -Explanation "先行詞 job を修飾する関係代名詞です。" -KeyPhrase "穴埋め:関係代名詞"
        }
        3 {
          $q = "If I ___ more experience, I would apply for that role. (" + $Level + "-FB-" + $i.ToString("00") + ")"
          Add-Problem -Level $Level -Seq $seq -SkillType "grammar" -QuestionType "fill_blank" -QuestionText $q -Choices @("have", "had", "will have", "am having") -Answer 1 -Explanation "仮定法過去では if 節に過去形を使います。" -KeyPhrase "穴埋め:仮定法"
        }
      }
    }
  }
}

function Generate-ResponseChoice {
  param([string]$Level, [int]$SeqStart)

  $a1Prompts = @(
    @("A: How are you?`nB: ___", @("I am fine, thank you.", "At the station.", "Because it is big.", "Two apples."), 0),
    @("A: What is your name?`nB: ___", @("My name is Ken.", "I am ten years old.", "I like music.", "It is sunny."), 0),
    @("A: Do you like cats?`nB: ___", @("Yes, I do.", "At five o'clock.", "In my bag.", "Three books."), 0),
    @("A: Where do you live?`nB: ___", @("I live in Osaka.", "I am happy.", "I have a pen.", "It is Monday."), 0)
  )

  $a2Prompts = @(
    @("A: Are you free this afternoon?`nB: ___", @("Yes, I can meet at three.", "I met him yesterday.", "It is the biggest one.", "Because I was tired."), 0),
    @("A: Why were you late?`nB: ___", @("Because the bus was delayed.", "At the library.", "I will be a teacher.", "No, I don't."), 0),
    @("A: Could you help me with this report?`nB: ___", @("Sure, I'll help after lunch.", "I helped yesterday only.", "This report is blue.", "At room 204."), 0),
    @("A: How long have you studied English?`nB: ___", @("For about three years.", "In the classroom.", "My teacher is kind.", "Yes, I studied."), 0)
  )

  $b1Prompts = @(
    @("A: Do you think we should postpone the meeting?`nB: ___", @("Yes, unless everyone can join on time.", "I postponed it last year.", "At the office door.", "The meeting is a table."), 0),
    @("A: How did your presentation go?`nB: ___", @("It went well after I adjusted the slides.", "I present every Tuesday.", "The projector is expensive.", "At nine o'clock exactly."), 0),
    @("A: Why did you choose that course?`nB: ___", @("It matched the skills I needed for work.", "The course chose me.", "I have chosen tomorrow.", "At the third floor."), 0),
    @("A: Can you finish the draft by Friday?`nB: ___", @("I can, provided I get the final data today.", "I finished drafts before.", "Friday is my favorite.", "In the same folder."), 0)
  )

  for ($i = 1; $i -le 20; $i++) {
    $seq = $SeqStart + $i - 1
    if ($Level -eq "A1") {
      $p = $a1Prompts[($i - 1) % $a1Prompts.Count]
      Add-Problem -Level $Level -Seq $seq -SkillType "reading" -QuestionType "response_choice" -QuestionText ($p[0] + " (A1-RC-" + $i.ToString("00") + ")") -Choices $p[1] -Answer $p[2] -Explanation "質問の意図に合う自然な応答を選びます。" -KeyPhrase "応答選択:A1"
    }
    if ($Level -eq "A2") {
      $p = $a2Prompts[($i - 1) % $a2Prompts.Count]
      Add-Problem -Level $Level -Seq $seq -SkillType "reading" -QuestionType "response_choice" -QuestionText ($p[0] + " (A2-RC-" + $i.ToString("00") + ")") -Choices $p[1] -Answer $p[2] -Explanation "文脈に合う応答を選びます。" -KeyPhrase "応答選択:A2"
    }
    if ($Level -eq "B1") {
      $p = $b1Prompts[($i - 1) % $b1Prompts.Count]
      Add-Problem -Level $Level -Seq $seq -SkillType "reading" -QuestionType "response_choice" -QuestionText ($p[0] + " (B1-RC-" + $i.ToString("00") + ")") -Choices $p[1] -Answer $p[2] -Explanation "条件や理由を含む自然な返答を判断します。" -KeyPhrase "応答選択:B1"
    }
  }
}

function Generate-ShortReading {
  param([string]$Level, [int]$SeqStart)

  $b1ReadingSet = @(
    @("Read: The design team compared user feedback from two prototypes and chose the one with fewer support requests. Which prototype did they choose?", @("The one with fewer support requests.", "The one with lower price.", "The one launched first.", "The one with more screens.")),
    @("Read: Aya revised the proposal after the client asked for a shorter timeline and clearer milestones. Why did Aya revise it?", @("Because the client requested changes.", "Because the printer broke.", "Because the budget doubled.", "Because the meeting was canceled.")),
    @("Read: During the trial week, the support team answered chats first and emails later, which reduced waiting time. What reduced waiting time?", @("Prioritizing chats before emails.", "Hiring ten new agents.", "Closing the help center.", "Sending fewer replies.")),
    @("Read: Ken shared weekly progress notes so new members could understand decisions quickly. What was the purpose of the notes?", @("To help new members understand decisions.", "To replace all meetings.", "To reduce product features.", "To avoid customer interviews.")),
    @("Read: The sales group postponed the campaign until they confirmed inventory levels. Why did they postpone it?", @("They needed to confirm inventory.", "They changed office locations.", "They lost internet access.", "They hired fewer staff.")),
    @("Read: Mei tested three headlines and selected the one that produced the highest click-through rate. Which headline was selected?", @("The headline with the highest click-through rate.", "The longest headline.", "The first headline written.", "The least formal headline.")),
    @("Read: The team moved the deadline by two days because a key vendor delivered materials late. Why was the deadline moved?", @("A vendor delivered materials late.", "The team finished too early.", "The budget was increased.", "The office was closed for holidays.")),
    @("Read: Riku summarized customer interviews and grouped comments into usability, pricing, and reliability. What did Riku do with the comments?", @("He grouped them by theme.", "He deleted negative comments.", "He translated all comments.", "He sent them only to sales.")),
    @("Read: To prevent repeated mistakes, the manager added a checklist before each release. What was the checklist for?", @("To prevent repeated mistakes.", "To shorten lunch breaks.", "To increase meeting length.", "To reduce testing scope.")),
    @("Read: After reviewing error logs, the engineer fixed the login bug and monitored reports for three days. What happened after the fix?", @("Reports were monitored for three days.", "All logs were removed immediately.", "The app was redesigned.", "User accounts were reset.")),
    @("Read: The HR team introduced a mentoring program so junior staff could ask questions more easily. Why was the program introduced?", @("To make it easier for junior staff to ask questions.", "To reduce training materials.", "To evaluate only senior staff.", "To cancel one-on-one meetings.")),
    @("Read: Because survey responses were low, the team shortened the form and clarified each question. What change was made to improve responses?", @("The form was shortened and clarified.", "The survey was translated into five languages.", "The deadline was removed.", "The audience was narrowed to managers only.")),
    @("Read: Lina prepared a comparison chart to explain why one supplier was more reliable despite a higher price. What did the chart explain?", @("Why a higher-priced supplier was more reliable.", "Why all suppliers should be replaced.", "Why price should be ignored completely.", "Why delivery speed was unknown.")),
    @("Read: The project lead asked everyone to update task status every evening to spot delays early. Why was daily status updating required?", @("To detect delays early.", "To increase overtime hours.", "To reduce team communication.", "To skip weekly planning.")),
    @("Read: The team recorded a short demo video so remote members could review the workflow before discussion. Why was the video recorded?", @("So remote members could review the workflow.", "So the product could launch immediately.", "So meetings could be canceled forever.", "So customers could edit the script.")),
    @("Read: After two weeks, the pilot group reported fewer handover errors and faster onboarding. What result was reported?", @("Fewer handover errors and faster onboarding.", "Lower salaries and longer shifts.", "More complaints and slower training.", "No measurable change at all.")),
    @("Read: Nao changed the meeting agenda to focus on blockers first, which made decisions faster. What made decisions faster?", @("Focusing on blockers first.", "Adding more presentation slides.", "Inviting external speakers.", "Shortening the budget report.")),
    @("Read: The operations team created a backup plan in case the main server failed during peak hours. Why did they create it?", @("To prepare for server failure during peak hours.", "To lower internet speed intentionally.", "To avoid data backups.", "To stop monitoring system health.")),
    @("Read: Yuta documented common customer questions and shared sample answers with the support team. What did Yuta share?", @("Sample answers to common questions.", "A list of canceled products.", "Only unresolved tickets.", "A new pricing contract.")),
    @("Read: The committee approved the proposal after confirming that risks were identified and mitigation steps were realistic. Why was it approved?", @("Risks and mitigation steps were confirmed.", "The document was the shortest.", "No risks were discussed.", "The deadline was removed entirely."))
  )

  for ($i = 1; $i -le 20; $i++) {
    $seq = $SeqStart + $i - 1

    if ($Level -eq "A1") {
      $name = @("Tom","Mika","Ken","Sara","Yui")[(($i-1) % 5)]
      $place = @("park","library","school","store","station")[(($i-1) % 5)]
      $q = "Read: $name goes to the $place after school. What place does $name go to?"
      $choices = @($place, "hospital", "bank", "museum")
      Add-Problem -Level $Level -Seq $seq -SkillType "reading" -QuestionType "short_reading" -QuestionText ($q + " (A1-SR-" + $i.ToString("00") + ")") -Choices $choices -Answer 0 -Explanation "本文中の場所情報を確認します。" -KeyPhrase "短文読解:A1"
    }

    if ($Level -eq "A2") {
      $person = @("Emma","Nina","Ryo","Luis","Aki")[(($i-1) % 5)]
      $day = @("Monday","Tuesday","Wednesday","Thursday","Friday")[(($i-1) % 5)]
      $act = @("visit her grandmother","take a piano lesson","play tennis","study at the cafe","help at home")[(($i-1) % 5)]
      $q = "Read: $person usually $act on $day evenings. What does $person usually do on $day evenings?"
      $choices = @($act, "goes camping", "takes a flight", "watches a movie at noon")
      Add-Problem -Level $Level -Seq $seq -SkillType "reading" -QuestionType "short_reading" -QuestionText ($q + " (A2-SR-" + $i.ToString("00") + ")") -Choices $choices -Answer 0 -Explanation "本文の行動情報をそのまま対応させます。" -KeyPhrase "短文読解:A2"
    }

    if ($Level -eq "B1") {
      $p = $b1ReadingSet[$i - 1]
      Add-Problem -Level $Level -Seq $seq -SkillType "reading" -QuestionType "short_reading" -QuestionText ($p[0] + " (B1-SR-" + $i.ToString("00") + ")") -Choices $p[1] -Answer 0 -Explanation "本文の要点を根拠に最適な選択肢を判断します。" -KeyPhrase "短文読解:B1"
    }
  }
}

function Generate-SentenceBuild {
  param([string]$Level, [int]$SeqStart)

  for ($i = 1; $i -le 20; $i++) {
    $seq = $SeqStart + $i - 1

    if ($Level -eq "A1") {
      $pairs = @(
        @("私は毎朝7時に起きます。", "I get up at seven every morning."),
        @("彼はサッカーが好きです。", "He likes soccer."),
        @("これは私のペンです。", "This is my pen."),
        @("私たちは日曜日に公園へ行きます。", "We go to the park on Sunday."),
        @("彼女は英語を勉強しています。", "She is studying English.")
      )
      $p = $pairs[($i - 1) % $pairs.Count]
      $correct = $p[1]
      $choices = @($correct, "I am up get at seven every morning.", "He like soccer.", "We goes to park Sunday.")
      Add-Problem -Level $Level -Seq $seq -SkillType "vocabulary" -QuestionType "sentence_build" -QuestionText ("次の日本語に最も近い英文を選んでください: 「" + $p[0] + "」 (A1-SB-" + $i.ToString("00") + ")") -Choices $choices -Answer 0 -Explanation "語順と基本文型が自然な英文を選びます。" -KeyPhrase "短文英作:A1"
    }

    if ($Level -eq "A2") {
      $pairs = @(
        @("私は昨日その本を読み終えました。", "I finished reading the book yesterday."),
        @("もし晴れたら、私たちは散歩に行きます。", "If it is sunny, we will go for a walk."),
        @("彼女は3年間この町に住んでいます。", "She has lived in this town for three years."),
        @("この問題は前のものより難しいです。", "This question is more difficult than the previous one."),
        @("彼は夕食の前に宿題を終えました。", "He finished his homework before dinner.")
      )
      $p = $pairs[($i - 1) % $pairs.Count]
      $correct = $p[1]
      $choices = @($correct, "I have finish read the book yesterday.", "If sunny, we go walking will.", "She living this town for three years.")
      Add-Problem -Level $Level -Seq $seq -SkillType "vocabulary" -QuestionType "sentence_build" -QuestionText ("次の日本語に最も近い英文を選んでください: 「" + $p[0] + "」 (A2-SB-" + $i.ToString("00") + ")") -Choices $choices -Answer 0 -Explanation "時制と語順が正しい文を選びます。" -KeyPhrase "短文英作:A2"
    }

    if ($Level -eq "B1") {
      $pairs = @(
        @("会議が終わるまでに、私は提案書を完成させているでしょう。", "I will have finished the proposal by the time the meeting ends."),
        @("そのプロジェクトは、私たちが予想していたよりも多くの時間を要しました。", "The project took more time than we had expected."),
        @("十分なデータがあれば、その結果をより正確に説明できます。", "If we had enough data, we could explain the results more accurately."),
        @("彼女は顧客が本当に必要としていることを理解している。", "She understands what the client really needs."),
        @("私は新しい環境に適応するために、毎日少しずつ練習しています。", "I practice a little every day to adapt to the new environment.")
      )
      $p = $pairs[($i - 1) % $pairs.Count]
      $correct = $p[1]
      $choices = @($correct, "I will finished proposal when meeting end.", "Project more time took than we expected had.", "She understand what client need really.")
      Add-Problem -Level $Level -Seq $seq -SkillType "vocabulary" -QuestionType "sentence_build" -QuestionText ("次の日本語に最も近い英文を選んでください: 「" + $p[0] + "」 (B1-SB-" + $i.ToString("00") + ")") -Choices $choices -Answer 0 -Explanation "複文の構造と時制の整合を確認します。" -KeyPhrase "短文英作:B1"
    }
  }
}

$levels = @("A1","A2","B1")
foreach ($level in $levels) {
  $seqStart = 1
  Generate-FillBlank -Level $level -SeqStart $seqStart
  $seqStart += 20
  Generate-ResponseChoice -Level $level -SeqStart $seqStart
  $seqStart += 20
  Generate-ShortReading -Level $level -SeqStart $seqStart
  $seqStart += 20
  Generate-SentenceBuild -Level $level -SeqStart $seqStart
}

$items | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $OutPath
Write-Host "Generated problems:" $items.Count

