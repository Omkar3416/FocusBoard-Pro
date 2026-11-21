
package com.focusboard.focusboardbackend.repository;

import com.focusboard.focusboardbackend.entity.AdminAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditLogRepository
        extends JpaRepository<AdminAuditLog, Long> {
}
