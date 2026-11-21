CREATE TABLE app_security_settings (
                                       id SMALLINT PRIMARY KEY CHECK (id = 1),

                                       owner_bootstrap_completed_at TIMESTAMP NULL,

                                       owner_bootstrap_completed_by BIGINT NULL,

                                       CONSTRAINT fk_owner_bootstrap_user
                                           FOREIGN KEY (owner_bootstrap_completed_by)
                                               REFERENCES app_users(id)
);

INSERT INTO app_security_settings (
    id,
    owner_bootstrap_completed_at,
    owner_bootstrap_completed_by
)
VALUES (1, NULL, NULL);