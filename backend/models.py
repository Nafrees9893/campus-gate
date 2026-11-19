import re
from typing import Annotated
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints


def email_value(value):
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise ValueError("Enter a valid email address")
    return value.lower()


Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)
]
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=254),
    AfterValidator(email_value),
]
OptionalEmail = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=254),
    AfterValidator(lambda s: email_value(s) if s else ""),
]
Password = Annotated[str, Field(min_length=10, max_length=128)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorMessage(BaseModel):
    detail: str


class Login(Input):
    email: Email
    password: Annotated[str, Field(min_length=1, max_length=128)]


class Register(Input):
    name: Name
    email: Email
    password: Password
    admin_code: Annotated[str, Field(max_length=128)] = ""


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str


class Visitor(Input):
    name: Name
    email: OptionalEmail = ""
    phone: Annotated[
        str, StringConstraints(strip_whitespace=True, pattern=r"^[+0-9() .\-]{0,30}$")
    ] = ""
    organization: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=120)
    ] = ""


class VisitorOut(Visitor):
    id: int


class Host(Input):
    name: Name
    email: Email
    department: Name


class HostOut(Host):
    id: int


class Visit(Input):
    visitor_id: Annotated[int, Field(gt=0)]
    host_id: Annotated[int, Field(gt=0)]
    purpose: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=2, max_length=240)
    ]


class VisitOut(Visit):
    id: int
    check_in: str
    check_out: str | None
    visitor_name: str
    host_name: str
    department: str


class Report(BaseModel):
    total: int
    on_campus: int
    checked_out: int
    rows: list[VisitOut]
