from dataclasses import replace

from fastapi.testclient import TestClient

from app.main import create_app


def test_call_flow(settings):
    client = TestClient(create_app(settings))
    r = client.post("/calls")
    assert r.status_code == 200 and "Lotus Family Clinic" in r.json()["reply"]
    cid = r.json()["id"]
    r = client.post(f"/calls/{cid}/turn", json={"text": "Dr. Rao on Wednesday, my name is Kiran Das"})
    assert r.status_code == 200 and len(r.json()["offered"]) == 2
    r = client.post(f"/calls/{cid}/turn", json={"text": "the first one"})
    assert r.json()["booking"]["doctor"] == "Dr. Kavya Rao"
    r = client.post(f"/calls/{cid}/turn", json={"text": "no thanks, bye"})
    assert r.json()["ended"] and r.json()["summary"]["outcome"] == "booked"
    assert client.post(f"/calls/{cid}/turn", json={"text": "hello?"}).status_code == 409
    assert client.get(f"/calls/{cid}").json()["ended"]


def test_validation_and_missing(settings):
    client = TestClient(create_app(settings))
    assert client.post("/calls/nope/turn", json={"text": "hi"}).status_code == 404
    cid = client.post("/calls").json()["id"]
    assert client.post(f"/calls/{cid}/turn", json={"text": "   "}).status_code == 422
    assert client.post(f"/calls/{cid}/turn", json={"text": "x" * 401}).status_code == 422
    assert client.get("/health").json() == {"ok": True, "live": False, "speech": False}


def test_token(settings):
    client = TestClient(create_app(replace(settings, token="s3cret")))
    assert client.post("/calls").status_code == 401
    assert client.post("/calls", headers={"x-voice-token": "s3cret"}).status_code == 200


class FakeTranscriber:
    def __init__(self, text="Dr. Rao on Wednesday", seconds=2.0, error=None):
        self.text, self.seconds, self.error, self.hints = text, seconds, error, []

    async def transcribe(self, audio, filename, hint):
        self.hints.append(hint)
        if self.error:
            raise self.error
        return self.text, self.seconds


def test_transcribe(settings):
    fake = FakeTranscriber()
    client = TestClient(create_app(settings, transcriber=fake))
    r = client.post("/transcribe", files={"audio": ("a.webm", b"\x1a" * 2000, "audio/webm")}, data={"hint": "about"})
    assert r.status_code == 200 and r.json()["text"] == "Dr. Rao on Wednesday" and fake.hints == ["about"]
    r = client.post("/transcribe", files={"audio": ("a.webm", b"x" * (settings.clip_max_bytes + 1), "audio/webm")})
    assert r.status_code == 413


def test_transcribe_offline_and_busy(settings):
    from app.stt import SttBusy
    assert TestClient(create_app(settings)).post(
        "/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}).status_code == 503
    client = TestClient(create_app(settings, transcriber=FakeTranscriber(error=SttBusy("429"))))
    assert client.post("/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}).status_code == 503


def test_silence_phrases_are_dropped():
    from app.stt import clean
    assert clean(" Thank you. ") == "" and clean("you") == "" and clean("Thank you, book it") == "Thank you, book it"


def test_samples_file_is_fresh_and_results_only():
    import asyncio
    from scripts.samples import OUT, build, render
    fresh = render(asyncio.run(build()))
    assert OUT.read_text(encoding="utf-8") == fresh, "run: python -m scripts.samples"
    low = fresh.lower()
    for secret in ("rules", "model", "prompt", "groq", "unsure", "source"):
        assert secret not in low, secret
