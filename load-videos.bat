@echo off
cd /d "%~dp0backend"
call .venv\Scripts\activate.bat
set /p SID=School id (shown by check-db.bat / load-textbooks.bat): 
python -m scripts.attach_chapter_videos %SID% --grade 6 --subject "Social Studies" --unit 1 --en ..\media\social6_ch1_en.mp4 --ar ..\media\social6_ch1_ar.mp4
pause
