
package com.focusboard.focusboardbackend.controller;

import com.focusboard.focusboardbackend.dto.RecurringTaskRequest;
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

import java.time.LocalDate;
import java.util.List;

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

    // Get all tasks belonging to the logged-in user
    @GetMapping
    public ResponseEntity<List<TaskResponse>> getAllTasks(
            @AuthenticationPrincipal AppUser currentUser
    ) {

        List<TaskResponse> tasks = taskService.getAllTasks(
                currentUser.getId()
        );

        return ResponseEntity.ok(tasks);
    }

    // Get tasks for a particular date
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

    // Get a specific task by ID
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

    // Update an existing task
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

    // Delete a task
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long id
    ) {

        taskService.deleteTask(
                id,
                currentUser.getId()
        );

        return ResponseEntity.noContent().build();
    }
}
