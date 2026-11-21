
package com.focusboard.focusboardbackend.repository;

import com.focusboard.focusboardbackend.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    // Get all tasks belonging to a particular user
    List<Task> findAllByUser_Id(Long userId);

    // Get tasks belonging to a user, ordered by date and start time
    List<Task> findAllByUser_IdOrderByTaskDateAscStartTimeAsc(Long userId);

    // Get tasks belonging to a user on a particular date
    List<Task> findAllByUser_IdAndTaskDateOrderByStartTimeAsc(
            Long userId,
            LocalDate taskDate
    );

    // Find a particular task belonging to a particular user
    Optional<Task> findByIdAndUser_Id(Long taskId, Long userId);

    // Delete a task only when it belongs to the specified user
    void deleteByIdAndUser_Id(Long taskId, Long userId);

    // Count tasks belonging to a particular user
    long countByUser_Id(Long userId);

    // Count completed tasks belonging to a particular user
    long countByUser_IdAndCompletedTrue(Long userId);

    // Permanently delete all tasks belonging to a user
    @Modifying
    @Query("DELETE FROM Task t WHERE t.user.id = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);
}
