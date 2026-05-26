package com.taskflow.project.scheduler;

import com.taskflow.project.constant.enums.SprintStatus;
import com.taskflow.project.entity.Sprint;
import com.taskflow.project.repository.SprintRepository;
import com.taskflow.project.service.SprintSnapshotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class SprintScheduler {

    private final SprintRepository sprintRepository;
    private final SprintSnapshotService snapshotService;

    /**
     * Mỗi 10 phút quét sprint:
     *   - PLANNING tới start_date → ACTIVE (nếu project chưa có ACTIVE khác)
     *   - ACTIVE quá end_date → CLOSED
     */
    @Scheduled(cron = "0 */10 * * * *")
    @Transactional
    public void rolloverSprints() {
        long now = System.currentTimeMillis();

        List<Sprint> active = sprintRepository.findByStatusAndDeletedFalse(SprintStatus.ACTIVE);
        int closed = 0;
        Set<Long> projectsWithActive = new HashSet<>();
        for (Sprint s : active) {
            if (s.getEndDate() != null && s.getEndDate() < now) {
                s.setStatus(SprintStatus.CLOSED);
                snapshotService.applySnapshot(s);
                sprintRepository.save(s);
                closed++;
            } else {
                projectsWithActive.add(s.getProjectId());
            }
        }

        List<Sprint> planning = sprintRepository.findByStatusAndDeletedFalse(SprintStatus.PLANNING);
        int activated = 0;
        for (Sprint s : planning) {
            if (s.getStartDate() == null || s.getStartDate() > now) continue;
            if (s.getEndDate() != null && s.getEndDate() < now) continue;
            if (projectsWithActive.contains(s.getProjectId())) continue;
            s.setStatus(SprintStatus.ACTIVE);
            sprintRepository.save(s);
            projectsWithActive.add(s.getProjectId());
            activated++;
        }

        if (closed > 0 || activated > 0) {
            log.info("Sprint rollover: closed={}, activated={}", closed, activated);
        }
    }
}
