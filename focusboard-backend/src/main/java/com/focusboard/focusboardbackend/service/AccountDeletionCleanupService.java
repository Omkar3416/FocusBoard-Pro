
package com.focusboard.focusboardbackend.service;

import com.focusboard.focusboardbackend.repository.TaskRepository;
import com.focusboard.focusboardbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountDeletionCleanupService {

    private final JdbcTemplate jdbcTemplate;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional
    public boolean permanentlyDeleteAccount(
            Long userId,
            UUID processingToken
    ) {

        String verificationSql = """
                SELECT id
                FROM app_users
                WHERE id = ?
                  AND deletion_processing_token = ?
                  AND deletion_requested_at IS NOT NULL
                  AND deletion_scheduled_at <= CURRENT_TIMESTAMP
                  AND deletion_processing_started_at IS NOT NULL
                  AND role IN ('USER', 'ADMIN')
                  AND enabled = FALSE
                FOR UPDATE
                """;

        List<Long> matchingUsers = jdbcTemplate.query(
                verificationSql,
                (rs, rowNum) -> rs.getLong("id"),
                userId,
                processingToken
        );

        if (matchingUsers.isEmpty()) {
            return false;
        }

        // Delete all tasks belonging to this user first.
        taskRepository.deleteAllByUserId(userId);

        // Delete the application account.
        userRepository.deleteById(userId);

        // Administrative audit logs are intentionally preserved.
        return true;
    }
}
