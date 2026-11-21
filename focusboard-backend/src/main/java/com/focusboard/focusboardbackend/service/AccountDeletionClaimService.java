
package com.focusboard.focusboardbackend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountDeletionClaimService {

    private final JdbcTemplate jdbcTemplate;

    public record DeletionClaim(
            Long userId,
            String firebaseUid,
            UUID processingToken
    ) {}

    @Transactional
    public Optional<DeletionClaim> claimNextDueDeletion() {

        UUID processingToken = UUID.randomUUID();

        String sql = """
                WITH candidate AS (
                    SELECT id
                    FROM app_users
                    WHERE deletion_requested_at IS NOT NULL
                      AND deletion_scheduled_at <= CURRENT_TIMESTAMP
                      AND role IN ('USER', 'ADMIN')
                      AND enabled = FALSE
                      AND (
                          deletion_processing_token IS NULL
                          OR deletion_processing_lease_until <= CURRENT_TIMESTAMP
                      )
                    ORDER BY deletion_scheduled_at, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                UPDATE app_users u
                SET deletion_processing_started_at =
                        COALESCE(
                            u.deletion_processing_started_at,
                            CURRENT_TIMESTAMP
                        ),
                    deletion_processing_token = ?,
                    deletion_processing_lease_until =
                        CURRENT_TIMESTAMP + INTERVAL '5 minutes',
                    deletion_attempt_count = u.deletion_attempt_count + 1,
                    deletion_last_error = NULL,
                    updated_at = CURRENT_TIMESTAMP
                FROM candidate c
                WHERE u.id = c.id
                RETURNING u.id, u.firebase_uid
                """;

        List<DeletionClaim> claims = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new DeletionClaim(
                        rs.getLong("id"),
                        rs.getString("firebase_uid"),
                        processingToken
                ),
                processingToken
        );

        return claims.stream().findFirst();
    }
}
