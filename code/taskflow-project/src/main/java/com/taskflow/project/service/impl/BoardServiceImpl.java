package com.taskflow.project.service.impl;

import com.taskflow.common.exception.NotFoundException;
import com.taskflow.events.RoutingKeys;
import com.taskflow.events.dto.ProjectEvents;
import com.taskflow.project.constant.enums.Role;
import com.taskflow.project.dto.request.BoardRequest;
import com.taskflow.project.dto.request.ListRequest;
import com.taskflow.project.dto.request.ReorderListsRequest;
import com.taskflow.project.dto.response.BoardResponse;
import com.taskflow.project.dto.response.ListResponse;
import com.taskflow.project.entity.Board;
import com.taskflow.project.entity.BoardList;
import com.taskflow.project.mapper.ProjectMapper;
import com.taskflow.project.messaging.ProjectEventPublisher;
import com.taskflow.project.repository.BoardListRepository;
import com.taskflow.project.repository.BoardRepository;
import com.taskflow.project.service.AuthorizationService;
import com.taskflow.project.service.BoardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BoardServiceImpl implements BoardService {

    private final BoardRepository boardRepository;
    private final BoardListRepository listRepository;
    private final ProjectMapper mapper;
    private final ProjectEventPublisher publisher;
    private final AuthorizationService authz;

    @Override
    @Transactional
    public BoardResponse create(Long callerId, Long projectId, BoardRequest req) {
        authz.requireRole(projectId, callerId, Role.EDITOR);

        Board b = new Board();
        b.setProjectId(projectId);
        b.setName(req.getName());
        b.setDescription(req.getDescription());
        b.setColor(req.getColor());
        // position = max + 1
        b.setPosition(boardRepository.findByProjectIdAndDeletedFalseOrderByPositionAsc(projectId).size());
        b = boardRepository.save(b);

        publisher.publish(RoutingKeys.BOARD_CREATED, callerId,
                ProjectEvents.BoardCreated.builder()
                        .boardId(b.getId()).projectId(projectId)
                        .name(b.getName()).color(b.getColor()).build());

        return mapper.toResponse(b);
    }

    @Override
    public List<BoardResponse> listForProject(Long callerId, Long projectId) {
        authz.requireMember(projectId, callerId);
        return boardRepository.findByProjectIdAndDeletedFalseOrderByPositionAsc(projectId).stream()
                .map(mapper::toResponse).toList();
    }

    @Override
    public BoardResponse get(Long callerId, Long boardId) {
        Board b = loadBoard(boardId);
        authz.requireMember(b.getProjectId(), callerId);
        BoardResponse resp = mapper.toResponse(b);
        var lists = listRepository.findByBoardIdAndDeletedFalseOrderByPositionAsc(boardId).stream()
                .map(mapper::toResponse).toList();
        resp.setLists(lists);
        return resp;
    }

    @Override
    @Transactional
    public BoardResponse update(Long callerId, Long boardId, BoardRequest req) {
        Board b = loadBoard(boardId);
        authz.requireRole(b.getProjectId(), callerId, Role.EDITOR);
        b.setName(req.getName());
        b.setDescription(req.getDescription());
        b.setColor(req.getColor());
        return mapper.toResponse(boardRepository.save(b));
    }

    @Override
    @Transactional
    public void delete(Long callerId, Long boardId) {
        Board b = loadBoard(boardId);
        authz.requireRole(b.getProjectId(), callerId, Role.ADMIN);
        b.setDeleted(true);
        boardRepository.save(b);

        publisher.publish(RoutingKeys.BOARD_DELETED, callerId,
                ProjectEvents.BoardDeleted.builder()
                        .boardId(boardId).projectId(b.getProjectId()).build());
    }

    @Override
    @Transactional
    public ListResponse createList(Long callerId, Long boardId, ListRequest req) {
        Board b = loadBoard(boardId);
        authz.requireRole(b.getProjectId(), callerId, Role.EDITOR);

        List<BoardList> existing = listRepository.findByBoardIdAndDeletedFalseOrderByPositionAsc(boardId);
        int targetPos;
        if (req.getPosition() == null || req.getPosition() < 0 || req.getPosition() >= existing.size()) {
            targetPos = existing.size();
        } else {
            targetPos = req.getPosition();
            for (BoardList existingList : existing) {
                if (existingList.getPosition() >= targetPos) {
                    existingList.setPosition(existingList.getPosition() + 1);
                    listRepository.save(existingList);
                }
            }
        }

        BoardList l = new BoardList();
        l.setBoardId(boardId);
        l.setName(req.getName());
        l.setDescription(req.getDescription());
        l.setPosition(targetPos);
        l = listRepository.save(l);

        publisher.publish(RoutingKeys.LIST_CREATED, callerId,
                ProjectEvents.ListCreated.builder()
                        .listId(l.getId()).boardId(boardId).projectId(b.getProjectId())
                        .name(l.getName()).build());

        return mapper.toResponse(l);
    }

    @Override
    @Transactional
    public ListResponse updateList(Long callerId, Long listId, ListRequest req) {
        BoardList l = loadList(listId);
        Board b = loadBoard(l.getBoardId());
        authz.requireRole(b.getProjectId(), callerId, Role.EDITOR);
        l.setName(req.getName());
        l.setDescription(req.getDescription());
        return mapper.toResponse(listRepository.save(l));
    }

    @Override
    @Transactional
    public void deleteList(Long callerId, Long listId) {
        BoardList l = loadList(listId);
        Board b = loadBoard(l.getBoardId());
        authz.requireRole(b.getProjectId(), callerId, Role.EDITOR);
        l.setDeleted(true);
        listRepository.save(l);

        publisher.publish(RoutingKeys.LIST_DELETED, callerId,
                ProjectEvents.ListDeleted.builder()
                        .listId(listId).boardId(l.getBoardId()).projectId(b.getProjectId()).build());
    }

    @Override
    @Transactional
    public List<ListResponse> reorderLists(Long callerId, Long boardId, ReorderListsRequest req) {
        Board b = loadBoard(boardId);
        authz.requireRole(b.getProjectId(), callerId, Role.EDITOR);

        for (var item : req.getItems()) {
            BoardList l = loadList(item.getId());
            if (!l.getBoardId().equals(boardId)) {
                throw new com.taskflow.common.exception.BadRequestException("list_not_in_board");
            }
            l.setPosition(item.getPosition());
            listRepository.save(l);
        }
        return listRepository.findByBoardIdAndDeletedFalseOrderByPositionAsc(boardId).stream()
                .map(mapper::toResponse).toList();
    }

    private Board loadBoard(Long id) {
        return boardRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> NotFoundException.of("Board", id));
    }

    private BoardList loadList(Long id) {
        return listRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> NotFoundException.of("List", id));
    }
}
