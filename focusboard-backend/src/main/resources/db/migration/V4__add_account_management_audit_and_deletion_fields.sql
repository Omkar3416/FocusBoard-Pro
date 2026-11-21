
-- Add account status and identity snapshots to administrative audit logs.
ALTER TABLE admin_audit_logs
    ADD COLUMN previous_enabled BOOLEAN,
    ADD COLUMN new_enabled BOOLEAN,
    ADD COLUMN actor_name VARCHAR(100),
    ADD COLUMN actor_email VARCHAR(150),
    ADD COLUMN target_name VARCHAR(100),
    ADD COLUMN target_email VARCHAR(150),
    ADD COLUMN scheduled_deletion_at TIMESTAMP;

-- Track pending permanent deletion on each account.
ALTER TABLE app_users
    ADD COLUMN deletion_requested_at TIMESTAMP NULL,
    ADD COLUMN deletion_scheduled_at TIMESTAMP NULL;

-- Both deletion timestamps must either be present or absent.
ALTER TABLE app_users
    ADD CONSTRAINT ck_app_users_deletion_schedule_pair
        CHECK (
            (deletion_requested_at IS NULL)
                =
            (deletion_scheduled_at IS NULL)
            );

-- Efficiently find accounts whose deletion date has arrived.
CREATE INDEX idx_app_users_pending_deletion
    ON app_users (deletion_scheduled_at)
    WHERE deletion_scheduled_at IS NOT NULL;
