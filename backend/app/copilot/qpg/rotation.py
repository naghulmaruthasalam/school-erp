"""Shuffle-bag draw: every question in a bucket is used once before any repeats (ported from Skillorea's rotation_repo).

Growing the bank needs no migration: on every draw the stored order is reconciled with the live candidate ids, retired
ids are dropped and new ones are spliced into the untraversed tail at random positions.
"""
import random

from app.models.copilot_qpg import RotationState


def _reconcile(order: list[str], cursor: int, candidate_set: set[str]) -> tuple[list[str], int]:
    stored_set = set(order)
    seen = [qid for qid in order[:cursor] if qid in candidate_set]
    upcoming = [qid for qid in order[cursor:] if qid in candidate_set]
    new_ids = list(candidate_set - stored_set)
    random.shuffle(new_ids)
    upcoming.extend(new_ids)
    random.shuffle(upcoming)
    return seen + upcoming, len(seen)


def advance_rotation(
    order: list[str] | None, cursor: int, cycle: int, candidate_ids: list[str], count: int
) -> tuple[list[str], list[str], int, int]:
    """Draw up to `count` ids, preferring ones not yet drawn this cycle. Returns (drawn, order, cursor, cycle).
    Never returns more ids than there are candidates and never repeats an id within one call."""
    candidate_set = set(candidate_ids)
    if not candidate_set or count <= 0:
        return [], order or [], cursor, cycle
    count = min(count, len(candidate_set))
    if order is None:
        order = list(candidate_set)
        random.shuffle(order)
        cursor = 0
    else:
        order, cursor = _reconcile(order, cursor, candidate_set)
    drawn: list[str] = []
    remaining = count
    while remaining > 0:
        piece = order[cursor:cursor + remaining]
        drawn.extend(piece)
        cursor += len(piece)
        remaining -= len(piece)
        if remaining > 0:  # this cycle is used up: reshuffle, without what this same paper already has
            pool = list(candidate_set - set(drawn))
            random.shuffle(pool)
            order, cursor, cycle = pool, 0, cycle + 1
    return drawn, order, cursor, cycle


async def draw(school_id: str, user_id: str, class_id: str, subject_id: str, chapter: str, qtype: str,
               candidate_ids: list[str], count: int) -> list[str]:
    """advance_rotation, with the state kept in the database per teacher and bucket."""
    state = await RotationState.find_one(
        RotationState.school_id == school_id, RotationState.user_id == user_id, RotationState.class_id == class_id,
        RotationState.subject_id == subject_id, RotationState.chapter == chapter, RotationState.question_type == qtype,
    )
    drawn, order, cursor, cycle = advance_rotation(
        state.order if state else None, state.cursor if state else 0, state.cycle if state else 0, candidate_ids, count
    )
    if state is None:
        state = RotationState(school_id=school_id, user_id=user_id, class_id=class_id, subject_id=subject_id,
                              chapter=chapter, question_type=qtype)
    state.order, state.cursor, state.cycle = order, cursor, cycle
    await state.save()
    return drawn
