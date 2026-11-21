package com.focusboard.focusboardbackend.service;

import com.google.firebase.auth.FirebaseAuthException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccountDeletionWorker {

    private static final Logger log =
            LoggerFactory.getLogger(AccountDeletionWorker.class);

    private final AccountDeletionClaimService claimService;
    private final FirebaseAccountDeletionService firebaseDeletionService;
    private final AccountDeletionCleanupService cleanupService;
    private final AccountDeletionFailureService failureService;

    public void processNextDeletion() {

        // Step 1: Claim one eligible account.
        var optionalClaim = claimService.claimNextDueDeletion();

        if (optionalClaim.isEmpty()) {
            return;
        }

        var claim = optionalClaim.get();

        try {

            // Step 2: Delete the Firebase Authentication user.
            firebaseDeletionService.deleteFirebaseUser(
                    claim.firebaseUid()
            );

            // Step 3: Delete PostgreSQL tasks and application account.
            boolean deleted = cleanupService.permanentlyDeleteAccount(
                    claim.userId(),
                    claim.processingToken()
            );

            if (deleted) {
                log.info(
                        "Permanent account deletion completed. User ID={}",
                        claim.userId()
                );
            } else {
                log.warn(
                        "Account deletion cleanup skipped because claim validation failed. User ID={}",
                        claim.userId()
                );
            }

        } catch (Exception exception) {

            // Step 4: Record failure for a later retry.
            try {
                failureService.recordFailure(
                        claim.userId(),
                        claim.processingToken(),
                        exception
                );
            } catch (Exception recordingException) {
                log.error(
                        "Unable to record account deletion failure. User ID={}",
                        claim.userId()
                );
            }

            log.error(
                    "Permanent account deletion failed. User ID={}",
                    claim.userId()
            );
        }
    }
}