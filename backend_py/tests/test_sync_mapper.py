"""Tests for GitLab → Testmo sync mapper."""

from __future__ import annotations

import pytest

from app.services.sync_mapper import (
    build_run_name,
    build_run_url,
    build_testmo_test,
    map_issue_to_testmo_status,
)


class TestMapIssueToTestmoStatus:
    def test_closed_issue_is_passed(self) -> None:
        issue = {"state": "closed", "labels": []}
        assert map_issue_to_testmo_status(issue) == "passed"

    def test_open_with_bug_label_is_failed(self) -> None:
        issue = {"state": "opened", "labels": ["Bug", "QA"]}
        assert map_issue_to_testmo_status(issue) == "failed"

    def test_open_with_test_todo_is_untested(self) -> None:
        issue = {"state": "opened", "labels": ["Test::TODO"]}
        assert map_issue_to_testmo_status(issue) == "untested"

    def test_open_with_blocked_label_is_blocked(self) -> None:
        issue = {"state": "opened", "labels": ["blocked"]}
        assert map_issue_to_testmo_status(issue) == "blocked"

    def test_open_with_wip_label_is_wip(self) -> None:
        issue = {"state": "opened", "labels": ["WIP"]}
        assert map_issue_to_testmo_status(issue) == "wip"

    def test_bug_priority_over_test_todo(self) -> None:
        issue = {"state": "opened", "labels": ["Test::TODO", "Bug"]}
        assert map_issue_to_testmo_status(issue) == "failed"

    def test_open_default_is_retest(self) -> None:
        issue = {"state": "opened", "labels": ["QA"]}
        assert map_issue_to_testmo_status(issue) == "retest"


class TestBuildTestmoTest:
    def test_basic_structure(self) -> None:
        issue = {
            "iid": 42,
            "title": "Authentification SSO",
            "description": "Test description",
            "web_url": "https://gitlab.example.com/issues/42",
            "labels": ["QA", "Test::TODO"],
            "time_estimate": 3600,
            "state": "opened",
        }
        test = build_testmo_test(issue, 63, folder="R10 - Run 1")

        assert test["key"] == "gitlab-63-42"
        assert test["name"] == "[#42] Authentification SSO"
        assert test["status"] == "untested"
        assert test["folder"] == "R10 - Run 1"
        assert any(f["name"] == "Issue URL" for f in test["fields"])
        assert any(f["name"] == "Labels" for f in test["fields"])
        assert any(f["name"] == "Time Estimate" for f in test["fields"])

    def test_long_description_truncated(self) -> None:
        issue = {
            "iid": 1,
            "title": "T",
            "description": "x" * 3000,
            "web_url": "",
            "labels": [],
            "state": "opened",
        }
        test = build_testmo_test(issue, 1)
        desc_field = next((f for f in test["fields"] if f["name"] == "Description"), None)
        assert desc_field is not None
        assert len(desc_field["value"]) < 3000
        assert "…" in desc_field["value"]

    def test_no_fields_when_empty(self) -> None:
        issue = {
            "iid": 1,
            "title": "T",
            "description": None,
            "web_url": "",
            "labels": [],
            "state": "opened",
        }
        test = build_testmo_test(issue, 1)
        assert "folder" not in test
        desc_field = next((f for f in test["fields"] if f["name"] == "Description"), None)
        assert desc_field is None


class TestBuildRunName:
    def test_without_version(self) -> None:
        assert build_run_name("R10 - Run 1") == "GitLab Sync — R10 - Run 1"

    def test_with_version(self) -> None:
        assert build_run_name("R10 - Run 1", "v2.3") == "GitLab Sync — R10 - Run 1 (vv2.3)"


class TestBuildRunUrl:
    def test_url_format(self, monkeypatch) -> None:
        monkeypatch.setattr(
            "app.services.sync_mapper.settings",
            type("S", (), {"testmo_url": "https://example.testmo.net"})(),
        )
        url = build_run_url(123)
        assert url == "https://example.testmo.net/automation/runs/123"
