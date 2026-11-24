-- Support temporary task deletion and five-minute undo.
ALTER TABLE tasks
    ADD COLUMN deleted_at TIMESTAMP NULL,
    ADD COLUMN deletion_batch_id UUID NULL;

-- Both deletion fields must either be present or absent.
ALTER TABLE tasks
    ADD CONSTRAINT ck_tasks_deletion_fields_pair
        CHECK (
            (deleted_at IS NULL)
                =
            (deletion_batch_id IS NULL)
            );

-- Efficiently find active tasks belonging to a user.
CREATE INDEX idx_tasks_active_user_date
    ON tasks (user_id, task_date)
    WHERE deleted_at IS NULL;

-- Efficiently find tasks belonging to a deletion batch.
CREATE INDEX idx_tasks_deletion_batch
    ON tasks (deletion_batch_id)
    WHERE deletion_batch_id IS NOT NULL;