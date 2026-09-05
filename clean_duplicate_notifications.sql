-- SQL script to purge duplicate notification records from Supabase
-- Run this in your Supabase SQL Editor to clean up existing duplicate notifications.

DELETE FROM notifications
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (
      user_id,
      type,
      COALESCE(data->>'taskId', ''),
      COALESCE(data->>'slot', ''),
      COALESCE(data->>'requestId', ''),
      title
    ) id
    FROM notifications
    ORDER BY
      user_id,
      type,
      COALESCE(data->>'taskId', ''),
      COALESCE(data->>'slot', ''),
      COALESCE(data->>'requestId', ''),
      title,
      created_at DESC
  ) keep_rows
);
