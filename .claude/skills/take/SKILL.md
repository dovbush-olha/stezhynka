---
name: take
description: Підготувати окремий worktree під GitHub issue - гілка з заголовка issue, свіжий main, залежності; закінчується доповіддю, задачу бере наступна команда.
argument-hint: <номер issue>
disable-model-invocation: true
---

# /take <номер issue>

Одна вкладка Claude Code - одна задача - один worktree.
Основна копія репозиторію лишається на `main`, її не чіпаємо.

## Кроки

1. **Прочитати issue.**
   `gh issue view <номер> --json title,body,labels,url`.
   Якщо `gh` відповідає «Could not resolve to a Repository» - активний акаунт без доступу до `origin`: `gh auth status`, `gh auth switch --user <власник репозиторію>` і повторити.

2. **Назвати гілку.**
   З заголовка issue: латиницею, через дефіс, 2-4 слова, без номера issue, без дати (`workflow-skills`, `solo-read-hints`).
   Українські слова перекладаються за змістом, не транслітеруються: «запис голосу» - `voice-recording`, не `zapys-golosu`.
   Перевірити, що такої гілки немає: `git branch -a --list '*<назва>*'`.
   Назвати її користувачці одним рядком і одразу йти далі: до push перейменувати нічого не коштує.

3. **Перейти у worktree.**
   Спершу `git fetch origin`, щоб гілка пішла від свіжого `origin/main`.
   Якщо сесія вже у worktree (`pwd` містить `.claude/worktrees/`) - сказати про це й зупинитися: друга задача - друга вкладка.
   Інакше `EnterWorktree` з `name` = назва гілки.
   Інструмент називає гілку `worktree-<назва>`, тож одразу `git branch -m worktree-<назва> <назва>`.
   Далі робоча тека сесії - `.claude/worktrees/<назва>`, усі команди - звідти.

4. **Встановити залежності.**
   `npm ci` у теці worktree.

5. **Доповісти.**
   Одним коротким блоком: гілка, тека, як запустити застосунок - `npm run dev` (Vite сам візьме вільний порт, якщо інший worktree вже займає свій), на телефоні в тій самій мережі - `npm run phone`.

6. **Зупинитися.**
   Скіл лише готує місце: доповідь - його остання дія, а задачу бере наступна команда, яку користувачка набирає сама.
   Закінчити доповідь підказкою з номером issue, обравши за issue одну з двох і назвавши її першою, другу - рядком нижче:
   - постановка однозначна - `/mattpocock-skills:implement issue #<номер>`;
   - у постановці є розгалуження чи відкриті питання - спершу `/mattpocock-skills:grill-with-docs #<номер>`, потім `/mattpocock-skills:implement`.
   Під підказкою - маршрут до PR одним рядком: реалізація → `/compact` → `/finish <номер>` → PR.

## Завершення задачі

Коли PR злито й користувачка просить прибрати worktree:

1. `git fetch origin`, потім `git merge-base --is-ancestor HEAD origin/main` - окремими командами.
2. Код виходу 0 (усі коміти гілки вже в `main`) - `ExitWorktree` з `action: "remove"` і `discard_changes: true` одразу.
   Без `discard_changes` інструмент відмовляє завжди: гілку перейменовано, і він рахує коміти від старого початку сесії, а не від `main`.
   Код 1 - показати `git log --oneline origin/main..HEAD` і спитати; `discard_changes` без відповіді не ставити.
   Якщо PR злито через squash, код буде 1, хоч усе вже в `main`: тоді звірити `gh pr view --json state` і спитати.

Лишити на потім: `ExitWorktree` з `action: "keep"`; повернення - `EnterWorktree` з `path`.

Продовжити саму розмову (нова вкладка, перезапуск, кінець ліміту):
сесія, що зайшла у worktree через `EnterWorktree`, записана за основною текою репозиторію, тож `claude --resume <id>` - з неї.
З теки worktree `claude --resume` відповідає «No conversation found».
Якщо після відновлення `pwd` - не тека worktree, першим кроком `EnterWorktree` з `path`.
