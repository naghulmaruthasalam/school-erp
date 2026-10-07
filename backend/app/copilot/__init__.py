"""Copilot: the study + teaching assistant inside the ERP.

Adapted from the Skillorea Teacher Copilot backend (chat pipeline, safety gate, worksheet and lesson
plan generators) onto the ERP's own auth (CurrentUser / roles), database (Beanie) and syllabus data.

Layout
  llm.py        provider layer (Gemini by default, OpenAI optional) with retries and streaming
  safety.py     content-safety + on-topic gate that runs before the model sees a message
  grounding.py  curriculum context from the school's own syllabus (+ text of attached documents)
  profiles.py   one profile per role: persona, quick actions, modes and tools   <- add a role here
  features/     the tools (quiz, worksheet, lesson plan, ...)                    <- add a tool here
  service.py    chat pipeline for the two modes: "study" (curriculum) and "school" (ERP data)
  sessions.py   persisted, owner-scoped chat sessions
"""
