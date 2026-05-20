-- =============================================================================
-- Migration: Enable Row-Level Security (RLS) on all public tables
-- =============================================================================
-- Context:
--   This app uses Prisma (server-side, postgres/service role) for all data
--   access, and Supabase Auth for authentication. Because Prisma connects
--   via the DATABASE_URL (postgres role) it BYPASSES RLS automatically —
--   so your API routes are completely unaffected by this migration.
--
--   Without RLS, anyone with your project's anon key and URL can query,
--   insert, update, or delete all rows directly via Supabase's REST API,
--   completely bypassing your Next.js API layer and its auth checks.
--
--   This migration:
--     1. Enables RLS on every table.
--     2. Adds a helper function that resolves the currently authenticated
--        Supabase Auth user's internal Prisma User.id via their email.
--     3. Adds least-privilege policies so that authenticated users can
--        only read/write their own data via the REST API.
--     4. Grants no access to the anon role (unauthenticated requests are
--        fully blocked at the database level).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper: resolve the Supabase JWT email → internal User.id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_id()
  RETURNS TEXT
  LANGUAGE sql
  SECURITY DEFINER   -- runs as the function owner (postgres), can always read User
  STABLE             -- same result within a transaction
AS $$
  SELECT id FROM "User" WHERE email = (auth.jwt() ->> 'email')
$$;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on all tables (defaults to deny-all until policies are added)
-- ---------------------------------------------------------------------------
ALTER TABLE "User"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Topic"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningOutcome" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionOutcome" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionTopic"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MasteryScore"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document"        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. RLS Policies
--
--    Convention: FOR ALL = SELECT + INSERT + UPDATE + DELETE.
--    USING  clause controls which existing rows are visible / modifiable.
--    WITH CHECK clause controls which rows can be inserted or updated into.
--    When WITH CHECK is omitted on a FOR ALL policy, USING is reused.
-- ---------------------------------------------------------------------------

-- User -----------------------------------------------------------------------
-- A user can only see and update their own row.
-- (Rows are created server-side by getPrismaUser() via the postgres role,
--  which bypasses RLS, so no INSERT policy is needed here.)
CREATE POLICY "user: own row only"
  ON "User"
  FOR ALL
  TO authenticated
  USING      (email = (auth.jwt() ->> 'email'))
  WITH CHECK (email = (auth.jwt() ->> 'email'));

-- Course ---------------------------------------------------------------------
CREATE POLICY "course: owner only"
  ON "Course"
  FOR ALL
  TO authenticated
  USING      ("userId" = auth_user_id())
  WITH CHECK ("userId" = auth_user_id());

-- Topic ----------------------------------------------------------------------
-- Topics belong to a Course; ownership is transitive through Course.userId.
CREATE POLICY "topic: owner only"
  ON "Topic"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Course"
      WHERE "Course"."id" = "Topic"."courseId"
        AND "Course"."userId" = auth_user_id()
    )
  );

-- LearningOutcome ------------------------------------------------------------
CREATE POLICY "learning_outcome: owner only"
  ON "LearningOutcome"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Course"
      WHERE "Course"."id" = "LearningOutcome"."courseId"
        AND "Course"."userId" = auth_user_id()
    )
  );

-- Question -------------------------------------------------------------------
CREATE POLICY "question: owner only"
  ON "Question"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Course"
      WHERE "Course"."id" = "Question"."courseId"
        AND "Course"."userId" = auth_user_id()
    )
  );

-- QuestionOutcome (join table) -----------------------------------------------
CREATE POLICY "question_outcome: owner only"
  ON "QuestionOutcome"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Question"
      JOIN "Course" ON "Course"."id" = "Question"."courseId"
      WHERE "Question"."id" = "QuestionOutcome"."questionId"
        AND "Course"."userId" = auth_user_id()
    )
  );

-- QuestionTopic (join table) -------------------------------------------------
CREATE POLICY "question_topic: owner only"
  ON "QuestionTopic"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Question"
      JOIN "Course" ON "Course"."id" = "Question"."courseId"
      WHERE "Question"."id" = "QuestionTopic"."questionId"
        AND "Course"."userId" = auth_user_id()
    )
  );

-- StudySession ---------------------------------------------------------------
CREATE POLICY "study_session: owner only"
  ON "StudySession"
  FOR ALL
  TO authenticated
  USING      ("userId" = auth_user_id())
  WITH CHECK ("userId" = auth_user_id());

-- QuestionAttempt ------------------------------------------------------------
CREATE POLICY "question_attempt: owner only"
  ON "QuestionAttempt"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "QuestionAttempt"."sessionId"
        AND "StudySession"."userId" = auth_user_id()
    )
  );

-- MasteryScore ---------------------------------------------------------------
CREATE POLICY "mastery_score: owner only"
  ON "MasteryScore"
  FOR ALL
  TO authenticated
  USING      ("userId" = auth_user_id())
  WITH CHECK ("userId" = auth_user_id());

-- Document -------------------------------------------------------------------
CREATE POLICY "document: owner only"
  ON "Document"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Course"
      WHERE "Course"."id" = "Document"."courseId"
        AND "Course"."userId" = auth_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- No anon policies are added — unauthenticated REST requests are blocked.
-- ---------------------------------------------------------------------------
