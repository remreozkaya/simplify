import type {
  Grade,
  PrerequisiteExpression,
} from "@/lib/itu/curriculum/types";

type Token =
  | { kind: "course"; courseCode: string; minimumGrade?: Grade }
  | { kind: "and" | "or" | "left" | "right" };

const COURSE_PATTERN =
  /^([A-ZÇĞİÖŞÜ]{2,8})\s*(\d{2,5})([A-Z]{0,3})\b/u;
const GRADE_PATTERN = /^(?:MIN(?:IMUM)?\.?\s*)?(AA|BA|BB|CB|CC|DC|DD|FD|FF)\b/i;

export function normalizeCourseCode(value: string): string {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  const match = normalized.match(/^([A-ZÇĞİÖŞÜ]{2,8})(\d{2,5}[A-Z]{0,3})$/u);

  return match ? `${match[1]} ${match[2]}` : value.replace(/\s+/g, " ").trim().toUpperCase();
}

function tokenize(value: string): Token[] | null {
  const source = value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    if (rest[0] === "(") {
      tokens.push({ kind: "left" });
      index += 1;
      continue;
    }
    if (rest[0] === ")") {
      tokens.push({ kind: "right" });
      index += 1;
      continue;
    }

    const operator = rest.match(/^(VEYA|AND|OR|VE)\b/i);
    if (operator) {
      tokens.push({ kind: /^(VEYA|OR)$/i.test(operator[1]) ? "or" : "and" });
      index += operator[0].length;
      continue;
    }

    const course = rest.match(COURSE_PATTERN);
    if (course) {
      index += course[0].length;
      const afterCourse = source.slice(index).replace(/^\s+/, "");
      const removedWhitespace = source.slice(index).length - afterCourse.length;
      const grade = afterCourse.match(GRADE_PATTERN);
      const token: Extract<Token, { kind: "course" }> = {
        kind: "course",
        courseCode: normalizeCourseCode(`${course[1]} ${course[2]}${course[3]}`),
      };
      if (grade) {
        token.minimumGrade = grade[1].toUpperCase() as Grade;
        index += removedWhitespace + grade[0].length;
      }
      tokens.push(token);
      continue;
    }

    return null;
  }

  return tokens;
}

function combine(
  kind: "and" | "or",
  left: PrerequisiteExpression,
  right: PrerequisiteExpression,
): PrerequisiteExpression {
  const operands = [
    ...(left.kind === kind ? left.operands : [left]),
    ...(right.kind === kind ? right.operands : [right]),
  ];
  return { kind, operands };
}

export function parsePrerequisiteExpression(raw: string): PrerequisiteExpression {
  const tokens = tokenize(raw);
  if (!tokens || tokens.length === 0) {
    return { kind: "unknown", raw };
  }
  const safeTokens = tokens;
  let position = 0;

  function primary(): PrerequisiteExpression | null {
    const token = safeTokens[position];
    if (!token) return null;
    if (token.kind === "course") {
      position += 1;
      return {
        kind: "course",
        courseCode: token.courseCode,
        ...(token.minimumGrade ? { minimumGrade: token.minimumGrade } : {}),
      };
    }
    if (token.kind === "left") {
      position += 1;
      const expression = orExpression();
      if (!expression || safeTokens[position]?.kind !== "right") return null;
      position += 1;
      return expression;
    }
    return null;
  }

  function andExpression(): PrerequisiteExpression | null {
    let expression = primary();
    if (!expression) return null;
    while (safeTokens[position]?.kind === "and") {
      position += 1;
      const right = primary();
      if (!right) return null;
      expression = combine("and", expression, right);
    }
    return expression;
  }

  function orExpression(): PrerequisiteExpression | null {
    let expression = andExpression();
    if (!expression) return null;
    while (safeTokens[position]?.kind === "or") {
      position += 1;
      const right = andExpression();
      if (!right) return null;
      expression = combine("or", expression, right);
    }
    return expression;
  }

  const expression = orExpression();
  return expression && position === safeTokens.length
    ? expression
    : { kind: "unknown", raw };
}
