
-- Preserve the account's original enabled status before deletion.
ALTER TABLE app_users
    ADD COLUMN deletion_previous_enabled BOOLEAN;

-- Mark when irreversible permanent-deletion processing begins.
ALTER TABLE app_users
    ADD COLUMN deletion_processing_started_at TIMESTAMP NULL;

-- Identify the worker currently processing an account deletion.
ALTER TABLE app_users
    ADD COLUMN deletion_processing_token UUID NULL;

-- Allow recovery if a deletion worker crashes.
ALTER TABLE app_users
    ADD COLUMN deletion_processing_lease_until TIMESTAMP NULL;

-- Track retry attempts and the most recent processing error.
ALTER TABLE app_users
    ADD COLUMN deletion_attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN deletion_last_error TEXT NULL;

-- Original enabled status must exist whenever deletion is pending.
ALTER TABLE app_users
    ADD CONSTRAINT ck_app_users_deletion_previous_enabled
        CHECK (
            (deletion_requested_at IS NULL)
                =
            (deletion_previous_enabled IS NULL)
            );

-- A processing token and its lease must be set or cleared together.
ALTER TABLE app_users
    ADD CONSTRAINT ck_app_users_deletion_processing_lease
        CHECK (
            (deletion_processing_token IS NULL)
                =
            (deletion_processing_lease_until IS NULL)
            );

-- Processing cannot start without a deletion request.
ALTER TABLE app_users
    ADD CONSTRAINT ck_app_users_deletion_processing_requested
        CHECK (
            deletion_processing_started_at IS NULL
                OR deletion_requested_at IS NOT NULL
            );

-- Retry count cannot be negative.
ALTER TABLE app_users
    ADD CONSTRAINT ck_app_users_deletion_attempt_count
        CHECK (deletion_attempt_count >= 0);
