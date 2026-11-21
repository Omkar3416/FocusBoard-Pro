
package com.focusboard.focusboardbackend.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FirebaseAccountDeletionService {

    private final FirebaseApp firebaseApp;

    public void deleteFirebaseUser(String firebaseUid)
            throws FirebaseAuthException {

        FirebaseAuth firebaseAuth = FirebaseAuth.getInstance(firebaseApp);

        try {
            firebaseAuth.deleteUser(firebaseUid);

        } catch (FirebaseAuthException exception) {

            if (exception.getAuthErrorCode() == AuthErrorCode.USER_NOT_FOUND) {
                // The Firebase user is already deleted.
                // Treat this as success during retries.
                return;
            }

            throw exception;
        }
    }
}
