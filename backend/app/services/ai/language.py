"""Which language an AI generator must write in (the request says "english"/"arabic", or en/ar)."""


def language_directive(language: str | None) -> str:
    arabic = str(language or "").strip().lower().startswith(("ar", "ع"))
    if arabic:
        return ("\n\nOUTPUT LANGUAGE: write every sentence of your answer in Arabic (العربية), whatever language the source material "
                "is in. Keep numbers, formulas and JSON keys as specified. Translate the material's ideas, do not copy English text.")
    return ("\n\nOUTPUT LANGUAGE: write every sentence of your answer in English, whatever language the source material is in "
            "(translate Arabic source text). Keep JSON keys as specified.")


def with_language(system_prompt: str, language: str | None) -> str:
    return system_prompt + language_directive(language)
