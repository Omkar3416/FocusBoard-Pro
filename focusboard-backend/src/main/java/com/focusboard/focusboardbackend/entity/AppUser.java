
package com.focusboard.focusboardbackend.entity;

import com.focusboard.focusboardbackend.enums.UserRole;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.UUID;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_users")
@Getter
@Setter
@NoArgsConstructor
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "firebase_uid", nullable = false, unique = true, length = 128)
    private String firebaseUid;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role = UserRole.USER;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deletion_requested_at")
    private LocalDateTime deletionRequestedAt;

    @Column(name = "deletion_scheduled_at")
    private LocalDateTime deletionScheduledAt;

    @Column(name = "deletion_previous_enabled")
    private Boolean deletionPreviousEnabled;

    @Column(name = "deletion_processing_started_at")
    private LocalDateTime deletionProcessingStartedAt;

    @Column(name = "deletion_processing_token")
    private UUID deletionProcessingToken;

    @Column(name = "deletion_processing_lease_until")
    private LocalDateTime deletionProcessingLeaseUntil;

    @Column(name = "deletion_attempt_count", nullable = false)
    private int deletionAttemptCount = 0;

    @Column(name = "deletion_last_error", columnDefinition = "TEXT")
    private String deletionLastError;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
