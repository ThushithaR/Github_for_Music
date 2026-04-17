from services.audio import convert_to_wav, hash_audio, save_blob

with open("sample.webm", "rb") as f:
    webm = f.read()

wav = convert_to_wav(webm)
h = hash_audio(wav)
path = save_blob(h, wav)

print("OK:", path)