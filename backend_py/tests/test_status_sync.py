"""Tests for status_sync helpers ported from Node.js calculations/sync.test.ts."""

from __future__ import annotations


from app.services.status_sync import (
    ALL_TEST_LABELS,
    STATUS_ID_TO_NAME,
    STATUS_TO_GITLAB_STATUS,
    STATUS_TO_LABEL,
    build_comment_text,
    compute_label_changes,
    compute_status_change,
    is_comment_duplicate,
    GITLAB_STATUS_OK,
    GITLAB_STATUS_KO,
    GITLAB_STATUS_WIP,
    GITLAB_STATUS_RETEST,
    GITLAB_STATUS_TODO,
)


class TestAllTestLabels:
    def test_contains_expected_labels(self) -> None:
        assert "Test::OK" in ALL_TEST_LABELS
        assert "Test::KO" in ALL_TEST_LABELS
        assert "Test::WIP" in ALL_TEST_LABELS
        assert "Test::SKIPPED" in ALL_TEST_LABELS
        assert "Test::BLOCKED" in ALL_TEST_LABELS
        assert "DoubleTestNécessaire" in ALL_TEST_LABELS
        assert "Test::TODO" in ALL_TEST_LABELS


class TestStatusIdToName:
    def test_passed(self) -> None:
        assert STATUS_ID_TO_NAME[2] == "Passed"

    def test_failed(self) -> None:
        assert STATUS_ID_TO_NAME[3] == "Failed"

    def test_retest(self) -> None:
        assert STATUS_ID_TO_NAME[4] == "Retest"

    def test_wip(self) -> None:
        assert STATUS_ID_TO_NAME[8] == "WIP"

    def test_unknown_is_undefined(self) -> None:
        assert STATUS_ID_TO_NAME.get(99) is None

    def test_all_mapped_statuses_have_name(self) -> None:
        for sid in STATUS_TO_LABEL:
            assert STATUS_ID_TO_NAME.get(sid)


class TestBuildCommentText:
    def test_passed(self) -> None:
        text = build_comment_text("R10 - run 1", 2)
        assert text == "Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status Passed"

    def test_wip(self) -> None:
        text = build_comment_text("R14 - run 2", 8)
        assert text == "Commentaire ajouté automatiquement - Test sur le run: R14 - run 2 - Status WIP"

    def test_failed(self) -> None:
        text = build_comment_text("R10 - run 1", 3)
        assert text == "Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status Failed"

    def test_retest(self) -> None:
        text = build_comment_text("R10 - run 1", 4)
        assert text == "Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status Retest"

    def test_unknown_fallback(self) -> None:
        text = build_comment_text("R10 - run 1", 99)
        assert text == "Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status 99"

    def test_different_runs_distinct(self) -> None:
        assert build_comment_text("R10 - run 1", 2) != build_comment_text("R11 - run 1", 2)

    def test_same_run_different_status_distinct(self) -> None:
        assert build_comment_text("R10 - run 1", 8) != build_comment_text("R10 - run 1", 2)


class TestIsCommentDuplicate:
    def test_empty_list(self) -> None:
        assert is_comment_duplicate([], "text") is False

    def test_duplicate_found(self) -> None:
        assert is_comment_duplicate([{"body": "text"}], "text") is True

    def test_different_comment(self) -> None:
        assert is_comment_duplicate([{"body": "other"}], "text") is False

    def test_multiple_notes_one_match(self) -> None:
        notes = [
            {"body": "manual"},
            {"body": "text"},
            {"body": "other"},
        ]
        assert is_comment_duplicate(notes, "text") is True

    def test_wip_vs_passed_not_duplicate(self) -> None:
        wip = build_comment_text("R10 - run 1", 8)
        passed = build_comment_text("R10 - run 1", 2)
        assert is_comment_duplicate([{"body": wip}], passed) is False
        assert is_comment_duplicate([{"body": wip}], wip) is True

    def test_null_bodies_no_crash(self) -> None:
        notes = [{"body": None}, {"body": None}, {"body": "text"}]
        assert is_comment_duplicate(notes, "text") is True


class TestComputeLabelChanges:
    def test_no_label_plus_passed(self) -> None:
        result = compute_label_changes([], "Test::OK")
        assert result["add_label"] == "Test::OK"
        assert result["remove_labels"] == []
        assert result["action"] == "update"

    def test_no_label_plus_wip(self) -> None:
        result = compute_label_changes([], "Test::WIP")
        assert result["add_label"] == "Test::WIP"
        assert result["remove_labels"] == []

    def test_ko_to_passed(self) -> None:
        result = compute_label_changes(["Test::KO"], "Test::OK")
        assert result["add_label"] == "Test::OK"
        assert result["remove_labels"] == ["Test::KO"]
        assert result["action"] == "update"

    def test_todo_to_wip(self) -> None:
        result = compute_label_changes(["Test::TODO"], "Test::WIP")
        assert result["add_label"] == "Test::WIP"
        assert result["remove_labels"] == ["Test::TODO"]

    def test_doubletest_to_ko(self) -> None:
        result = compute_label_changes(["DoubleTestNécessaire"], "Test::KO")
        assert result["add_label"] == "Test::KO"
        assert result["remove_labels"] == ["DoubleTestNécessaire"]

    def test_already_ok_noop(self) -> None:
        result = compute_label_changes(["Test::OK"], "Test::OK")
        assert result["action"] == "noop"
        assert result["remove_labels"] == []

    def test_already_wip_noop(self) -> None:
        result = compute_label_changes(["Test::WIP"], "Test::WIP")
        assert result["action"] == "noop"

    def test_non_test_labels_ignored(self) -> None:
        result = compute_label_changes(["Test::KO", "Bug", "Sprint::R14"], "Test::OK")
        assert "Test::KO" in result["remove_labels"]
        assert "Bug" not in result["remove_labels"]
        assert "Sprint::R14" not in result["remove_labels"]

    def test_untested_skip(self) -> None:
        result = compute_label_changes(["Test::KO"], None)
        assert result["action"] == "skip"
        assert result["add_label"] is None

    def test_multiple_test_labels_removed(self) -> None:
        result = compute_label_changes(["Test::KO", "Test::WIP", "Bug"], "Test::OK")
        assert result["add_label"] == "Test::OK"
        assert "Test::KO" in result["remove_labels"]
        assert "Test::WIP" in result["remove_labels"]
        assert "Bug" not in result["remove_labels"]
        assert "Test::OK" not in result["remove_labels"]


class TestStatusToGitlabStatus:
    def test_passed_to_ok(self) -> None:
        assert STATUS_TO_GITLAB_STATUS[2] == GITLAB_STATUS_OK

    def test_failed_to_ko(self) -> None:
        assert STATUS_TO_GITLAB_STATUS[3] == GITLAB_STATUS_KO

    def test_retest_to_retest(self) -> None:
        assert STATUS_TO_GITLAB_STATUS[4] == GITLAB_STATUS_RETEST

    def test_wip_to_wip(self) -> None:
        assert STATUS_TO_GITLAB_STATUS[8] == GITLAB_STATUS_WIP

    def test_untested_undefined(self) -> None:
        assert STATUS_TO_GITLAB_STATUS.get(1) is None

    def test_unknown_567_undefined(self) -> None:
        for sid in (5, 6, 7):
            assert STATUS_TO_GITLAB_STATUS.get(sid) is None

    def test_mapped_truthy(self) -> None:
        for sid in (2, 3, 4, 8):
            assert STATUS_TO_GITLAB_STATUS[sid]


class TestComputeStatusChange:
    def test_different_status_update(self) -> None:
        result = compute_status_change(GITLAB_STATUS_TODO, GITLAB_STATUS_OK)
        assert result["new_status"] == GITLAB_STATUS_OK
        assert result["action"] == "update"

    def test_same_status_noop(self) -> None:
        result = compute_status_change(GITLAB_STATUS_OK, GITLAB_STATUS_OK)
        assert result["new_status"] == GITLAB_STATUS_OK
        assert result["action"] == "noop"

    def test_new_status_none_skip(self) -> None:
        result = compute_status_change(GITLAB_STATUS_OK, None)
        assert result["action"] == "skip"
        assert result["new_status"] is None

    def test_current_status_none_update(self) -> None:
        result = compute_status_change(None, GITLAB_STATUS_KO)
        assert result["action"] == "update"
