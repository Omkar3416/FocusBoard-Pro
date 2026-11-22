package com.focusboard.focusboardbackend.service;

import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.enums.UserRole;
import com.focusboard.focusboardbackend.repository.UserRepository;
import com.focusboard.focusboardbackend.dto.UserResponse;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.focusboard.focusboardbackend.dto.AccountDeletionResponse;
import java.time.LocalDateTime;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;




    // Register a new user or return an existing user
    public AppUser registerOrGetUser(
            String firebaseUid,
            String email,
            String name
    ) {

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        // First, check whether this Firebase identity already exists.
        AppUser existingUser = userRepository
                .findByFirebaseUid(firebaseUid)
                .orElse(null);

        if (existingUser != null) {

            // Pending deletion accounts must not regain access.
            if (existingUser.getDeletionRequestedAt() != null) {
                throw pendingDeletionException(existingUser);
            }

            if (!existingUser.isEnabled()) {
                throw new IllegalStateException(
                        "Your account has been disabled. Please contact the application owner."
                );
            }

            return existingUser;
        }

        // Check whether this email belongs to an older application account.
        AppUser existingEmailUser = userRepository
                .findByEmail(normalizedEmail)
                .orElse(null);

        if (existingEmailUser != null) {

            if (existingEmailUser.getDeletionRequestedAt() != null) {
                throw pendingDeletionException(existingEmailUser);
            }

            throw new IllegalStateException(
                    "An account with this email already exists. Please contact the application owner."
            );
        }

        // No existing account: create a fresh USER account.
        return createNewUser(
                firebaseUid,
                normalizedEmail,
                name
        );
    }

    // Build an appropriate message for accounts awaiting permanent deletion.
    private IllegalStateException pendingDeletionException(AppUser user) {

        if (user.getDeletionProcessingStartedAt() != null) {
            return new IllegalStateException(
                    "Your previous account is undergoing permanent deletion. "
                            + "You cannot register again using this email until the process is completed."
            );
        }

        String scheduledDate = user.getDeletionScheduledAt() != null
                ? user.getDeletionScheduledAt().toLocalDate().toString()
                : "the scheduled deletion date";

        return new IllegalStateException(
                "Your previous account was scheduled for permanent deletion by the application owner. "
                        + "The deletion is scheduled for " + scheduledDate + ". "
                        + "You cannot access or register again using this email while deletion is pending. "
                        + "Please contact the application owner for assistance."
        );
    }


    // Create a new application user
    private AppUser createNewUser(
            String firebaseUid,
            String email,
            String name
    ) {

        // Prevent duplicate email registration with another Firebase UID
        if (userRepository.existsByEmail(email)) {
            throw new IllegalStateException(
                    "An account with this email already exists"
            );
        }

        AppUser user = new AppUser();

        user.setFirebaseUid(firebaseUid);
        user.setEmail(email);
        user.setName(name);

        // Every newly registered user starts with USER role.
        // OWNER and ADMIN roles are assigned only through
        // secure administrative operations.
        user.setRole(UserRole.USER);

        user.setEnabled(true);

        return userRepository.save(user);
    }

    // Find an application user using Firebase UID
    @Transactional(readOnly = true)
    public AppUser getUserByFirebaseUid(String firebaseUid) {

        AppUser user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "User not found"
                        )
                );

        if (!user.isEnabled()) {
            throw new IllegalStateException(
                    "Your account has been disabled"
            );
        }

        return user;
    }

    // Find a user by database ID
    @Transactional(readOnly = true)
    public AppUser getUserById(Long userId) {

        return userRepository.findById(userId)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "User not found with ID: " + userId
                        )
                );
    }

    // Get all registered users (OWNER and ADMIN only)
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers(AppUser currentUser) {

        if (currentUser == null
                || !currentUser.isEnabled()
                || (currentUser.getRole() != UserRole.OWNER
                && currentUser.getRole() != UserRole.ADMIN)) {

            throw new org.springframework.security.access.AccessDeniedException(
                    "Only OWNER and ADMIN can view all users"
            );
        }

        return userRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(user -> new UserResponse(
                        user.getId(),
                        user.getName(),
                        user.getEmail(),
                        user.getRole(),
                        user.isEnabled(),
                        user.getCreatedAt(),
                        user.getDeletionRequestedAt(),
                        user.getDeletionScheduledAt(),
                        user.getDeletionProcessingStartedAt()
                ))
                .toList();
    }
    // Promote an enabled USER to ADMIN.
// Both OWNER and ADMIN can perform this operation.
    public UserResponse promoteUserToAdmin(
            AppUser currentUser,
            Long targetUserId
    ) {

        if (currentUser == null || currentUser.getId() == null) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Authentication is required"
            );
        }

        Long actorUserId = currentUser.getId();

        if (actorUserId.equals(targetUserId)) {
            throw new IllegalArgumentException(
                    "You cannot promote your own account"
            );
        }

        // Lock both accounts in ID order to prevent concurrent role changes.
        List<Map<String, Object>> lockedUsers = jdbcTemplate.queryForList(
                """
                        SELECT id, role, enabled, name, email
                        FROM app_users
                        WHERE id IN (?, ?)
                        ORDER BY id
                        FOR UPDATE
                """,
                actorUserId,
                targetUserId
        );

        Map<String, Object> actor = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == actorUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Acting user not found")
                );

        Map<String, Object> target = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == targetUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Target user not found")
                );

        String actorRole = String.valueOf(actor.get("role"));

        if (!Boolean.TRUE.equals(actor.get("enabled"))
                || (!"OWNER".equals(actorRole)
                && !"ADMIN".equals(actorRole))) {

            throw new org.springframework.security.access.AccessDeniedException(
                    "Only enabled OWNER or ADMIN accounts can promote users"
            );
        }

        String targetRole = String.valueOf(target.get("role"));

        if (!Boolean.TRUE.equals(target.get("enabled"))) {
            throw new IllegalStateException(
                    "A disabled user cannot be promoted"
            );
        }

        if (!"USER".equals(targetRole)) {
            throw new IllegalStateException(
                    "Only regular USER accounts can be promoted to ADMIN"
            );
        }

        // Update the target user's role.
        int updatedRows = jdbcTemplate.update(
                """
                UPDATE app_users
                SET role = 'ADMIN',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND role = 'USER'
                  AND enabled = TRUE
                """,
                targetUserId
        );

        if (updatedRows != 1) {
            throw new IllegalStateException(
                    "Unable to promote the selected user"
            );
        }

        // Record the action with complete audit snapshots.
        jdbcTemplate.update(
                """
                INSERT INTO admin_audit_logs (
                    actor_user_id,
                    target_user_id,
                    action,
                    previous_role,
                    new_role,
                    previous_enabled,
                    new_enabled,
                    actor_name,
                    actor_email,
                    target_name,
                    target_email
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                actorUserId,
                targetUserId,
                "PROMOTE_TO_ADMIN",
                "USER",
                "ADMIN",
                true,
                true,
                actor.get("name"),
                actor.get("email"),
                target.get("name"),
                target.get("email")
        );

        // Return the updated user details.
        AppUser updatedUser = getUserById(targetUserId);

        return new UserResponse(
                updatedUser.getId(),
                updatedUser.getName(),
                updatedUser.getEmail(),
                updatedUser.getRole(),
                updatedUser.isEnabled(),
                updatedUser.getCreatedAt(),
                updatedUser.getDeletionRequestedAt(),
                updatedUser.getDeletionScheduledAt(),
                updatedUser.getDeletionProcessingStartedAt()
        );
    }


    // Enable or disable a USER or ADMIN account according to permissions.
    public UserResponse updateUserStatus(
            AppUser currentUser,
            Long targetUserId,
            boolean enabled
    ) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Authentication is required"
            );
        }

        Long actorUserId = currentUser.getId();

        if (actorUserId.equals(targetUserId)) {
            throw new IllegalArgumentException(
                    "You cannot change your own account status"
            );
        }

        List<Map<String, Object>> lockedUsers = jdbcTemplate.queryForList(
                """
                SELECT id, role, enabled, name, email,
                       deletion_requested_at, deletion_scheduled_at
                FROM app_users
                WHERE id IN (?, ?)
                ORDER BY id
                FOR UPDATE
                """,
                actorUserId,
                targetUserId
        );

        Map<String, Object> actor = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == actorUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Acting user not found")
                );

        Map<String, Object> target = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == targetUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Target user not found")
                );

        String actorRole = String.valueOf(actor.get("role"));
        String targetRole = String.valueOf(target.get("role"));

        if (!Boolean.TRUE.equals(actor.get("enabled"))
                || (!"OWNER".equals(actorRole)
                && !"ADMIN".equals(actorRole))) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only enabled OWNER or ADMIN accounts can change account status"
            );
        }

        if ("OWNER".equals(targetRole)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "The OWNER account cannot be disabled or modified"
            );
        }

        if (!"OWNER".equals(actorRole) && !"USER".equals(targetRole)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "ADMIN can only enable or disable regular USER accounts"
            );
        }

        if (target.get("deletion_requested_at") != null
                || target.get("deletion_scheduled_at") != null) {
            throw new IllegalStateException(
                    "Cancel the pending deletion before changing account status"
            );
        }

        boolean previousEnabled = Boolean.TRUE.equals(target.get("enabled"));

        if (previousEnabled == enabled) {
            throw new IllegalStateException(
                    enabled
                            ? "This account is already enabled"
                            : "This account is already disabled"
            );
        }

        int updatedRows = jdbcTemplate.update(
                """
                UPDATE app_users
                SET enabled = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND role IN ('USER', 'ADMIN')
                  AND enabled = ?
                  AND deletion_requested_at IS NULL
                  AND deletion_scheduled_at IS NULL
                """,
                enabled,
                targetUserId,
                previousEnabled
        );

        if (updatedRows != 1) {
            throw new IllegalStateException(
                    "Unable to update the selected account status"
            );
        }

        String action;

        if (enabled) {
            action = "ENABLE_" + targetRole;
        } else {
            action = "DISABLE_" + targetRole;
        }

        jdbcTemplate.update(
                """
                INSERT INTO admin_audit_logs (
                    actor_user_id,
                    target_user_id,
                    action,
                    previous_role,
                    new_role,
                    previous_enabled,
                    new_enabled,
                    actor_name,
                    actor_email,
                    target_name,
                    target_email
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                actorUserId,
                targetUserId,
                action,
                targetRole,
                targetRole,
                previousEnabled,
                enabled,
                actor.get("name"),
                actor.get("email"),
                target.get("name"),
                target.get("email")
        );

        AppUser updatedUser = getUserById(targetUserId);

        return new UserResponse(
                updatedUser.getId(),
                updatedUser.getName(),
                updatedUser.getEmail(),
                updatedUser.getRole(),
                updatedUser.isEnabled(),
                updatedUser.getCreatedAt(),
                updatedUser.getDeletionRequestedAt(),
                updatedUser.getDeletionScheduledAt(),
                updatedUser.getDeletionProcessingStartedAt()
        );
    }

    // Request permanent account deletion with a 90-day grace period.
// Only OWNER can request deletion of USER or ADMIN accounts.
    public AccountDeletionResponse requestAccountDeletion(
            AppUser currentUser,
            Long targetUserId
    ) {

        if (currentUser == null || currentUser.getId() == null) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Authentication is required"
            );
        }

        Long actorUserId = currentUser.getId();

        if (actorUserId.equals(targetUserId)) {
            throw new IllegalArgumentException(
                    "You cannot request deletion of your own account"
            );
        }

        List<Map<String, Object>> lockedUsers = jdbcTemplate.queryForList(
                """
                SELECT id, role, enabled, name, email,
                       deletion_requested_at, deletion_scheduled_at
                FROM app_users
                WHERE id IN (?, ?)
                ORDER BY id
                FOR UPDATE
                """,
                actorUserId,
                targetUserId
        );

        Map<String, Object> actor = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == actorUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Acting user not found")
                );

        Map<String, Object> target = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == targetUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Target user not found")
                );

        String actorRole = String.valueOf(actor.get("role"));
        String targetRole = String.valueOf(target.get("role"));

        if (!Boolean.TRUE.equals(actor.get("enabled"))
                || !"OWNER".equals(actorRole)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only the enabled OWNER can request account deletion"
            );
        }

        if ("OWNER".equals(targetRole)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "The OWNER account cannot be deleted"
            );
        }

        if (!"USER".equals(targetRole) && !"ADMIN".equals(targetRole)) {
            throw new IllegalStateException("Invalid target account role");
        }

        if (target.get("deletion_requested_at") != null
                || target.get("deletion_scheduled_at") != null) {
            throw new IllegalStateException(
                    "This account already has a pending deletion request"
            );
        }

        LocalDateTime requestedAt = LocalDateTime.now();
        LocalDateTime scheduledAt = requestedAt.plusDays(90);

        int updatedRows = jdbcTemplate.update(
                """
                        UPDATE app_users
                                SET enabled = FALSE,
                                    deletion_previous_enabled = ?,
                                    deletion_requested_at = ?,
                                    deletion_scheduled_at = ?,
                                    deletion_processing_started_at = NULL,
                                    deletion_processing_token = NULL,
                                    deletion_processing_lease_until = NULL,
                                    deletion_attempt_count = 0,
                                    deletion_last_error = NULL,
                                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND role IN ('USER', 'ADMIN')
                  AND deletion_requested_at IS NULL
                  AND deletion_scheduled_at IS NULL
                """,
                target.get("enabled"),
                requestedAt,
                scheduledAt,
                targetUserId
        );

        if (updatedRows != 1) {
            throw new IllegalStateException(
                    "Unable to schedule account deletion"
            );
        }

        jdbcTemplate.update(
                """
                INSERT INTO admin_audit_logs (
                    actor_user_id,
                    target_user_id,
                    action,
                    previous_role,
                    new_role,
                    previous_enabled,
                    new_enabled,
                    actor_name,
                    actor_email,
                    target_name,
                    target_email,
                    scheduled_deletion_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                actorUserId,
                targetUserId,
                "REQUEST_DELETE_" + targetRole,
                targetRole,
                targetRole,
                target.get("enabled"),
                false,
                actor.get("name"),
                actor.get("email"),
                target.get("name"),
                target.get("email"),
                scheduledAt
        );

        AppUser updatedUser = getUserById(targetUserId);

        return new AccountDeletionResponse(
                updatedUser.getId(),
                updatedUser.getName(),
                updatedUser.getEmail(),
                updatedUser.getRole(),
                updatedUser.isEnabled(),
                updatedUser.getDeletionRequestedAt(),
                updatedUser.getDeletionScheduledAt()
        );
    }
    // Cancel a pending account deletion.
// Only OWNER can restore an account during its 90-day grace period.
    public AccountDeletionResponse cancelAccountDeletion(
            AppUser currentUser,
            Long targetUserId
    ) {

        if (currentUser == null || currentUser.getId() == null) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Authentication is required"
            );
        }

        Long actorUserId = currentUser.getId();

        if (actorUserId.equals(targetUserId)) {
            throw new IllegalArgumentException(
                    "You cannot cancel deletion of your own account"
            );
        }

        List<Map<String, Object>> lockedUsers = jdbcTemplate.queryForList(
                """
                        SELECT id, role, enabled, name, email,
                               deletion_requested_at, deletion_scheduled_at,
                               deletion_previous_enabled, deletion_processing_started_at
                FROM app_users
                WHERE id IN (?, ?)
                ORDER BY id
                FOR UPDATE
                """,
                actorUserId,
                targetUserId
        );



        Map<String, Object> actor = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == actorUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Acting user not found")
                );

        Map<String, Object> target = lockedUsers.stream()
                .filter(user ->
                        ((Number) user.get("id")).longValue() == targetUserId
                )
                .findFirst()
                .orElseThrow(() ->
                        new EntityNotFoundException("Target user not found")
                );



        String actorRole = String.valueOf(actor.get("role"));
        String targetRole = String.valueOf(target.get("role"));

        if (!Boolean.TRUE.equals(actor.get("enabled"))
                || !"OWNER".equals(actorRole)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only the enabled OWNER can cancel account deletion"
            );
        }

        if ("OWNER".equals(targetRole)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "OWNER account cannot have a pending deletion"
            );
        }

        if (!"USER".equals(targetRole) && !"ADMIN".equals(targetRole)) {
            throw new IllegalStateException("Invalid target account role");
        }

        Object requestedAt = target.get("deletion_requested_at");
        Object scheduledAt = target.get("deletion_scheduled_at");

        if (requestedAt == null || scheduledAt == null) {
            throw new IllegalStateException(
                    "This account does not have a pending deletion request"
            );
        }

        Object processingStartedAt = target.get("deletion_processing_started_at");

        if (processingStartedAt != null) {
            throw new IllegalStateException(
                    "Permanent deletion processing has already started and cannot be cancelled"
            );
        }

        Boolean previousEnabled = (Boolean) target.get("deletion_previous_enabled");

        if (previousEnabled == null) {
            throw new IllegalStateException(
                    "Original account status is missing; deletion cannot be safely cancelled"
            );
        }

        LocalDateTime scheduledDeletion =
                ((java.sql.Timestamp) scheduledAt).toLocalDateTime();


        int updatedRows = jdbcTemplate.update(
                """
                        UPDATE app_users
                        SET enabled = ?,
                            deletion_previous_enabled = NULL,
                            deletion_requested_at = NULL,
                            deletion_scheduled_at = NULL,
                            deletion_processing_token = NULL,
                            deletion_processing_lease_until = NULL,
                            deletion_attempt_count = 0,
                            deletion_last_error = NULL,
                            updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND role IN ('USER', 'ADMIN')
                  AND enabled = FALSE
                  AND deletion_requested_at IS NOT NULL
                  AND deletion_scheduled_at IS NOT NULL
                  AND deletion_processing_started_at IS NULL
                  AND deletion_scheduled_at > CURRENT_TIMESTAMP
                """,
                previousEnabled,
                targetUserId
        );

        if (updatedRows != 1) {
            throw new IllegalStateException(
                    "Unable to cancel the account deletion request"
            );
        }

        jdbcTemplate.update(
                """
                INSERT INTO admin_audit_logs (
                    actor_user_id,
                    target_user_id,
                    action,
                    previous_role,
                    new_role,
                    previous_enabled,
                    new_enabled,
                    actor_name,
                    actor_email,
                    target_name,
                    target_email,
                    scheduled_deletion_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                actorUserId,
                targetUserId,
                "CANCEL_DELETE_" + targetRole,
                targetRole,
                targetRole,
                false,
                previousEnabled,
                actor.get("name"),
                actor.get("email"),
                target.get("name"),
                target.get("email"),
                scheduledDeletion
        );

        AppUser updatedUser = getUserById(targetUserId);

        return new AccountDeletionResponse(
                updatedUser.getId(),
                updatedUser.getName(),
                updatedUser.getEmail(),
                updatedUser.getRole(),
                updatedUser.isEnabled(),
                updatedUser.getDeletionRequestedAt(),
                updatedUser.getDeletionScheduledAt()
        );
    }
}
