
package com.focusboard.focusboardbackend.repository;

import com.focusboard.focusboardbackend.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByFirebaseUid(String firebaseUid);

    Optional<AppUser> findByEmail(String email);

    List<AppUser> findAllByOrderByCreatedAtDesc();

    boolean existsByFirebaseUid(String firebaseUid);

    boolean existsByEmail(String email);
}
