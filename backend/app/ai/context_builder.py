from app.core.deps import CurrentUser
from app.core.enums import Role
from app.ai import prompts


async def build_system_prompt(current: CurrentUser) -> str:
    school_name = "Cogniitec AI School ERP"
    if current.school_id:
        from app.models.tenant import Tenant

        tenant = await Tenant.get(current.school_id)
        if tenant:
            school_name = tenant.name

    name = current.user.full_name
    match current.role:
        case Role.STUDENT:
            return prompts.student_system_prompt(school_name, name)
        case Role.PARENT:
            return prompts.parent_system_prompt(school_name, name)
        case Role.TEACHER:
            return prompts.teacher_system_prompt(school_name, name)
        case Role.PRINCIPAL:
            return prompts.principal_system_prompt(school_name, name)
        case Role.SCHOOL_ADMIN:
            return prompts.admin_system_prompt(school_name, name)
        case Role.SUPER_ADMIN:
            return prompts.super_admin_system_prompt(name)
        case _:
            return prompts.admin_system_prompt(school_name, name)
