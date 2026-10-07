"""Server-side PDF rendering (worksheets, lesson plans, question papers, grading reports).

HTML + self-hosted KaTeX + bundled fonts are printed to a vector PDF by headless Chromium (Playwright) in a
separate process. Install the browser with `playwright install --with-deps chromium` (the Docker image does).
"""
