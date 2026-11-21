package com.focusboard.focusboardbackend.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccountDeletionScheduler {

    private static final Logger log =
            LoggerFactory.getLogger(AccountDeletionScheduler.class);

    private final AccountDeletionWorker deletionWorker;

    @Scheduled(fixedDelay = 60000)
    public void processDueAccountDeletions() {
        try {
            deletionWorker.processNextDeletion();
        } catch (Exception exception) {
            log.error(
                    "Unexpected error while running account deletion worker",
                    exception
            );
        }
    }
}