const broadCategoryRules: Array<[string, RegExp]> = [
  ["Ficção científica", /science fiction|sci[- ]?fi|space opera|cyberpunk|dystopi/i],
  ["Fantasia", /fantasy|fantasia|magic|magical|fairy tale/i],
  ["Romance", /romance|love stor|romantic fiction/i],
  ["Suspense", /thriller|suspense|mystery|detective|crime fiction/i],
  ["Biografia", /biograph|autobiograph|memoir|memórias/i],
  ["Ciência", /science|physics|chemistry|biology|astronomy|mathematics/i],
  ["História", /history|historical|história|civilization/i],
  ["Filosofia", /philosoph|ethics|stoic/i],
  ["Tecnologia", /technology|computer|programming|software|artificial intelligence/i],
  ["Ficção", /fiction|novel|short stor|literature/i],
];

const genericSubjects = /^(fiction|novels?|literature|general|accessible book|protected daisy|large type books?|translations?)$/i;

function cleanSubject(subject: string) {
  return subject.trim().replace(/\s+/g, " ");
}

export function classifyBookSubjects(subjects: string[]) {
  const clean = [...new Set(subjects.map(cleanSubject).filter(Boolean))];
  const categories: string[] = [];

  for (const subject of clean) {
    for (const [category, matcher] of broadCategoryRules) {
      if (matcher.test(subject) && !categories.includes(category)) categories.push(category);
      if (categories.length === 3) break;
    }
    if (categories.length === 3) break;
  }

  const tags = clean
    .filter((subject) => !genericSubjects.test(subject))
    .filter((subject) => !categories.some((category) => subject.localeCompare(category, "pt-BR", { sensitivity: "base" }) === 0))
    .slice(0, 10);

  return { categories: categories.slice(0, 3), tags };
}
