-- Remove the old constraint that only permits ADMIN and USER.
ALTER TABLE app_users
DROP CONSTRAINT IF EXISTS app_users_role_check;

-- Allow all three application roles.
ALTER TABLE app_users
ADD CONSTRAINT app_users_role_check
CHECK (role IN ('OWNER', 'ADMIN', 'USER'));

-- Guarantee that only one account can have the OWNER role.
CREATE UNIQUE INDEX ux_app_users_single_owner
ON app_users (role)
WHERE role = 'OWNER';
