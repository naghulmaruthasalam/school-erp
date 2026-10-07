#!/usr/bin/env bash
# Attaches the chapter video lessons in ./media to Class 6 Social Studies, chapter 1 (English + Arabic), in every school that has it.
set -euo pipefail
cd "$(dirname "$0")/backend"
. .venv/bin/activate
python -m scripts.attach_chapter_videos --grade 6 --subject "Social Studies" --unit 1 --en ../media/social6_ch1_en.mp4 --ar ../media/social6_ch1_ar.mp4
