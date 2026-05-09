export const mockUser = {
  name: "Alex Johnson",
  email: "alex.johnson@uni.edu",
  joined: "February 2025",
};

export const mockCourses = [
  {
    id: "comp2511",
    code: "COMP2511",
    fullName: "Object Oriented Design & Programming",
    startDate: "17 Feb 2025",
    endDate: "15 Jun 2025",
    instructor: "Dr. Sarah Chen",
    email: "sarah.chen@uni.edu",
    mastery: 72,
    timeSpent: 14.5,
  },
  {
    id: "cpsc213",
    code: "CPSC 213",
    fullName: "Introduction to Computer Systems",
    startDate: "6 Jan 2025",
    endDate: "20 Apr 2025",
    instructor: "Dr. Mike Feeley",
    email: "feeley@cs.ubc.ca",
    mastery: 54,
    timeSpent: 11.3,
  },
  {
    id: "math1141",
    code: "MATH1141",
    fullName: "Higher Mathematics 1A",
    startDate: "17 Feb 2025",
    endDate: "15 Jun 2025",
    instructor: "Prof. James Liu",
    email: "j.liu@uni.edu",
    mastery: 58,
    timeSpent: 10.2,
  },
  {
    id: "psyc1001",
    code: "PSYC1001",
    fullName: "Psychology 1A",
    startDate: "17 Feb 2025",
    endDate: "15 Jun 2025",
    instructor: "Dr. Emma Wilson",
    email: "e.wilson@uni.edu",
    mastery: 85,
    timeSpent: 8.0,
  },
];

export type Topic = {
  id: string;
  name: string;
  courseId: string;
};

export type Outcome = {
  id: string;
  text: string;
  topicId?: string;
  courseId: string;
  mastery: number;
};

export type Question = {
  id: string;
  text: string;
  mastery: number;
  correctAnswer: string;
  outcomeIds: string[];
  courseId: string;
};

export const mockTopics: Topic[] = [
  // COMP2511
  { id: "tc1", name: "OOP Fundamentals", courseId: "comp2511" },
  { id: "tc2", name: "Polymorphism & Types", courseId: "comp2511" },
  { id: "tc3", name: "Testing & Reliability", courseId: "comp2511" },
  // CPSC 213
  { id: "t1", name: "Memory & Pointers", courseId: "cpsc213" },
  { id: "t2", name: "Assembly", courseId: "cpsc213" },
  { id: "t3", name: "Compilation", courseId: "cpsc213" },
];

export const mockOutcomes: Outcome[] = [
  { id: "lo1", text: "Apply SOLID design principles", mastery: 45, courseId: "comp2511", topicId: "tc1" },
  { id: "lo2", text: "Implement common design patterns", mastery: 52, courseId: "comp2511", topicId: "tc1" },
  { id: "lo3", text: "Write maintainable OOP code", mastery: 60, courseId: "comp2511", topicId: "tc1" },
  { id: "lo4", text: "Use generics and collections effectively", mastery: 68, courseId: "comp2511", topicId: "tc2" },
  { id: "lo5", text: "Understand polymorphism types", mastery: 71, courseId: "comp2511", topicId: "tc2" },
  { id: "lo6", text: "Apply encapsulation principles", mastery: 79, courseId: "comp2511", topicId: "tc2" },
  { id: "lo7", text: "Distinguish interface vs abstract class", mastery: 82, courseId: "comp2511", topicId: "tc2" },
  { id: "lo8", text: "Write unit tests for OOP code", mastery: 38, courseId: "comp2511", topicId: "tc3" },
  { id: "lo9", text: "Understand exception handling hierarchy", mastery: 55, courseId: "comp2511", topicId: "tc3" },
  { id: "lo10", text: "Use inheritance appropriately", mastery: 75, courseId: "comp2511", topicId: "tc3" },
  // CPSC 213
  { id: "cpsc_lo1", text: "Pointer Arithmetic", topicId: "t1", courseId: "cpsc213", mastery: 45 },
  { id: "cpsc_lo2", text: "Memory Addressing", topicId: "t1", courseId: "cpsc213", mastery: 52 },
  { id: "cpsc_lo3", text: "Stack vs Heap", topicId: "t1", courseId: "cpsc213", mastery: 67 },
  { id: "cpsc_lo4", text: "Instruction Encoding", topicId: "t2", courseId: "cpsc213", mastery: 38 },
  { id: "cpsc_lo5", text: "Fetch-Execute Cycle", topicId: "t2", courseId: "cpsc213", mastery: 55 },
  { id: "cpsc_lo6", text: "Register Usage", topicId: "t2", courseId: "cpsc213", mastery: 61 },
  { id: "cpsc_lo7", text: "C to Assembly Translation", topicId: "t3", courseId: "cpsc213", mastery: 42 },
  { id: "cpsc_lo8", text: "Variable Declarations", topicId: "t3", courseId: "cpsc213", mastery: 70 },
  { id: "cpsc_lo9", text: "Type Casting", topicId: "t3", courseId: "cpsc213", mastery: 48 },
];

export const mockQuestions: Question[] = [
  {
    id: "q1",
    text: "What is the difference between an interface and an abstract class in Java?",
    mastery: 88,
    correctAnswer:
      "An interface defines a contract (all methods abstract by default, no state), while an abstract class can have concrete methods and instance fields. A class can implement multiple interfaces but can only extend one abstract class.",
    outcomeIds: ["lo7"],
    courseId: "comp2511",
  },
  {
    id: "q2",
    text: "Explain the Liskov Substitution Principle with an example.",
    mastery: 64,
    correctAnswer:
      "LSP states that objects of a superclass should be replaceable with objects of a subclass without altering correctness. Example: if Bird has a fly() method, a Penguin subclass violates LSP since penguins cannot fly.",
    outcomeIds: ["lo1"],
    courseId: "comp2511",
  },
  {
    id: "q3",
    text: "What is method overloading vs method overriding?",
    mastery: 92,
    correctAnswer:
      "Overloading: same method name, different parameter lists (compile-time polymorphism). Overriding: subclass redefines a superclass method with the same signature (runtime polymorphism).",
    outcomeIds: ["lo5"],
    courseId: "comp2511",
  },
  {
    id: "q4",
    text: "Describe the Observer design pattern.",
    mastery: 55,
    correctAnswer:
      "Observer defines a one-to-many dependency so that when one object (Subject) changes state, all dependents (Observers) are notified automatically. Used in event-driven systems.",
    outcomeIds: ["lo2"],
    courseId: "comp2511",
  },
  {
    id: "q5",
    text: "What is the purpose of the 'final' keyword in Java?",
    mastery: 78,
    correctAnswer:
      "final on a variable makes it a constant. final on a method prevents overriding. final on a class prevents inheritance.",
    outcomeIds: ["lo3"],
    courseId: "comp2511",
  },
  {
    id: "q6",
    text: "Explain encapsulation and why it matters.",
    mastery: 81,
    correctAnswer:
      "Encapsulation bundles data and methods that operate on data into a class, hiding internal state via access modifiers. It reduces coupling and makes code easier to maintain.",
    outcomeIds: ["lo6"],
    courseId: "comp2511",
  },
  {
    id: "q7",
    text: "What is a generic type in Java and why is it useful?",
    mastery: 69,
    correctAnswer:
      "Generics allow classes and methods to operate on typed parameters, enabling type safety at compile time without casting. E.g. List<String> vs raw List.",
    outcomeIds: ["lo4"],
    courseId: "comp2511",
  },
  {
    id: "q8",
    text: "What is the Singleton pattern and when should you avoid it?",
    mastery: 47,
    correctAnswer:
      "Singleton ensures only one instance of a class exists. Avoid it when it introduces global state, makes testing difficult, or creates hidden dependencies.",
    outcomeIds: ["lo2"],
    courseId: "comp2511",
  },
  // CPSC 213 — Memory & Pointers
  {
    id: "cpsc_q1",
    text: "If p is a pointer to an int (4 bytes), what address does p+3 refer to?",
    mastery: 55,
    correctAnswer:
      "p+3 moves the address forward by 3 × sizeof(int) = 12 bytes. So if p points to address 0x100, p+3 points to 0x10C.",
    outcomeIds: ["cpsc_lo1"],
    courseId: "cpsc213",
  },
  {
    id: "cpsc_q2",
    text: "How is the address of an array element a[i] computed?",
    mastery: 48,
    correctAnswer:
      "address of a[i] = base address of a + i × sizeof(element type). This is pointer arithmetic applied to an array base pointer.",
    outcomeIds: ["cpsc_lo1", "cpsc_lo2"],
    courseId: "cpsc213",
  },
  {
    id: "cpsc_q3",
    text: "What is the difference between stack and heap memory allocation?",
    mastery: 62,
    correctAnswer:
      "Stack memory is automatically managed (LIFO, fixed size, fast) and freed when the enclosing function returns. Heap memory is manually allocated (malloc/free) and persists until explicitly freed, allowing dynamic sizing.",
    outcomeIds: ["cpsc_lo3"],
    courseId: "cpsc213",
  },
  // CPSC 213 — Assembly
  {
    id: "cpsc_q4",
    text: "Describe the fetch-execute cycle of a CPU.",
    mastery: 70,
    correctAnswer:
      "1. Fetch: read the instruction at the address in the PC. 2. Decode: interpret the opcode and operands. 3. Execute: perform the operation. 4. Increment PC. Repeat.",
    outcomeIds: ["cpsc_lo5"],
    courseId: "cpsc213",
  },
  {
    id: "cpsc_q5",
    text: "What does an instruction encoding specify?",
    mastery: 44,
    correctAnswer:
      "An instruction encoding maps an assembly mnemonic to a binary bit pattern, specifying the opcode and operand fields (registers, immediates, or memory addresses) within a fixed-width or variable-width word.",
    outcomeIds: ["cpsc_lo4"],
    courseId: "cpsc213",
  },
  {
    id: "cpsc_q6",
    text: "How are general-purpose registers divided in a typical calling convention?",
    mastery: 51,
    correctAnswer:
      "Caller-saved registers hold temporaries the callee may overwrite. Callee-saved registers must be preserved across calls. Specific registers are designated for return values, function arguments, the stack pointer, and the frame pointer.",
    outcomeIds: ["cpsc_lo6"],
    courseId: "cpsc213",
  },
  // CPSC 213 — Compilation
  {
    id: "cpsc_q7",
    text: "How does a C declaration 'int x = 5;' typically translate to assembly?",
    mastery: 58,
    correctAnswer:
      "The compiler allocates 4 bytes on the stack (subtracts 4 from SP) and stores the immediate value 5 at that location. In x86-64: sub $4, %rsp; movl $5, (%rsp).",
    outcomeIds: ["cpsc_lo7", "cpsc_lo8"],
    courseId: "cpsc213",
  },
  {
    id: "cpsc_q8",
    text: "What assembly instruction(s) does a C cast from int to char typically produce?",
    mastery: 40,
    correctAnswer:
      "A truncation to the lowest 8 bits. On x86-64 this may be a movzbl or movsbl, or simply using the byte-register alias (e.g., %al instead of %eax) — no explicit instruction needed when the value is already in a register.",
    outcomeIds: ["cpsc_lo9"],
    courseId: "cpsc213",
  },
  {
    id: "cpsc_q9",
    text: "Why does the C compiler insert padding between struct fields?",
    mastery: 45,
    correctAnswer:
      "To satisfy alignment requirements: each field must start at an address that is a multiple of its size. Padding bytes are inserted so the next field is correctly aligned, even if it wastes space.",
    outcomeIds: ["cpsc_lo8"],
    courseId: "cpsc213",
  },
];

export const mockDocuments = [
  { id: "d1", name: "Week 1 Lecture Slides", type: "Lecture", outcomes: 3, questions: 12 },
  { id: "d2", name: "Week 2 — Design Patterns", type: "Lecture", outcomes: 5, questions: 18 },
  { id: "d3", name: "Assignment 1 Spec", type: "Assignment", outcomes: 4, questions: 0 },
  { id: "d4", name: "Midterm Study Guide", type: "Quiz", outcomes: 8, questions: 25 },
];

export const mockSessionResults = {
  score: 18,
  total: 25,
  confidenceBreakdown: { confident: 14, guessed: 7, unsure: 4 },
  rankedOutcomes: [
    { text: "Write unit tests for OOP code", score: 30, suggestion: "Review testing frameworks and practice writing test cases" },
    { text: "Apply SOLID design principles", score: 42, suggestion: "Focus on Single Responsibility and Dependency Inversion" },
    { text: "Implement common design patterns", score: 55, suggestion: "Practice Factory, Observer, and Strategy patterns" },
    { text: "Understand exception handling hierarchy", score: 61, suggestion: "Study checked vs unchecked exceptions" },
    { text: "Use generics and collections effectively", score: 68, suggestion: "Review Java Collections API and bounded type parameters" },
    { text: "Apply encapsulation principles", score: 79, suggestion: "Good — keep practicing access modifier choices" },
    { text: "Use inheritance appropriately", score: 83, suggestion: "Strong — ensure you can explain when NOT to use inheritance" },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function getTopicsForCourse(courseId: string): Topic[] {
  return mockTopics.filter((t) => t.courseId === courseId);
}

export function getOutcomesForCourse(courseId: string): Outcome[] {
  return mockOutcomes.filter((o) => o.courseId === courseId);
}

export function getQuestionsForCourse(courseId: string): Question[] {
  return mockQuestions.filter((q) => q.courseId === courseId);
}

export function getQuestionsForTopics(courseId: string, topicIds: string[]): Question[] {
  const outcomes = getOutcomesForCourse(courseId);
  const outcomeIdsInTopics = new Set(
    outcomes.filter((o) => o.topicId && topicIds.includes(o.topicId)).map((o) => o.id)
  );
  return getQuestionsForCourse(courseId).filter((q) =>
    q.outcomeIds.some((id) => outcomeIdsInTopics.has(id))
  );
}

export function getQuestionCountForTopic(topicId: string, courseId: string): number {
  return getQuestionsForTopics(courseId, [topicId]).length;
}
