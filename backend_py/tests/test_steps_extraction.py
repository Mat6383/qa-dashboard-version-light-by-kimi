"""Tests for GitLab notes → Testmo steps extraction (Routine B)."""

from __future__ import annotations

from typing import Any


from app.services.sync_mapper import extract_steps_from_notes


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _assert_step_text1(step: dict, expected_substring: str) -> None:
    assert expected_substring in step["text1"], f"Expected {expected_substring!r} in {step['text1']!r}"


# ------------------------------------------------------------------
# Cases ported from backend/tests/calculations/steps.test.ts
# ------------------------------------------------------------------


def test_no_section_returns_empty() -> None:
    notes = [{"body": "Simple commentaire sans balise."}]
    assert extract_steps_from_notes(notes) == []


def test_empty_notes_returns_empty() -> None:
    assert extract_steps_from_notes([]) == []


def test_prerequis_then_test_order() -> None:
    body = "[PRÉREQUIS]\nAvoir un compte.\n[TEST]\nFaire le test."
    steps = extract_steps_from_notes([{"body": body}])
    assert len(steps) == 2
    _assert_step_text1(steps[0], "[PRÉREQUIS]")
    _assert_step_text1(steps[1], "[TEST]")
    assert steps[0]["display_order"] == 1
    assert steps[1]["display_order"] == 2


def test_test_first_impact_last() -> None:
    body = "[TEST]\nEtapes.\n[IMPACT]\nScript R14."
    steps = extract_steps_from_notes([{"body": body}])
    assert len(steps) == 2
    _assert_step_text1(steps[0], "[IMPACT]")
    _assert_step_text1(steps[1], "[TEST]")


def test_tests_plural_also_last() -> None:
    body = "[PRÉREQUIS]\nPré.\n[TESTS]\nTest pluriel."
    steps = extract_steps_from_notes([{"body": body}])
    assert steps[-1]["text1"].count("[TESTS]") >= 1


def test_all_steps_have_expected_text3() -> None:
    body = "[PRÉREQUIS]\nPré.\n[TEST]\nTest."
    steps = extract_steps_from_notes([{"body": body}])
    for s in steps:
        assert s["text3"] == "<p>Conforme aux specs fonctionnelles</p>"


def test_text1_non_empty_and_has_fields() -> None:
    body = "[PRÉREQUIS]\nAvoir un client.\n[TEST]\nFaire la manip."
    steps = extract_steps_from_notes([{"body": body}])
    for s in steps:
        assert s["text1"].strip()
        assert "text3" in s
        assert "display_order" in s


def test_longest_note_for_non_test_all_tests_collected() -> None:
    notes = [
        {"body": "[TEST]\nCourt."},
        {"body": "[PRÉREQUIS]\nLong prérequis avec beaucoup de texte.\n[TEST]\nTest long avec beaucoup d'étapes."},
    ]
    steps = extract_steps_from_notes(notes)
    assert len(steps) == 3
    _assert_step_text1(steps[0], "[PRÉREQUIS]")
    _assert_step_text1(steps[1], "Court")
    _assert_step_text1(steps[2], "Test long")


def test_markdown_link_not_a_false_step() -> None:
    body = """[TEST]
Passer le script [R14.sql](https://gitlab.neo-logix.fr/blob/master/SQL/R14.sql)

> Atelier > OF
Ouvrir un OF qui est état lancé

[IMPACT]
FEN_OF
FEN_PLANNING_DAY"""
    steps = extract_steps_from_notes([{"body": body}])
    assert len(steps) == 2
    test_step = [s for s in steps if "[TEST]" in s["text1"]]
    assert len(test_step) == 1
    assert "R14.sql" in test_step[0]["text1"]
    assert "[TEST]" in steps[-1]["text1"]


def test_real_r14_note_three_steps_test_last() -> None:
    body = """[PRÉREQUIS]
Tester avant de passer le script R14.
Avoir un client avec compte-poids.
[TEST]
Pour générer des mouvement de compte-poids prévisionnels :
Trouver un client sur compte-poids.
Vente → Commande → Nouvelle commande sur ce client.
[IMPACT]
Script R14."""
    steps = extract_steps_from_notes([{"body": body}])
    assert len(steps) == 3
    _assert_step_text1(steps[0], "[PRÉREQUIS]")
    _assert_step_text1(steps[1], "[IMPACT]")
    _assert_step_text1(steps[2], "[TEST]")


def test_two_notes_two_tests_chronological() -> None:
    notes = [
        {"body": "[PRÉREQUIS]\nPré requis ici.\n[TEST]\nTest de la note 1."},
        {"body": "[TEST]\nTest de la note 2."},
    ]
    steps = extract_steps_from_notes(notes)
    assert len(steps) == 3
    _assert_step_text1(steps[0], "[PRÉREQUIS]")
    _assert_step_text1(steps[1], "Test de la note 1")
    _assert_step_text1(steps[2], "Test de la note 2")


def test_older_test_included_even_if_not_longest() -> None:
    notes = [
        {"body": "[TEST]\nPremier test (ancien)."},
        {"body": "[PRÉREQUIS]\nPré.\n[IMPACT]\nImpact.\n[TEST]\nTest complet."},
    ]
    steps = extract_steps_from_notes(notes)
    assert len(steps) == 4
    _assert_step_text1(steps[0], "[PRÉREQUIS]")
    _assert_step_text1(steps[1], "[IMPACT]")
    _assert_step_text1(steps[2], "Premier test")
    _assert_step_text1(steps[3], "Test complet")


def test_three_notes_three_tests_chronological() -> None:
    notes = [
        {"body": "[TEST]\nTest A."},
        {"body": "[TEST]\nTest B."},
        {"body": "[TEST]\nTest C."},
    ]
    steps = extract_steps_from_notes(notes)
    assert len(steps) == 3
    _assert_step_text1(steps[0], "Test A")
    _assert_step_text1(steps[1], "Test B")
    _assert_step_text1(steps[2], "Test C")


def test_note_without_test_plus_note_with_test() -> None:
    notes = [
        {"body": "[PRÉREQUIS]\nPré.\n[IMPACT]\nImpact."},
        {"body": "[TEST]\nTest récent."},
    ]
    steps = extract_steps_from_notes(notes)
    assert len(steps) == 3
    _assert_step_text1(steps[0], "[PRÉREQUIS]")
    _assert_step_text1(steps[1], "[IMPACT]")
    _assert_step_text1(steps[2], "Test récent")


def test_tests_plural_in_secondary_note_collected() -> None:
    notes = [
        {"body": "[PRÉREQUIS]\nPré.\n[TEST]\nTest principal."},
        {"body": "[TESTS]\nCorrection de test."},
    ]
    steps = extract_steps_from_notes(notes)
    assert len(steps) == 3
    _assert_step_text1(steps[0], "[PRÉREQUIS]")
    _assert_step_text1(steps[1], "Test principal")
    _assert_step_text1(steps[2], "Correction de test")


# ------------------------------------------------------------------
# Additional Python-specific edge cases
# ------------------------------------------------------------------


def test_note_with_body_none_ignored() -> None:
    notes: list[dict[str, Any]] = [
        {"body": None},
        {"body": "[TEST]\nValid."},
    ]
    steps = extract_steps_from_notes(notes)
    assert len(steps) == 1


def test_empty_content_section_discarded() -> None:
    body = "[PRÉREQUIS]\n\n[TEST]\nContent."
    steps = extract_steps_from_notes([{"body": body}])
    assert len(steps) == 1
    _assert_step_text1(steps[0], "[TEST]")
