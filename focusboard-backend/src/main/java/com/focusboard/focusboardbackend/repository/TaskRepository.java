
package com.focusboard.focusboardbackend.repository;

import com.focusboard.focusboardbackend.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, Long> {

    // Get active tasks belonging to a particular user
    @Query("""
            SELECT t FROM Task t
            WHERE t.user.id = :userId
            AND t.deletedAt IS NULL
            """)
    List<Task> findAllByUser_Id(@Param("userId") Long userId);

    // Get active tasks ordered by date and start time
    @Query("""
            SELECT t FROM Task t
            WHERE t.user.id = :userId
            AND t.deletedAt IS NULL
            ORDER BY t.taskDate ASC, t.startTime ASC
            """)
    List<Task> findAllByUser_IdOrderByTaskDateAscStartTimeAsc(
            @Param("userId") Long userId
    );

    // Find all active tasks older than the specified cutoff date.
// Includes both completed and pending tasks.
    @Query("""
        SELECT t FROM Task t
        WHERE t.user.id = :userId
        AND t.taskDate < :cutoffDate
        AND t.deletedAt IS NULL
        ORDER BY t.taskDate ASC, t.startTime ASC
        """)
    List<Task> findAllActiveTasksOlderThan(
            @Param("userId") Long userId,
            @Param("cutoffDate") LocalDate cutoffDate
    );

    // Get active tasks belonging to a user on a particular date
    @Query("""
            SELECT t FROM Task t
            WHERE t.user.id = :userId
            AND t.taskDate = :taskDate
            AND t.deletedAt IS NULL
            ORDER BY t.startTime ASC
            """)
    List<Task> findAllByUser_IdAndTaskDateOrderByStartTimeAsc(
            @Param("userId") Long userId,
            @Param("taskDate") LocalDate taskDate
    );

    // Find an active task belonging to a particular user
    @Query("""
            SELECT t FROM Task t
            WHERE t.id = :taskId
            AND t.user.id = :userId
            AND t.deletedAt IS NULL
            """)
    Optional<Task> findByIdAndUser_Id(
            @Param("taskId") Long taskId,
            @Param("userId") Long userId
    );

    // Find all active occurrences in a recurring series
    List<Task> findAllByRecurrenceGroupIdAndUser_IdAndDeletedAtIsNull(
            UUID recurrenceGroupId,
            Long userId
    );

    // Find temporarily deleted tasks belonging to a deletion batch
    List<Task> findAllByDeletionBatchIdAndUser_IdAndDeletedAtIsNotNull(
            UUID deletionBatchId,
            Long userId
    );

    // Count active tasks belonging to a particular user
    long countByUser_IdAndDeletedAtIsNull(Long userId);

    // Count completed active tasks belonging to a particular user
    long countByUser_IdAndCompletedTrueAndDeletedAtIsNull(Long userId);

    // Permanently delete expired temporarily deleted tasks
    @Modifying
    @Query("""
            DELETE FROM Task t
            WHERE t.deletedAt IS NOT NULL
            AND t.deletedAt <= :cutoff
            """)
    int permanentlyDeleteExpiredTasks(
            @Param("cutoff") LocalDateTime cutoff
    );

    // Permanently delete all tasks belonging to a user.
    // This also removes temporarily deleted tasks during account deletion.
    @Modifying
    @Query("DELETE FROM Task t WHERE t.user.id = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);
}
