/**
 * Line-based scene script.
 *
 *   scene "제목"
 *   stage solution
 *   mol w = H2O at center
 *   step "설명 문장"
 *     arrow w.O:lp -> w.O~a.H
 *
 * One line = one command. Words are split on whitespace, "double quotes" keep
 * spaces, and `#` starts a comment. The parser only splits lines into
 * commands and steps; the compiler gives each command its meaning.
 */

export interface Diag {
  line: number;
  message: string;
}

export interface Cmd {
  line: number;
  op: string;
  args: string[];
  /** Which args were written in quotes (quoted text is never a keyword). */
  quoted: boolean[];
  text: string;
}

export interface StepAst {
  line: number;
  text: string;
  cmds: Cmd[];
  endLine: number;
}

export interface ScriptAst {
  header: Cmd[];
  steps: StepAst[];
  errors: Diag[];
}

export function tokenize(src: string, line: number, errors: Diag[]): { words: string[]; quoted: boolean[] } {
  const words: string[] = [];
  const quoted: boolean[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    // '#' starts a comment only where a word would start (so SMILES triple bonds like C#N survive).
    if (ch === '#') break;
    if (ch === '"' || ch === '“' || ch === '”') {
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== '"' && src[j] !== '”' && src[j] !== '“') {
        out += src[j];
        j++;
      }
      if (j >= src.length) {
        errors.push({ line, message: '따옴표 짝이 맞지 않아요.' });
      }
      words.push(out);
      quoted.push(true);
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < src.length && src[j] !== ' ' && src[j] !== '\t' && src[j] !== '"') j++;
    words.push(src.slice(i, j));
    quoted.push(false);
    i = j;
  }
  return { words, quoted };
}

const HEADER_OPS = new Set(['scene', 'stage', 'lens', 'crowd', 'crystal', 'electrode', 'protein']);

export function parse(src: string): ScriptAst {
  const errors: Diag[] = [];
  const header: Cmd[] = [];
  const steps: StepAst[] = [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let current: StepAst | null = null;

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const { words, quoted } = tokenize(raw, line, errors);
    if (words.length === 0) return;
    const op = quoted[0] ? '' : words[0].toLowerCase();
    if (!op) {
      errors.push({ line, message: '줄 맨 앞에 명령어가 없어요.' });
      return;
    }
    const cmd: Cmd = { line, op, args: words.slice(1), quoted: quoted.slice(1), text: raw.trim() };
    if (op === 'step') {
      if (cmd.args.length === 0) {
        errors.push({ line, message: 'step 뒤에 설명 문장을 따옴표로 적어 주세요. 예: step "물 분자가 다가가요"' });
      }
      current = { line, text: cmd.args.join(' '), cmds: [], endLine: line };
      steps.push(current);
      return;
    }
    if (HEADER_OPS.has(op)) {
      if (current && op !== 'lens') {
        errors.push({ line, message: `${op}은(는) 첫 step보다 앞에 적어야 해요.` });
        return;
      }
      if (!current) {
        header.push(cmd);
        return;
      }
    }
    if (current) {
      current.cmds.push(cmd);
      current.endLine = line;
    } else {
      header.push(cmd);
    }
  });

  return { header, steps, errors };
}
