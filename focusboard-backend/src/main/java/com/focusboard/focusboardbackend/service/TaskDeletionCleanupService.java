
package com.focusboard.focusboardbackend.service;

import com.focusboard.focusboardbackend.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskDeletionCleanupService {

    private final TaskRepository taskRepository;

    // Permanently delete tasks after their five-minute undo period expires.
    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void permanentlyDeleteExpiredTasks() {

        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(5);

        int deletedCount =
                taskRepository.permanentlyDeleteExpiredTasks(cutoff);

        if (deletedCount > 0) {
            log.info(
                    "Permanently deleted {} expired task(s)",
                    deletedCount
            );
        }
    }
}
