"""Feature (tool) plumbing. A feature is a spec the UI can render a form from plus an async handler."""
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.copilot.grounding import StudyContext
from app.core.deps import CurrentUser

Handler = Callable[[CurrentUser, "StudyContext | None", dict], Awaitable[dict]]


def field_spec(name: str, label: str, type: str = "text", *, required: bool = False, default: Any = None,
               options: list | None = None, min: int | None = None, max: int | None = None, help: str | None = None) -> dict:
    """type: text | textarea | number | select | date | dates (see the frontend's ToolForm)."""
    spec: dict[str, Any] = {"name": name, "label": label, "type": type, "required": required}
    for key, value in (("default", default), ("options", options), ("min", min), ("max", max), ("help", help)):
        if value is not None:
            spec[key] = value
    return spec


@dataclass(frozen=True)
class Feature:
    key: str
    title: str
    description: str
    icon: str  # lucide icon name the UI maps
    handler: Handler
    needs_context: bool = False  # needs class (+ subject + chapter) picked
    require_subject: bool = False
    require_chapter: bool = False
    fields: list[dict] = field(default_factory=list)

    def spec(self) -> dict:
        return {
            "key": self.key,
            "title": self.title,
            "description": self.description,
            "icon": self.icon,
            "needs_context": self.needs_context,
            "require_subject": self.require_subject,
            "require_chapter": self.require_chapter,
            "fields": self.fields,
        }
