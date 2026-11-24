
package com.focusboard.focusboardbackend.controller;

import com.focusboard.focusboardbackend.dto.RecurringTaskRequest;
import com.focusboard.focusboardbackend.dto.TaskDeletionResponse;
import com.focusboard.focusboardbackend.dto.TaskRequest;
import com.focusboard.focusboardbackend.dto.TaskResponse;
import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.focusboard.focusboardbackend.dto.OldTasksDeletionPreviewResponse;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    // Create a single task
    @PostMapping
    public ResponseEntity<TaskResponse> createTask(
            @AuthenticationPrincipal AppUser currentUser,
            @Valid @RequestBody TaskRequest request
    ) {

        TaskResponse response = taskService.createTask(
                currentUser.getId(),
                request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // Create recurring tasks
    @PostMapping("/recurring")
    public ResponseEntity<List<TaskResponse>> createRecurringTasks(
            @AuthenticationPrincipal AppUser currentUser,
            @Valid @RequestBody RecurringTaskRequest request
    ) {

        List<TaskResponse> responses =
                taskService.createRecurringTasks(
                        currentUser.getId(),
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(responses);
    }

    // Preview old tasks eligible for bulk deletion
    @GetMapping("/old-tasks/preview")
    public ResponseEntity<OldTasksDeletionPreviewResponse> previewOldTasksDeletion(
            @AuthenticationPrincipal AppUser currentUser
    ) {

        OldTasksDeletionPreviewResponse response =
                taskService.previewOldTasksDeletion(
                        currentUser.getId()
                );

        return ResponseEntity.ok(response);
    }

    // Get all active tasks belonging to the logged-in user
    @GetMapping
    public ResponseEntity<List<TaskResponse>> getAllTasks(
            @AuthenticationPrincipal AppUser currentUser
    ) {

        List<TaskResponse> tasks = taskService.getAllTasks(
                currentUser.getId()
        );

        return ResponseEntity.ok(tasks);
    }

    // Get active tasks for a particular date
    @GetMapping("/date")
    public ResponseEntity<List<TaskResponse>> getTasksByDate(
            @AuthenticationPrincipal AppUser currentUser,
            @RequestParam LocalDate taskDate
    ) {

        List<TaskResponse> tasks = taskService.getTasksByDate(
                currentUser.getId(),
                taskDate
        );

        return ResponseEntity.ok(tasks);
    }

    // Get a specific active task by ID
    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> getTaskById(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long id
    ) {

        TaskResponse task = taskService.getTaskById(
                id,
                currentUser.getId()
        );

        return ResponseEntity.ok(task);
    }

    // Update an existing active task
    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> updateTask(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest request
    ) {

        TaskResponse updatedTask = taskService.updateTask(
                id,
                currentUser.getId(),
                request
        );

        return ResponseEntity.ok(updatedTask);
    }

    // Temporarily delete all eligible old tasks
    @DeleteMapping("/old-tasks")
    public ResponseEntity<TaskDeletionResponse> deleteOldTasks(
            @AuthenticationPrincipal AppUser currentUser
    ) {

        TaskDeletionResponse response = taskService.deleteOldTasks(
                currentUser.getId()
        );

        return ResponseEntity.ok(response);
    }

    // Temporarily delete one task occurrence
    @DeleteMapping("/{id}")
    public ResponseEntity<TaskDeletionResponse> deleteTask(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long id
    ) {

        TaskDeletionResponse response = taskService.deleteTask(
                id,
                currentUser.getId()
        );

        return ResponseEntity.ok(response);
    }

    // Temporarily delete an entire recurring series
    @DeleteMapping("/{id}/series")
    public ResponseEntity<TaskDeletionResponse> deleteTaskSeries(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long id
    ) {

        TaskDeletionResponse response = taskService.deleteTaskSeries(
                id,
                currentUser.getId()
        );

        return ResponseEntity.ok(response);
    }

    // Undo a temporary deletion
    @PostMapping("/deletions/{batchId}/undo")
    public ResponseEntity<Integer> undoDeletion(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable UUID batchId
    ) {

        int restoredCount = taskService.undoDeletion(
                batchId,
                currentUser.getId()
        );

        return ResponseEntity.ok(restoredCount);
    }
}
