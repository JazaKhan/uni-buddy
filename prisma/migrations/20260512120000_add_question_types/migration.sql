-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('WRITTEN', 'MULTIPLE_CHOICE', 'FILL_IN_BLANK');

-- AlterTable: add isArchived to Course
ALTER TABLE "Course" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add type/options/blanks/isAiGenerated to Question
ALTER TABLE "Question"
  ADD COLUMN "type" "QuestionType" NOT NULL DEFAULT 'WRITTEN',
  ADD COLUMN "options" JSONB,
  ADD COLUMN "blanks" JSONB,
  ADD COLUMN "isAiGenerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Document
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
