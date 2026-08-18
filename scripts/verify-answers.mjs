import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// BAMF Gesamtfragenkatalog, Stand 07.05.2025. The sequence follows the
// 300 general questions and the ten questions for each state in this order.
// Source: https://oet.bamf.de/ords/oetut/f?p=514:1:0
const GENERAL_KEY =
  'dbaccdabcdacdbbadaadacdcabbcbbbcacbadbdbabbbaaacbbcaddabdbdbdbbddaddcdddacaddcdcddcccabacacddbbdabaababdddbbbcdbabcdcdccaaccbacacacbbadbccbaababadbdcbbcdbccaaabadccadddcaddcbbcbdbcbcbaabddcdbacabaacbcbbbbabccdbbccabadbddadcbdbbcdadcadcdbbbcbcaadbbbbbdaadcdbbbdbaaaddadccbddbdddaccbbbbdacbcbaccabcdaba';

const STATE_KEYS = {
  'Baden-Württemberg': 'abcbbcbbdd',
  Bayern: 'bdccbbdddb',
  Berlin: 'dccbbdaddc',
  Brandenburg: 'aacbbcaddb',
  Bremen: 'cbbbbbaaca',
  Hamburg: 'bacbbdacbb',
  Hessen: 'adccbadcdb',
  'Mecklenburg-Vorpommern': 'cbcbbabcdb',
  Niedersachsen: 'cacbbaaadb',
  'Nordrhein-Westfalen': 'bbcbbdccdb',
  'Rheinland-Pfalz': 'aaccbdaadb',
  Saarland: 'dcccbbcbdb',
  Sachsen: 'daccbabddb',
  'Sachsen-Anhalt': 'ddcbbbccdb',
  'Schleswig-Holstein': 'cccbbcdadb',
  Thüringen: 'ddcbbcbbdb',
};

function verifyFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const general = questions.filter((question) => question.type === 'general');
  const states = questions.filter((question) => question.type === 'state');
  const failures = [];

  if (questions.length !== 460 || general.length !== 300 || states.length !== 160) {
    failures.push(
      `expected 460 questions (300 general + 160 state), got ${questions.length} (${general.length} general + ${states.length} state)`,
    );
  }

  const generalAnswers = general.map((question) => question.correctAnswer).join('');
  if (generalAnswers !== GENERAL_KEY) {
    for (let index = 0; index < Math.min(general.length, GENERAL_KEY.length); index += 1) {
      if (general[index].correctAnswer !== GENERAL_KEY[index]) {
        failures.push(
          `general question ${general[index].id}: expected ${GENERAL_KEY[index]}, got ${general[index].correctAnswer}`,
        );
      }
    }
  }

  for (const [state, expectedKey] of Object.entries(STATE_KEYS)) {
    const stateQuestions = states.filter((question) => question.state === state);
    const actualKey = stateQuestions.map((question) => question.correctAnswer).join('');
    if (stateQuestions.length !== 10) {
      failures.push(`${state}: expected 10 questions, got ${stateQuestions.length}`);
    }
    if (actualKey !== expectedKey) {
      for (let index = 0; index < Math.min(stateQuestions.length, expectedKey.length); index += 1) {
        if (stateQuestions[index].correctAnswer !== expectedKey[index]) {
          failures.push(
            `${state} question ${index + 1} (id ${stateQuestions[index].id}): expected ${expectedKey[index]}, got ${stateQuestions[index].correctAnswer}`,
          );
        }
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`${relativePath} failed answer verification:\n- ${failures.join('\n- ')}`);
  }

  console.log(`Verified ${relativePath}: 460/460 answer keys match the BAMF catalogue.`);
  return questions.map((question) => question.correctAnswer).join('');
}

const productionKey = verifyFile(path.join('src', 'data', 'questions.json'));
const mirrorKey = verifyFile(path.join('app', 'data', 'questions.json'));

if (productionKey !== mirrorKey) {
  throw new Error('The production and mirror question datasets have different answer keys.');
}

console.log('All 460 question answers verified successfully.');
