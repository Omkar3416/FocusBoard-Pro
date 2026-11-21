
package com.focusboard.focusboardbackend.service;

import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.enums.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@Service
public class OwnerBootstrapService {

    private final JdbcTemplate jdbcTemplate;
    private final String bootstrapSecret;

    public OwnerBootstrapService(
            JdbcTemplate jdbcTemplate,
            @Value("${app.security.owner-bootstrap-secret:}")
            String bootstrapSecret
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.bootstrapSecret = bootstrapSecret;
    }

    @Transactional
    public void bootstrapOwner(
            AppUser currentUser,
            String suppliedSecret
    ) {

        // 1. Require a configured bootstrap secret.
        if (bootstrapSecret == null || bootstrapSecret.isBlank()) {
            throw new IllegalStateException(
                    "Owner provisioning is not configured"
            );
        }

        // 2. Verify the supplied secret without logging it.
        if (suppliedSecret == null || suppliedSecret.isBlank()
                || !MessageDigest.isEqual(
                bootstrapSecret.getBytes(StandardCharsets.UTF_8),
                suppliedSecret.getBytes(StandardCharsets.UTF_8)
        )) {
            throw new AccessDeniedException(
                    "Invalid owner provisioning credentials"
            );
        }

        // 3. Only an existing, enabled ADMIN can perform initial setup.
        if (currentUser == null
                || !currentUser.isEnabled()
                || currentUser.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException(
                    "Only an enabled ADMIN can perform initial owner provisioning"
            );
        }

        // 4. Lock the single bootstrap-settings row.
        // This prevents two simultaneous bootstrap requests.
        Map<String, Object> settings = jdbcTemplate.queryForMap(
                """
                SELECT owner_bootstrap_completed_at
                FROM app_security_settings
                WHERE id = 1
                FOR UPDATE
                """
        );

        if (settings.get("owner_bootstrap_completed_at") != null) {
            throw new IllegalStateException(
                    "Owner provisioning has already been completed"
            );
        }

        // Prevent concurrent user registration or role changes
// while initial OWNER provisioning is in progress.
        jdbcTemplate.execute(
                "LOCK TABLE app_users IN SHARE ROW EXCLUSIVE MODE"
        );

        // Initial provisioning is allowed only when this is
// the first and only registered application account.
        Integer userCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM app_users",
                Integer.class
        );

        if (userCount == null || userCount != 1) {
            throw new IllegalStateException(
                    "Initial owner provisioning requires exactly one registered account"
            );
        }

        // 5. Ensure an OWNER does not already exist.
        Integer ownerCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM app_users WHERE role = 'OWNER'",
                Integer.class
        );

        if (ownerCount == null || ownerCount != 0) {
            throw new IllegalStateException(
                    "An OWNER account already exists"
            );
        }

        // 6. Promote the authenticated database account atomically.
        int updatedUsers = jdbcTemplate.update(
                """
                UPDATE app_users
                SET role = 'OWNER',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND role = 'ADMIN'
                  AND enabled = TRUE
                """,
                currentUser.getId()
        );

        if (updatedUsers != 1) {
            throw new IllegalStateException(
                    "Unable to promote the authenticated account to OWNER"
            );
        }

        // 7. Permanently mark initial provisioning as completed.
        int updatedSettings = jdbcTemplate.update(
                """
                UPDATE app_security_settings
                SET owner_bootstrap_completed_at = CURRENT_TIMESTAMP,
                    owner_bootstrap_completed_by = ?
                WHERE id = 1
                  AND owner_bootstrap_completed_at IS NULL
                """,
                currentUser.getId()
        );

        if (updatedSettings != 1) {
            throw new IllegalStateException(
                    "Unable to complete owner provisioning"
            );
        }
    }
}
