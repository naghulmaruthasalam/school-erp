"""AI services for teacher copilot features."""
from app.services.ai.gemini_client import (
    generate,
    generate_vision,
    GeminiError,
    GeminiNotConfigured,
)
from app.services.ai.homework_validator import (
    validate_text_homework,
    validate_image_homework,
    get_quick_feedback,
    HomeworkValidationResult,
)
from app.services.ai.lesson_plan_generator import (
    extract_topics,
    generate_lesson_plan,
    LessonPlanResponse,
)
from app.services.ai.question_paper_generator import (
    generate_question_paper,
    generate_worksheet,
    QuestionPaper,
)

__all__ = [
    "generate",
    "generate_vision",
    "GeminiError",
    "GeminiNotConfigured",
    "validate_text_homework",
    "validate_image_homework",
    "get_quick_feedback",
    "HomeworkValidationResult",
    "extract_topics",
    "generate_lesson_plan",
    "LessonPlanResponse",
    "generate_question_paper",
    "generate_worksheet",
    "QuestionPaper",
]
