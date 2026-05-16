-- Fix all FK constraints to use CASCADE to match schema.prisma onDelete:Cascade declarations.
-- The initial migration created all FKs as RESTRICT; this corrects them.

-- Topic
ALTER TABLE "Topic" DROP CONSTRAINT IF EXISTS "Topic_courseId_fkey";
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LearningOutcome
ALTER TABLE "LearningOutcome" DROP CONSTRAINT IF EXISTS "LearningOutcome_topicId_fkey";
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningOutcome" DROP CONSTRAINT IF EXISTS "LearningOutcome_courseId_fkey";
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Question
ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_courseId_fkey";
ALTER TABLE "Question" ADD CONSTRAINT "Question_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- QuestionOutcome
ALTER TABLE "QuestionOutcome" DROP CONSTRAINT IF EXISTS "QuestionOutcome_questionId_fkey";
ALTER TABLE "QuestionOutcome" ADD CONSTRAINT "QuestionOutcome_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionOutcome" DROP CONSTRAINT IF EXISTS "QuestionOutcome_learningOutcomeId_fkey";
ALTER TABLE "QuestionOutcome" ADD CONSTRAINT "QuestionOutcome_learningOutcomeId_fkey"
  FOREIGN KEY ("learningOutcomeId") REFERENCES "LearningOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- QuestionTopic
ALTER TABLE "QuestionTopic" DROP CONSTRAINT IF EXISTS "QuestionTopic_questionId_fkey";
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionTopic" DROP CONSTRAINT IF EXISTS "QuestionTopic_topicId_fkey";
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StudySession
ALTER TABLE "StudySession" DROP CONSTRAINT IF EXISTS "StudySession_userId_fkey";
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudySession" DROP CONSTRAINT IF EXISTS "StudySession_courseId_fkey";
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- QuestionAttempt
ALTER TABLE "QuestionAttempt" DROP CONSTRAINT IF EXISTS "QuestionAttempt_sessionId_fkey";
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionAttempt" DROP CONSTRAINT IF EXISTS "QuestionAttempt_questionId_fkey";
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MasteryScore
ALTER TABLE "MasteryScore" DROP CONSTRAINT IF EXISTS "MasteryScore_userId_fkey";
ALTER TABLE "MasteryScore" ADD CONSTRAINT "MasteryScore_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MasteryScore" DROP CONSTRAINT IF EXISTS "MasteryScore_learningOutcomeId_fkey";
ALTER TABLE "MasteryScore" ADD CONSTRAINT "MasteryScore_learningOutcomeId_fkey"
  FOREIGN KEY ("learningOutcomeId") REFERENCES "LearningOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_courseId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
