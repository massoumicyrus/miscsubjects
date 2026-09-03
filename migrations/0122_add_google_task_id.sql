-- Migration 0122: add google_task_id to tasks table for Google Tasks sync tracking
ALTER TABLE tasks ADD COLUMN google_task_id TEXT;
