-- Align quiz-question image Storage permissions with the quiz module.
-- Active administrators and teachers share the same module-level permissions.
DROP POLICY IF EXISTS "Quiz question images upload by quiz owner" ON storage.objects;
CREATE POLICY "Quiz question images upload by active staff"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quiz-question-images'
  AND EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.is_active = true
      AND p.role IN ('admin', 'teacher')
  )
);

DROP POLICY IF EXISTS "Quiz question images delete by quiz owner" ON storage.objects;
CREATE POLICY "Quiz question images delete by active staff"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'quiz-question-images'
  AND EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.is_active = true
      AND p.role IN ('admin', 'teacher')
  )
);

DROP POLICY IF EXISTS "Quiz question images view by eligible users" ON storage.objects;
CREATE POLICY "Quiz question images view by eligible users"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'quiz-question-images'
  AND (
    EXISTS (
      SELECT 1
      FROM public.user_profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.is_active = true
        AND p.role IN ('admin', 'teacher')
    )
    OR EXISTS (
      SELECT 1
      FROM public.learning_quizzes q
      JOIN public.user_profiles p ON p.user_id = (SELECT auth.uid())
      WHERE q.id::text = (storage.foldername(objects.name))[1]
        AND p.is_active = true
        AND p.role = 'student'
        AND (
          (
            q.status = 'published'
            AND (q.available_from IS NULL OR q.available_from <= now())
            AND (q.available_until IS NULL OR q.available_until > now())
            AND (q.target_form_level IS NULL OR q.target_form_level = p.form_level)
          )
          OR EXISTS (
            SELECT 1
            FROM public.quiz_attempts qa
            WHERE qa.quiz_id = q.id
              AND qa.student_id = p.user_id
          )
        )
    )
  )
);
