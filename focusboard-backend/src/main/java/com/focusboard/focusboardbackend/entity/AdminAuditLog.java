
package com.focusboard.focusboardbackend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "target_user_id", nullable = false)
    private Long targetUserId;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(name = "previous_role", length = 20)
    private String previousRole;

    @Column(name = "new_role", length = 20)
    private String newRole;

    @Column(name = "previous_enabled")
    private Boolean previousEnabled;

    @Column(name = "new_enabled")
    private Boolean newEnabled;

    @Column(name = "actor_name", length = 100)
    private String actorName;

    @Column(name = "actor_email", length = 150)
    private String actorEmail;

    @Column(name = "target_name", length = 100)
    private String targetName;

    @Column(name = "target_email", length = 150)
    private String targetEmail;

    @Column(name = "scheduled_deletion_at")
    private LocalDateTime scheduledDeletionAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
