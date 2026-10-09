"""Riyah: one assistant that answers in the language it was spoken or typed to, by voice or text."""
import json

import pytest

from app.copilot import language as lang
from app.copilot import llm
from tests.test_copilot import as_student, fake, school  # noqa: F401


def events(body: str) -> list[dict]:
    return [json.loads(line[6:]) for line in body.split("\n\n") if line.startswith("data: ")]


def test_language_follows_the_script_of_the_message():
    assert lang.detect_script_language("ما هي عاصمة عمان؟") == "Arabic"
    assert lang.detect_script_language("What is photosynthesis?") == "English"
    assert lang.detect_script_language("प्रकाश संश्लेषण क्या है") == "Hindi"
    assert lang.detect_script_language("ஒளிச்சேர்க்கை என்றால் என்ன") == "Tamil"
    assert lang.detect_script_language("اشرح لي photosynthesis من فضلك") == "Arabic"  # a Latin word inside an Arabic sentence
    assert lang.detect_script_language("12 + 5") is None
    assert lang.resolve_reply_language("12 + 5", "auto", "Arabic") == "Arabic"  # nothing to detect: the session's language
    assert lang.resolve_reply_language("Hello", "auto", "Arabic") == "English"  # auto follows the message
    assert lang.resolve_reply_language("Hello", "Tamil", "Arabic") == "Tamil"  # an explicit choice wins
    assert lang.resolve_reply_language("Hello", "ar", None) == "Arabic"
    assert lang.name_from_code("ar-OM") == "Arabic" and lang.name_from_code("fr") == "French" and lang.name_from_code("xx") is None


@pytest.mark.asyncio
async def test_typed_messages_are_answered_in_the_language_they_were_written_in(client, school, fake):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"], "language": "English"})).json()["id"]
    r = await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "ما هي عملية البناء الضوئي؟"})
    assert r.json()["language"] == "Arabic" and "Reply language: Arabic" in [c for c in fake.calls if c[0] == "chat"][-1][1]
    await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "and in English please, what is a root?"})
    assert "Reply language: English" in [c for c in fake.calls if c[0] == "chat"][-1][1]  # the next message switches back by itself
    await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "what is a leaf?", "language": "Tamil"})
    assert "Reply language: Tamil" in [c for c in fake.calls if c[0] == "chat"][-1][1]  # unless the user chose a language


@pytest.fixture
def speech(monkeypatch):
    state = {"heard": {"text": "ما هي عاصمة عمان؟", "language": "ar"}, "audio": None, "mime": None}

    async def transcribe(audio, mime="audio/wav"):
        state["audio"], state["mime"] = audio, mime
        return state["heard"]

    async def synthesize(text, language="English"):
        state["spoken"] = (text, language)
        return b"RIFF....WAVEfake"

    monkeypatch.setattr(llm, "transcribe", transcribe)
    monkeypatch.setattr(llm, "synthesize", synthesize)
    return state


@pytest.mark.asyncio
async def test_a_spoken_question_is_transcribed_its_language_found_and_answered_in_it(client, school, fake, speech):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"], "language": "English"})).json()["id"]
    r = await client.post(f"/api/v1/copilot/sessions/{sid}/voice", files={"audio": ("speech.wav", b"RIFF" + b"\0" * 500, "audio/wav")})
    assert r.status_code == 200
    evs = events(r.text)
    assert evs[0] == {"type": "transcript", "text": "ما هي عاصمة عمان؟", "language": "Arabic", "code": "ar", "reply_language": "Arabic"}
    assert "".join(e["text"] for e in evs if e["type"] == "chunk") == "Hello there" and evs[-1]["type"] == "done"
    assert "Reply language: Arabic" in [c for c in fake.calls if c[0] == "stream"][-1][1]  # answered in the language that was spoken
    assert speech["mime"] == "audio/wav" and len(speech["audio"]) > 100
    saved = (await client.get(f"/api/v1/copilot/sessions/{sid}")).json()
    assert saved["messages"][-2]["content"] == "ما هي عاصمة عمان؟"  # the transcript is the user's message in the history

    speech["heard"] = {"text": "What is a seed?", "language": "en"}
    evs = events((await client.post(f"/api/v1/copilot/sessions/{sid}/voice", files={"audio": ("s.wav", b"RIFF" + b"\0" * 500, "audio/wav")})).text)
    assert evs[0]["language"] == "English" and "Reply language: English" in [c for c in fake.calls if c[0] == "stream"][-1][1]
    evs = events((await client.post(f"/api/v1/copilot/sessions/{sid}/voice", data={"language": "Hindi"}, files={"audio": ("s.wav", b"RIFF" + b"\0" * 500, "audio/wav")})).text)
    assert evs[0]["language"] == "English" and evs[0]["reply_language"] == "Hindi"  # heard English, but asked for Hindi


@pytest.mark.asyncio
async def test_voice_problems_are_explained_not_crashed(client, school, fake, speech):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "school"})).json()["id"]
    assert (await client.post(f"/api/v1/copilot/sessions/{sid}/voice", files={"audio": ("s.wav", b"x", "audio/wav")})).status_code == 422  # nothing recorded
    speech["heard"] = {"text": "  ", "language": "en"}
    evs = events((await client.post(f"/api/v1/copilot/sessions/{sid}/voice", files={"audio": ("s.wav", b"RIFF" + b"\0" * 500, "audio/wav")})).text)
    assert evs == [{"type": "error", "detail": "I could not hear anything. Please try again."}]

    async def broken(audio, mime="audio/wav"):
        raise llm.LLMError("down")

    llm.transcribe = broken
    evs = events((await client.post(f"/api/v1/copilot/sessions/{sid}/voice", files={"audio": ("s.wav", b"RIFF" + b"\0" * 500, "audio/wav")})).text)
    assert evs[0]["type"] == "error" and "try again" in evs[0]["detail"]


@pytest.mark.asyncio
async def test_speak_returns_audio_or_says_it_is_unavailable(client, school, fake, speech, monkeypatch):
    as_student()
    r = await client.post("/api/v1/copilot/speak", json={"text": "مرحبا", "language": "Arabic"})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/wav" and r.content.startswith(b"RIFF") and speech["spoken"] == ("مرحبا", "Arabic")

    async def broken(text, language="English"):
        raise llm.LLMError("no tts")

    monkeypatch.setattr(llm, "synthesize", broken)
    assert (await client.post("/api/v1/copilot/speak", json={"text": "hi", "language": "English"})).status_code == 503
    assert (await client.post("/api/v1/copilot/speak", json={"text": "", "language": "English"})).status_code == 422
    prof = (await client.get("/api/v1/copilot/profile")).json()
    assert prof["voice"] == {"stt": True, "tts": True}
    assert "Riyah" in (await client.post("/api/v1/copilot/sessions", json={"mode": "school"})).json()["messages"][0]["content"]


def test_wav_wrapper_produces_a_playable_header():
    wav = llm.wav_from_pcm(b"\0\0" * 2400, 24000)
    assert wav[:4] == b"RIFF" and wav[8:12] == b"WAVE" and len(wav) == 44 + 4800
