package com.focusboard.focusboardbackend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountDeletionFailureService {

    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void recordFailure(
            Long userId,
            UUID processingToken,
            Exception exception
    ) {

        String errorMessage = exception.getMessage();

        if (errorMessage == null || errorMessage.isBlank()) {
            errorMessage = exception.getClass().getSimpleName();
        }

        // Keep the stored error message within a reasonable length.
        if (errorMessage.length() > 1000) {
            errorMessage = errorMessage.substring(0, 1000);
        }

        String sql = """
                UPDATE app_users
                SET deletion_last_error = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND deletion_processing_token = ?
                  AND deletion_requested_at IS NOT NULL
                  AND deletion_processing_started_at IS NOT NULL
                """;

        jdbcTemplate.update(
                sql,
                errorMessage,
                userId,
                processingToken
        );
    }
}